import { useState } from 'react'
import { formatBytes, formatDuration } from '@shared/format'
import { totalSize } from '@shared/history'
import type { HistoryEntry } from '@shared/types'
import { t } from '../i18n/es'

interface HistoryPanelProps {
  entries: HistoryEntry[]
  cleanupBusy: boolean
  onReexport: (entry: HistoryEntry) => void
  onOpenFolder: (id: string) => void
  onRevealEntry: (id: string) => void
  onDelete: (id: string) => void
  onCleanup: () => void
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

export function HistoryPanel({
  entries,
  cleanupBusy,
  onReexport,
  onOpenFolder,
  onRevealEntry,
  onDelete,
  onCleanup
}: HistoryPanelProps) {
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [confirmingCleanup, setConfirmingCleanup] = useState(false)

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">●</div>
        <h2>{t.history.title}</h2>
        <p className="muted">{t.history.empty}</p>
      </div>
    )
  }

  return (
    <div className="history-layout">
      <section className="panel history-toolbar">
        <div>
          <h2>{t.history.title}</h2>
          <p className="muted">
            {t.history.total}: {formatBytes(totalSize(entries))} · {entries.length}
          </p>
        </div>
        {confirmingCleanup ? (
          <div className="inline-confirm">
            <span>{t.history.cleanupConfirmBody}</span>
            <button
              type="button"
              className="btn danger small"
              disabled={cleanupBusy}
              onClick={() => {
                onCleanup()
                setConfirmingCleanup(false)
              }}
            >
              {t.actions.confirm}
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setConfirmingCleanup(false)}
            >
              {t.actions.no}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn ghost small"
            disabled={cleanupBusy}
            onClick={() => setConfirmingCleanup(true)}
          >
            {t.actions.cleanup}
          </button>
        )}
      </section>

      <div className="history-list">
        {entries.map((entry) => (
          <article key={entry.id} className="panel history-card">
            <div className="history-thumb">
              {entry.thumbPath ? (
                <img
                  src={window.api.thumbUrl(entry.id)}
                  alt=""
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="thumb-placeholder">▶</div>
              )}
            </div>

            <div className="history-body">
              <header className="history-heading">
                <div>
                  <h3>{formatDate(entry.createdAt)}</h3>
                  <p className="muted">
                    {formatDuration(entry.durationMs)} · {formatBytes(entry.sizeBytes)} ·{' '}
                    {entry.width} × {entry.height} · {entry.fps} FPS
                  </p>
                </div>
                <div className="history-badges">
                  <span className={`badge badge-${entry.mode}`}>{t.modes[entry.mode]}</span>
                  {entry.status === 'recovered' && (
                    <span className="badge badge-warning">{t.history.recovered}</span>
                  )}
                  <span className="badge">
                    {entry.exports.length > 0
                      ? `${entry.exports.length} ${
                          entry.exports.length === 1 ? t.history.exported : t.history.exportedPlural
                        }`
                      : 'WebM'}
                  </span>
                </div>
              </header>

              {confirmingDelete === entry.id ? (
                <div className="inline-confirm">
                  <span>{t.history.deleteConfirm}</span>
                  <button
                    type="button"
                    className="btn danger small"
                    onClick={() => {
                      onDelete(entry.id)
                      setConfirmingDelete(null)
                    }}
                  >
                    {t.actions.confirm}
                  </button>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => setConfirmingDelete(null)}
                  >
                    {t.actions.no}
                  </button>
                </div>
              ) : (
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn small primary"
                    onClick={() => onReexport(entry)}
                  >
                    {t.actions.reexport}
                  </button>
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => onRevealEntry(entry.id)}
                  >
                    {t.actions.reveal}
                  </button>
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => onOpenFolder(entry.id)}
                  >
                    {t.actions.openFolder}
                  </button>
                  <button
                    type="button"
                    className="btn small ghost danger-text"
                    onClick={() => setConfirmingDelete(entry.id)}
                  >
                    {t.actions.delete}
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
