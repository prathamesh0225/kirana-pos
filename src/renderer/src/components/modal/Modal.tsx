import { useEffect, useRef } from 'react'
import './modal.css'

type ModalProps = {
  title: string
  children: React.ReactNode
  onClose?: () => void
  initialFocus?: 'first' | 'none'
}

function Modal({
  title,
  children,
  onClose,
  initialFocus = 'first'
}: ModalProps): React.JSX.Element {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (initialFocus === 'first') {
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      firstFocusable?.focus()
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [initialFocus, onClose])

  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget && onClose) {
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayClick}>
      <div
        ref={modalRef}
        className="modal-window"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <div className="modal-title">{title}</div>
        </div>

        <div className="modal-content">{children}</div>
      </div>
    </div>
  )
}

export default Modal
