import { useEffect, useRef } from 'react'
import Modal from '../modal/Modal'
import './confirm-dialog.css'

type ConfirmDialogProps = {
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'normal' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  title,
  message,
  confirmText = 'Yes',
  cancelText = 'No',
  variant = 'normal',
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel])

  return (
    <Modal title={title} onClose={onCancel} initialFocus="none">
      <div className={`confirm-dialog ${variant === 'warning' ? 'confirm-dialog-warning' : ''}`}>
        <div className="confirm-message">{message}</div>

        <div className="confirm-actions">
          <button ref={confirmRef} type="button" className="confirm-primary" onClick={onConfirm}>
            {confirmText}
          </button>

          <button type="button" className="confirm-secondary" onClick={onCancel}>
            {cancelText}
          </button>
        </div>

        <div className="confirm-shortcuts">
          Enter = {confirmText}&nbsp;&nbsp;&nbsp;Esc = {cancelText}
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
