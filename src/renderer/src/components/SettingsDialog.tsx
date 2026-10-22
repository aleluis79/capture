import { useState } from 'react'
import type { PlatformInfo, Settings, ShortcutState } from '@shared/types'
import { t } from '../i18n/es'

interface SettingsDialogProps {
  settings: Settings
  platformInfo: PlatformInfo
  shortcut: ShortcutState | null
  onClose: () => void
  onChooseFolder: () => void
  onSaveShortcut: (accelerator: string) => Promise<void>
}

export function SettingsDialog({
  settings,
  platformInfo,
  shortcut,
  onClose,
  onChooseFolder,
  onSaveShortcut
}: SettingsDialogProps) {
  const [shortcutValue, setShortcutValue] = useState(shortcut?.accelerator ?? settings.shortcut)
  const [savingShortcut, setSavingShortcut] = useState(false)
  const [shortcutError, setShortcutError] = useState<string | null>(null)

  const saveShortcut = async (): Promise<void> => {
    setSavingShortcut(true)
    setShortcutError(null)
    try {
      await onSaveShortcut(shortcutValue)
    } catch (error) {
      setShortcutError(error instanceof Error ? error.message : t.errors.generic)
    } finally {
      setSavingShortcut(false)
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="dialog">
        <header className="dialog-header">
          <h2>{t.actions.settings}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t.actions.close}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="dialog-body">
          <label className="field">
            <span>{t.settings.shortcut}</span>
            <div className="shortcut-row">
              <input
                type="text"
                value={shortcutValue}
                onChange={(event) => setShortcutValue(event.target.value)}
                placeholder={t.settings.shortcutPlaceholder}
                spellCheck={false}
              />
              <button
                type="button"
                className="btn primary small"
                disabled={savingShortcut}
                onClick={() => void saveShortcut()}
              >
                {t.actions.saveShortcut}
              </button>
            </div>
            <small className="muted">{t.settings.shortcutHint}</small>
            {shortcut && !shortcut.registered && (
              <small className="form-error">{shortcut.error}</small>
            )}
            {shortcut?.registered && (
              <small className="form-success">
                {t.settings.activeShortcut}: {shortcut.accelerator}
              </small>
            )}
            {shortcutError && <small className="form-error">{shortcutError}</small>}
          </label>

          <div className="field">
            <span>{t.settings.folder}</span>
            <div className="folder-row">
              <code title={settings.outputDir}>{settings.outputDir}</code>
              <button type="button" className="btn ghost small" onClick={onChooseFolder}>
                {t.actions.chooseFolder}
              </button>
            </div>
          </div>

          <div className="info-block">
            <div>
              <span className="muted">{t.settings.platform}</span>
              <strong>
                {platformInfo.platform} · {platformInfo.sessionType}
              </strong>
            </div>
            <div>
              <span className="muted">{t.settings.cursor}</span>
              <strong>{platformInfo.cursorNotice}</strong>
            </div>
            <div>
              <span className="muted">{t.settings.audio}</span>
              <strong>{t.settings.audioNotice}</strong>
            </div>
          </div>
        </div>

        <footer className="dialog-footer">
          <div className="dialog-actions">
            <button type="button" className="btn primary" onClick={onClose}>
              {t.actions.close}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
