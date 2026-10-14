import { useEffect, useRef, useState } from 'react'
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
  const [selectedAction, setSelectedAction] = useState<'confirm' | 'cancel'>('confirm')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedAction('confirm')

    const frame = requestAnimationFrame(() => {
      dialogRef.current?.focus()
    })

    function handleKeyDown(event: KeyboardEvent): void {
      // Confirm dialog is modal: don't allow keyboard events
      // to reach the screen underneath it.
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        setSelectedAction('confirm')
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        setSelectedAction('cancel')
        return
      }

      if (event.key === 'Enter') {
        if (selectedAction === 'confirm') {
          onConfirm()
        } else {
          onCancel()
        }

        return
      }

      if (event.key === 'Escape') {
        onCancel()
      }
    }

    // Capture phase is important here.
    // It prevents ItemMaster/Billing global key handlers
    // from seeing Enter/Escape while this dialog is open.
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [onConfirm, onCancel, selectedAction])

  return (
    <Modal title={title} onClose={onCancel} initialFocus="none">
      <div
        ref={dialogRef}
        className={`confirm-dialog ${variant === 'warning' ? 'confirm-dialog-warning' : ''}`}
        tabIndex={-1}
      >
        <div className="confirm-message">{message}</div>

        <div className="confirm-actions">
          <button
            type="button"
            className={
              selectedAction === 'confirm' ? 'confirm-primary confirm-selected' : 'confirm-primary'
            }
            onClick={onConfirm}
          >
            {selectedAction === 'confirm' ? '> ' : ''}
            {confirmText}
          </button>

          <button
            type="button"
            className={
              selectedAction === 'cancel'
                ? 'confirm-secondary confirm-selected'
                : 'confirm-secondary'
            }
            onClick={onCancel}
          >
            {selectedAction === 'cancel' ? '> ' : ''}
            {cancelText}
          </button>
        </div>

        <div className="confirm-shortcuts">
          ↑↓ Select&nbsp;&nbsp;&nbsp;Enter Confirm&nbsp;&nbsp;&nbsp;Esc Cancel
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
