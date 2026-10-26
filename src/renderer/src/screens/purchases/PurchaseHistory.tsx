
import { useEffect, useMemo, useRef, useState } from 'react'
import './purchase-history.css'
import ContextPanel from '../../components/context-panel/ContextPanel'
import DateFilterDialog, {
  type DateRange
} from '../../components/date-filter-dialog/DateFilterDialog'

type PurchaseHistoryProps = {
  onBack: () => void
  onModifyPurchase: (purchaseId: number) => void
}

type PurchaseHistoryRow = {
  id: number
  invoiceNumber: string
  supplierId: number
  supplierName: string
  purchaseDate: string
  subtotalPaise: number
  discountPaise: number
  taxPaise: number
  totalAmountPaise: number
  paidPaise: number
  balancePaise: number
  paymentMethod: 'CASH' | 'UPI' | 'CREDIT'
}

function formatMoney(paise: number): string {
  return (paise / 100).toFixed(2)
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return value
  }

  return `${match[3]}/${match[2]}/${match[1]}`
}

/**
 * Converts purchase date into local YYYY-MM-DD.
 *
 * Purchase dates are normally already stored as YYYY-MM-DD,
 * so keep that value directly instead of allowing timezone
 * conversion to change the calendar date.
 */
function getLocalDateOnly(value: string): string | null {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (dateOnlyMatch) {
    return value
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export default function PurchaseHistory({
  onBack,
  onModifyPurchase
}: PurchaseHistoryProps): React.JSX.Element {
  const [purchases, setPurchases] = useState<PurchaseHistoryRow[]>([])

  const [selectedIndex, setSelectedIndex] = useState(-1)

  const [search, setSearch] = useState('')

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  /*
   * Purchase History opens with the date filter first.
   */
  const [dateFilterApplied, setDateFilterApplied] = useState(false)

  const [dateRange, setDateRange] = useState<DateRange>({
    fromDate: null,
    toDate: null
  })

  const tableRef = useRef<HTMLTableSectionElement>(null)

  async function loadPurchases(): Promise<void> {
    try {
      setLoading(true)
      setError('')

      const result = await window.kirana.purchase.list(200)

      setPurchases(result)
    } catch (err) {
      console.error('Purchase history load failed:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load purchase history.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPurchases()
  }, [])

  /*
   * First apply the date filter.
   */
  const dateFilteredPurchases = useMemo(() => {
    if (!dateRange.fromDate && !dateRange.toDate) {
      return purchases
    }

    return purchases.filter((purchase) => {
      const purchaseDateOnly = getLocalDateOnly(purchase.purchaseDate)

      if (!purchaseDateOnly) {
        return false
      }

      if (
        dateRange.fromDate &&
        purchaseDateOnly < dateRange.fromDate
      ) {
        return false
      }

      if (
        dateRange.toDate &&
        purchaseDateOnly > dateRange.toDate
      ) {
        return false
      }

      return true
    })
  }, [purchases, dateRange])

  /*
   * Then apply the existing search.
   */
  const filteredPurchases = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return dateFilteredPurchases
    }

    return dateFilteredPurchases.filter((purchase) => {
      return (
        purchase.invoiceNumber.toLowerCase().includes(query) ||
        purchase.supplierName.toLowerCase().includes(query) ||
        purchase.paymentMethod.toLowerCase().includes(query)
      )
    })
  }, [dateFilteredPurchases, search])

  /*
   * Reset selection whenever the filtered list changes.
   */
  useEffect(() => {
    setSelectedIndex(
      filteredPurchases.length > 0 ? 0 : -1
    )
  }, [filteredPurchases])

  /*
   * Keep selected row visible.
   */
  useEffect(() => {
    const tbody = tableRef.current

    if (!tbody || selectedIndex < 0) {
      return
    }

    const selectedRow = tbody.querySelector(
      `[data-row-index="${selectedIndex}"]`
    )

    if (!(selectedRow instanceof HTMLElement)) {
      return
    }

    selectedRow.scrollIntoView({
      block: 'nearest'
    })
  }, [selectedIndex])

  /*
   * Keyboard controls.
   */
  useEffect(() => {
    /*
     * Do not allow Purchase History keyboard controls
     * until the date filter has been applied.
     */
    if (!dateFilterApplied) {
      return
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()

        onBack()

        return
      }

      if (event.key === 'F5') {
        event.preventDefault()
        event.stopPropagation()

        void loadPurchases()

        return
      }

      if (filteredPurchases.length === 0) {
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()

        setSelectedIndex((current) =>
          Math.min(
            current + 1,
            Math.max(filteredPurchases.length - 1, 0)
          )
        )

        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()

        setSelectedIndex((current) =>
          Math.max(current - 1, 0)
        )

        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()

        const selected = filteredPurchases[selectedIndex]

        if (selected) {
          void onModifyPurchase(selected.id)
        }

        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    filteredPurchases,
    selectedIndex,
    dateFilterApplied,
    onBack,
    onModifyPurchase
  ])

  /*
   * Apply Date Filter.
   */
  function handleDateFilterApply(range: DateRange): void {
    setDateRange(range)

    setDateFilterApplied(true)
  }

  /*
   * Cancel Date Filter.
   */
  function handleDateFilterCancel(): void {
    onBack()
  }

  /*
   * Show Date Filter first.
   */
  if (!dateFilterApplied) {
    return (
      <DateFilterDialog
        open={true}
        title="Purchase History Date Filter"
        initialFromDate={dateRange.fromDate}
        initialToDate={dateRange.toDate}
        showPresets={true}
        onApply={handleDateFilterApply}
        onCancel={handleDateFilterCancel}
      />
    )
  }

  return (
    <div className="purchase-history-layout">
      <div className="purchase-history">
        <div className="purchase-history-header">
          <div>
            <div className="purchase-history-title">
              PURCHASE HISTORY
            </div>

            <div className="purchase-history-subtitle">
              Enter = Modify &nbsp;&nbsp; ↑↓ = Select &nbsp;&nbsp;
              F5 = Refresh &nbsp;&nbsp; Esc = Back
            </div>
          </div>

          <input
            autoFocus
            className="purchase-history-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Search invoice / supplier..."
          />
        </div>

        <div className="purchase-history-filter-info">
          Purchases: {filteredPurchases.length}
        </div>

        {error && (
          <div className="purchase-history-error">
            {error}
          </div>
        )}

        <div className="purchase-history-table-wrapper">
          <table className="purchase-history-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>INVOICE</th>
                <th>SUPPLIER</th>
                <th>TOTAL</th>
                <th>PAID</th>
                <th>BALANCE</th>
                <th>PAYMENT</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody ref={tableRef}>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="purchase-history-empty"
                  >
                    Loading purchase history...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="purchase-history-empty"
                  >
                    No purchases found for the selected date range.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase, index) => {
                  const selected = index === selectedIndex

                  return (
                    <tr
                      key={purchase.id}
                      data-row-index={index}
                      className={
                        selected
                          ? 'purchase-history-row-selected'
                          : ''
                      }
                      onClick={() => {
                        setSelectedIndex(index)
                      }}
                      onDoubleClick={() => {
                        void onModifyPurchase(purchase.id)
                      }}
                    >
                      <td>
                        {formatDate(purchase.purchaseDate)}
                      </td>

                      <td>
                        {purchase.invoiceNumber}
                      </td>

                      <td>
                        {purchase.supplierName}
                      </td>

                      <td>
                        <strong>
                          ₹{formatMoney(
                            purchase.totalAmountPaise
                          )}
                        </strong>
                      </td>

                      <td>
                        ₹{formatMoney(purchase.paidPaise)}
                      </td>

                      <td>
                        ₹{formatMoney(purchase.balancePaise)}
                      </td>

                      <td>
                        {purchase.paymentMethod}
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            void onModifyPurchase(purchase.id)
                          }}
                        >
                          Modify
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="purchase-history-footer">
          <span>↑↓ Select</span>
          <span>Enter Modify</span>
          <span>Double Click Modify</span>
          <span>F5 Refresh</span>
          <span>Esc Back</span>
        </div>
      </div>

      <ContextPanel
        mode="purchase-history"
        purchaseId={filteredPurchases[selectedIndex]?.id}
      />
    </div>
  )
}