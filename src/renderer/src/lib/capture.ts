import { bitrateFor } from '@shared/quality'
import { computeCropRect, toEvenDimensions } from '@shared/region'
import type { AudioInputDevice, QualityPreset, Region, Size } from '@shared/types'
import { t } from '../i18n/es'

const VIDEO_MIME_CANDIDATES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
const AUDIO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  ...VIDEO_MIME_CANDIDATES
]

function isUserRejection(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  return /permission denied|notallowed|denied by the user|user denied|aborterror|selection cancelled|cancelled/i.test(
    `${error.name} ${error.message}`
  )
}

export async function acquireDisplayStream(fps: number, systemAudio = false): Promise<MediaStream> {
  const videoConstraints = {
    frameRate: { ideal: fps, max: fps }
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      audio: systemAudio,
      video: videoConstraints
    })
  } catch (error) {
    if (!systemAudio || isUserRejection(error)) {
      throw error
    }
    stream = await navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: videoConstraints
    })
  }

  const track = stream.getVideoTracks()[0]
  if (track) {
    await track.applyConstraints({ frameRate: { ideal: fps, max: fps } }).catch(() => undefined)
  }

  return stream
}

export async function acquireMicStream(deviceId = 'default'): Promise<MediaStream> {
  const baseAudio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }

  const useSpecificDevice = Boolean(deviceId && deviceId !== 'default')

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: useSpecificDevice ? { ...baseAudio, deviceId: { exact: deviceId } } : baseAudio,
      video: false
    })
  } catch (error) {
    const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
    if (
      useSpecificDevice &&
      /notfound|overconstrained|requested device not found/i.test(text)
    ) {
      return await navigator.mediaDevices.getUserMedia({
        audio: baseAudio,
        video: false
      })
    }
    if (/permission denied|notallowed|denied by the user|user denied/i.test(text)) {
      throw new Error('MIC_PERMISSION_DENIED')
    }
    throw new Error('MIC_UNAVAILABLE')
  }
}

export async function listAudioInputs(): Promise<AudioInputDevice[]> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.enumerateDevices !== 'function'
  ) {
    return []
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    let index = 0
    return devices
      .filter(
        (device) =>
          device.kind === 'audioinput' &&
          Boolean(device.deviceId) &&
          device.deviceId !== 'default'
      )
      .map((device) => {
        index += 1
        return {
          deviceId: device.deviceId,
          label: device.label.trim() || `Micrófono ${index}`
        }
      })
  } catch {
    return []
  }
}

export interface AudioPipelineOptions {
  displayStream: MediaStream
  systemAudio: boolean
  systemAudioGain?: number
  micStream: MediaStream | null
  micGain?: number
}

export interface AudioPipeline {
  track: MediaStreamTrack | null
  hasAudio: boolean
  getLevel: () => number
  stop: () => void
}

function clampGain(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1
  }
  return Math.min(4, Math.max(0.5, value))
}

export function createAudioPipeline(options: AudioPipelineOptions): AudioPipeline {
  const systemTracks = options.systemAudio ? (options.displayStream.getAudioTracks?.() ?? []) : []
  const micTracks = options.micStream?.getAudioTracks?.() ?? []

  const sysTrack = systemTracks[0] ?? null
  const micTrack = micTracks[0] ?? null

  if (!sysTrack && !micTrack) {
    return {
      track: null,
      hasAudio: false,
      getLevel: () => 0,
      stop: () => {
        stopStream(options.micStream)
      }
    }
  }

  if (typeof AudioContext === 'undefined') {
    const singleTrack = micTrack ?? sysTrack
    return {
      track: singleTrack,
      hasAudio: true,
      getLevel: () => 0,
      stop: () => {
        stopStream(options.micStream)
      }
    }
  }

  const ctx = new AudioContext()
  const destination = ctx.createMediaStreamDestination()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  analyser.smoothingTimeConstant = 0.5

  const nodes: Array<{ source: MediaStreamAudioSourceNode; gain: GainNode }> = []

  const attach = (track: MediaStreamTrack, gainValue: number | undefined): void => {
    const source = ctx.createMediaStreamSource(new MediaStream([track]))
    const gain = ctx.createGain()
    gain.gain.value = clampGain(gainValue)
    source.connect(gain)
    gain.connect(analyser)
    nodes.push({ source, gain })
  }

  if (sysTrack) {
    attach(sysTrack, options.systemAudioGain)
  }
  if (micTrack) {
    attach(micTrack, options.micGain)
  }

  analyser.connect(destination)

  const samples = new Float32Array(analyser.fftSize)
  let stopped = false

  const getLevel = (): number => {
    if (stopped) {
      return 0
    }
    analyser.getFloatTimeDomainData(samples)
    let sum = 0
    for (const sample of samples) {
      sum += sample * sample
    }
    const rms = Math.sqrt(sum / samples.length)
    return Math.min(1, rms * 3)
  }

  const mixedTrack = destination.stream.getAudioTracks()[0] ?? micTrack ?? sysTrack

  return {
    track: mixedTrack,
    hasAudio: true,
    getLevel,
    stop: () => {
      stopped = true
      for (const { source, gain } of nodes) {
        source.disconnect()
        gain.disconnect()
      }
      analyser.disconnect()
      stopStream(destination.stream)
      stopStream(options.micStream)
      void ctx.close().catch(() => undefined)
    }
  }
}

export function composeCaptureStream(
  videoStream: MediaStream,
  audioTrack: MediaStreamTrack | null
): MediaStream {
  const videoTracks = videoStream.getVideoTracks?.() ?? []
  const existingAudio = videoStream.getAudioTracks?.() ?? []

  if (!audioTrack && existingAudio.length === 0) {
    return videoStream
  }

  if (
    audioTrack &&
    existingAudio.length === 1 &&
    existingAudio[0] === audioTrack &&
    typeof MediaStream === 'undefined'
  ) {
    return videoStream
  }

  if (typeof MediaStream !== 'undefined') {
    return new MediaStream(audioTrack ? [...videoTracks, audioTrack] : [...videoTracks])
  }

  if (audioTrack && typeof videoStream.addTrack === 'function') {
    videoStream.addTrack(audioTrack)
  }
  return videoStream
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}

export function chooseMimeType(hasAudio = false): string {
  if (typeof MediaRecorder === 'undefined') {
    return ''
  }

  const candidates = hasAudio ? AUDIO_MIME_CANDIDATES : VIDEO_MIME_CANDIDATES
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? ''
}

export interface RecorderConfig {
  width: number
  height: number
  fps: number
  quality: QualityPreset
}

export function createMediaRecorder(stream: MediaStream, config: RecorderConfig): MediaRecorder {
  const bitrate = bitrateFor(config)
  const hasAudio = (stream.getAudioTracks?.() ?? []).length > 0
  const mimeType = chooseMimeType(hasAudio)

  return new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: bitrate,
    ...(hasAudio ? { audioBitsPerSecond: 128_000 } : {})
  })
}

export function getStreamSize(stream: MediaStream): Size {
  const settings = stream.getVideoTracks()[0]?.getSettings()
  return {
    width: settings?.width ?? 0,
    height: settings?.height ?? 0
  }
}

export function attachVideo(stream: MediaStream): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.autoplay = true
    video.style.position = 'fixed'
    video.style.width = '1px'
    video.style.height = '1px'
    video.style.opacity = '0'
    video.style.pointerEvents = 'none'
    video.style.left = '-9999px'
    video.srcObject = stream
    document.body.appendChild(video)

    const timer = window.setTimeout(() => {
      cleanup()
      detachVideo(video)
      reject(new Error(t.errors.videoTimeout))
    }, 15_000)

    const cleanup = (): void => {
      window.clearTimeout(timer)
      video.onloadedmetadata = null
      video.onerror = null
    }

    video.onloadedmetadata = () => {
      cleanup()
      void video.play().catch(() => undefined)
      resolve(video)
    }

    video.onerror = () => {
      cleanup()
      detachVideo(video)
      reject(new Error(t.errors.videoRead))
    }
  })
}

export function detachVideo(video: HTMLVideoElement): void {
  video.pause()
  video.srcObject = null
  video.remove()
}

export async function getStreamVideoSize(stream: MediaStream): Promise<Size> {
  const direct = getStreamSize(stream)
  if (direct.width > 1 && direct.height > 1) {
    return direct
  }

  const video = await attachVideo(stream)
  const size = { width: video.videoWidth, height: video.videoHeight }
  detachVideo(video)
  return size
}

export interface RegionPipeline {
  stream: MediaStream
  width: number
  height: number
  stop: () => void
}

export async function createRegionPipeline(
  source: MediaStream,
  region: Region,
  fps: number,
  audioTrack: MediaStreamTrack | null = null
): Promise<RegionPipeline> {
  const video = await attachVideo(source)
  const crop = computeCropRect(region, {
    width: video.videoWidth,
    height: video.videoHeight
  })

  if (!crop) {
    detachVideo(video)
    throw new Error(t.errors.regionCrop)
  }

  const size = toEvenDimensions({ width: crop.width, height: crop.height })
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    detachVideo(video)
    throw new Error('No se pudo preparar el lienzo de captura')
  }

  let running = true

  const draw = (): void => {
    if (!running) {
      return
    }
    context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, size.width, size.height)
    video.requestVideoFrameCallback(draw)
  }

  video.requestVideoFrameCallback(draw)

  const stream = canvas.captureStream(fps)
  if (audioTrack && typeof stream.addTrack === 'function') {
    stream.addTrack(audioTrack)
  }

  return {
    stream,
    width: size.width,
    height: size.height,
    stop: () => {
      running = false
      stopStream(stream)
      detachVideo(video)
      canvas.width = 0
      canvas.height = 0
    }
  }
}
