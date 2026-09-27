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
}

export function Dashboard({ onOpenBilling, onOpenItems, onOpenBillHistory, onOpenSettings }: DashboardProps) {
  const [salesSummary, setSalesSummary] = useState<DashboardSalesSummary>({
    totalSalesPaise: 0,
    billsToday: 0
  })

  const [isLoading, setIsLoading] = useState(true)

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

        <div className="dashboard-stat dashboard-stat-warning">
          <div className="dashboard-stat-label">LOW STOCK</div>
          <div className="dashboard-stat-value">0</div>
          <div className="dashboard-stat-note">Items need attention</div>
        </div>
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

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Low Stock</h2>
              <span>Items below their stock level</span>
            </div>
          </div>

          <div className="dashboard-empty">No low-stock items.</div>
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
