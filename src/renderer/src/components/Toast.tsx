import { t } from '../i18n/es'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastMessage {
  kind: ToastKind
  message: string
}

interface ToastProps {
  toast: ToastMessage
  onClose: () => void
}

export function Toast({ toast, onClose }: ToastProps) {
  return (
    <div className={`toast toast-${toast.kind}`} role="status">
      <span>{toast.message}</span>
      <button type="button" aria-label={t.common.closeToast} onClick={onClose}>
        ×
      </button>
    </div>
  )
}
