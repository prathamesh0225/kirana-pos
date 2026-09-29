import { useEffect, useRef, useState, ReactElement } from 'react'
import './stock-history.css'

type StockHistoryProduct = {
  id: number
  name: string
  barcode: string | null
  unit: string
  stock_quantity: number
  quantity_precision: number
}

type StockMovementRecord = {
  id: number
  productId: number
  movementType: string
  quantity: number
  referenceType: string | null
  referenceId: number | null
  movementDate: string
  notes: string | null
  reason: string | null
}

type DateRange = {
  fromDate: string | null
  toDate: string | null
}

type StockHistoryProps = {
  product: StockHistoryProduct
  dateRange: DateRange
  onBack: () => void
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function formatQuantity(value: number, precision: number): string {
  return value.toFixed(precision)
}

function movementLabel(type: string): string {
  switch (type) {
    case 'SALE':
      return 'SALE'

    case 'RETURN':
      return 'RETURN'

    case 'ADJUSTMENT':
      return 'ADJUSTMENT'

    default:
      return type
  }
}

function getReason(movement: StockMovementRecord): string {
  if (movement.reason?.trim()) {
    return movement.reason
  }

  if (movement.notes?.trim()) {
    return movement.notes
  }

  return ''
}

export default function StockHistory({
  product,
  dateRange,
  onBack
}: StockHistoryProps): ReactElement {
  const [movements, setMovements] = useState<StockMovementRecord[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const screenRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    let cancelled = false

    async function loadHistory(): Promise<void> {
      try {
        setLoading(true)
        setError(null)

        const result = await window.kirana.products.getStockHistory(
          product.id,
          dateRange.fromDate,
          dateRange.toDate
        )

        if (!cancelled) {
          setMovements(result)
          setSelectedIndex(0)
          rowRefs.current = []
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load stock history.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadHistory()

    return (): void => {
      cancelled = true
    }
  }, [product.id, dateRange.fromDate, dateRange.toDate])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()

        onBack()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()

        if (movements.length === 0) {
          return
        }

        setSelectedIndex((current): number => {
          const nextIndex = Math.min(current + 1, movements.length - 1)

          requestAnimationFrame((): void => {
            rowRefs.current[nextIndex]?.scrollIntoView({
              block: 'nearest',
              inline: 'nearest'
            })
          })

          return nextIndex
        })

        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()

        if (movements.length === 0) {
          return
        }

        setSelectedIndex((current): number => {
          const nextIndex = Math.max(current - 1, 0)

          requestAnimationFrame((): void => {
            rowRefs.current[nextIndex]?.scrollIntoView({
              block: 'nearest',
              inline: 'nearest'
            })
          })

          return nextIndex
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return (): void => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [movements.length, onBack])

  useEffect(() => {
    screenRef.current?.focus()
  }, [])

  return (
    <div className="stock-history-screen" ref={screenRef} tabIndex={-1}>
      <div className="stock-history-header">
        <div className="stock-history-title">STOCK HISTORY</div>

        <div className="stock-history-product">
          Product: <strong>{product.name}</strong>
        </div>

        <div className="stock-history-meta">
          Barcode: {product.barcode || '-'}
          {'   '}
          Unit: {product.unit}
          {'   '}
          Current Stock:{' '}
          <strong>{formatQuantity(product.stock_quantity, product.quantity_precision)}</strong>
        </div>

        <div className="stock-history-meta">
          Date: <strong>{dateRange.fromDate || 'All'}</strong>
          {' - '}
          <strong>{dateRange.toDate || 'All'}</strong>
        </div>
      </div>

      {error && <div className="stock-history-error">{error}</div>}

      <div className="stock-history-table">
        {/* FIXED HEADER - NEVER SCROLLS */}
        <div className="stock-history-row stock-history-head">
          <div>Date / Time</div>
          <div>Type</div>
          <div className="stock-history-qty">Quantity</div>
          <div>Reason</div>
        </div>

        {/* ONLY THIS PART SCROLLS */}
        <div className="stock-history-body">
          {loading && <div className="stock-history-empty">Loading stock history...</div>}

          {!loading && !error && movements.length === 0 && (
            <div className="stock-history-empty">No stock movement history.</div>
          )}

          {!loading &&
            !error &&
            movements.map((movement: StockMovementRecord, index: number) => (
              <div
                key={movement.id}
                ref={(element): void => {
                  rowRefs.current[index] = element
                }}
                className={`stock-history-row ${
                  index === selectedIndex ? 'stock-history-selected' : ''
                }`}
                onClick={(): void => setSelectedIndex(index)}
              >
                <div>{formatDate(movement.movementDate)}</div>

                <div>{movementLabel(movement.movementType)}</div>

                <div className="stock-history-qty">
                  {movement.quantity > 0 ? '+' : ''}
                  {formatQuantity(movement.quantity, product.quantity_precision)}
                </div>

                <div>{getReason(movement)}</div>
              </div>
            ))}
        </div>
      </div>

      <div className="stock-history-footer">
        <span>↑↓ Select</span>
        <span>Esc Back</span>
      </div>
    </div>
  )
}
