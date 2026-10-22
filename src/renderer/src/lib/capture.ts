import { bitrateFor } from '@shared/quality'
import { computeCropRect, toEvenDimensions } from '@shared/region'
import type { QualityPreset, Region, Size } from '@shared/types'
import { t } from '../i18n/es'

const MIME_CANDIDATES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

export async function acquireDisplayStream(fps: number): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: false,
    video: {
      frameRate: { ideal: fps, max: fps }
    }
  })

  const track = stream.getVideoTracks()[0]
  if (track) {
    await track.applyConstraints({ frameRate: { ideal: fps, max: fps } }).catch(() => undefined)
  }

  return stream
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}

export function chooseMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return ''
  }

  return MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? ''
}

export interface RecorderConfig {
  width: number
  height: number
  fps: number
  quality: QualityPreset
}

export function createMediaRecorder(stream: MediaStream, config: RecorderConfig): MediaRecorder {
  const bitrate = bitrateFor(config)
  const mimeType = chooseMimeType()

  return new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: bitrate
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
  fps: number
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
