import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { HistoryEntry, QualityPreset, RecordingMode, Region, Size } from '@shared/types'
import { t } from '../i18n/es'
import {
  acquireDisplayStream,
  acquireMicStream,
  composeCaptureStream,
  createAudioPipeline,
  createMediaRecorder,
  createRegionPipeline,
  getStreamVideoSize,
  stopStream
} from '../lib/capture'
import type { AudioPipeline, RegionPipeline } from '../lib/capture'
import { initialRecordingState, recordingReducer } from '../lib/recordingReducer'
import type { RecordingState } from '../lib/recordingReducer'

export interface StartRecordingOptions {
  mode: RecordingMode
  region: Region | null
  stream?: MediaStream | null
  fps: number
  quality: QualityPreset
  countdownSeconds: number
  systemAudio?: boolean
  micAudio?: boolean
  micDeviceId?: string
  systemAudioGain?: number
  micGain?: number
}

interface CaptureMeta {
  mode: RecordingMode
  region: Region | null
  fps: number
  quality: QualityPreset
  width: number
  height: number
  hasAudio: boolean
}

interface UseScreenRecorderOptions {
  onFinished: (entry: HistoryEntry) => void
  onError: (message: string) => void
}

export interface ScreenRecorderController {
  state: RecordingState
  preparing: boolean
  start: (options: StartRecordingOptions) => Promise<void>
  cancel: () => void
  stop: () => void
  reset: () => void
  setMode: (mode: RecordingMode) => void
  setRegion: (region: Region | null) => void
  openEntry: (entryId: string) => void
  beginExport: () => void
  updateExportProgress: (percent: number) => void
  finishExport: () => void
  cancelExport: () => void
  reportError: (message: string) => void
  clearError: () => void
  audioLevel: number
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function cleanErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

    if (message === 'MIC_PERMISSION_DENIED') {
      return 'No se concedió permiso para usar el micrófono.'
    }
    if (message === 'MIC_UNAVAILABLE') {
      return 'No se pudo acceder al micrófono seleccionado.'
    }
    if (/permission denied|notallowed|denied by the user|user denied/i.test(message)) {
      return 'No se concedió permiso para capturar la pantalla.'
    }
    if (/notfounderror|requested device not found|no sources|no capturable/i.test(message)) {
      return 'No se encontró ninguna fuente de captura disponible.'
    }
    if (/notreadable|could not start|could not capture/i.test(message)) {
      return 'No se pudo iniciar la captura de la fuente.'
    }
    if (/aborterror|selection cancelled|cancelled/i.test(message)) {
      return 'La selección de fuente se canceló.'
    }

    return message || 'Se produjo un error inesperado'
  }
  return 'Se produjo un error inesperado'
}

export function useScreenRecorder(options: UseScreenRecorderOptions): ScreenRecorderController {
  const [state, dispatch] = useReducer(recordingReducer, initialRecordingState)
  const [preparing, setPreparing] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  const stateRef = useRef(state)
  const onFinishedRef = useRef(options.onFinished)
  const onErrorRef = useRef(options.onError)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pipelineRef = useRef<RegionPipeline | null>(null)
  const audioPipelineRef = useRef<AudioPipeline | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const metaRef = useRef<CaptureMeta | null>(null)
  const queueRef = useRef<Blob[]>([])
  const flushingRef = useRef<Promise<void> | null>(null)
  const runningRef = useRef(false)
  const stoppingRef = useRef(false)
  const cancelledRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const levelTimerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const lastTickRef = useRef(0)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    onFinishedRef.current = options.onFinished
    onErrorRef.current = options.onError
  }, [options.onFinished, options.onError])

  const flushQueue = useCallback(async (): Promise<void> => {
    if (flushingRef.current) {
      await flushingRef.current
      return
    }

    const run = (async () => {
      while (queueRef.current.length > 0) {
        const blob = queueRef.current.shift()
        if (!blob || blob.size === 0) {
          continue
        }
        const sessionId = sessionIdRef.current
        if (!sessionId) {
          return
        }
        const buffer = await blob.arrayBuffer()
        await window.api.appendChunk(sessionId, buffer)
      }
    })()

    flushingRef.current = run.finally(() => {
      flushingRef.current = null
    })

    await flushingRef.current
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopLevelMonitor = useCallback(() => {
    if (levelTimerRef.current !== null) {
      window.clearInterval(levelTimerRef.current)
      levelTimerRef.current = null
    }
    setAudioLevel(0)
  }, [])

  const cleanupStreams = useCallback(() => {
    pipelineRef.current?.stop()
    pipelineRef.current = null
    audioPipelineRef.current?.stop()
    audioPipelineRef.current = null
    stopStream(streamRef.current)
    streamRef.current = null
    stopTimer()
    stopLevelMonitor()
  }, [stopLevelMonitor, stopTimer])

  const abortSession = useCallback(async () => {
    const sessionId = sessionIdRef.current
    sessionIdRef.current = null
    if (sessionId) {
      await window.api.abortRecording(sessionId).catch(() => undefined)
    }
  }, [])

  const handleFailure = useCallback(
    async (message: string) => {
      const recorder = recorderRef.current
      recorderRef.current = null

      if (recorder) {
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.onerror = null
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop()
          } catch {
            // La sesión se aborta a continuación.
          }
        }
      }

      runningRef.current = false
      stoppingRef.current = false
      cleanupStreams()
      await abortSession()
      setPreparing(false)
      dispatch({ type: 'error', message })
      onErrorRef.current(message)
      void window.api.showWindow().catch(() => undefined)
    },
    [abortSession, cleanupStreams]
  )

  const finalize = useCallback(async () => {
    const meta = metaRef.current
    const sessionId = sessionIdRef.current

    if (!meta || !sessionId) {
      return
    }

    try {
      void window.api.showWindow().catch(() => undefined)
      stopTimer()
      await flushQueue()

      const recorder = recorderRef.current
      recorderRef.current = null
      if (recorder) {
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.onerror = null
      }

      const durationMs = Math.max(0, performance.now() - startedAtRef.current)
      const entry = await window.api.finishRecording({
        sessionId,
        durationMs,
        width: meta.width,
        height: meta.height,
        fps: meta.fps,
        mode: meta.mode,
        hasAudio: meta.hasAudio
      })

      sessionIdRef.current = null
      metaRef.current = null
      runningRef.current = false
      stoppingRef.current = false
      setPreparing(false)
      cleanupStreams()
      dispatch({ type: 'recording-finished', entryId: entry.id })
      onFinishedRef.current(entry)
    } catch (error) {
      await handleFailure(cleanErrorMessage(error))
    }
  }, [cleanupStreams, flushQueue, handleFailure, stopTimer])

  const cancel = useCallback(() => {
    if (stateRef.current.phase !== 'countdown') {
      return
    }

    cancelledRef.current = true
    runningRef.current = false
    stoppingRef.current = false
    cleanupStreams()
    setPreparing(false)
    dispatch({ type: 'cancel' })
    void window.api.showWindow().catch(() => undefined)
  }, [cleanupStreams])

  const stop = useCallback(() => {
    if (stoppingRef.current) {
      return
    }
    if (stateRef.current.phase === 'countdown') {
      cancel()
      return
    }
    if (stateRef.current.phase !== 'recording') {
      return
    }

    stoppingRef.current = true
    dispatch({ type: 'stop' })

    const recorder = recorderRef.current
    if (!recorder) {
      cancelledRef.current = true
      runningRef.current = false
      stoppingRef.current = false
      cleanupStreams()
      setPreparing(false)
      dispatch({ type: 'cancel' })
      return
    }

    if (recorder.state !== 'inactive') {
      try {
        recorder.stop()
        return
      } catch {
        // Si no se puede detener, finalizamos manualmente.
      }
    }

    void finalize()
  }, [cancel, cleanupStreams, finalize])

  const start = useCallback(
    async (startOptions: StartRecordingOptions) => {
      if (runningRef.current) {
        return
      }

      runningRef.current = true
      stoppingRef.current = false
      cancelledRef.current = false
      setPreparing(true)

      let stream = startOptions.stream ?? null

      try {
        const systemAudio = Boolean(startOptions.systemAudio)
        const micAudio = Boolean(startOptions.micAudio)

        if (!stream) {
          stream = await acquireDisplayStream(startOptions.fps, systemAudio)
        }
        streamRef.current = stream

        if (cancelledRef.current) {
          cleanupStreams()
          runningRef.current = false
          setPreparing(false)
          return
        }

        const micStream = micAudio
          ? await acquireMicStream(startOptions.micDeviceId ?? 'default')
          : null

        if (cancelledRef.current) {
          stopStream(micStream)
          cleanupStreams()
          runningRef.current = false
          setPreparing(false)
          return
        }

        const audioPipeline = createAudioPipeline({
          displayStream: stream,
          systemAudio,
          systemAudioGain: startOptions.systemAudioGain,
          micStream,
          micGain: startOptions.micGain
        })
        audioPipelineRef.current = audioPipeline

        let captureStream = stream
        let size: Size

        if (startOptions.mode === 'region') {
          if (!startOptions.region) {
            throw new Error(t.errors.selectRegion)
          }
          const pipeline = await createRegionPipeline(
            stream,
            startOptions.region,
            startOptions.fps,
            audioPipeline.track
          )
          if (cancelledRef.current) {
            pipeline.stop()
            cleanupStreams()
            runningRef.current = false
            setPreparing(false)
            return
          }
          pipelineRef.current = pipeline
          captureStream = pipeline.stream
          size = { width: pipeline.width, height: pipeline.height }
        } else {
          size = await getStreamVideoSize(stream)
          captureStream = composeCaptureStream(stream, audioPipeline.track)
        }

        if (size.width < 2 || size.height < 2) {
          throw new Error(t.errors.sizeUnknown)
        }

        metaRef.current = {
          mode: startOptions.mode,
          region: startOptions.region,
          fps: startOptions.fps,
          quality: startOptions.quality,
          width: size.width,
          height: size.height,
          hasAudio: audioPipeline.hasAudio
        }

        dispatch({
          type: 'start-countdown',
          seconds: Math.max(0, Math.floor(startOptions.countdownSeconds))
        })

        for (
          let remaining = Math.max(0, Math.floor(startOptions.countdownSeconds));
          remaining > 0;
          remaining -= 1
        ) {
          await delay(1000)
          if (cancelledRef.current) {
            return
          }
          if (remaining > 1) {
            dispatch({ type: 'tick-countdown' })
          }
        }

        if (cancelledRef.current) {
          return
        }

        if (startOptions.mode === 'screen') {
          await window.api.hideWindow().catch(() => undefined)
          await delay(300)
        }

        if (cancelledRef.current) {
          return
        }

        const session = await window.api.startRecording({
          mode: startOptions.mode,
          fps: startOptions.fps,
          quality: startOptions.quality,
          region: startOptions.region,
          sourceWidth: size.width,
          sourceHeight: size.height
        })

        if (cancelledRef.current) {
          await window.api.abortRecording(session.sessionId).catch(() => undefined)
          return
        }

        sessionIdRef.current = session.sessionId

        const recorder = createMediaRecorder(captureStream, {
          width: size.width,
          height: size.height,
          fps: startOptions.fps,
          quality: startOptions.quality
        })
        recorderRef.current = recorder

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            queueRef.current.push(event.data)
            void flushQueue()
          }
        }
        recorder.onerror = () => {
          void handleFailure(t.errors.encoderError)
        }
        recorder.onstop = () => {
          void finalize()
        }

        recorder.start(1000)
        startedAtRef.current = performance.now()
        lastTickRef.current = performance.now()

        setAudioLevel(audioPipeline.getLevel())
        levelTimerRef.current = window.setInterval(() => {
          setAudioLevel(audioPipelineRef.current?.getLevel() ?? 0)
        }, 100)

        timerRef.current = window.setInterval(() => {
          const now = performance.now()
          dispatch({ type: 'tick-recording', deltaMs: now - lastTickRef.current })
          lastTickRef.current = now
        }, 500)

        dispatch({ type: 'begin-recording' })
        setPreparing(false)

        for (const track of stream.getVideoTracks()) {
          track.addEventListener('ended', () => {
            if (!runningRef.current || stoppingRef.current) {
              return
            }
            stoppingRef.current = true
            dispatch({ type: 'stop' })
            onErrorRef.current(t.errors.sourceEnded)
            const current = recorderRef.current
            if (current && current.state !== 'inactive') {
              try {
                current.stop()
              } catch {
                void finalize()
              }
            }
          })
        }
      } catch (error) {
        runningRef.current = false
        setPreparing(false)
        await handleFailure(cleanErrorMessage(error))
      }
    },
    [cleanupStreams, finalize, flushQueue, handleFailure]
  )

  const reset = useCallback(() => {
    dispatch({ type: 'reset' })
  }, [])

  const setMode = useCallback((mode: RecordingMode) => {
    dispatch({ type: 'select-mode', mode })
  }, [])

  const setRegion = useCallback((region: Region | null) => {
    dispatch({ type: 'set-region', region })
  }, [])

  const openEntry = useCallback((entryId: string) => {
    dispatch({ type: 'open-entry', entryId })
  }, [])

  const beginExport = useCallback(() => {
    dispatch({ type: 'start-export' })
  }, [])

  const updateExportProgress = useCallback((percent: number) => {
    dispatch({ type: 'export-progress', percent })
  }, [])

  const finishExport = useCallback(() => {
    dispatch({ type: 'export-finished' })
  }, [])

  const cancelExport = useCallback(() => {
    dispatch({ type: 'export-cancelled' })
  }, [])

  const reportError = useCallback((message: string) => {
    dispatch({ type: 'error', message })
    onErrorRef.current(message)
  }, [])

  const clearError = useCallback(() => {
    dispatch({ type: 'clear-error' })
  }, [])

  useEffect(() => {
    return () => {
      cancelledRef.current = true
      stopTimer()

      if (levelTimerRef.current !== null) {
        window.clearInterval(levelTimerRef.current)
        levelTimerRef.current = null
      }

      const recorder = recorderRef.current
      if (recorder) {
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.onerror = null
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop()
          } catch {
            // Ignorado durante el desmontaje.
          }
        }
      }

      pipelineRef.current?.stop()
      pipelineRef.current = null
      audioPipelineRef.current?.stop()
      audioPipelineRef.current = null
      stopStream(streamRef.current)
      streamRef.current = null

      const sessionId = sessionIdRef.current
      sessionIdRef.current = null
      if (sessionId) {
        void window.api.abortRecording(sessionId).catch(() => undefined)
      }
    }
  }, [stopTimer])

  return {
    state,
    preparing,
    audioLevel,
    start,
    cancel,
    stop,
    reset,
    setMode,
    setRegion,
    openEntry,
    beginExport,
    updateExportProgress,
    finishExport,
    cancelExport,
    reportError,
    clearError
  }
}
