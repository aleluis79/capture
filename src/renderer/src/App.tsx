import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildOutputFilename, formatBytes, formatDuration } from '@shared/format'
import type {
  ExportOptions,
  HistoryEntry,
  OrphanRecording,
  PlatformInfo,
  Region,
  Settings,
  ShortcutState,
  SourceInfo
} from '@shared/types'
import { acquireDisplayStream, listAudioInputs, stopStream } from './lib/capture'
import type { AudioInputDevice } from '@shared/types'
import { useScreenRecorder } from './hooks/useScreenRecorder'
import { ModeSelector } from './components/ModeSelector'
import { SourcePicker } from './components/SourcePicker'
import { SettingsPanel } from './components/SettingsPanel'
import { RegionSelector } from './components/RegionSelector'
import { CountdownOverlay } from './components/CountdownOverlay'
import { ReviewPanel } from './components/ReviewPanel'
import type { ExportSelection } from './components/ReviewPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { OrphanBanner } from './components/OrphanBanner'
import { SettingsDialog } from './components/SettingsDialog'
import { Toast } from './components/Toast'
import type { ToastKind, ToastMessage } from './components/Toast'
import { t } from './i18n/es'

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `export-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function messageFrom(error: unknown): string {
  if (error instanceof Error) {
    return (
      error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') ||
      t.errors.generic
    )
  }
  return t.errors.generic
}

export default function App(): React.JSX.Element {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [orphans, setOrphans] = useState<OrphanRecording[]>([])
  const [orphanBusy, setOrphanBusy] = useState(false)
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [region, setRegion] = useState<Region | null>(null)
  const [regionStream, setRegionStream] = useState<MediaStream | null>(null)
  const [reviewEntry, setReviewEntry] = useState<HistoryEntry | null>(null)
  const [tab, setTab] = useState<'record' | 'history'>('record')
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcut, setShortcut] = useState<ShortcutState | null>(null)
  const [cleanupBusy, setCleanupBusy] = useState(false)
  const [audioInputs, setAudioInputs] = useState<AudioInputDevice[]>([])

  const regionStreamRef = useRef<MediaStream | null>(null)
  const exportIdRef = useRef<string | null>(null)
  const shortcutActionRef = useRef<() => void>(() => undefined)

  const showToast = useCallback((kind: ToastKind, message: string) => {
    setToast({ kind, message })
  }, [])

  const refreshHistory = useCallback(async (): Promise<HistoryEntry[]> => {
    const list = await window.api.listHistory()
    setHistory(list)
    return list
  }, [])

  const handleFinished = useCallback(
    (entry: HistoryEntry) => {
      setReviewEntry(entry)
      setRegion(null)
      if (regionStreamRef.current) {
        stopStream(regionStreamRef.current)
        regionStreamRef.current = null
      }
      void refreshHistory()
      showToast('success', t.notifications.recordingSaved)
    },
    [refreshHistory, showToast]
  )

  const handleError = useCallback(
    (message: string) => {
      showToast('error', message)
    },
    [showToast]
  )

  const recorder = useScreenRecorder({ onFinished: handleFinished, onError: handleError })
  const mode = recorder.state.mode

  useEffect(() => {
    let alive = true

    const load = async (): Promise<void> => {
      try {
        const [info, loadedSettings, list, orphanList, shortcutState] = await Promise.all([
          window.api.getPlatformInfo(),
          window.api.getSettings(),
          window.api.listHistory(),
          window.api.listOrphans(),
          window.api.getShortcut()
        ])

        if (!alive) {
          return
        }

        setPlatformInfo(info)
        setSettings(loadedSettings)
        setHistory(list)
        setOrphans(orphanList)
        setShortcut(shortcutState)
      } catch (error) {
        if (alive) {
          showToast('error', messageFrom(error))
        }
      }
    }

    void load()
    return () => {
      alive = false
    }
  }, [showToast])

  useEffect(() => {
    if (!platformInfo || platformInfo.needsSystemPicker) {
      setSources([])
      return
    }

    let alive = true
    setSourcesLoading(true)

    void window.api
      .listSources()
      .then((list) => {
        if (alive) {
          setSources(list)
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          showToast('error', messageFrom(error))
        }
      })
      .finally(() => {
        if (alive) {
          setSourcesLoading(false)
        }
      })

    return () => {
      alive = false
    }
  }, [platformInfo, mode, showToast])

  const filteredSources = useMemo(
    () =>
      sources.filter((source) =>
        mode === 'window' ? source.kind === 'window' : source.kind === 'screen'
      ),
    [sources, mode]
  )

  useEffect(() => {
    if (!platformInfo || platformInfo.needsSystemPicker) {
      return
    }
    if (sourceId && filteredSources.some((source) => source.id === sourceId)) {
      return
    }
    if (filteredSources.length === 1) {
      const only = filteredSources[0]
      setSourceId(only.id)
      void window.api.setPendingSource(only.id)
    }
  }, [filteredSources, platformInfo, sourceId])

  useEffect(() => {
    let alive = true

    void listAudioInputs().then((devices) => {
      if (alive) {
        setAudioInputs(devices)
      }
    })

    return () => {
      alive = false
    }
  }, [settings?.micAudio])

  useEffect(() => {
    return window.api.onExportProgress((progress) => {
      if (progress.exportId === exportIdRef.current) {
        recorder.updateExportProgress(progress.percent)
      }
    })
  }, [recorder.updateExportProgress])

  useEffect(() => {
    shortcutActionRef.current = () => {
      if (settingsOpen) {
        return
      }
      if (recorder.state.phase === 'recording') {
        recorder.stop()
        return
      }
      if (recorder.state.phase === 'idle' || recorder.state.phase === 'review') {
        void handleStart()
      }
    }
  })

  useEffect(() => {
    return window.api.onShortcutToggle(() => shortcutActionRef.current())
  }, [])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!settingsOpen) {
      return
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settingsOpen])

  const updateSettings = async (patch: Partial<Settings>): Promise<void> => {
    try {
      const updated = await window.api.updateSettings(patch)
      setSettings(updated)
    } catch (error) {
      showToast('error', messageFrom(error))
    }
  }

  const clearRegion = (): void => {
    setRegion(null)
    recorder.setRegion(null)
    if (regionStreamRef.current) {
      stopStream(regionStreamRef.current)
      regionStreamRef.current = null
    }
    if (regionStream) {
      stopStream(regionStream)
      setRegionStream(null)
    }
  }

  const handleModeChange = (next: typeof mode): void => {
    if (recorder.state.phase !== 'idle' && recorder.state.phase !== 'review') {
      return
    }
    recorder.setMode(next)
    setSourceId(null)
    void window.api.setPendingSource(null)
    clearRegion()
  }

  const handleSelectSource = (id: string): void => {
    setSourceId(id)
    void window.api.setPendingSource(id)
  }

  const chooseRegion = async (): Promise<void> => {
    if (!settings) {
      return
    }
    if (!platformInfo?.needsSystemPicker && !sourceId) {
      showToast('error', t.errors.selectSource)
      return
    }

    try {
      if (sourceId && !platformInfo?.needsSystemPicker) {
        await window.api.setPendingSource(sourceId)
      }
      const stream = await acquireDisplayStream(settings.fps)
      setRegionStream(stream)
    } catch (error) {
      showToast('error', messageFrom(error))
    }
  }

  const handleRegionConfirm = (selected: Region): void => {
    if (!regionStream) {
      return
    }
    regionStreamRef.current = regionStream
    setRegionStream(null)
    setRegion(selected)
    recorder.setRegion(selected)
  }

  const handleRegionCancel = (): void => {
    if (regionStream) {
      stopStream(regionStream)
      setRegionStream(null)
    }
  }

  async function handleStart(): Promise<void> {
    if (!settings || !platformInfo || recorder.preparing) {
      return
    }

    if (recorder.state.phase === 'recording') {
      recorder.stop()
      return
    }
    if (recorder.state.phase === 'countdown') {
      recorder.cancel()
      return
    }
    if (recorder.state.phase !== 'idle' && recorder.state.phase !== 'review') {
      return
    }

    if (recorder.state.phase === 'review') {
      setReviewEntry(null)
      recorder.reset()
      clearRegion()
    }

    const currentMode = recorder.state.mode
    const audioOptions = {
      systemAudio: settings.systemAudio,
      micAudio: settings.micAudio,
      micDeviceId: settings.micDeviceId,
      systemAudioGain: settings.systemAudioGain,
      micGain: settings.micGain
    }

    if (currentMode === 'region') {
      if (!region || !regionStreamRef.current) {
        await chooseRegion()
        return
      }
      const stream = regionStreamRef.current
      regionStreamRef.current = null
      await recorder.start({
        mode: currentMode,
        region,
        stream,
        fps: settings.fps,
        quality: settings.quality,
        countdownSeconds: settings.countdownSeconds,
        ...audioOptions
      })
      return
    }

    if (!platformInfo.needsSystemPicker) {
      if (!sourceId) {
        showToast('error', t.errors.selectSource)
        return
      }
      await window.api.setPendingSource(sourceId)
    }

    await recorder.start({
      mode: currentMode,
      region: null,
      fps: settings.fps,
      quality: settings.quality,
      countdownSeconds: settings.countdownSeconds,
      ...audioOptions
    })
  }

  const handleNewRecording = (): void => {
    setReviewEntry(null)
    recorder.reset()
    clearRegion()
    setTab('record')
  }

  const handleDeleteReview = async (): Promise<void> => {
    if (!reviewEntry) {
      return
    }
    try {
      const list = await window.api.removeRecording(reviewEntry.id)
      setHistory(list)
      setReviewEntry(null)
      recorder.reset()
      clearRegion()
      showToast('info', t.notifications.recordingDeleted)
    } catch (error) {
      showToast('error', messageFrom(error))
    }
  }

  const handleExport = async (selection: ExportSelection): Promise<void> => {
    if (!reviewEntry) {
      return
    }

    try {
      const outputPath = await window.api.chooseExportPath(buildOutputFilename())
      if (!outputPath) {
        return
      }

      const exportId = createId()
      exportIdRef.current = exportId

      const options: ExportOptions = { ...selection }
      recorder.beginExport()

      const outcome = await window.api.runExport({
        exportId,
        entryId: reviewEntry.id,
        outputPath,
        options
      })

      if (outcome.ok) {
        showToast('success', t.review.exportSuccess)
        const list = await refreshHistory()
        const updated = list.find((entry) => entry.id === reviewEntry.id)
        if (updated) {
          setReviewEntry(updated)
        }
      } else if (outcome.errorCode === 'cancelled') {
        showToast('info', t.errors.exportCancelled)
      } else {
        showToast('error', outcome.message || t.errors.exportFailed)
      }
    } catch (error) {
      showToast('error', messageFrom(error))
    } finally {
      exportIdRef.current = null
      recorder.finishExport()
    }
  }

  const handleCancelExport = async (): Promise<void> => {
    if (exportIdRef.current) {
      await window.api.cancelExport(exportIdRef.current)
    }
  }

  const handleReexport = (entry: HistoryEntry): void => {
    setReviewEntry(entry)
    recorder.openEntry(entry.id)
    setTab('record')
  }

  const handleDeleteHistory = async (id: string): Promise<void> => {
    try {
      const list = await window.api.removeRecording(id)
      setHistory(list)
      if (reviewEntry?.id === id) {
        setReviewEntry(null)
        recorder.reset()
      }
      showToast('info', t.notifications.recordingDeleted)
    } catch (error) {
      showToast('error', messageFrom(error))
    }
  }

  const handleCleanup = async (): Promise<void> => {
    setCleanupBusy(true)
    try {
      const outcome = await window.api.cleanupSources()
      setHistory(outcome.entries)
      showToast(
        'success',
        t.notifications.cleanup.replace('{size}', formatBytes(outcome.reclaimedBytes))
      )
    } catch (error) {
      showToast('error', messageFrom(error))
    } finally {
      setCleanupBusy(false)
    }
  }

  const handleRecoverOrphan = async (id: string): Promise<void> => {
    setOrphanBusy(true)
    try {
      const entry = await window.api.recoverOrphan(id)
      setOrphans(await window.api.listOrphans())
      await refreshHistory()
      setReviewEntry(entry)
      recorder.openEntry(entry.id)
      setTab('record')
      showToast('success', t.notifications.recordingRecovered)
    } catch (error) {
      showToast('error', messageFrom(error))
    } finally {
      setOrphanBusy(false)
    }
  }

  const handleDiscardOrphan = async (id: string): Promise<void> => {
    setOrphanBusy(true)
    try {
      await window.api.discardOrphan(id)
      setOrphans(await window.api.listOrphans())
    } catch (error) {
      showToast('error', messageFrom(error))
    } finally {
      setOrphanBusy(false)
    }
  }

  const handleChooseFolder = async (): Promise<void> => {
    try {
      const updated = await window.api.chooseOutputDir()
      if (updated) {
        setSettings(updated)
        showToast('success', t.notifications.folderChanged)
      }
    } catch (error) {
      showToast('error', messageFrom(error))
    }
  }

  const handleSaveShortcut = async (accelerator: string): Promise<void> => {
    const state = await window.api.setShortcut(accelerator)
    setShortcut(state)
    if (!state.registered) {
      throw new Error(state.error ?? t.errors.shortcutRegister)
    }
    setSettings(await window.api.getSettings())
    showToast('success', t.notifications.shortcutSaved)
  }

  if (!platformInfo || !settings) {
    return <div className="loading-screen">{t.capture.loading}</div>
  }

  const busy =
    recorder.preparing ||
    recorder.state.phase === 'countdown' ||
    recorder.state.phase === 'recording' ||
    recorder.state.phase === 'stopping' ||
    recorder.state.phase === 'exporting'

  const primaryLabel = recorder.preparing
    ? t.capture.preparing
    : recorder.state.phase === 'recording'
      ? t.actions.stop
      : recorder.state.phase === 'stopping'
        ? t.capture.finalizing
        : mode === 'region' && !region
          ? t.actions.selectRegion
          : t.actions.record

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>{t.appName}</h1>
            <p>{t.tagline}</p>
          </div>
        </div>

        <nav className="tabs" aria-label={t.common.sections}>
          <button
            type="button"
            className={tab === 'record' ? 'tab active' : 'tab'}
            onClick={() => setTab('record')}
            disabled={recorder.state.phase === 'recording'}
          >
            {t.tabs.record}
          </button>
          <button
            type="button"
            className={tab === 'history' ? 'tab active' : 'tab'}
            onClick={() => setTab('history')}
            disabled={busy}
          >
            {t.tabs.history}
          </button>
        </nav>

        <button
          type="button"
          className="icon-button"
          aria-label={t.actions.settings}
          title={t.actions.settings}
          disabled={busy}
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
        </button>
      </header>

      <main className="app-main">
        {tab === 'record' ? (
          reviewEntry ? (
            <ReviewPanel
              key={reviewEntry.id}
              entry={reviewEntry}
              defaults={settings}
              exporting={recorder.state.phase === 'exporting'}
              exportPercent={recorder.state.exportPercent}
              onExport={(selection) => void handleExport(selection)}
              onCancelExport={() => void handleCancelExport()}
              onNewRecording={handleNewRecording}
              onDelete={() => void handleDeleteReview()}
              onReveal={(path) => void window.api.revealPath(path)}
            />
          ) : (
            <div className="capture-layout">
              <OrphanBanner
                orphans={orphans}
                busy={orphanBusy}
                onRecover={(id) => void handleRecoverOrphan(id)}
                onDiscard={(id) => void handleDiscardOrphan(id)}
              />

              <div className="capture-heading">
                <ModeSelector mode={mode} disabled={busy} onChange={handleModeChange} />

                {recorder.state.phase === 'recording' && (
                  <div className="recording-bar" role="status">
                    <span className="rec-dot" aria-hidden="true" />
                    <span>{t.capture.recording}</span>
                    <strong className="timer">{formatDuration(recorder.state.elapsedMs)}</strong>
                    {(settings.systemAudio || settings.micAudio) && (
                      <div
                        className="audio-meter"
                        role="meter"
                        aria-label={t.capture.audioLevel}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(recorder.audioLevel * 100)}
                        title={t.capture.audioLevelHint}
                      >
                        <div
                          className="audio-meter-fill"
                          style={{ width: `${Math.round(recorder.audioLevel * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <SourcePicker
                sources={filteredSources}
                selectedId={sourceId}
                mode={mode}
                sessionType={platformInfo.sessionType}
                loading={sourcesLoading}
                disabled={busy}
                onSelect={handleSelectSource}
              />

              <SettingsPanel
                settings={settings}
                cursorNotice={platformInfo.cursorNotice}
                audioInputs={audioInputs}
                canEnableSystemAudio={platformInfo.canEnableSystemAudio}
                disabled={busy}
                onChange={(patch) => void updateSettings(patch)}
              />

              {mode === 'region' && (
                <section className="panel region-panel">
                  <div>
                    <h2>{t.capture.regionHeading}</h2>
                    <p className="muted">
                      {region
                        ? `${t.capture.regionReady}: ${region.width} × ${region.height} px`
                        : t.capture.regionPending}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn ghost small"
                    disabled={busy}
                    onClick={() => void chooseRegion()}
                  >
                    {region ? t.actions.changeRegion : t.actions.selectRegion}
                  </button>
                </section>
              )}

              <div className="record-row">
                <button
                  type="button"
                  className={`btn record-button ${
                    recorder.state.phase === 'recording' ? 'recording' : ''
                  }`}
                  disabled={recorder.preparing || recorder.state.phase === 'stopping'}
                  onClick={() => void handleStart()}
                >
                  <span className="record-dot" aria-hidden="true" />
                  {primaryLabel}
                </button>
                <p className="muted record-hint">
                  {mode === 'region' && !region
                    ? t.capture.regionButtonHint
                    : recorder.state.phase === 'recording'
                      ? `${formatDuration(recorder.state.elapsedMs)} · ${settings.fps} FPS`
                      : t.capture.outputHint}
                </p>
              </div>
            </div>
          )
        ) : (
          <HistoryPanel
            entries={history}
            cleanupBusy={cleanupBusy}
            onReexport={handleReexport}
            onOpenFolder={(id) => void window.api.openEntryFolder(id)}
            onRevealEntry={(id) => void window.api.revealEntry(id)}
            onDelete={(id) => void handleDeleteHistory(id)}
            onCleanup={() => void handleCleanup()}
          />
        )}
      </main>

      {recorder.state.phase === 'countdown' && (
        <CountdownOverlay
          remaining={recorder.state.countdownRemaining}
          onCancel={recorder.cancel}
        />
      )}

      {regionStream && (
        <RegionSelector
          stream={regionStream}
          onConfirm={handleRegionConfirm}
          onCancel={handleRegionCancel}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          platformInfo={platformInfo}
          shortcut={shortcut}
          onClose={() => setSettingsOpen(false)}
          onChooseFolder={() => void handleChooseFolder()}
          onSaveShortcut={handleSaveShortcut}
        />
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
