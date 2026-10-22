import type { ResolutionPreset, Settings } from '@shared/types'
import { t } from '../i18n/es'

interface SettingsPanelProps {
  settings: Settings
  cursorNotice: string
  disabled?: boolean
  onChange: (patch: Partial<Settings>) => void
}

const RESOLUTIONS: Array<{ value: ResolutionPreset; label: string }> = [
  { value: 'native', label: t.settings.native },
  { value: '2160p', label: '2160p (4K)' },
  { value: '1440p', label: '1440p' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: 'custom', label: t.settings.custom }
]

const FPS_OPTIONS = [15, 24, 30, 60]

export function SettingsPanel({
  settings,
  cursorNotice,
  disabled = false,
  onChange
}: SettingsPanelProps) {
  return (
    <section className="panel capture-settings">
      <div className="settings-grid">
        <label className="field">
          <span>{t.settings.resolution}</span>
          <select
            value={settings.resolution}
            disabled={disabled}
            onChange={(event) => onChange({ resolution: event.target.value as ResolutionPreset })}
          >
            {RESOLUTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{t.settings.fps}</span>
          <div className="fps-row">
            <select
              value={FPS_OPTIONS.includes(settings.fps) ? String(settings.fps) : 'custom'}
              disabled={disabled}
              onChange={(event) => {
                if (event.target.value !== 'custom') {
                  onChange({ fps: Number(event.target.value) })
                }
              }}
            >
              {FPS_OPTIONS.map((fps) => (
                <option key={fps} value={fps}>
                  {fps} FPS
                </option>
              ))}
              <option value="custom">{t.settings.custom}</option>
            </select>
            <input
              type="number"
              min={1}
              max={120}
              value={settings.fps}
              disabled={disabled}
              aria-label={t.settings.fpsCustomAria}
              onChange={(event) => {
                const value = event.target.valueAsNumber
                if (Number.isFinite(value)) {
                  onChange({ fps: Math.min(120, Math.max(1, Math.round(value))) })
                }
              }}
            />
          </div>
        </label>

        <label className="field">
          <span>{t.settings.quality}</span>
          <select
            value={settings.quality}
            disabled={disabled}
            onChange={(event) => onChange({ quality: event.target.value as Settings['quality'] })}
          >
            <option value="high">{t.settings.qualityHigh}</option>
            <option value="medium">{t.settings.qualityMedium}</option>
            <option value="low">{t.settings.qualityLow}</option>
          </select>
        </label>

        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={settings.countdownSeconds > 0}
            disabled={disabled}
            onChange={(event) => onChange({ countdownSeconds: event.target.checked ? 3 : 0 })}
          />
          <span>{t.settings.countdown}</span>
        </label>

        <div className="field checkbox-field disabled-field" title={cursorNotice}>
          <input type="checkbox" checked readOnly disabled aria-label={t.settings.cursor} />
          <span>{t.settings.cursor}</span>
        </div>

        <div className="field audio-badge">
          <span className="badge">{t.settings.audio}</span>
          <small>{t.settings.audioNotice}</small>
        </div>
      </div>

      {settings.resolution === 'custom' && (
        <div className="custom-size-row">
          <label className="field compact">
            <span>{t.settings.width}</span>
            <input
              type="number"
              min={2}
              max={7680}
              value={settings.customWidth}
              disabled={disabled}
              onChange={(event) => {
                const value = event.target.valueAsNumber
                if (Number.isFinite(value)) {
                  onChange({ customWidth: Math.max(2, Math.min(7680, Math.round(value))) })
                }
              }}
            />
          </label>
          <span className="times">×</span>
          <label className="field compact">
            <span>{t.settings.height}</span>
            <input
              type="number"
              min={2}
              max={4320}
              value={settings.customHeight}
              disabled={disabled}
              onChange={(event) => {
                const value = event.target.valueAsNumber
                if (Number.isFinite(value)) {
                  onChange({ customHeight: Math.max(2, Math.min(4320, Math.round(value))) })
                }
              }}
            />
          </label>
        </div>
      )}
    </section>
  )
}
