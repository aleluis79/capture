import type { RecordingMode } from '@shared/types'
import { t } from '../i18n/es'

interface ModeSelectorProps {
  mode: RecordingMode
  disabled?: boolean
  onChange: (mode: RecordingMode) => void
}

const MODES: Array<{ id: RecordingMode; label: string; description: string; icon: string }> = [
  {
    id: 'screen',
    label: t.modes.screen,
    description: t.modeDescriptions.screen,
    icon: 'M3 4h18v12H3zM9 20h6M12 16v4'
  },
  {
    id: 'window',
    label: t.modes.window,
    description: t.modeDescriptions.window,
    icon: 'M3 5h18v14H3zM3 9h18M6 7h1M9 7h1'
  },
  {
    id: 'region',
    label: t.modes.region,
    description: t.modeDescriptions.region,
    icon: 'M4 4h6M4 4v6M20 4h-6M20 4v6M4 20h6M4 20v-6M20 20h-6M20 20v-6'
  }
]

export function ModeSelector({ mode, disabled = false, onChange }: ModeSelectorProps) {
  return (
    <div className="mode-selector" role="tablist" aria-label={t.common.captureMode}>
      {MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={mode === item.id}
          className={`mode-card ${mode === item.id ? 'selected' : ''}`}
          disabled={disabled}
          onClick={() => onChange(item.id)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={item.icon} />
          </svg>
          <span className="mode-label">{item.label}</span>
          <span className="mode-description">{item.description}</span>
        </button>
      ))}
    </div>
  )
}
