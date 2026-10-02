import { useEffect, useState } from 'react'
import './batch-selector.css'

export type BatchRecord = {
  id: number
  productId: number
  batchNumber: string | null
  expiryDate: string | null
  mrpPaise: number
  purchaseRatePaise: number
  sellingRatePaise: number
  quantity: number
}

type BatchSelectorProps = {
  productName: string
  batches: BatchRecord[]
  onSelect: (batch: BatchRecord) => void
  onBack: () => void
}

function formatRupees(paise: number | null | undefined): string {
  if (!Number.isFinite(paise)) {
    return '-'
  }

  return (paise / 100).toFixed(2)
}

export default function BatchSelector({
  productName,
  batches,
  onSelect,
  onBack
}: BatchSelectorProps): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [batches])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'ArrowDown') {
        event.preventDefault()

        setSelectedIndex((current) => Math.min(current + 1, Math.max(batches.length - 1, 0)))

        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()

        setSelectedIndex((current) => Math.max(current - 1, 0))

        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()

        const batch = batches[selectedIndex]

        if (batch && batch.quantity > 0) {
          onSelect(batch)
        }

        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onBack()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [batches, selectedIndex, onBack, onSelect])

  return (
    <div className="batch-selector-screen">
      <div className="batch-selector-title">SELECT BATCH</div>

      <div className="batch-selector-product">{productName}</div>

      <div className="batch-selector-table-wrapper">
        <table className="batch-selector-table">
          <thead>
            <tr>
              <th>BATCH</th>
              <th>MRP</th>
              <th>SELLING RATE</th>
              <th>STOCK</th>
            </tr>
          </thead>

          <tbody>
            {batches.map((batch, index) => {
              const selected = index === selectedIndex
              const unavailable = batch.quantity <= 0

              return (
                <tr
                  key={batch.id}
                  className={[
                    selected ? 'batch-row-selected' : '',
                    unavailable ? 'batch-row-unavailable' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setSelectedIndex(index)

                    if (!unavailable) {
                      onSelect(batch)
                    }
                  }}
                >
                  <td className="batch-number-cell">{batch.batchNumber ?? '-'}</td>

                  <td className="batch-money-cell">₹{formatRupees(batch.mrpPaise)}</td>

                  <td className="batch-money-cell">₹{formatRupees(batch.sellingRatePaise)}</td>

                  <td className="batch-stock-cell">{batch.quantity}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {batches.length === 0 && (
        <div className="batch-selector-error">No batches available for this product.</div>
      )}

      <div className="batch-selector-footer">
        <span>↑↓ Select Batch</span>
        <span>Enter Select</span>
        <span>Esc Back</span>
      </div>
    </div>
  )
}
