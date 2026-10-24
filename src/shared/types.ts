export type RecordingMode = 'screen' | 'window' | 'region'

export type QualityPreset = 'high' | 'medium' | 'low'

export type ResolutionPreset = 'native' | '2160p' | '1440p' | '1080p' | '720p' | 'custom'

export type SessionType = 'wayland' | 'x11' | 'windows' | 'unknown'

export interface Size {
  width: number
  height: number
}

export interface Region {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface AudioInputDevice {
  deviceId: string
  label: string
}

export interface Settings {
  resolution: ResolutionPreset
  customWidth: number
  customHeight: number
  fps: number
  quality: QualityPreset
  countdownSeconds: number
  shortcut: string
  outputDir: string
  keepSource: boolean
  systemAudio: boolean
  micAudio: boolean
  micDeviceId: string
  systemAudioGain: number
  micGain: number
  normalizeAudio: boolean
}

export interface SourceInfo {
  id: string
  name: string
  kind: 'screen' | 'window'
  thumbnail: string
  displayId: string
}

export interface RecorderStartRequest {
  mode: RecordingMode
  fps: number
  quality: QualityPreset
  region: Region | null
  sourceWidth: number
  sourceHeight: number
}

export interface RecorderStartResult {
  sessionId: string
}

export interface RecorderFinishRequest {
  sessionId: string
  durationMs: number
  width: number
  height: number
  fps: number
  mode: RecordingMode
  hasAudio?: boolean
}

export interface ExportedFile {
  path: string
  createdAt: string
  width: number
  height: number
  fps: number
}

export interface HistoryEntry {
  id: string
  createdAt: string
  durationMs: number
  sizeBytes: number
  width: number
  height: number
  fps: number
  mode: RecordingMode
  hasAudio?: boolean
  sourcePath: string
  thumbPath: string | null
  exports: ExportedFile[]
  status: 'complete' | 'recovered'
}

export interface ExportOptions {
  startMs: number
  endMs: number
  width: number
  height: number
  fps: number
  quality: QualityPreset
}

export interface ExportProgress {
  exportId: string
  percent: number
  etaMs: number | null
}

export interface ExportResult {
  path: string
  sizeBytes: number
}

export type ExportFailureCode =
  | 'cancelled'
  | 'ffmpeg-missing'
  | 'no-space'
  | 'invalid-request'
  | 'ffmpeg-failed'
  | 'entry-missing'

export interface ExportRunRequest {
  exportId: string
  entryId: string
  outputPath: string
  options: ExportOptions
}

export type ExportRunOutcome =
  { ok: true; result: ExportResult } | { ok: false; errorCode: ExportFailureCode; message: string }

export interface CleanupOutcome {
  entries: HistoryEntry[]
  removedCount: number
  reclaimedBytes: number
}

export interface PlatformInfo {
  platform: string
  sessionType: SessionType
  needsSystemPicker: boolean
  cursorNotice: string
  canEnableSystemAudio: boolean
  appVersion: string
}

export interface ShortcutState {
  accelerator: string
  registered: boolean
  error: string | null
}

export interface OrphanRecording {
  id: string
  sourcePath: string
  sizeBytes: number
  createdAt: string
}

export interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: string
}
