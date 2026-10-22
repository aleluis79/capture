import { useEffect } from 'react'
import { t } from '../i18n/es'

interface CountdownOverlayProps {
  remaining: number
  onCancel: () => void
}

export function CountdownOverlay({ remaining, onCancel }: CountdownOverlayProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="overlay countdown-overlay" role="dialog" aria-modal="true">
      <div className="countdown-content">
        <p className="muted">{t.capture.startingIn}</p>
        <div className="countdown-number" aria-live="assertive">
          {remaining}
        </div>
        <button type="button" className="btn ghost" onClick={onCancel}>
          {t.actions.cancelEsc}
        </button>
      </div>
    </div>
  )
}
