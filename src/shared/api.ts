import type {
  CleanupOutcome,
  ExportProgress,
  ExportRunOutcome,
  ExportRunRequest,
  HistoryEntry,
  OrphanRecording,
  PlatformInfo,
  RecorderFinishRequest,
  RecorderStartRequest,
  RecorderStartResult,
  Settings,
  ShortcutState,
  SourceInfo
} from './types'

export interface CapturaApi {
  getPlatformInfo(): Promise<PlatformInfo>
  getSettings(): Promise<Settings>
  updateSettings(patch: Partial<Settings>): Promise<Settings>
  chooseOutputDir(): Promise<Settings | null>

  listSources(): Promise<SourceInfo[]>
  setPendingSource(sourceId: string | null): Promise<void>

  startRecording(request: RecorderStartRequest): Promise<RecorderStartResult>
  appendChunk(sessionId: string, chunk: ArrayBuffer): Promise<void>
  finishRecording(request: RecorderFinishRequest): Promise<HistoryEntry>
  abortRecording(sessionId: string): Promise<void>

  listHistory(): Promise<HistoryEntry[]>
  removeRecording(id: string): Promise<HistoryEntry[]>
  openEntryFolder(id: string): Promise<void>
  revealEntry(id: string): Promise<void>
  cleanupSources(): Promise<CleanupOutcome>
  listOrphans(): Promise<OrphanRecording[]>
  recoverOrphan(id: string): Promise<HistoryEntry>
  discardOrphan(id: string): Promise<void>

  chooseExportPath(suggestedName: string): Promise<string | null>
  runExport(request: ExportRunRequest): Promise<ExportRunOutcome>
  cancelExport(exportId: string): Promise<boolean>

  getShortcut(): Promise<ShortcutState>
  setShortcut(accelerator: string): Promise<ShortcutState>

  hideWindow(): Promise<void>
  showWindow(): Promise<void>
  revealPath(path: string): Promise<void>

  mediaUrl(entryId: string): string
  thumbUrl(entryId: string): string

  onExportProgress(callback: (progress: ExportProgress) => void): () => void
  onShortcutToggle(callback: () => void): () => void
}
