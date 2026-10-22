import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/channels'
import type { CapturaApi } from '@shared/api'
import type { ExportProgress } from '@shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => {
    callback(payload)
  }
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: CapturaApi = {
  getPlatformInfo: () => ipcRenderer.invoke(IPC.platformInfo),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch),
  chooseOutputDir: () => ipcRenderer.invoke(IPC.settingsChooseOutputDir),

  listSources: () => ipcRenderer.invoke(IPC.sourcesList),
  setPendingSource: (sourceId) => ipcRenderer.invoke(IPC.sourcesSetPending, sourceId),

  startRecording: (request) => ipcRenderer.invoke(IPC.recorderStart, request),
  appendChunk: (sessionId, chunk) => ipcRenderer.invoke(IPC.recorderChunk, { sessionId, chunk }),
  finishRecording: (request) => ipcRenderer.invoke(IPC.recorderFinish, request),
  abortRecording: (sessionId) => ipcRenderer.invoke(IPC.recorderAbort, sessionId),

  listHistory: () => ipcRenderer.invoke(IPC.historyList),
  removeRecording: (id) => ipcRenderer.invoke(IPC.historyRemove, id),
  openEntryFolder: (id) => ipcRenderer.invoke(IPC.historyOpenFolder, id),
  revealEntry: (id) => ipcRenderer.invoke(IPC.historyReveal, id),
  cleanupSources: () => ipcRenderer.invoke(IPC.historyCleanup),
  listOrphans: () => ipcRenderer.invoke(IPC.historyOrphans),
  recoverOrphan: (id) => ipcRenderer.invoke(IPC.historyRecover, id),
  discardOrphan: (id) => ipcRenderer.invoke(IPC.historyDiscardOrphan, id),

  chooseExportPath: (suggestedName) => ipcRenderer.invoke(IPC.exportPickOutput, suggestedName),
  runExport: (request) => ipcRenderer.invoke(IPC.exportRun, request),
  cancelExport: (exportId) => ipcRenderer.invoke(IPC.exportCancel, exportId),

  getShortcut: () => ipcRenderer.invoke(IPC.shortcutGet),
  setShortcut: (accelerator) => ipcRenderer.invoke(IPC.shortcutSet, accelerator),

  hideWindow: () => ipcRenderer.invoke(IPC.windowHide),
  showWindow: () => ipcRenderer.invoke(IPC.windowShow),
  revealPath: (path) => ipcRenderer.invoke(IPC.appRevealPath, path),

  mediaUrl: (entryId) => `captura-media://${encodeURIComponent(entryId)}`,
  thumbUrl: (entryId) => `captura-media://${encodeURIComponent(entryId)}/thumb`,

  onExportProgress: (callback) => subscribe<ExportProgress>(IPC.exportProgress, callback),
  onShortcutToggle: (callback) => subscribe<void>(IPC.shortcutToggle, callback)
}

contextBridge.exposeInMainWorld('api', api)
