import { describe, expect, it } from 'vitest'
import {
  canExport,
  canStart,
  initialRecordingState,
  isBusy,
  primaryActionLabel,
  recordingReducer
} from '@renderer/lib/recordingReducer'
import type { RecordingState } from '@renderer/lib/recordingReducer'

function reduce(state: RecordingState, actions: Parameters<typeof recordingReducer>[1][]) {
  return actions.reduce(recordingReducer, state)
}

describe('recordingReducer', () => {
  it('empieza inactivo, en modo pantalla y sin entrada', () => {
    expect(initialRecordingState).toMatchObject({
      phase: 'idle',
      mode: 'screen',
      region: null,
      elapsedMs: 0,
      entryId: null,
      error: null
    })
  })

  it('cambia de modo y limpia la región al salir del modo región', () => {
    const withRegion = reduce(initialRecordingState, [
      { type: 'select-mode', mode: 'region' },
      { type: 'set-region', region: { x: 0, y: 0, width: 100, height: 100 } }
    ])

    expect(withRegion.region).not.toBeNull()
    expect(recordingReducer(withRegion, { type: 'select-mode', mode: 'screen' }).region).toBeNull()
  })

  it('inicia la cuenta atrás y pasa a grabar al terminar', () => {
    const countdown = recordingReducer(initialRecordingState, {
      type: 'start-countdown',
      seconds: 3
    })

    expect(countdown.phase).toBe('countdown')
    expect(countdown.countdownRemaining).toBe(3)

    const recording = reduce(countdown, [
      { type: 'tick-countdown' },
      { type: 'tick-countdown' },
      { type: 'tick-countdown' }
    ])

    expect(recording.phase).toBe('recording')
    expect(recording.countdownRemaining).toBe(0)
  })

  it('comienza a grabar directamente si la cuenta atrás es cero', () => {
    const state = recordingReducer(initialRecordingState, { type: 'start-countdown', seconds: 0 })
    expect(state.phase).toBe('recording')
  })

  it('cancela la cuenta atrás sin dejar entrada', () => {
    const countdown = recordingReducer(initialRecordingState, {
      type: 'start-countdown',
      seconds: 3
    })
    const cancelled = recordingReducer(countdown, { type: 'cancel' })

    expect(cancelled.phase).toBe('idle')
    expect(cancelled.entryId).toBeNull()
  })

  it('acumula el tiempo de grabación', () => {
    const recording = recordingReducer(initialRecordingState, {
      type: 'start-countdown',
      seconds: 0
    })
    const ticked = reduce(recording, [
      { type: 'tick-recording', deltaMs: 1000 },
      { type: 'tick-recording', deltaMs: 500 }
    ])

    expect(ticked.elapsedMs).toBe(1500)
  })

  it('detiene y pasa a revisión con el id de la entrada', () => {
    const recording = recordingReducer(initialRecordingState, {
      type: 'start-countdown',
      seconds: 0
    })
    const stopping = recordingReducer(recording, { type: 'stop' })
    expect(stopping.phase).toBe('stopping')

    const review = recordingReducer(stopping, {
      type: 'recording-finished',
      entryId: 'entrada-1'
    })
    expect(review.phase).toBe('review')
    expect(review.entryId).toBe('entrada-1')
  })

  it('no se detiene si no está grabando', () => {
    expect(recordingReducer(initialRecordingState, { type: 'stop' }).phase).toBe('idle')
  })

  it('abre una entrada existente en revisión', () => {
    const review = recordingReducer(initialRecordingState, {
      type: 'open-entry',
      entryId: 'historica'
    })

    expect(review.phase).toBe('review')
    expect(review.entryId).toBe('historica')
    expect(review.exportPercent).toBeNull()
  })

  it('gestiona el ciclo de exportación', () => {
    const review: RecordingState = {
      ...initialRecordingState,
      phase: 'review',
      entryId: 'entrada-1'
    }

    const exporting = recordingReducer(review, { type: 'start-export' })
    expect(exporting.phase).toBe('exporting')
    expect(exporting.exportPercent).toBe(0)

    const progress = recordingReducer(exporting, { type: 'export-progress', percent: 42.5 })
    expect(progress.exportPercent).toBe(42.5)

    expect(recordingReducer(progress, { type: 'export-finished' }).phase).toBe('review')
    expect(recordingReducer(progress, { type: 'export-cancelled' }).phase).toBe('review')
  })

  it('limita el porcentaje de exportación', () => {
    const exporting: RecordingState = { ...initialRecordingState, phase: 'exporting' }
    expect(
      recordingReducer(exporting, { type: 'export-progress', percent: 150 }).exportPercent
    ).toBe(100)
    expect(
      recordingReducer(exporting, { type: 'export-progress', percent: -5 }).exportPercent
    ).toBe(0)
  })

  it('no exporta sin una entrada en revisión', () => {
    const review: RecordingState = { ...initialRecordingState, phase: 'review' }
    expect(recordingReducer(review, { type: 'start-export' }).phase).toBe('review')
  })

  it('vuelve a inactivo al reiniciar y conserva el modo elegido', () => {
    const review: RecordingState = {
      ...initialRecordingState,
      mode: 'window',
      phase: 'review',
      entryId: 'entrada-1',
      elapsedMs: 5000,
      error: 'algo'
    }

    const reset = recordingReducer(review, { type: 'reset' })
    expect(reset.phase).toBe('idle')
    expect(reset.mode).toBe('window')
    expect(reset.entryId).toBeNull()
    expect(reset.elapsedMs).toBe(0)
    expect(reset.error).toBeNull()
  })

  it('gestiona errores según la fase', () => {
    const countdown = recordingReducer(
      { ...initialRecordingState, phase: 'countdown', countdownRemaining: 2 },
      { type: 'error', message: 'sin permiso' }
    )
    expect(countdown.phase).toBe('idle')
    expect(countdown.error).toBe('sin permiso')

    const exporting = recordingReducer(
      { ...initialRecordingState, phase: 'exporting', exportPercent: 30 },
      { type: 'error', message: 'ffmpeg falló' }
    )
    expect(exporting.phase).toBe('review')
    expect(exporting.exportPercent).toBeNull()
    expect(exporting.error).toBe('ffmpeg falló')
  })

  it('permite limpiar el error', () => {
    const withError = recordingReducer(initialRecordingState, {
      type: 'error',
      message: 'fallo'
    })
    expect(recordingReducer(withError, { type: 'clear-error' }).error).toBeNull()
  })
})

describe('selectores', () => {
  it('canStart solo en inactivo', () => {
    expect(canStart(initialRecordingState)).toBe(true)
    expect(canStart({ ...initialRecordingState, phase: 'countdown' })).toBe(false)
    expect(canStart({ ...initialRecordingState, phase: 'recording' })).toBe(false)
  })

  it('canExport solo en revisión con entrada', () => {
    expect(canExport({ ...initialRecordingState, phase: 'review', entryId: 'a' })).toBe(true)
    expect(canExport({ ...initialRecordingState, phase: 'review', entryId: null })).toBe(false)
    expect(canExport({ ...initialRecordingState, phase: 'exporting', entryId: 'a' })).toBe(false)
  })

  it('isBusy durante captura y exportación', () => {
    expect(isBusy({ ...initialRecordingState, phase: 'recording' })).toBe(true)
    expect(isBusy({ ...initialRecordingState, phase: 'stopping' })).toBe(true)
    expect(isBusy({ ...initialRecordingState, phase: 'exporting' })).toBe(true)
    expect(isBusy(initialRecordingState)).toBe(false)
  })

  it('etiqueta la acción principal según la fase', () => {
    expect(primaryActionLabel(initialRecordingState)).toBe('Grabar')
    expect(primaryActionLabel({ ...initialRecordingState, phase: 'countdown' })).toBe('Cancelar')
    expect(primaryActionLabel({ ...initialRecordingState, phase: 'recording' })).toBe('Detener')
    expect(primaryActionLabel({ ...initialRecordingState, phase: 'stopping' })).toBe('Finalizando…')
    expect(primaryActionLabel({ ...initialRecordingState, phase: 'review' })).toBe('Exportar MP4')
    expect(primaryActionLabel({ ...initialRecordingState, phase: 'exporting' })).toBe('Exportando…')
  })
})
