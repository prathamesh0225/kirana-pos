import { useEffect, useState } from 'react'
import './context-panel.css'

type ContextPanelMode = 'billing' | 'blank'

type BillingContextProduct = {
  productId: number
  productName: string
  stockQuantity: number
  lowStockLevel: number
  soldQuantity: number
  expiryDate?: string | null
}

type BillingContextData = {
  urgentStock: BillingContextProduct[]
  topSellers: BillingContextProduct[]
  expiringStock: BillingContextProduct[]
}

type ContextPanelProps = {
  mode: ContextPanelMode
}

function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2)
}

function formatExpiryDate(date: string): string {
  const normalized = normalizeExpiryDate(date)

  if (!normalized) {
    return date
  }

  const value = new Date(`${normalized}T00:00:00`)

  if (Number.isNaN(value.getTime())) {
    return date
  }

  return value.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short'
  })
}

function getExpiryDays(expiryDate: string): number {
  const normalized = normalizeExpiryDate(expiryDate)

  if (!normalized) {
    return 999999
  }

  const expiry = new Date(`${normalized}T00:00:00`)
  const today = new Date()

  today.setHours(0, 0, 0, 0)

  const difference = expiry.getTime() - today.getTime()

  return Math.ceil(difference / (1000 * 60 * 60 * 24))
}

function normalizeExpiryDate(value: string): string | null {
  const trimmed = value.trim()

  // Current format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  // Older format: DD/MM/YYYY
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed)

  if (!match) {
    return null
  }

  return `${match[3]}-${match[2]}-${match[1]}`
}

export default function ContextPanel({ mode }: ContextPanelProps): React.JSX.Element {
  const [data, setData] = useState<BillingContextData | null>(null)

  /*
   * Controls whether the panel details are visible.
   *
   * true  = details visible
   * false = details hidden
   */
  const [detailsVisible, setDetailsVisible] = useState(true)

  useEffect(() => {
    if (mode !== 'billing') {
      setData(null)
      return
    }

    let cancelled = false

    async function loadContextData(): Promise<void> {
      try {
        const contextData = await window.kirana.billing.getContextData()

        if (!cancelled) {
          setData(contextData)
        }
      } catch (error) {
        console.error('Unable to load billing context data:', error)

        if (!cancelled) {
          setData({
            urgentStock: [],
            topSellers: [],
            expiringStock: []
          })
        }
      }
    }

    // Initial load when Billing opens.
    void loadContextData()

    // Refresh automatically after a successful sale.
    const handleSaleCompleted = (): void => {
      void loadContextData()
    }

    window.addEventListener('kirana:sale-completed', handleSaleCompleted)

    return () => {
      cancelled = true

      window.removeEventListener('kirana:sale-completed', handleSaleCompleted)
    }
  }, [mode])

  if (mode === 'blank') {
    return <aside className="context-panel context-panel-blank" />
  }

  return (
    <aside
      className={['context-panel', !detailsVisible ? 'context-panel-hidden' : '']
        .filter(Boolean)
        .join(' ')}
    >
      {/* =====================================================
          HEADER
         ===================================================== */}

      <div className="context-panel-header">
        <button
          type="button"
          className="context-panel-eye"
          title={detailsVisible ? 'Hide details' : 'Show details'}
          aria-label={detailsVisible ? 'Hide billing insights' : 'Show billing insights'}
          onClick={() => {
            setDetailsVisible((current) => !current)
          }}
        >
          {detailsVisible ? '◉' : '◎'}
        </button>

        <div className="context-panel-title">BILLING INSIGHTS</div>
      </div>

      {!detailsVisible ? (
        <div className="context-panel-hidden-message">Details hidden</div>
      ) : !data ? (
        <div className="context-panel-loading">Loading...</div>
      ) : (
        <div className="context-panel-content">
          {/* =================================================
              URGENT STOCK
             ================================================= */}

          <section className="context-section">
            <div className="context-section-title urgent">URGENT STOCK</div>

            <div className="context-section-hint">Low stock + high demand</div>

            {data.urgentStock.length === 0 ? (
              <div className="context-empty">No urgent stock</div>
            ) : (
              <div className="context-product-list">
                {data.urgentStock.slice(0, 15).map((product) => (
                  <div className="context-product" key={product.productId}>
                    <div className="context-product-name">{product.productName}</div>

                    <div className="context-product-meta">
                      <span>Stock {formatQuantity(product.stockQuantity)}</span>

                      <span>Sold {formatQuantity(product.soldQuantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* =================================================
              TOP SELLERS
             ================================================= */}

          <section className="context-section">
            <div className="context-section-title">TOP SELLERS</div>

            <div className="context-section-hint">Last 30 days</div>

            {data.topSellers.length === 0 ? (
              <div className="context-empty">No sales data</div>
            ) : (
              <div className="context-product-list">
                {data.topSellers.slice(0, 15).map((product, index) => (
                  <div className="context-product" key={product.productId}>
                    <div className="context-product-name">
                      <span className="context-rank">{index + 1}.</span>

                      {product.productName}
                    </div>

                    <div className="context-product-meta">
                      <span>Sold {formatQuantity(product.soldQuantity)}</span>

                      <span>Stock {formatQuantity(product.stockQuantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* =================================================
              EXPIRING STOCK
             ================================================= */}

          <section className="context-section">
            <div className="context-section-title expiry">EXPIRING STOCK</div>

            <div className="context-section-hint">High stock • Next 30 days</div>

            {data.expiringStock.length === 0 ? (
              <div className="context-empty">No near-expiry stock</div>
            ) : (
              <div className="context-product-list">
                {data.expiringStock.slice(0, 15).map((product) => {
                  const days = product.expiryDate ? getExpiryDays(product.expiryDate) : null

                  return (
                    <div className="context-product" key={product.productId}>
                      <div className="context-product-top">
                        <div className="context-product-name">{product.productName}</div>

                        {days !== null && (
                          <div className="context-expiry-warning">
                            {days <= 0
                              ? 'Expires today'
                              : `${days} day${days === 1 ? '' : 's'} left`}
                          </div>
                        )}
                      </div>

                      <div className="context-product-meta">
                        <span>Stock {formatQuantity(product.stockQuantity)}</span>

                        {product.expiryDate && <span>{formatExpiryDate(product.expiryDate)}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </aside>
  )
}
