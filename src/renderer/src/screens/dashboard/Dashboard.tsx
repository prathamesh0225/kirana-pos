import { useEffect, useState } from 'react'
import './dashboard.css'

type DashboardSalesSummary = {
  totalSalesPaise: number
  billsToday: number
}

type DashboardProps = {
  onOpenBilling: () => void
  onOpenItems: () => void
  onOpenBillHistory: () => void
  onOpenSettings: () => void
  onOpenLowStock: () => void
}

export function Dashboard({
  onOpenBilling,
  onOpenItems,
  onOpenBillHistory,
  onOpenLowStock
}: DashboardProps) {
  const [salesSummary, setSalesSummary] = useState<DashboardSalesSummary>({
    totalSalesPaise: 0,
    billsToday: 0
  })

  const [isLoading, setIsLoading] = useState(true)
  const [lowStockCount, setLowStockCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadDashboardData(): Promise<void> {
      try {
        const summary = await window.kirana.billing.getDashboardSalesSummary()

        if (!cancelled) {
          setSalesSummary(summary)
        }
      } catch (error) {
        console.error('Failed to load dashboard sales summary:', error)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadDashboardData()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadLowStockCount(): Promise<void> {
      try {
        const products = await window.kirana.products.list(10000, 'active')

        const count = products.filter(
          (product) => product.stock_quantity <= product.low_stock_level
        ).length

        if (!cancelled) {
          setLowStockCount(count)
        }
      } catch (error) {
        console.error('Failed to load low-stock count:', error)
      }
    }

    void loadLowStockCount()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'F1') {
        event.preventDefault()
        onOpenBilling()
        return
      }

      if (event.key === 'F3') {
        event.preventDefault()
        onOpenItems()
        return
      }

      if (event.key === 'F2') {
        event.preventDefault()
        onOpenBillHistory()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onOpenBilling, onOpenItems, onOpenBillHistory])

  return (
    <div className="dashboard">
      <div className="dashboard-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Today's business overview</p>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="dashboard-stat">
          <div className="dashboard-stat-label">TODAY'S SALES</div>
          <div className="dashboard-stat-value">
            {isLoading ? '...' : `₹ ${(salesSummary.totalSalesPaise / 100).toFixed(2)}`}
          </div>
          <div className="dashboard-stat-note">Today's completed sales</div>
        </div>

        <div className="dashboard-stat">
          <div className="dashboard-stat-label">TODAY'S PROFIT</div>
          <div className="dashboard-stat-value">₹ 0.00</div>
          <div className="dashboard-stat-note">Estimated gross profit</div>
        </div>

        <div className="dashboard-stat">
          <div className="dashboard-stat-label">BILLS TODAY</div>
          <div className="dashboard-stat-value">{isLoading ? '...' : salesSummary.billsToday}</div>
          <div className="dashboard-stat-note">Completed bills</div>
        </div>

        <button
          type="button"
          className="dashboard-stat dashboard-stat-warning"
          onClick={onOpenLowStock}
        >
          <div className="dashboard-stat-label">LOW STOCK</div>
          <div className="dashboard-stat-value">{lowStockCount}</div>
          <div className="dashboard-stat-note">Items need attention</div>
        </button>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Recent Bills</h2>
              <span>Latest completed sales</span>
            </div>
          </div>

          <div className="dashboard-empty">No bills today.</div>
        </section>

        <section
          className="dashboard-panel"
          onClick={onOpenLowStock}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpenLowStock()
            }
          }}
        >
          <div className="dashboard-panel-header">
            <div>
              <h2>Low Stock ({lowStockCount})</h2>
              <span>Click to view low-stock products</span>
            </div>
          </div>

          <div className="dashboard-empty">
            {lowStockCount === 0
              ? 'No low-stock items.'
              : `${lowStockCount} items need attention. Click to view.`}
          </div>
        </section>
      </div>

      <section className="dashboard-panel dashboard-quick-actions">
        <div className="dashboard-panel-header">
          <div>
            <h2>Quick Actions</h2>
            <span>Common tasks</span>
          </div>
        </div>

        <div className="dashboard-actions">
          <button type="button" onClick={onOpenBilling}>
            <strong>New Bill</strong>
            <span>Start a new sale</span>
          </button>

          <button type="button" onClick={onOpenItems}>
            <strong>Add Item</strong>
            <span>Create a new product</span>
          </button>

          <button type="button" onClick={onOpenBillHistory}>
            <strong>Bill History</strong>
            <span>View completed bills</span>
          </button>
        </div>
      </section>
    </div>
  )
}
