import type { SessionType, SourceInfo } from '@shared/types'
import { t } from '../i18n/es'

interface SourcePickerProps {
  sources: SourceInfo[]
  selectedId: string | null
  mode: 'screen' | 'window' | 'region'
  sessionType: SessionType
  loading: boolean
  disabled?: boolean
  onSelect: (id: string) => void
}

export function SourcePicker({
  sources,
  selectedId,
  mode,
  sessionType,
  loading,
  disabled = false,
  onSelect
}: SourcePickerProps) {
  if (sessionType === 'wayland') {
    return (
      <section className="panel source-panel">
        <div className="panel-heading">
          <h2>{t.capture.source}</h2>
        </div>
        <div className="notice notice-info">
          <strong>{t.capture.waylandTitle}</strong>
          <p>{t.capture.waylandBody}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="panel source-panel">
      <div className="panel-heading">
        <h2>{mode === 'region' ? t.capture.baseScreen : t.capture.source}</h2>
      </div>

      {loading ? (
        <p className="muted">{t.capture.loadingSources}</p>
      ) : sources.length === 0 ? (
        <p className="muted">{t.capture.noSources}</p>
      ) : (
        <div className="source-grid">
          {sources.map((source) => (
            <button
              key={source.id}
              type="button"
              className={`source-card ${selectedId === source.id ? 'selected' : ''}`}
              disabled={disabled}
              onClick={() => onSelect(source.id)}
              title={source.name}
            >
              <img src={source.thumbnail} alt="" />
              <span className="source-name">{source.name}</span>
              <span className="source-kind">
                {source.kind === 'screen' ? t.capture.screen : t.capture.window}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
