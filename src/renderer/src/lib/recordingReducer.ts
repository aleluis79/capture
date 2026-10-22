import type { RecordingMode, Region } from '@shared/types'
import { t } from '../i18n/es'

export type RecordingPhase =
  'idle' | 'countdown' | 'recording' | 'stopping' | 'review' | 'exporting'

export interface RecordingState {
  phase: RecordingPhase
  mode: RecordingMode
  region: Region | null
  countdownRemaining: number
  elapsedMs: number
  entryId: string | null
  error: string | null
  exportPercent: number | null
}

export type RecordingAction =
  | { type: 'select-mode'; mode: RecordingMode }
  | { type: 'set-region'; region: Region | null }
  | { type: 'start-countdown'; seconds: number }
  | { type: 'tick-countdown' }
  | { type: 'begin-recording' }
  | { type: 'cancel' }
  | { type: 'tick-recording'; deltaMs: number }
  | { type: 'stop' }
  | { type: 'recording-finished'; entryId: string }
  | { type: 'open-entry'; entryId: string }
  | { type: 'start-export' }
  | { type: 'export-progress'; percent: number }
  | { type: 'export-finished' }
  | { type: 'export-cancelled' }
  | { type: 'error'; message: string }
  | { type: 'clear-error' }
  | { type: 'reset' }

export const initialRecordingState: RecordingState = {
  phase: 'idle',
  mode: 'screen',
  region: null,
  countdownRemaining: 0,
  elapsedMs: 0,
  entryId: null,
  error: null,
  exportPercent: null
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(100, Math.max(0, value))
}

export function recordingReducer(state: RecordingState, action: RecordingAction): RecordingState {
  switch (action.type) {
    case 'select-mode': {
      if (state.phase !== 'idle' && state.phase !== 'review') {
        return state
      }
      return {
        ...state,
        mode: action.mode,
        region: action.mode === 'region' ? state.region : null
      }
    }

    case 'set-region':
      return { ...state, region: action.region }

    case 'start-countdown': {
      if (state.phase !== 'idle' && state.phase !== 'review') {
        return state
      }
      const seconds = Math.max(0, Math.floor(action.seconds))
      return {
        ...state,
        phase: seconds > 0 ? 'countdown' : 'recording',
        countdownRemaining: seconds,
        elapsedMs: 0,
        entryId: null,
        error: null,
        exportPercent: null
      }
    }

    case 'tick-countdown': {
      if (state.phase !== 'countdown') {
        return state
      }
      if (state.countdownRemaining <= 1) {
        return { ...state, phase: 'recording', countdownRemaining: 0 }
      }
      return { ...state, countdownRemaining: state.countdownRemaining - 1 }
    }

    case 'begin-recording':
      return state.phase === 'countdown' || state.phase === 'idle'
        ? { ...state, phase: 'recording', countdownRemaining: 0, elapsedMs: 0 }
        : state

    case 'cancel':
      return state.phase === 'countdown' || state.phase === 'recording'
        ? { ...state, phase: 'idle', countdownRemaining: 0, elapsedMs: 0, exportPercent: null }
        : state

    case 'tick-recording':
      return state.phase === 'recording'
        ? { ...state, elapsedMs: state.elapsedMs + Math.max(0, action.deltaMs) }
        : state

    case 'stop':
      return state.phase === 'recording' ? { ...state, phase: 'stopping' } : state

    case 'recording-finished':
      return state.phase === 'stopping'
        ? { ...state, phase: 'review', entryId: action.entryId, countdownRemaining: 0 }
        : state

    case 'open-entry':
      return {
        ...state,
        phase: 'review',
        entryId: action.entryId,
        countdownRemaining: 0,
        elapsedMs: 0,
        exportPercent: null,
        error: null
      }

    case 'start-export':
      return state.phase === 'review' && state.entryId
        ? { ...state, phase: 'exporting', exportPercent: 0, error: null }
        : state

    case 'export-progress':
      return state.phase === 'exporting'
        ? { ...state, exportPercent: clampPercent(action.percent) }
        : state

    case 'export-finished':
    case 'export-cancelled':
      return state.phase === 'exporting'
        ? { ...state, phase: 'review', exportPercent: null }
        : state

    case 'error': {
      if (state.phase === 'countdown') {
        return {
          ...state,
          phase: 'idle',
          countdownRemaining: 0,
          elapsedMs: 0,
          exportPercent: null,
          error: action.message
        }
      }
      if (state.phase === 'exporting') {
        return { ...state, phase: 'review', exportPercent: null, error: action.message }
      }
      return { ...state, error: action.message }
    }

    case 'clear-error':
      return { ...state, error: null }

    case 'reset':
      return {
        ...initialRecordingState,
        mode: state.mode,
        region: state.mode === 'region' ? state.region : null
      }

    default:
      return state
  }
}

export function canStart(state: RecordingState): boolean {
  return state.phase === 'idle' || state.phase === 'review'
}

export function canExport(state: RecordingState): boolean {
  return state.phase === 'review' && state.entryId !== null
}

export function isBusy(state: RecordingState): boolean {
  return state.phase === 'recording' || state.phase === 'stopping' || state.phase === 'exporting'
}

export function primaryActionLabel(state: RecordingState): string {
  switch (state.phase) {
    case 'countdown':
      return t.actions.cancel
    case 'recording':
      return t.actions.stop
    case 'stopping':
      return t.capture.finalizing
    case 'review':
      return t.actions.export
    case 'exporting':
      return t.actions.exporting
    default:
      return t.actions.record
  }
}
