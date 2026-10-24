import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acquireDisplayStream,
  acquireMicStream,
  chooseMimeType,
  composeCaptureStream,
  createAudioPipeline,
  createMediaRecorder,
  listAudioInputs
} from '@renderer/lib/capture'

function makeTrack(kind: 'video' | 'audio', id = `${kind}-1`): MediaStreamTrack {
  return {
    id,
    kind,
    stop: vi.fn(),
    getSettings: () => ({ width: 1280, height: 720 }),
    applyConstraints: vi.fn().mockResolvedValue(undefined)
  } as unknown as MediaStreamTrack
}

function makeStream(tracks: MediaStreamTrack[]): MediaStream {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((track) => track.kind === 'video'),
    getAudioTracks: () => tracks.filter((track) => track.kind === 'audio'),
    addTrack: (track: MediaStreamTrack) => {
      tracks.push(track)
    }
  } as unknown as MediaStream
}

describe('capture audio helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('solicita audio del sistema en acquireDisplayStream cuando se activa', async () => {
    const videoTrack = makeTrack('video')
    const audioTrack = makeTrack('audio', 'sys-audio')
    const getDisplayMedia = vi.fn().mockResolvedValue(makeStream([videoTrack, audioTrack]))

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getDisplayMedia }
    })

    const stream = await acquireDisplayStream(30, true)

    expect(getDisplayMedia).toHaveBeenCalledWith({
      audio: true,
      video: { frameRate: { ideal: 30, max: 30 } }
    })
    expect(stream.getAudioTracks()).toHaveLength(1)
  })

  it('reintenta sin audio del sistema si la fuente falla al pedir loopback pero no por permiso denegado', async () => {
    const videoTrack = makeTrack('video')
    const getDisplayMedia = vi
      .fn()
      .mockRejectedValueOnce(new Error('Audio capture is not supported'))
      .mockResolvedValueOnce(makeStream([videoTrack]))

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getDisplayMedia }
    })

    const stream = await acquireDisplayStream(30, true)

    expect(getDisplayMedia).toHaveBeenCalledTimes(2)
    expect(getDisplayMedia).toHaveBeenLastCalledWith({
      audio: false,
      video: { frameRate: { ideal: 30, max: 30 } }
    })
    expect(stream.getVideoTracks()).toHaveLength(1)
  })

  it('adquiere el micrófono seleccionado y hace fallback al predeterminado si fue desconectado', async () => {
    const micTrack = makeTrack('audio', 'mic-default')
    const notFound = new Error('Requested device not found')
    notFound.name = 'NotFoundError'

    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce(makeStream([micTrack]))

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia }
    })

    const stream = await acquireMicStream('usb-desconectado')

    expect(getUserMedia).toHaveBeenCalledTimes(2)
    expect(getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: {
        deviceId: { exact: 'usb-desconectado' },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    })
    expect(getUserMedia).toHaveBeenNthCalledWith(2, {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    })
    expect(stream.getAudioTracks()[0].id).toBe('mic-default')
  })

  it('enumera los micrófonos disponibles excluyendo entradas vacías y duplicados default', async () => {
    const enumerateDevices = vi.fn().mockResolvedValue([
      { kind: 'audioinput', deviceId: 'default', label: 'Default' },
      { kind: 'audioinput', deviceId: 'mic-1', label: 'Micrófono USB' },
      { kind: 'audioinput', deviceId: 'mic-2', label: '' },
      { kind: 'videoinput', deviceId: 'cam-1', label: 'Cámara' }
    ])

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { enumerateDevices }
    })

    const devices = await listAudioInputs()

    expect(devices).toEqual([
      { deviceId: 'mic-1', label: 'Micrófono USB' },
      { deviceId: 'mic-2', label: 'Micrófono 2' }
    ])
  })

  it('aplica la ganancia por fuente, mide el nivel y limpia al detener', () => {
    const sysTrack = makeTrack('audio', 'sys-track')
    const micTrack = makeTrack('audio', 'mic-track')
    const mixedTrack = makeTrack('audio', 'mixed-track')
    const connect = vi.fn()
    const disconnect = vi.fn()
    const close = vi.fn().mockResolvedValue(undefined)
    const gains: Array<{ gain: { value: number } }> = []

    class FakeAudioContext {
      createMediaStreamDestination() {
        return { stream: makeStream([mixedTrack]) }
      }
      createMediaStreamSource() {
        return { connect, disconnect }
      }
      createGain() {
        const node = { gain: { value: 0 }, connect, disconnect }
        gains.push(node)
        return node
      }
      createAnalyser() {
        return {
          fftSize: 0,
          smoothingTimeConstant: 0,
          connect,
          disconnect,
          getFloatTimeDomainData: (data: Float32Array) => data.fill(0.5)
        }
      }
      close = close
    }

    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal(
      'MediaStream',
      class {
        private readonly tracks: MediaStreamTrack[]
        constructor(tracks: MediaStreamTrack[] = []) {
          this.tracks = [...tracks]
        }
        getTracks() {
          return this.tracks
        }
        getAudioTracks() {
          return this.tracks.filter((track) => track.kind === 'audio')
        }
        getVideoTracks() {
          return this.tracks.filter((track) => track.kind === 'video')
        }
      }
    )

    const pipeline = createAudioPipeline({
      displayStream: makeStream([makeTrack('video'), sysTrack]),
      systemAudio: true,
      systemAudioGain: 2,
      micStream: makeStream([micTrack]),
      micGain: 1.5
    })

    expect(pipeline.hasAudio).toBe(true)
    expect(pipeline.track?.id).toBe('mixed-track')
    expect(gains.map((node) => node.gain.value)).toEqual([2, 1.5])
    expect(pipeline.getLevel()).toBeGreaterThan(0)

    pipeline.stop()
    expect(pipeline.getLevel()).toBe(0)
    expect(micTrack.stop).toHaveBeenCalled()
    expect(mixedTrack.stop).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it('devuelve un nivel cero cuando no hay fuentes de audio', () => {
    const pipeline = createAudioPipeline({
      displayStream: makeStream([makeTrack('video')]),
      systemAudio: false,
      micStream: null
    })

    expect(pipeline.hasAudio).toBe(false)
    expect(pipeline.track).toBeNull()
    expect(pipeline.getLevel()).toBe(0)
    pipeline.stop()
  })

  it('prioriza códecs con opus cuando el stream tiene audio', () => {
    const isTypeSupported = vi.fn((mime: string) => mime === 'video/webm;codecs=vp9,opus')
    const recorderSpy = vi.fn()

    class FakeMediaRecorder {
      static isTypeSupported = isTypeSupported
      constructor(stream: MediaStream, options: unknown) {
        recorderSpy(stream, options)
      }
    }

    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)

    expect(chooseMimeType(true)).toBe('video/webm;codecs=vp9,opus')

    const stream = makeStream([makeTrack('video'), makeTrack('audio')])
    createMediaRecorder(stream, { width: 1280, height: 720, fps: 30, quality: 'medium' })

    expect(recorderSpy).toHaveBeenCalledWith(
      stream,
      expect.objectContaining({
        mimeType: 'video/webm;codecs=vp9,opus',
        audioBitsPerSecond: 128_000
      })
    )
  })

  it('compone el stream final con la pista de vídeo y la pista de audio activa', () => {
    vi.stubGlobal(
      'MediaStream',
      class {
        private readonly tracks: MediaStreamTrack[]
        constructor(tracks: MediaStreamTrack[] = []) {
          this.tracks = [...tracks]
        }
        getTracks() {
          return this.tracks
        }
        getAudioTracks() {
          return this.tracks.filter((track) => track.kind === 'audio')
        }
        getVideoTracks() {
          return this.tracks.filter((track) => track.kind === 'video')
        }
      }
    )

    const videoTrack = makeTrack('video')
    const audioTrack = makeTrack('audio', 'active-audio')
    const composed = composeCaptureStream(makeStream([videoTrack]), audioTrack)

    expect(composed.getVideoTracks()).toHaveLength(1)
    expect(composed.getAudioTracks()).toEqual([audioTrack])
  })
})
