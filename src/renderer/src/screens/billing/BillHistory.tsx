import { useEffect, useRef, useState } from 'react'
import type { SaleListItem } from './billing.types'
import './bill-history.css'

type BillHistoryProps = {
  onBack: () => void
  onOpenBill: (saleId: number) => void
  onModifyBill: (saleId: number) => void
}

function formatMoney(paise: number): string {
  return (paise / 100).toFixed(2)
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
    minute: '2-digit'
  })
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed'

    case 'partially_returned':
      return 'Partially Returned'

    case 'returned':
      return 'Returned'

    case 'cancelled':
      return 'Cancelled'

    case 'void':
      return 'Void'

    default:
      return status
  }
}

export default function BillHistory({ onBack, onOpenBill, onModifyBill }: BillHistoryProps) {
  const [bills, setBills] = useState<SaleListItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tableRef = useRef<HTMLTableSectionElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadBills() {
      try {
        setLoading(true)
        setError(null)

        const result = await window.kirana.billing.listSales(200)

        if (cancelled) {
          return
        }

        setBills(result)
        setSelectedIndex(result.length > 0 ? 0 : -1)
      } catch (err) {
        if (cancelled) {
          return
        }

        setError(err instanceof Error ? err.message : 'Unable to load bill history')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadBills()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const selectedRow = tableRef.current?.querySelector(`[data-row-index="${selectedIndex}"]`)

    if (selectedRow instanceof HTMLElement) {
      selectedRow.scrollIntoView({
        block: 'nearest'
      })
    }
  }, [selectedIndex])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onBack()
        return
      }

      if (bills.length === 0) {
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()

        setSelectedIndex((current) => Math.min(current + 1, bills.length - 1))

        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()

        setSelectedIndex((current) => Math.max(current - 1, 0))

        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()

        const selected = bills[selectedIndex]

        if (selected) {
          onOpenBill(selected.id)
        }

        return
      }

      if (event.key === 'F3') {
        event.preventDefault()

        const selected = bills[selectedIndex]

        if (selected) {
          onModifyBill(selected.id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [bills, selectedIndex, onBack, onOpenBill, onModifyBill])

  return (
    <div className="bill-history">
      <div className="bill-history-header">
        <div className="bill-history-title">BILL HISTORY</div>

        <div className="bill-history-count">Bills: {bills.length}</div>
      </div>

      {loading && <div className="bill-history-message">Loading bill history...</div>}

      {!loading && error && <div className="bill-history-message bill-history-error">{error}</div>}

      {!loading && !error && bills.length === 0 && (
        <div className="bill-history-message">No completed bills found.</div>
      )}

      {!loading && !error && bills.length > 0 && (
        <div className="bill-history-table-wrapper">
          <table className="bill-history-table">
            <thead>
              <tr>
                <th className="col-bill">Bill No.</th>
                <th className="col-date">Date</th>
                <th className="col-money">Original</th>
                <th className="col-money">Refunded</th>
                <th className="col-money">Net</th>
                <th className="col-status">Status</th>
              </tr>
            </thead>

            <tbody ref={tableRef}>
              {bills.map((bill, index) => {
                const selected = index === selectedIndex

                return (
                  <tr
                    key={bill.id}
                    data-row-index={index}
                    className={selected ? 'bill-history-row selected' : 'bill-history-row'}
                    onClick={() => setSelectedIndex(index)}
                    onDoubleClick={() => onOpenBill(bill.id)}
                  >
                    <td className="col-bill">{bill.billNumber}</td>

                    <td className="col-date">{formatDate(bill.saleDate)}</td>

                    <td className="col-money">₹{formatMoney(bill.totalPaise)}</td>

                    <td className="col-money">₹{formatMoney(bill.refundedPaise)}</td>

                    <td className="col-money">₹{formatMoney(bill.netPaise)}</td>

                    <td className="col-status">{getStatusLabel(bill.status)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bill-history-footer">
        <span>↑↓ Select</span>
        <span>Enter View</span>
        <span>F3 Modify Bill</span>
        <span>Esc Back</span>
      </div>
    </div>
  )
}
