import { useEffect, useMemo, useRef, useState } from 'react'
import type { SaleListItem } from './billing.types'
import DateFilterDialog, {
  type DateRange
} from '../../components/date-filter-dialog/DateFilterDialog'
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

/**
 * Converts a sale date into local YYYY-MM-DD.
 *
 * This is important because the date filter works with calendar dates,
 * not UTC timestamps.
 */
function getLocalDateOnly(value: string): string | null {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export default function BillHistory({ onBack, onOpenBill, onModifyBill }: BillHistoryProps) {
  /*
   * All bills loaded from the database.
   *
   * We keep the complete list here and create the filtered list
   * separately based on the selected date range.
   */
  const [allBills, setAllBills] = useState<SaleListItem[]>([])

  const [selectedIndex, setSelectedIndex] = useState(-1)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  /*
   * Bill History is initially hidden.
   *
   * The date filter is shown first.
   */
  const [dateFilterApplied, setDateFilterApplied] = useState(false)

  const [dateRange, setDateRange] = useState<DateRange>({
    fromDate: null,
    toDate: null
  })

  const tableRef = useRef<HTMLTableSectionElement>(null)

  /*
   * Load bills when Bill History opens.
   */
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

        setAllBills(result)
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

  /*
   * Filter bills using the selected date range.
   *
   * If both dates are null, all bills are returned.
   */
  const bills = useMemo(() => {
    if (!dateRange.fromDate && !dateRange.toDate) {
      return allBills
    }

    return allBills.filter((bill) => {
      const saleDateOnly = getLocalDateOnly(bill.saleDate)

      if (!saleDateOnly) {
        return false
      }

      /*
       * From Date
       */
      if (dateRange.fromDate && saleDateOnly < dateRange.fromDate) {
        return false
      }

      /*
       * To Date
       */
      if (dateRange.toDate && saleDateOnly > dateRange.toDate) {
        return false
      }

      return true
    })
  }, [allBills, dateRange])

  /*
   * Reset the selected row whenever the filtered bill list changes.
   */
  useEffect(() => {
    setSelectedIndex(bills.length > 0 ? 0 : -1)
  }, [bills])

  /*
   * Keep the selected row visible when using Arrow Up / Down.
   */
  useEffect(() => {
    const tbody = tableRef.current

    if (!tbody || selectedIndex < 0) {
      return
    }

    const selectedRow = tbody.querySelector(`[data-row-index="${selectedIndex}"]`)

    if (!(selectedRow instanceof HTMLElement)) {
      return
    }

    const tableWrapper = tbody.closest('.bill-history-table-wrapper')

    if (!(tableWrapper instanceof HTMLElement)) {
      return
    }

    const tableHeader = tableWrapper.querySelector('thead')

    if (!(tableHeader instanceof HTMLElement)) {
      return
    }

    const wrapperRect = tableWrapper.getBoundingClientRect()

    const headerRect = tableHeader.getBoundingClientRect()

    const rowRect = selectedRow.getBoundingClientRect()

    /*
     * Visible area starts below the sticky header.
     */
    const visibleTop = wrapperRect.top + headerRect.height

    const visibleBottom = wrapperRect.bottom

    /*
     * Row is hidden underneath the header.
     */
    if (rowRect.top < visibleTop) {
      tableWrapper.scrollTop -= visibleTop - rowRect.top

      return
    }

    /*
     * Row is below the visible table area.
     */
    if (rowRect.bottom > visibleBottom) {
      tableWrapper.scrollTop += rowRect.bottom - visibleBottom
    }
  }, [selectedIndex])
  /*
   * Keyboard controls.
   */
  useEffect(() => {
    /*
     * Do not register Bill History keyboard actions until
     * the date filter has been applied.
     */
    if (!dateFilterApplied) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      /*
       * Escape
       */
      if (event.key === 'Escape') {
        event.preventDefault()
        onBack()
        return
      }

      /*
       * Nothing to select.
       */
      if (bills.length === 0) {
        return
      }

      /*
       * Move selection down.
       */
      if (event.key === 'ArrowDown') {
        event.preventDefault()

        setSelectedIndex((current) => Math.min(current + 1, bills.length - 1))

        return
      }

      /*
       * Move selection up.
       */
      if (event.key === 'ArrowUp') {
        event.preventDefault()

        setSelectedIndex((current) => Math.max(current - 1, 0))

        return
      }

      /*
       * Enter = View Bill
       */
      if (event.key === 'Enter') {
        event.preventDefault()

        const selected = bills[selectedIndex]

        if (selected) {
          onOpenBill(selected.id)
        }

        return
      }

      /*
       * F3 = Modify Bill
       */
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
  }, [bills, selectedIndex, dateFilterApplied, onBack, onOpenBill, onModifyBill])

  /*
   * Apply Date Filter.
   */
  function handleDateFilterApply(range: DateRange): void {
    setDateRange(range)

    /*
     * Hide the date dialog and show Bill History.
     */
    setDateFilterApplied(true)
  }

  /*
   * Cancel Date Filter.
   *
   * Since the user has just opened Bill History and has not
   * selected a date yet, returning to the previous screen is
   * the cleanest behavior.
   */
  function handleDateFilterCancel(): void {
    onBack()
  }

  /*
   * IMPORTANT:
   *
   * While the date filter has not been applied, do not render
   * Bill History at all.
   *
   * This prevents Bill History from appearing as a background
   * behind the Date Filter dialog.
   */
  if (!dateFilterApplied) {
    return (
      <DateFilterDialog
        open={true}
        title="Bill History Date Filter"
        initialFromDate={dateRange.fromDate}
        initialToDate={dateRange.toDate}
        showPresets={true}
        onApply={handleDateFilterApply}
        onCancel={handleDateFilterCancel}
      />
    )
  }

  /*
   * Bill History UI.
   */
  return (
    <div className="bill-history">
      <div className="bill-history-header">
        <div className="bill-history-title">BILL HISTORY</div>

        <div className="bill-history-count">Bills: {bills.length}</div>
      </div>

      {loading && <div className="bill-history-message">Loading bill history...</div>}

      {!loading && error && <div className="bill-history-message bill-history-error">{error}</div>}

      {!loading && !error && bills.length === 0 && (
        <div className="bill-history-message">No bills found for the selected date range.</div>
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
