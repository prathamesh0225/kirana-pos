import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from '../../components/confirm-dialog/ConfirmDialog'
import './stock-adjustment.css'

type StockAdjustmentProps = {
  product: ProductRecord
  onSaved: () => void
  onCancel: () => void
}

function StockAdjustment({ product, onSaved, onCancel }: StockAdjustmentProps): React.JSX.Element {
  const [adjustment, setAdjustment] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const adjustmentRef = useRef<HTMLInputElement>(null)
  const reasonRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => {
      adjustmentRef.current?.focus()
    })
  }, [])

  const adjustmentValue = Number(adjustment)
  const newStock = product.stock_quantity + adjustmentValue

  function validate(): void {
    if (!adjustment.trim()) {
      throw new Error('Adjustment quantity is required')
    }

    if (!Number.isFinite(adjustmentValue)) {
      throw new Error('Invalid adjustment quantity')
    }

    if (adjustmentValue === 0) {
      throw new Error('Adjustment cannot be zero')
    }

    if (newStock < 0) {
      throw new Error('Stock cannot become negative')
    }

    if (!reason.trim()) {
      throw new Error('Reason is required')
    }
  }

  function requestSave(): void {
    try {
      validate()
      setError('')
      setShowConfirmation(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid stock adjustment')
    }
  }

  async function saveAdjustment(): Promise<void> {
    if (saving) {
      return
    }

    try {
      setSaving(true)
      setError('')

      await window.kirana.products.adjustStock(product.id, {
        quantity: adjustmentValue,
        reason: reason.trim()
      })

      setShowConfirmation(false)
      onSaved()
    } catch (err) {
      setShowConfirmation(false)

      setError(err instanceof Error ? err.message : 'Unable to adjust stock')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (showConfirmation) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()

        onCancel()
        return
      }

      if (event.key !== 'Enter') {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (document.activeElement === adjustmentRef.current) {
        reasonRef.current?.focus()
        return
      }

      if (document.activeElement === reasonRef.current) {
        requestSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showConfirmation, adjustmentValue, reason])

  return (
    <div className="stock-adjustment">
      <div className="stock-adjustment-header">
        <div>
          <div className="stock-adjustment-title">STOCK ADJUSTMENT</div>

          <div className="stock-adjustment-subtitle">{product.name}</div>
        </div>

        <div className="stock-adjustment-shortcuts">
          <span>Enter Next</span>
          <span>Esc Cancel</span>
        </div>
      </div>

      <div className="stock-adjustment-body">
        <div className="stock-adjustment-info">
          <div>
            <span>Product</span>
            <strong>{product.name}</strong>
          </div>

          <div>
            <span>Barcode</span>
            <strong>{product.barcode ?? '-'}</strong>
          </div>

          <div>
            <span>Current Stock</span>
            <strong>
              {product.stock_quantity} {product.unit}
            </strong>
          </div>
        </div>

        <div className="stock-adjustment-fields">
          <label>
            <span>Adjustment ({product.unit})</span>

            <input
              ref={adjustmentRef}
              className="number-input"
              inputMode="decimal"
              value={adjustment}
              onChange={(event) => {
                setAdjustment(event.target.value)
                setError('')
              }}
              placeholder="+3 or -2"
              autoComplete="off"
            />
          </label>

          <label>
            <span>Reason</span>

            <input
              ref={reasonRef}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                setError('')
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>

        <div className="stock-adjustment-result">
          <span>New Stock</span>

          <strong>
            {Number.isFinite(newStock) ? newStock : '-'} {product.unit}
          </strong>
        </div>

        {error && <div className="stock-adjustment-error">{error}</div>}
      </div>

      <div className="stock-adjustment-footer">
        <span>Enter Next</span>
        <span>Esc Cancel</span>

        <button type="button" onClick={requestSave} disabled={saving}>
          Save
        </button>

        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>

      {showConfirmation && (
        <ConfirmDialog
          title="Confirm Stock Adjustment"
          message={
            <>
              Adjust <strong>{product.name}</strong> by{' '}
              <strong>
                {adjustmentValue > 0 ? '+' : ''}
                {adjustmentValue} {product.unit}
              </strong>
              ?
              <br />
              New stock:{' '}
              <strong>
                {newStock} {product.unit}
              </strong>
            </>
          }
          confirmText="Yes"
          cancelText="No"
          onConfirm={() => {
            void saveAdjustment()
          }}
          onCancel={() => {
            setShowConfirmation(false)

            requestAnimationFrame(() => {
              reasonRef.current?.focus()
            })
          }}
        />
      )}
    </div>
  )
}

export default StockAdjustment
