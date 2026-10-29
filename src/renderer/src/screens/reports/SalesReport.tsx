import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DateFilterDialog, {
  type DateRange
} from '../../components/date-filter-dialog/DateFilterDialog'
import './sales-report.css'

type Tab = 'daily' | 'bills' | 'products' | 'payments'

type ReportData = Awaited<ReturnType<typeof window.kirana.billing.getSalesReport>>

type Props = {
  onBack: () => void
  onOpenBill: (saleId: number) => void
}

const TABS: Array<[Tab, string]> = [
  ['daily', 'Daily'],
  ['bills', 'Bills'],
  ['products', 'Products'],
  ['payments', 'Payments']
]

function today(): string {
  const date = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function money(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

function dateLabel(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN')
}

function dateTimeLabel(value: string): string {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-IN')
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF', csv], {
    type: 'text/csv;charset=utf-8;'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}

export default function SalesReport({ onBack, onOpenBill }: Props): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('daily')

  const [dateRange, setDateRange] = useState<DateRange>({
    fromDate: today(),
    toDate: today()
  })

  // Open the date filter first. Do not load a report on screen mount.
  const [dateDialogOpen, setDateDialogOpen] = useState(true)

  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRowIndex, setSelectedRowIndex] = useState(0)

  const tableWrapRef = useRef<HTMLDivElement>(null)

  const [tableHasFocus, setTableHasFocus] = useState(false)

  const totalBills = report?.bills.length ?? 0

  const netSalesPaise = report?.bills.reduce((total, bill) => total + bill.netPaise, 0) ?? 0

  const averageBillPaise = totalBills > 0 ? Math.round(netSalesPaise / totalBills) : 0

  const unitsSold = report?.products.reduce((total, product) => total + product.quantity, 0) ?? 0

  const totalSalesPaise = useMemo(
    () => report?.daily.reduce((sum, row) => sum + row.salesPaise, 0) ?? 0,
    [report]
  )

  const visibleRowCount = useMemo(() => {
    if (!report) return 0

    switch (activeTab) {
      case 'daily':
        return report.daily.length
      case 'bills':
        return report.bills.length
      case 'products':
        return report.products.length
      case 'payments':
        return report.payments.length
    }
  }, [activeTab, report])

  const loadReport = useCallback(async (range: DateRange): Promise<void> => {
    setLoading(true)
    setError(null)
    setReport(null)
    setSelectedRowIndex(0)

    try {
      const result = await window.kirana.billing.getSalesReport(range)
      setReport(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sales report.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Deliberately no useEffect to load the initial date range.
  // A report is requested only when the user applies the date filter.
  function applyDateRange(range: DateRange): void {
    setDateRange(range)
    setDateDialogOpen(false)
    void loadReport(range)
  }

  function changeTab(tab: Tab): void {
    setActiveTab(tab)
    setSelectedRowIndex(0)

    // Automatically focus the report table after switching tabs.
    requestAnimationFrame(() => {
      tableWrapRef.current?.focus()
    })
  }

  function exportCurrentTab(): void {
    if (!report || loading) return

    const suffix = `${dateRange.fromDate || 'all'}_to_${dateRange.toDate || 'all'}`
    let rows: unknown[][] = []
    const tabName = activeTab

    if (activeTab === 'daily') {
      rows = [
        ['Date', 'First Bill No.', 'Last Bill No.', 'Bills', 'Net Sales (₹)'],
        ...report.daily.map((row) => [
          row.date,
          row.firstBillNumber,
          row.lastBillNumber,
          row.billCount,
          (row.salesPaise / 100).toFixed(2)
        ])
      ]
    } else if (activeTab === 'bills') {
      rows = [
        ['Bill No.', 'Date', 'Status', 'Bill Total (₹)', 'Refunded (₹)', 'Net Sales (₹)'],
        ...report.bills.map((bill) => [
          bill.billNumber,
          bill.saleDate,
          bill.status,
          (bill.totalPaise / 100).toFixed(2),
          (bill.refundedPaise / 100).toFixed(2),
          (bill.netPaise / 100).toFixed(2)
        ])
      ]
    } else if (activeTab === 'products') {
      rows = [
        ['Product', 'Quantity Sold', 'Sales Amount (₹)'],
        ...report.products.map((product) => [
          product.productName,
          product.quantity,
          (product.salesPaise / 100).toFixed(2)
        ])
      ]
    } else {
      rows = [
        ['Payment Method', 'Amount (₹)'],
        ...report.payments.map((payment) => [
          payment.paymentMethod,
          (payment.amountPaise / 100).toFixed(2)
        ])
      ]
    }

    downloadCsv(`sales-report-${tabName}-${suffix}.csv`, rows)
  }

  // Keyboard shortcuts that work throughout the Sales Report screen.
  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent): void {
      // Do not hijack shortcuts while the user is typing into a control.
      const target = event.target

      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)

      if (event.key === 'Escape') {
        if (dateDialogOpen) {
          event.preventDefault()
          setDateDialogOpen(false)
        } else if (!isTyping) {
          event.preventDefault()
          onBack()
        }
        return
      }

      if (isTyping) return

      if (event.key === 'F2') {
        event.preventDefault()
        setDateDialogOpen(true)
        return
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        exportCurrentTab()
        return
      }

      if (event.altKey && /^[1-4]$/.test(event.key)) {
        event.preventDefault()
        const tab = TABS[Number(event.key) - 1]?.[0]
        if (tab) changeTab(tab)
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [dateDialogOpen, onBack, report, dateRange, activeTab, loading])

  function handleReportTableKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (dateDialogOpen || loading || !report || visibleRowCount === 0) return

    if (event.target instanceof HTMLButtonElement && event.key === 'Enter') {
      // Let the bill-number button handle its own Enter key.
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedRowIndex((index) => Math.min(index + 1, visibleRowCount - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedRowIndex((index) => Math.max(index - 1, 0))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setSelectedRowIndex(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setSelectedRowIndex(visibleRowCount - 1)
      return
    }

    if (event.key === 'Enter' && activeTab === 'bills') {
      event.preventDefault()
      const bill = report.bills[selectedRowIndex]
      if (bill) onOpenBill(bill.id)
    }
  }

  // Keep the selected row visible when navigating with the keyboard.
  useEffect(() => {
    const selectedRow = tableWrapRef.current?.querySelector(
      'tbody tr[data-row-index="' + selectedRowIndex + '"]'
    )

    selectedRow?.scrollIntoView({ block: 'nearest' })
  }, [selectedRowIndex, activeTab, report])

  function selectRow(index: number): void {
    setSelectedRowIndex(index)
    tableWrapRef.current?.focus()
  }

  const displayedDateRange = report
    ? dateRange.fromDate || dateRange.toDate
      ? `${dateRange.fromDate ? dateLabel(dateRange.fromDate) : 'Beginning'} – ${
          dateRange.toDate ? dateLabel(dateRange.toDate) : 'Today'
        }`
      : 'All dates'
    : 'Select a date range'

  return (
    <div className="sales-report">
      <header className="sales-report-header">
        <div>
          <h1>Sales Report</h1>
          <div className="sales-report-date">{displayedDateRange}</div>
        </div>

        <div className="sales-report-actions">
          <button
            type="button"
            onClick={() => setDateDialogOpen(true)}
            title="Open date filter (F2)"
          >
            Date Filter
          </button>

          <button
            type="button"
            onClick={exportCurrentTab}
            disabled={!report || loading}
            title="Export current tab (Ctrl+E)"
          >
            Export CSV
          </button>

          <button type="button" onClick={onBack}>
            Back
          </button>
        </div>
      </header>

      {loading && <div className="sales-report-message">Loading report…</div>}

      {error && <div className="sales-report-error">{error}</div>}

      {!report && !loading && !error && !dateDialogOpen && (
        <div className="sales-report-message">Select a date range to view the sales report.</div>
      )}

      {report && (
        <>
          <div className="sales-report-summary">
            <div className="sales-report-summary-card">
              <span>Total Bills</span>
              <strong>{totalBills}</strong>
            </div>

            <div className="sales-report-summary-card">
              <span>Net Sales</span>
              <strong>{money(netSalesPaise)}</strong>
            </div>

            <div className="sales-report-summary-card">
              <span>Average Bill</span>
              <strong>{money(averageBillPaise)}</strong>
            </div>

            <div className="sales-report-summary-card">
              <span>Units Sold</span>
              <strong>{unitsSold.toLocaleString('en-IN')}</strong>
            </div>
          </div>

          <nav className="sales-report-tabs" aria-label="Sales report tabs">
            {TABS.map(([tab, label], index) => (
              <button
                type="button"
                key={tab}
                className={activeTab === tab ? 'active' : ''}
                aria-pressed={activeTab === tab}
                title={`Alt+${index + 1}`}
                onClick={() => changeTab(tab)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div
            className="sales-report-table-wrap"
            ref={tableWrapRef}
            tabIndex={0}
            onFocus={() => setTableHasFocus(true)}
            onBlur={() => setTableHasFocus(false)}
            onKeyDown={handleReportTableKeyDown}
            aria-label={`${activeTab} report table. Use arrow keys to navigate rows.`}
          >
            {activeTab === 'daily' && (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Bill No. Range</th>
                    <th className="numeric">Bills</th>
                    <th className="numeric">Net Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {report.daily.map((row, index) => (
                    <tr
                      key={row.date}
                      data-row-index={index}
                      className={index === selectedRowIndex ? 'selected' : ''}
                      onClick={() => selectRow(index)}
                    >
                      <td>{dateLabel(row.date)}</td>
                      <td>
                        {row.firstBillNumber === row.lastBillNumber
                          ? row.firstBillNumber
                          : `${row.firstBillNumber} – ${row.lastBillNumber}`}
                      </td>
                      <td className="numeric">{row.billCount}</td>
                      <td className="numeric">{money(row.salesPaise)}</td>
                    </tr>
                  ))}

                  {report.daily.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty">
                        No sales for this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'bills' && (
              <table>
                <thead>
                  <tr>
                    <th>Bill No.</th>
                    <th>Date / Time</th>
                    <th>Status</th>
                    <th className="numeric">Bill Total</th>
                    <th className="numeric">Refund</th>
                    <th className="numeric">Net Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bills.map((bill, index) => (
                    <tr
                      key={bill.id}
                      data-row-index={index}
                      className={index === selectedRowIndex ? 'selected' : ''}
                      onClick={() => selectRow(index)}
                      onDoubleClick={() => onOpenBill(bill.id)}
                    >
                      <td>
                        <button
                          type="button"
                          className="sales-report-bill-link"
                          onClick={() => onOpenBill(bill.id)}
                        >
                          {bill.billNumber}
                        </button>
                      </td>
                      <td>{dateTimeLabel(bill.saleDate)}</td>
                      <td>{bill.status}</td>
                      <td className="numeric">{money(bill.totalPaise)}</td>
                      <td className="numeric">{money(bill.refundedPaise)}</td>
                      <td className="numeric">{money(bill.netPaise)}</td>
                    </tr>
                  ))}

                  {report.bills.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty">
                        No bills for this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'products' && (
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="numeric">Quantity Sold</th>
                    <th className="numeric">Sales Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {report.products.map((product, index) => (
                    <tr
                      key={product.productName}
                      data-row-index={index}
                      className={index === selectedRowIndex ? 'selected' : ''}
                      onClick={() => selectRow(index)}
                    >
                      <td>{product.productName}</td>
                      <td className="numeric">{product.quantity}</td>
                      <td className="numeric">{money(product.salesPaise)}</td>
                    </tr>
                  ))}

                  {report.products.length === 0 && (
                    <tr>
                      <td colSpan={3} className="empty">
                        No products sold in this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'payments' && (
              <table>
                <thead>
                  <tr>
                    <th>Payment Method</th>
                    <th className="numeric">Amount Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {report.payments.map((payment, index) => (
                    <tr
                      key={payment.paymentMethod}
                      data-row-index={index}
                      className={index === selectedRowIndex ? 'selected' : ''}
                      onClick={() => selectRow(index)}
                    >
                      <td>{payment.paymentMethod}</td>
                      <td className="numeric">{money(payment.amountPaise)}</td>
                    </tr>
                  ))}

                  {report.payments.length === 0 && (
                    <tr>
                      <td colSpan={2} className="empty">
                        No payments for this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="sales-report-footer">
            <div className="sales-report-footer-summary">
              {activeTab === 'daily'
                ? `Total sales: ${money(totalSalesPaise)}`
                : `${visibleRowCount} row${visibleRowCount === 1 ? '' : 's'}`}
            </div>

            <div className="sales-report-shortcuts">
              <span>
                <kbd>F2</kbd> Date Filter
              </span>
              <span>
                <kbd>Alt+1</kbd> Daily
              </span>
              <span>
                <kbd>Alt+2</kbd> Bills
              </span>
              <span>
                <kbd>Alt+3</kbd> Products
              </span>
              <span>
                <kbd>Alt+4</kbd> Payments
              </span>
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> Navigate
              </span>
              <span>
                <kbd>Home</kbd> / <kbd>End</kbd> First / Last
              </span>
              {activeTab === 'bills' && (
                <span>
                  <kbd>Enter</kbd> Open Bill
                </span>
              )}
              <span>
                <kbd>Ctrl+E</kbd> Export CSV
              </span>
              <span>
                <kbd>Esc</kbd> Close / Back
              </span>
            </div>
          </div>
        </>
      )}

      <DateFilterDialog
        open={dateDialogOpen}
        title="Sales Report Date Filter"
        initialFromDate={dateRange.fromDate}
        initialToDate={dateRange.toDate}
        onApply={applyDateRange}
        onCancel={() => setDateDialogOpen(false)}
      />
    </div>
  )
}
