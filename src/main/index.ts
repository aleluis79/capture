import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  net,
  powerSaveBlocker,
  protocol,
  session,
  shell
} from 'electron'
import { access, mkdir } from 'node:fs/promises'
import { constants as fsConstants, existsSync, readdirSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { OpenDialogOptions, SaveDialogOptions } from 'electron'
import { IPC } from '@shared/channels'
import { buildOutputFilename } from '@shared/format'
import { createDefaultSettings, isValidShortcut } from '@shared/settings'
import type {
  CleanupOutcome,
  ExportProgress,
  ExportRunOutcome,
  ExportRunRequest,
  HistoryEntry,
  PlatformInfo,
  RecorderFinishRequest,
  RecorderStartRequest,
  Settings,
  ShortcutState,
  SourceInfo
} from '@shared/types'
import { ExportError, Exporter } from './exporter'
import { extractThumbnail, probeMedia, resolveFfmpegPath } from './ffmpeg'
import { HistoryStore } from './historyStore'
import { applyPlatformSwitches, buildPlatformInfo, detectSessionType } from './platform'
import { RecordingSessions } from './recordingSessions'
import { SettingsStore } from './settingsStore'

const SESSION_TYPE = detectSessionType(process.platform, process.env)

applyPlatformSwitches(app, SESSION_TYPE)

if (process.platform === 'linux') {
  app.setDesktopName('captura.desktop')
}
if (process.platform === 'win32') {
  app.setAppUserModelId('com.alejandro.captura')
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'captura-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
])

let mainWindow: BrowserWindow | null = null
let settingsStore: SettingsStore
let historyStore: HistoryStore
let sessions: RecordingSessions
let exporter: Exporter
let platformInfo: PlatformInfo
let ffmpegPath: string | null = null
let pendingSourceId: string | null = null
let powerSaveId: number | null = null
let shortcutState: ShortcutState = { accelerator: '', registered: false, error: null }

function loadDevFfmpeg(): string | null {
  if (app.isPackaged) {
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const resolved = require('ffmpeg-static') as string | null
    return resolved && existsSync(resolved) ? resolved : null
  } catch {
    return null
  }
}

function clearStaleMarkers(recordingsDir: string): void {
  if (!existsSync(recordingsDir)) {
    return
  }
  for (const dirent of readdirSync(recordingsDir, { withFileTypes: true })) {
    if (dirent.isDirectory()) {
      rmSync(join(recordingsDir, dirent.name, '.in-progress'), { force: true })
    }
  }
}

async function ensureWritableDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  await access(dir, fsConstants.W_OK)
}

function startPowerSave(): void {
  if (powerSaveId !== null && powerSaveBlocker.isStarted(powerSaveId)) {
    return
  }
  powerSaveId = powerSaveBlocker.start('prevent-display-sleep')
}

function stopPowerSaveIfIdle(): void {
  if (sessions.activeCount() > 0) {
    return
  }
  if (powerSaveId !== null && powerSaveBlocker.isStarted(powerSaveId)) {
    powerSaveBlocker.stop(powerSaveId)
  }
  powerSaveId = null
}

function applyShortcut(accelerator: string): ShortcutState {
  if (shortcutState.registered && shortcutState.accelerator) {
    globalShortcut.unregister(shortcutState.accelerator)
  }

  let registered = false
  try {
    registered = globalShortcut.register(accelerator, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC.shortcutToggle)
      }
    })
  } catch {
    registered = false
  }

  shortcutState = {
    accelerator,
    registered,
    error: registered
      ? null
      : 'No se pudo registrar el atajo global. Puedes iniciar y detener la grabación desde la ventana.'
  }

  return { ...shortcutState }
}

function registerProtocol(): void {
  protocol.handle('captura-media', (request) => {
    const url = new URL(request.url)
    const id = decodeURIComponent(url.hostname || url.pathname.replace(/^\/+/, ''))
    const entry = historyStore.find(id)

    if (!entry) {
      return new Response('Grabación no encontrada', { status: 404 })
    }

    if (url.pathname === '/thumb') {
      if (entry.thumbPath && existsSync(entry.thumbPath)) {
        return net.fetch(pathToFileURL(entry.thumbPath).toString())
      }
      return new Response('Miniatura no disponible', { status: 404 })
    }

    let filePath = entry.sourcePath
    if (!existsSync(filePath)) {
      const latest = [...entry.exports].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      if (!latest || !existsSync(latest.path)) {
        return new Response('Archivo no disponible', { status: 404 })
      }
      filePath = latest.path
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })
}

function registerDisplayMediaHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      const respondWithSource = (source: Electron.DesktopCapturerSource | undefined): void => {
        if (!source) {
          callback(null)
          return
        }
        if (request.audioRequested) {
          try {
            callback({ video: source, audio: 'loopback' })
            return
          } catch {
            // Si loopback no está soportado, continuamos solo con vídeo.
          }
        }
        callback({ video: source })
      }

      try {
        if (pendingSourceId) {
          const requested = pendingSourceId
          pendingSourceId = null
          const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            thumbnailSize: { width: 0, height: 0 }
          })
          const source = sources.find((candidate) => candidate.id === requested)
          respondWithSource(source)
          return
        }

        if (SESSION_TYPE === 'wayland') {
          const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            thumbnailSize: { width: 0, height: 0 }
          })
          respondWithSource(sources[0])
          return
        }

        callback(null)
      } catch {
        callback(null)
      }
    },
    { useSystemPicker: true }
  )
}

function registerIpc(): void {
  ipcMain.handle(IPC.platformInfo, () => platformInfo)

  ipcMain.handle(IPC.settingsGet, () => settingsStore.get())

  ipcMain.handle(IPC.settingsSet, async (_event, patch: Partial<Settings>) => {
    if (typeof patch.outputDir === 'string' && patch.outputDir.trim().length > 0) {
      await ensureWritableDir(patch.outputDir)
    }

    const updated = settingsStore.update(patch)
    if (patch.shortcut && patch.shortcut !== shortcutState.accelerator) {
      applyShortcut(updated.shortcut)
    }
    return updated
  })

  ipcMain.handle(IPC.settingsChooseOutputDir, async () => {
    const options: OpenDialogOptions = {
      title: 'Elegir carpeta de grabaciones',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const dir = result.filePaths[0]
    await ensureWritableDir(dir)
    return settingsStore.update({ outputDir: dir })
  })

  ipcMain.handle(IPC.sourcesList, async (): Promise<SourceInfo[]> => {
    if (SESSION_TYPE === 'wayland') {
      return []
    }

    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: false
    })

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      kind: source.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnail: source.thumbnail.toDataURL(),
      displayId: source.display_id
    }))
  })

  ipcMain.handle(IPC.sourcesSetPending, (_event, sourceId: string | null) => {
    pendingSourceId = sourceId
  })

  ipcMain.handle(
    IPC.recorderStart,
    async (_event, _request: RecorderStartRequest): Promise<{ sessionId: string }> => {
      const { sessionId } = await sessions.start()
      startPowerSave()
      return { sessionId }
    }
  )

  ipcMain.handle(
    IPC.recorderChunk,
    async (_event, payload: { sessionId: string; chunk: ArrayBuffer }) => {
      await sessions.append(payload.sessionId, new Uint8Array(payload.chunk))
    }
  )

  ipcMain.handle(
    IPC.recorderFinish,
    async (_event, request: RecorderFinishRequest): Promise<HistoryEntry> => {
      const finished = await sessions.finish(request.sessionId)
      stopPowerSaveIfIdle()

      const width = Math.max(2, Math.floor(request.width / 2) * 2)
      const height = Math.max(2, Math.floor(request.height / 2) * 2)
      const thumbPath = join(finished.dir, 'thumb.jpg')
      let thumbnailReady = false

      if (ffmpegPath) {
        thumbnailReady = await extractThumbnail(
          ffmpegPath,
          finished.sourcePath,
          thumbPath,
          Math.min(500, Math.max(0, request.durationMs / 2))
        )
      }

      const entry: HistoryEntry = {
        id: request.sessionId,
        createdAt: new Date().toISOString(),
        durationMs: Math.max(0, Math.round(request.durationMs)),
        sizeBytes: finished.sizeBytes,
        width,
        height,
        fps: request.fps,
        mode: request.mode,
        hasAudio: request.hasAudio === true,
        sourcePath: finished.sourcePath,
        thumbPath: thumbnailReady ? thumbPath : null,
        exports: [],
        status: 'complete'
      }

      historyStore.add(entry)
      return entry
    }
  )

  ipcMain.handle(IPC.recorderAbort, async (_event, sessionId: string) => {
    await sessions.abort(sessionId)
    stopPowerSaveIfIdle()
  })

  ipcMain.handle(IPC.historyList, () => historyStore.list())

  ipcMain.handle(IPC.historyRemove, (_event, id: string) => {
    historyStore.remove(id)
    return historyStore.list()
  })

  ipcMain.handle(IPC.historyOpenFolder, async (_event, id: string) => {
    if (!historyStore.find(id)) {
      return
    }
    await shell.openPath(historyStore.entryDir(id))
  })

  ipcMain.handle(IPC.historyReveal, (_event, id: string) => {
    const entry = historyStore.find(id)
    if (!entry) {
      return
    }

    const latest = [...entry.exports].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    if (latest && existsSync(latest.path)) {
      shell.showItemInFolder(latest.path)
      return
    }

    if (existsSync(entry.sourcePath)) {
      shell.showItemInFolder(entry.sourcePath)
    }
  })

  ipcMain.handle(IPC.historyCleanup, (): CleanupOutcome => {
    const result = historyStore.cleanupSources()
    return { entries: historyStore.list(), ...result }
  })

  ipcMain.handle(IPC.historyOrphans, () => historyStore.orphans())

  ipcMain.handle(IPC.historyRecover, async (_event, id: string): Promise<HistoryEntry> => {
    const orphan = historyStore.orphans().find((candidate) => candidate.id === id)
    if (!orphan) {
      throw new Error('La grabación interrumpida ya no está disponible')
    }

    const probe = ffmpegPath ? await probeMedia(ffmpegPath, orphan.sourcePath) : null

    if (ffmpegPath) {
      await extractThumbnail(
        ffmpegPath,
        orphan.sourcePath,
        join(historyStore.entryDir(id), 'thumb.jpg'),
        500
      )
    }

    return historyStore.recoverOrphan(id, {
      durationMs: probe?.durationMs ?? 0,
      width: probe?.width ?? 0,
      height: probe?.height ?? 0,
      fps: probe?.fps || 30,
      mode: 'screen',
      hasAudio: probe?.hasAudio ?? false
    })
  })

  ipcMain.handle(IPC.historyDiscardOrphan, (_event, id: string) => {
    historyStore.discardOrphan(id)
  })

  ipcMain.handle(
    IPC.exportPickOutput,
    async (_event, suggestedName: string): Promise<string | null> => {
      const settings = settingsStore.get()
      const safeName = basename(suggestedName || buildOutputFilename())

      const options: SaveDialogOptions = {
        title: 'Guardar vídeo exportado',
        defaultPath: join(settings.outputDir, safeName),
        filters: [{ name: 'Vídeo MP4', extensions: ['mp4'] }],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      }
      const result = mainWindow
        ? await dialog.showSaveDialog(mainWindow, options)
        : await dialog.showSaveDialog(options)

      if (result.canceled || !result.filePath) {
        return null
      }

      return result.filePath.toLowerCase().endsWith('.mp4')
        ? result.filePath
        : `${result.filePath}.mp4`
    }
  )

  ipcMain.handle(
    IPC.exportRun,
    async (event, request: ExportRunRequest): Promise<ExportRunOutcome> => {
      const entry = historyStore.find(request.entryId)
      if (!entry) {
        return {
          ok: false,
          errorCode: 'entry-missing',
          message: 'La grabación seleccionada ya no existe.'
        }
      }

      if (!existsSync(entry.sourcePath)) {
        return {
          ok: false,
          errorCode: 'entry-missing',
          message: 'La grabación original ya no está disponible en el disco.'
        }
      }

      try {
        const result = await exporter.run(
          {
            exportId: request.exportId,
            inputPath: entry.sourcePath,
            outputPath: request.outputPath,
            startMs: request.options.startMs,
            endMs: request.options.endMs,
            width: request.options.width,
            height: request.options.height,
            fps: request.options.fps,
            quality: request.options.quality,
            normalizeAudio: settingsStore.get().normalizeAudio
          },
          {
            onProgress: (percent) => {
              if (!event.sender.isDestroyed()) {
                const progress: ExportProgress = {
                  exportId: request.exportId,
                  percent,
                  etaMs: null
                }
                event.sender.send(IPC.exportProgress, progress)
              }
            }
          }
        )

        historyStore.addExport(entry.id, {
          path: result.path,
          createdAt: new Date().toISOString(),
          width: request.options.width,
          height: request.options.height,
          fps: request.options.fps
        })

        return { ok: true, result }
      } catch (error) {
        if (error instanceof ExportError) {
          return { ok: false, errorCode: error.code, message: error.message }
        }
        return {
          ok: false,
          errorCode: 'ffmpeg-failed',
          message: 'La exportación falló por un error inesperado.'
        }
      }
    }
  )

  ipcMain.handle(IPC.exportCancel, (_event, exportId: string) => exporter.cancel(exportId))

  ipcMain.handle(IPC.shortcutGet, () => ({ ...shortcutState }))

  ipcMain.handle(IPC.shortcutSet, (_event, accelerator: string): ShortcutState => {
    if (!isValidShortcut(accelerator)) {
      return { ...shortcutState, error: 'La combinación de teclas no es válida.' }
    }

    const previous = { ...shortcutState }
    const next = applyShortcut(accelerator)

    if (!next.registered) {
      if (previous.registered) {
        applyShortcut(previous.accelerator)
      } else {
        shortcutState = previous
      }
      return { ...shortcutState, error: 'La combinación no está disponible en este sistema.' }
    }

    settingsStore.update({ shortcut: accelerator })
    return { ...next, error: null }
  })

  ipcMain.handle(IPC.windowHide, () => {
    mainWindow?.minimize()
  })

  ipcMain.handle(IPC.windowShow, () => {
    if (!mainWindow) {
      return
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.show()
    mainWindow.focus()
  })

  ipcMain.handle(IPC.appRevealPath, (_event, filePath: string) => {
    if (typeof filePath === 'string' && existsSync(filePath)) {
      shell.showItemInFolder(filePath)
    }
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 980,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d1117',
    title: 'Captura',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function bootstrap(): Promise<void> {
  const dataDir = process.env['CAPTURA_DATA_DIR'] || app.getPath('userData')
  const defaults = createDefaultSettings(join(app.getPath('videos'), 'Capturas'))

  settingsStore = new SettingsStore(join(dataDir, 'settings.json'), defaults)
  historyStore = new HistoryStore(dataDir)
  sessions = new RecordingSessions(historyStore.recordingsDir)
  ffmpegPath = resolveFfmpegPath({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    platform: process.platform,
    devPath: loadDevFfmpeg()
  })
  exporter = new Exporter(ffmpegPath)
  platformInfo = buildPlatformInfo(process.platform, SESSION_TYPE, app.getVersion())

  clearStaleMarkers(historyStore.recordingsDir)
  registerProtocol()
  registerDisplayMediaHandler()
  registerIpc()

  const initialSettings = settingsStore.get()
  if (process.env['CAPTURA_DISABLE_GLOBAL_SHORTCUTS'] === '1') {
    shortcutState = {
      accelerator: initialSettings.shortcut,
      registered: false,
      error: 'Los atajos globales están desactivados en este entorno.'
    }
  } else {
    applyShortcut(initialSettings.shortcut)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}

const hasLock = app.requestSingleInstanceLock()

if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(bootstrap)

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })
}
