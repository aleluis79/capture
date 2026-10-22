import { formatBytes } from '@shared/format'
import type { OrphanRecording } from '@shared/types'
import { t } from '../i18n/es'

interface OrphanBannerProps {
  orphans: OrphanRecording[]
  busy: boolean
  onRecover: (id: string) => void
  onDiscard: (id: string) => void
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

export function OrphanBanner({ orphans, busy, onRecover, onDiscard }: OrphanBannerProps) {
  if (orphans.length === 0) {
    return null
  }

  return (
    <section className="panel orphan-panel">
      <div className="panel-heading">
        <h2>{t.history.orphansTitle}</h2>
      </div>
      <p className="muted">{t.history.orphansBody}</p>
      <ul className="orphan-list">
        {orphans.map((orphan) => (
          <li key={orphan.id} className="orphan-item">
            <div>
              <strong>{formatDate(orphan.createdAt)}</strong>
              <span className="muted"> · {formatBytes(orphan.sizeBytes)}</span>
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="btn small primary"
                disabled={busy}
                onClick={() => onRecover(orphan.id)}
              >
                {t.actions.recover}
              </button>
              <button
                type="button"
                className="btn small ghost"
                disabled={busy}
                onClick={() => onDiscard(orphan.id)}
              >
                {t.actions.discard}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
