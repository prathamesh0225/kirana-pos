import { useEffect, useRef } from 'react'
import Modal from '../modal/Modal'
import './error-dialog.css'

type ErrorDialogProps = {
  title?: string
  message: React.ReactNode
  onClose: () => void
}

function ErrorDialog({ title = 'Error', message, onClose }: ErrorDialogProps): React.JSX.Element {
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    okRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent): void {
      event.stopPropagation()

      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <Modal title={title} onClose={onClose} initialFocus="none">
      <div className="error-dialog">
        <div className="error-message">{message}</div>

        <div className="error-actions">
          <button ref={okRef} type="button" className="error-primary" onClick={onClose}>
            OK
          </button>
        </div>

        <div className="error-shortcuts">Enter = OK&nbsp;&nbsp;&nbsp;Esc = Close</div>
      </div>
    </Modal>
  )
}

export default ErrorDialog
