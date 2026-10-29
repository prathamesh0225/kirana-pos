import { useEffect, useState } from 'react'
import './context-panel.css'

type ContextPanelMode = 'billing' | 'bill-history' | 'purchase-history' | 'blank'

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

type HistoryItem = {
  productName: string
  quantity: number
  freeQuantity?: number
}

type HistoryContextData = {
  items: HistoryItem[]

  billNumber?: string

  invoiceNumber?: string
  supplierName?: string

  date?: string
  time?: string

  uniqueItems?: number
}

type ContextPanelProps = {
  mode: ContextPanelMode
  saleId?: number
  purchaseId?: number
}

function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2)
}

function normalizeExpiryDate(value: string): string | null {
  const trimmed = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed)

  if (!match) {
    return null
  }

  return `${match[3]}-${match[2]}-${match[1]}`
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

function formatHistoryDateTime(value: string | undefined): {
  date: string
  time: string
} {
  const trimmed = value?.trim() ?? ''

  if (!trimmed) {
    return {
      date: '',
      time: ''
    }
  }

  const parsed = new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    return {
      date: trimmed,
      time: ''
    }
  }

  return {
    date: parsed.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }),

    time: parsed.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }
}

export default function ContextPanel({
  mode,
  saleId,
  purchaseId
}: ContextPanelProps): React.ReactElement {
  const [data, setData] = useState<BillingContextData | null>(null)

  const [historyData, setHistoryData] = useState<HistoryContextData | null>(null)

  const [detailsVisible, setDetailsVisible] = useState(true)

  /*
   * =========================================================
   * BILLING CONTEXT
   * =========================================================
   */

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

    void loadContextData()

    const handleSaleCompleted = (): void => {
      void loadContextData()
    }

    window.addEventListener('kirana:sale-completed', handleSaleCompleted)

    return () => {
      cancelled = true

      window.removeEventListener('kirana:sale-completed', handleSaleCompleted)
    }
  }, [mode])

  /*
   * =========================================================
   * BILL HISTORY / PURCHASE HISTORY
   * =========================================================
   */

  useEffect(() => {
    if (mode !== 'bill-history' && mode !== 'purchase-history') {
      setHistoryData(null)
      return
    }

    let cancelled = false

    async function loadHistoryItems(): Promise<void> {
      try {
        /*
         * -----------------------------------------------------
         * BILL HISTORY
         * -----------------------------------------------------
         */

        if (mode === 'bill-history') {
          if (saleId === undefined) {
            setHistoryData({
              items: []
            })

            return
          }

          const sale = await window.kirana.billing.getSaleById(saleId)

          if (cancelled) {
            return
          }

          if (!sale) {
            setHistoryData({
              items: []
            })

            return
          }

          const dateTime = formatHistoryDateTime(sale.saleDate)

          setHistoryData({
            billNumber: sale.billNumber,

            date: dateTime.date,

            time: dateTime.time,

            uniqueItems: new Set(
              sale.items
                .filter((item) => item.productName.trim() !== '')
                .map((item) => item.productName.trim().toLowerCase())
            ).size,

            items: sale.items
              .filter((item) => item.productName.trim() !== '')
              .map((item) => ({
                productName: item.productName,

                quantity: item.quantity,

                freeQuantity: item.freeQuantity
              }))
          })

          return
        }

        /*
         * -----------------------------------------------------
         * PURCHASE HISTORY
         * -----------------------------------------------------
         */

        if (purchaseId === undefined) {
          setHistoryData({
            items: []
          })

          return
        }

        const purchase = await window.kirana.purchase.get(purchaseId)

        if (cancelled) {
          return
        }

        if (!purchase) {
          setHistoryData({
            items: []
          })

          return
        }

        const purchaseDateTime = formatHistoryDateTime(purchase.createdAt)
        setHistoryData({
          invoiceNumber: purchase.invoiceNumber,

          supplierName: purchase.supplierName,

          date: purchaseDateTime.date,
          time: purchaseDateTime.time,

          uniqueItems: new Set(
            purchase.lines
              .filter((line) => line.productName.trim() !== '')
              .map((line) => line.productName.trim().toLowerCase())
          ).size,

          items: purchase.lines.map((line) => ({
            productName: line.productName,

            quantity: line.quantity,

            freeQuantity: line.freeQuantity
          }))
        })
      } catch (error) {
        console.error('Unable to load history context data:', error)

        if (!cancelled) {
          setHistoryData({
            items: []
          })
        }
      }
    }

    void loadHistoryItems()

    return () => {
      cancelled = true
    }
  }, [mode, saleId, purchaseId])

  /*
   * =========================================================
   * BLANK MODE
   * =========================================================
   */

  if (mode === 'blank') {
    return <aside className="context-panel context-panel-blank" />
  }

  /*
   * =========================================================
   * BILL HISTORY / PURCHASE HISTORY
   * =========================================================
   */

  if (mode === 'bill-history' || mode === 'purchase-history') {
    const isBillHistory = mode === 'bill-history'

    const title = isBillHistory ? 'BILL DETAILS' : 'PURCHASE DETAILS'

    const subtitle = isBillHistory ? 'ITEMS SOLD' : 'ITEMS PURCHASED'

    const emptyMessage = isBillHistory ? 'No items found' : 'No purchase items found'

    const visibleItems = historyData?.items.slice(0, 15) ?? []

    const hasMoreItems = (historyData?.items.length ?? 0) > 15

    return (
      <aside className="context-panel">
        <div className="context-panel-header">
          <div className="context-panel-title">{title}</div>

          <button
            type="button"
            className="context-panel-eye"
            onClick={() => setDetailsVisible((visible) => !visible)}
            title={detailsVisible ? 'Hide details' : 'Show details'}
            aria-label={detailsVisible ? 'Hide details' : 'Show details'}
          >
            {detailsVisible ? '◉' : '◌'}
          </button>
        </div>

        <div className="context-panel-content">
          {!detailsVisible ? (
            <div className="context-panel-hidden-message">Details hidden</div>
          ) : (
            <>
              {/* =================================================
                  BILL / PURCHASE INFORMATION
                  ================================================= */}

              <section className="context-history-info">
                {isBillHistory ? (
                  <div className="context-history-row">
                    <span className="context-history-label">Bill No</span>

                    <span className="context-history-value">{historyData?.billNumber ?? '-'}</span>
                  </div>
                ) : (
                  <>
                    <div className="context-history-row">
                      <span className="context-history-label">Invoice No</span>

                      <span className="context-history-value">
                        {historyData?.invoiceNumber ?? '-'}
                      </span>
                    </div>

                    <div className="context-history-row">
                      <span className="context-history-label">Supplier</span>

                      <span className="context-history-value context-history-value-wrap">
                        {historyData?.supplierName ?? '-'}
                      </span>
                    </div>
                  </>
                )}

                <div className="context-history-row">
                  <span className="context-history-label">Date</span>

                  <span className="context-history-value">{historyData?.date ?? '-'}</span>
                </div>

                <div className="context-history-row">
                  <span className="context-history-label">Time</span>

                  <span className="context-history-value">{historyData?.time ?? '-'}</span>
                </div>

                <div className="context-history-row">
                  <span className="context-history-label">Unique Items</span>

                  <span className="context-history-value">{historyData?.uniqueItems ?? 0}</span>
                </div>
              </section>

              {/* =================================================
                  ITEMS
                  ================================================= */}

              <section className="context-section context-history-section">
                <div className="context-section-header">
                  <div>
                    <div className="context-section-title">{subtitle}</div>

                    <div className="context-section-hint">
                      {isBillHistory
                        ? 'Products in selected bill'
                        : 'Products in selected purchase'}
                    </div>
                  </div>
                </div>

                <div className="context-history-items">
                  {!historyData ? (
                    <div className="context-empty">Loading...</div>
                  ) : visibleItems.length === 0 ? (
                    <div className="context-empty">{emptyMessage}</div>
                  ) : (
                    <>
                      {visibleItems.map((item, index) => (
                        /*
                         * IMPORTANT:
                         * Do NOT use .context-product here.
                         * That class intentionally has a box
                         * border for Billing products.
                         */

                        <div className="history-item-line" key={`${item.productName}-${index}`}>
                          <span className="history-item-quantity">
                            {formatQuantity(item.quantity)}

                            {item.freeQuantity !== undefined &&
                              item.freeQuantity > 0 &&
                              ` + ${formatQuantity(item.freeQuantity)} free`}
                          </span>

                          <span className="history-item-separator">-</span>

                          <span className="history-item-name">{item.productName}</span>
                        </div>
                      ))}

                      {hasMoreItems && <div className="history-more-items">...</div>}
                    </>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    )
  }

  /*
   * =========================================================
   * BILLING MODE
   * =========================================================
   */

  return (
    <aside className="context-panel">
      <div className="context-panel-header">
        <div className="context-panel-title">QUICK INFO</div>

        <button
          type="button"
          className="context-panel-eye"
          onClick={() => setDetailsVisible((visible) => !visible)}
          title={detailsVisible ? 'Hide details' : 'Show details'}
          aria-label={detailsVisible ? 'Hide details' : 'Show details'}
        >
          {detailsVisible ? '◉' : '◌'}
        </button>
      </div>

      <div className="context-panel-content">
        {!detailsVisible ? (
          <div className="context-panel-hidden-message">Details hidden</div>
        ) : (
          <>
            {/* =================================================
                URGENT STOCK
                ================================================= */}

            <section className="context-section">
              <div className="context-section-header">
                <div>
                  <div className="context-section-title urgent">
                    URGENT STOCK
                    <span className="context-section-count">
                      Items: {data?.urgentStock.length ?? 0}
                    </span>
                  </div>

                  <div className="context-section-hint">Low stock + high demand</div>
                </div>
              </div>

              <div className="context-product-list">
                {!data ? (
                  <div className="context-empty">Loading...</div>
                ) : data.urgentStock.length === 0 ? (
                  <div className="context-empty">No urgent stock</div>
                ) : (
                  data.urgentStock.map((product) => (
                    <div className="context-product" key={product.productId}>
                      <div className="context-product-top">
                        <div className="context-product-name">{product.productName}</div>
                      </div>

                      <div className="context-product-meta">
                        <span>Stock {formatQuantity(product.stockQuantity)}</span>

                        <span>Sold {formatQuantity(product.soldQuantity)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* =================================================
                TOP SELLERS
                ================================================= */}

            <section className="context-section">
              <div className="context-section-header">
                <div>
                  <div className="context-section-title">TOP SELLERS</div>

                  <div className="context-section-hint">Last 30 days</div>
                </div>
              </div>

              <div className="context-product-list">
                {!data ? (
                  <div className="context-empty">Loading...</div>
                ) : data.topSellers.length === 0 ? (
                  <div className="context-empty">No sales data</div>
                ) : (
                  data.topSellers.map((product, index) => (
                    <div className="context-product" key={product.productId}>
                      <div className="context-product-top">
                        <div className="context-product-name">
                          <span className="context-rank">{index + 1}.</span> {product.productName}
                        </div>
                      </div>

                      <div className="context-product-meta">
                        <span>Sold {formatQuantity(product.soldQuantity)}</span>

                        <span>Stock {formatQuantity(product.stockQuantity)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* =================================================
                EXPIRING STOCK
                ================================================= */}

            <section className="context-section">
              <div className="context-section-header">
                <div>
                  <div className="context-section-title expiry">
                    EXPIRING STOCK
                    <span className="context-section-count">
                      Items: {data?.expiringStock.length ?? 0}
                    </span>
                  </div>

                  <div className="context-section-hint">High stock • Next 30 days</div>
                </div>
              </div>

              <div className="context-product-list">
                {!data ? (
                  <div className="context-empty">Loading...</div>
                ) : data.expiringStock.length === 0 ? (
                  <div className="context-empty">No products expiring soon</div>
                ) : (
                  data.expiringStock.map((product) => {
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

                          {product.expiryDate && (
                            <span>{formatExpiryDate(product.expiryDate)}</span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  )
}
