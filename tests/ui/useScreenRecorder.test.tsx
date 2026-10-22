import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CapturaApi } from '@shared/api'
import type { HistoryEntry } from '@shared/types'
import { useScreenRecorder } from '@renderer/hooks/useScreenRecorder'
import { t } from '@renderer/i18n/es'

const captureMock = vi.hoisted(() => ({
  acquireDisplayStream: vi.fn(),
  createMediaRecorder: vi.fn(),
  createRegionPipeline: vi.fn(),
  getStreamVideoSize: vi.fn(),
  stopStream: vi.fn()
}))

vi.mock('../../src/renderer/src/lib/capture', () => captureMock)

const entry: HistoryEntry = {
  id: 'sesion-1',
  createdAt: '2026-10-22T17:45:00.000Z',
  durationMs: 1000,
  sizeBytes: 1000,
  width: 1280,
  height: 720,
  fps: 30,
  mode: 'screen',
  sourcePath: '/datos/sesion-1/source.webm',
  thumbPath: null,
  exports: [],
  status: 'complete'
}

interface StreamHarness {
  stream: MediaStream
  emit: (event: string) => void
  track: {
    stop: ReturnType<typeof vi.fn>
  }
}

function createStream(width = 1280, height = 720): StreamHarness {
  const listeners = new Map<string, Array<() => void>>()
  const track = {
    getSettings: () => ({ width, height }),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((type: string, callback: () => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), callback])
    }),
    stop: vi.fn()
  }

  return {
    stream: {
      getVideoTracks: () => [track],
      getTracks: () => [track]
    } as unknown as MediaStream,
    track,
    emit: (event) => {
      for (const callback of listeners.get(event) ?? []) {
        callback()
      }
    }
  }
}

function createFakeRecorder() {
  const recorder = {
    state: 'inactive' as 'inactive' | 'recording',
    ondataavailable: null as ((event: { data: Blob }) => void) | null,
    onstop: null as (() => void) | null,
    onerror: null as (() => void) | null,
    start: vi.fn(() => {
      recorder.state = 'recording'
    }),
    stop: vi.fn(() => {
      recorder.state = 'inactive'
      recorder.onstop?.()
    })
  }
  return recorder
}

const api = {
  startRecording: vi.fn(),
  appendChunk: vi.fn(),
  finishRecording: vi.fn(),
  abortRecording: vi.fn(),
  hideWindow: vi.fn(),
  showWindow: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  window.api = api as unknown as CapturaApi
  api.startRecording.mockResolvedValue({ sessionId: 'sesion-1' })
  api.finishRecording.mockResolvedValue(entry)
  api.abortRecording.mockResolvedValue(undefined)
  api.appendChunk.mockResolvedValue(undefined)
  api.hideWindow.mockResolvedValue(undefined)
  api.showWindow.mockResolvedValue(undefined)
})

describe('useScreenRecorder', () => {
  it('graba, detiene y finaliza la sesión', async () => {
    const harness = createStream()
    const recorder = createFakeRecorder()
    captureMock.acquireDisplayStream.mockResolvedValue(harness.stream)
    captureMock.getStreamVideoSize.mockResolvedValue({ width: 1280, height: 720 })
    captureMock.createMediaRecorder.mockReturnValue(recorder)

    const onFinished = vi.fn()
    const onError = vi.fn()
    const { result } = renderHook(() => useScreenRecorder({ onFinished, onError }))

    await act(async () => {
      await result.current.start({
        mode: 'window',
        region: null,
        fps: 30,
        quality: 'medium',
        countdownSeconds: 0
      })
    })

    expect(result.current.state.phase).toBe('recording')
    expect(api.hideWindow).not.toHaveBeenCalled()
    expect(recorder.start).toHaveBeenCalledWith(1000)

    act(() => result.current.stop())

    await waitFor(() => expect(result.current.state.phase).toBe('review'))

    expect(api.finishRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sesion-1',
        width: 1280,
        height: 720,
        fps: 30,
        mode: 'window'
      })
    )
    expect(onFinished).toHaveBeenCalledWith(entry)
    expect(onError).not.toHaveBeenCalled()
  })

  it('oculta la ventana al grabar la pantalla y la restaura al parar', async () => {
    const harness = createStream()
    const recorder = createFakeRecorder()
    captureMock.acquireDisplayStream.mockResolvedValue(harness.stream)
    captureMock.getStreamVideoSize.mockResolvedValue({ width: 1280, height: 720 })
    captureMock.createMediaRecorder.mockReturnValue(recorder)

    const { result } = renderHook(() =>
      useScreenRecorder({ onFinished: vi.fn(), onError: vi.fn() })
    )

    await act(async () => {
      await result.current.start({
        mode: 'screen',
        region: null,
        fps: 30,
        quality: 'medium',
        countdownSeconds: 0
      })
    })

    expect(api.hideWindow).toHaveBeenCalledOnce()

    act(() => result.current.stop())
    await waitFor(() => expect(result.current.state.phase).toBe('review'))
    expect(api.showWindow).toHaveBeenCalled()
  })

  it('cancela la cuenta atrás sin iniciar sesión', async () => {
    const harness = createStream()
    captureMock.acquireDisplayStream.mockResolvedValue(harness.stream)
    captureMock.getStreamVideoSize.mockResolvedValue({ width: 1280, height: 720 })

    const { result } = renderHook(() =>
      useScreenRecorder({ onFinished: vi.fn(), onError: vi.fn() })
    )

    let startPromise: Promise<void> = Promise.resolve()
    act(() => {
      startPromise = result.current.start({
        mode: 'window',
        region: null,
        fps: 30,
        quality: 'medium',
        countdownSeconds: 1
      })
    })

    await waitFor(() => expect(result.current.state.phase).toBe('countdown'))
    act(() => result.current.cancel())

    expect(result.current.state.phase).toBe('idle')
    expect(captureMock.stopStream).toHaveBeenCalled()
    expect(api.startRecording).not.toHaveBeenCalled()

    await startPromise
  })

  it('finaliza y avisa si la fuente deja de estar disponible', async () => {
    const harness = createStream()
    const recorder = createFakeRecorder()
    captureMock.acquireDisplayStream.mockResolvedValue(harness.stream)
    captureMock.getStreamVideoSize.mockResolvedValue({ width: 1280, height: 720 })
    captureMock.createMediaRecorder.mockReturnValue(recorder)

    const onFinished = vi.fn()
    const onError = vi.fn()
    const { result } = renderHook(() => useScreenRecorder({ onFinished, onError }))

    await act(async () => {
      await result.current.start({
        mode: 'window',
        region: null,
        fps: 30,
        quality: 'medium',
        countdownSeconds: 0
      })
    })

    act(() => harness.emit('ended'))

    await waitFor(() => expect(result.current.state.phase).toBe('review'))
    expect(onError).toHaveBeenCalledWith(t.errors.sourceEnded)
    expect(api.finishRecording).toHaveBeenCalled()
  })

  it('traduce el permiso denegado y no deja sesión abierta', async () => {
    captureMock.acquireDisplayStream.mockRejectedValue(new Error('Permission denied'))

    const onError = vi.fn()
    const { result } = renderHook(() =>
      useScreenRecorder({ onFinished: vi.fn(), onError })
    )

    await act(async () => {
      await result.current.start({
        mode: 'screen',
        region: null,
        fps: 30,
        quality: 'medium',
        countdownSeconds: 0
      })
    })

    expect(result.current.state.phase).toBe('idle')
    expect(onError).toHaveBeenCalledWith('No se concedió permiso para capturar la pantalla.')
    expect(api.startRecording).not.toHaveBeenCalled()
    expect(api.abortRecording).not.toHaveBeenCalled()
  })

  it('usa el pipeline de región y registra su tamaño', async () => {
    const harness = createStream()
    const regionStream = createStream(640, 360).stream
    const stopPipeline = vi.fn()
    const recorder = createFakeRecorder()

    captureMock.acquireDisplayStream.mockResolvedValue(harness.stream)
    captureMock.createRegionPipeline.mockResolvedValue({
      stream: regionStream,
      width: 640,
      height: 360,
      stop: stopPipeline
    })
    captureMock.createMediaRecorder.mockReturnValue(recorder)

    const { result } = renderHook(() =>
      useScreenRecorder({ onFinished: vi.fn(), onError: vi.fn() })
    )

    await act(async () => {
      await result.current.start({
        mode: 'region',
        region: { x: 0, y: 0, width: 640, height: 360 },
        fps: 30,
        quality: 'high',
        countdownSeconds: 0
      })
    })

    expect(captureMock.createRegionPipeline).toHaveBeenCalledWith(
      harness.stream,
      { x: 0, y: 0, width: 640, height: 360 },
      30
    )
    expect(api.hideWindow).not.toHaveBeenCalled()

    act(() => result.current.stop())
    await waitFor(() => expect(result.current.state.phase).toBe('review'))
    expect(api.finishRecording).toHaveBeenCalledWith(
      expect.objectContaining({ width: 640, height: 360, mode: 'region' })
    )
    expect(stopPipeline).toHaveBeenCalled()
  })
})
