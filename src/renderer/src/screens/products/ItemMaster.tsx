// ItemMaster.tsx

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import './item-master.css'

import ConfirmDialog from '../../components/confirm-dialog/ConfirmDialog'

import DateFilterDialog, {
  type DateRange
} from '../../components/date-filter-dialog/DateFilterDialog'

import StockAdjustment from './StockAdjustment'
import StockHistory from './StockHistory'

import BarcodePrintDialog from '../../components/barcode-print-dialog/BarcodePrintDialog'

import ContextPanel from '../../components/context-panel/ContextPanel'

type ItemMasterProps = {
  mode?: 'manage' | 'select'
  initialFilter?: 'all' | 'low-stock'
  onBack: () => void
  onAddItem: () => void
  onEditItem: (productId: number) => void
  onSelectItem?: (product: ProductRecord) => void
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`
}

function getToday(): string {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/*
 * Product ID to restore after returning from
 * Edit / Stock Adjustment / Stock History /
 * Enable-Disable / Barcode Print.
 */
const ITEM_MASTER_RETURN_PRODUCT_KEY = 'item-master-return-product-id'

function ItemMaster({
  mode = 'manage',
  initialFilter = 'all',
  onBack,
  onAddItem,
  onEditItem,
  onSelectItem
}: ItemMasterProps): React.JSX.Element {
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [statusChangeProduct, setStatusChangeProduct] = useState<ProductRecord | null>(null)

  const [statusChanging, setStatusChanging] = useState(false)

  const [statusFilter, setStatusFilter] = useState<'active' | 'disabled' | 'all'>('active')

  const [stockFilter, setStockFilter] = useState<'all' | 'low-stock' | 'below' | 'above'>(
    initialFilter
  )

  const [stockThreshold, setStockThreshold] = useState('0')

  const [stockAdjustmentProduct, setStockAdjustmentProduct] = useState<ProductRecord | null>(null)

  const [stockHistoryProduct, setStockHistoryProduct] = useState<ProductRecord | null>(null)

  const [stockHistoryDateFilterOpen, setStockHistoryDateFilterOpen] = useState(false)

  const [stockHistoryDateRange, setStockHistoryDateRange] = useState<DateRange>({
    fromDate: getToday(),
    toDate: getToday()
  })

  // const [allProducts, setAllProducts] = useState<ProductRecord[]>([])

  const [searchError, setSearchError] = useState('')

  const [barcodePrintProduct, setBarcodePrintProduct] = useState<ProductRecord | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)

  const stockThresholdRef = useRef<HTMLInputElement>(null)

  const selectedRowRef = useRef<HTMLTableRowElement | null>(null)

  const restoreScrollOnReturnRef = useRef(false)

  /*
   * Remember the product before opening another
   * Item Master operation.
   */
  function rememberSelectedProduct(productId: number): void {
    sessionStorage.setItem(ITEM_MASTER_RETURN_PRODUCT_KEY, String(productId))
  }

  /*
   * Get the product that should be selected after
   * returning to Item Master.
   */
  function getRememberedProductId(): number | null {
    const value = sessionStorage.getItem(ITEM_MASTER_RETURN_PRODUCT_KEY)

    if (!value) {
      return null
    }

    const productId = Number(value)

    return Number.isFinite(productId) ? productId : null
  }

  /*
   * Clear the remembered product after it has
   * been restored.
   */
  function clearRememberedProduct(): void {
    sessionStorage.removeItem(ITEM_MASTER_RETURN_PRODUCT_KEY)
  }

  async function loadProducts(): Promise<void> {
    try {
      setLoading(true)
      setError('')

      const result = await window.kirana.products.list(10000, statusFilter)

      setProducts(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load products'

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProducts()
  }, [statusFilter])

  /*
   * Filter the products displayed in the table.
   *
   * Keyboard navigation and shortcuts must use
   * this same list so the selected index always
   * matches the visible row.
   */
  const visibleProducts = products.filter((product) => {
    if (stockFilter === 'low-stock') {
      return product.stock_quantity <= product.low_stock_level
    }

    const threshold = Number(stockThreshold)

    if (stockFilter === 'below') {
      return stockThreshold.trim() !== '' && product.stock_quantity <= threshold
    }

    if (stockFilter === 'above') {
      return stockThreshold.trim() !== '' && product.stock_quantity > threshold
    }

    return true
  })

  const selectedProduct = visibleProducts[selectedIndex]

  /*
   * Restore the exact product after returning from
   * Edit / Stock Adjustment / History / etc.
   *
   * Use visibleProducts so the selected index
   * matches the displayed table.
   */
  useEffect(() => {
    if (loading || products.length === 0) {
      return
    }

    const rememberedProductId = getRememberedProductId()

    if (rememberedProductId === null) {
      return
    }

    const rememberedIndex = visibleProducts.findIndex(
      (product) => product.id === rememberedProductId
    )

    if (rememberedIndex !== -1) {
      setSelectedIndex(rememberedIndex)
    } else {
      setSelectedIndex(0)
    }

    clearRememberedProduct()
  }, [products, visibleProducts, loading])

  /*
   * Existing search behavior.
   */
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchError('')
      setSelectedIndex(0)
    }
  }, [searchTerm])

  /*
   * Focus search box when Item Master opens.
   */
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  /*
   * Keep the selected row visible and centered.
   *
   * useLayoutEffect is intentional here because the
   * row must already exist in the DOM after products
   * reload before we calculate its position.
   */
  useLayoutEffect(() => {
    if (loading || visibleProducts.length === 0) {
      return
    }

    const frame = requestAnimationFrame(() => {
      const row = selectedRowRef.current

      if (!row) {
        return
      }

      const container = row.closest('.item-master-table-wrap')

      if (!(container instanceof HTMLElement)) {
        return
      }

      const header = container.querySelector('thead')

      if (!(header instanceof HTMLElement)) {
        return
      }

      const headerHeight = header.getBoundingClientRect().height

      const rowRect = row.getBoundingClientRect()

      const containerRect = container.getBoundingClientRect()

      /*
       * Visible table area starts below the sticky header.
       */
      const visibleTop = containerRect.top + headerHeight

      const visibleBottom = containerRect.bottom

      /*
       * Center the selected row inside the visible
       * table area.
       */
      const visibleCenter = (visibleTop + visibleBottom) / 2

      const rowCenter = (rowRect.top + rowRect.bottom) / 2

      container.scrollTop += rowCenter - visibleCenter
    })

    return (): void => {
      cancelAnimationFrame(frame)
    }
  }, [selectedIndex, visibleProducts, loading])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      /*
       * Child screen/dialog currently owns the keyboard.
       * Item Master must not process any shortcuts.
       */
      if (
        stockHistoryDateFilterOpen ||
        stockAdjustmentProduct ||
        stockHistoryProduct ||
        barcodePrintProduct
      ) {
        return
      }

      if (event.key === 'F2') {
        event.preventDefault()

        onAddItem()

        return
      }

      if (event.key === 'F3') {
        event.preventDefault()

        const selectedProduct = visibleProducts[selectedIndex]

        if (selectedProduct) {
          rememberSelectedProduct(selectedProduct.id)

          onEditItem(selectedProduct.id)
        }

        return
      }

      if (event.key === 'F4') {
        event.preventDefault()

        if (mode !== 'manage') {
          return
        }

        const selectedProduct = visibleProducts[selectedIndex]

        if (selectedProduct) {
          rememberSelectedProduct(selectedProduct.id)
          restoreScrollOnReturnRef.current = true
          setStockAdjustmentProduct(selectedProduct)
        }

        return
      }

      /*
       * F5:
       * Item Master → select product → Date Filter
       */
      if (event.key === 'F5' && mode === 'manage') {
        event.preventDefault()

        const selectedProduct = visibleProducts[selectedIndex]

        if (!selectedProduct) {
          return
        }

        rememberSelectedProduct(selectedProduct.id)
        restoreScrollOnReturnRef.current = true
        setStockHistoryProduct(selectedProduct)

        setStockHistoryDateFilterOpen(true)

        return
      }

      if (event.key === 'Enter' && onSelectItem) {
        event.preventDefault()

        const selectedProduct = visibleProducts[selectedIndex]

        if (selectedProduct) {
          onSelectItem(selectedProduct)
        }

        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()

        if (searchTerm) {
          setSearchTerm('')

          searchRef.current?.focus()

          return
        }

        /*
         * No child screen is active here,
         * so Escape means Item Master → Dashboard.
         */
        onBack()

        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()

        setSelectedIndex((current) => {
          if (visibleProducts.length === 0) {
            return 0
          }

          return Math.min(current + 1, visibleProducts.length - 1)
        })

        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()

        setSelectedIndex((current) => Math.max(current - 1, 0))

        return
      }

      if (event.key === 'Delete') {
        event.preventDefault()

        const selectedProduct = visibleProducts[selectedIndex]

        if (selectedProduct) {
          /*
           * Remember the product before opening the
           * Enable / Disable confirmation.
           */
          rememberSelectedProduct(selectedProduct.id)

          setStatusChangeProduct(selectedProduct)
        }

        return
      }

      if (event.key === 'Backspace') {
        const target = event.target

        // Allow normal editing inside input fields and textareas.
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          return
        }

        event.preventDefault()

        if (searchTerm) {
          setSearchTerm('')
          setSearchError('')
          setSelectedIndex(0)

          requestAnimationFrame(() => {
            searchRef.current?.focus()
          })
        }

        return
      }

      if ((event.key === '+' || event.key === '=') && mode === 'manage') {
        event.preventDefault()

        const selectedProduct = visibleProducts[selectedIndex]

        if (selectedProduct) {
          rememberSelectedProduct(selectedProduct.id)

          setBarcodePrintProduct(selectedProduct)
        }

        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return (): void => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    mode,
    onAddItem,
    onBack,
    onEditItem,
    onSelectItem,
    visibleProducts,
    searchTerm,
    selectedIndex,
    stockAdjustmentProduct,
    stockHistoryDateFilterOpen,
    stockHistoryProduct,
    barcodePrintProduct
  ])

  function productMatchesSearch(product: ProductRecord, query: string): boolean {
    const name = product.name.trim().toLowerCase()
    const barcode = (product.barcode ?? '').trim().toLowerCase()

    return name.startsWith(query) || barcode.startsWith(query)
  }

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const nextValue = event.target.value
    const query = nextValue.trim().toLowerCase()

    /*
     * Allow clearing the search.
     */
    if (!query) {
      setSearchTerm('')
      setSearchError('')
      setSelectedIndex(0)
      return
    }

    /*
     * Find the FIRST matching product within the
     * currently visible list.
     * This becomes the default selected product.
     */
    const matchingIndex = visibleProducts.findIndex((product) =>
      productMatchesSearch(product, query)
    )

    /*
     * Invalid next character:
     * do NOT update searchTerm.
     */
    if (matchingIndex === -1) {
      setSearchError('No such product found')
      return
    }

    /*
     * Valid search:
     * accept the search text and select
     * the FIRST matching product.
     */
    setSearchTerm(nextValue)
    setSearchError('')
    setSelectedIndex(matchingIndex)
  }

  /*
   * Stock Adjustment screen.
   */
  if (stockAdjustmentProduct) {
    return (
      <StockAdjustment
        product={stockAdjustmentProduct}
        onSaved={async (): Promise<void> => {
          setStockAdjustmentProduct(null)

          await loadProducts()
        }}
        onCancel={(): void => {
          setStockAdjustmentProduct(null)

          requestAnimationFrame((): void => {
            searchRef.current?.focus()
          })
        }}
      />
    )
  }

  /*
   * Stock History screen.
   *
   * This is shown ONLY after the user applies
   * the date filter.
   */
  if (stockHistoryProduct && !stockHistoryDateFilterOpen) {
    return (
      <StockHistory
        product={stockHistoryProduct}
        dateRange={stockHistoryDateRange}
        onBack={() => {
          setStockHistoryProduct(null)

          requestAnimationFrame(() => {
            searchRef.current?.focus()
          })
        }}
      />
    )
  }

  return (
    <div className="item-master-layout">
      <div className="item-master">
        <div className="item-master-header">
          <div className="item-master-title">ITEM MASTER</div>

          <div className="item-master-shortcuts">
            <span>↑↓ Select</span>
            <span>F2 Add</span>
            <span>F3 Edit</span>
            <span>F4 Stock Adj</span>
            <span>F5 History</span>
            <span>Enter No Action</span>
            <span>Esc Back</span>
            <span>DELETE Enable/Disable</span>
          </div>
        </div>

        <div className="item-master-table-wrap">
          <table className="item-master-table">
            <thead>
              <tr>
                <th className="select-column"></th>

                <th>Product</th>

                <th className="money-column">MRP</th>

                <th className="money-column">Rate</th>

                <th className="quantity-column">Stock</th>

                <th className="quantity-column">Low</th>

                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="table-message">
                    Loading...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={8} className="table-message error">
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && visibleProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-message">
                    {stockFilter === 'low-stock'
                      ? 'No low-stock products found'
                      : 'No products found'}
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                visibleProducts.map((product, index) => {
                  const selected = index === selectedIndex

                  const searchMatches =
                    searchTerm.trim() !== '' &&
                    productMatchesSearch(product, searchTerm.trim().toLowerCase())

                  return (
                    <tr
                      key={product.id}
                      ref={selected ? selectedRowRef : null}
                      className={
                        selected ? 'selected-row' : searchMatches ? 'search-match-row' : ''
                      }
                      onClick={(): void => {
                        setSelectedIndex(index)
                        searchRef.current?.focus()
                      }}
                      onDoubleClick={(): void => {
                        rememberSelectedProduct(product.id)
                        onEditItem(product.id)
                      }}
                    >
                      <td className="select-column">{selected ? '>' : ''}</td>

                      <td>{product.name}</td>

                      <td className="money-column">{formatRupees(product.mrp_paise)}</td>

                      <td className="money-column">{formatRupees(product.selling_price_paise)}</td>

                      <td className="quantity-column">{product.stock_quantity}</td>

                      <td className="quantity-column">{product.low_stock_level}</td>

                      <td>{product.is_active ? 'Active' : 'Disabled'}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        <div className="item-master-search-row">
          <label htmlFor="item-search">Search:</label>

          <input
            ref={searchRef}
            id="item-search"
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            autoComplete="off"
            spellCheck={false}
          />

          {searchError && <span className="item-master-search-error">{searchError}</span>}

          <label htmlFor="status-filter">Status:</label>

          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as 'active' | 'disabled' | 'all')
            }}
          >
            <option value="active">Active</option>

            <option value="disabled">Disabled</option>

            <option value="all">All</option>
          </select>

          <label htmlFor="stock-filter">Stock:</label>

          <select
            id="stock-filter"
            value={stockFilter}
            onChange={(event) => {
              const nextFilter = event.target.value as 'all' | 'low-stock' | 'below' | 'above'

              setStockFilter(nextFilter)
              setSelectedIndex(0)

              if (nextFilter === 'below' || nextFilter === 'above') {
                requestAnimationFrame(() => {
                  stockThresholdRef.current?.focus()
                  stockThresholdRef.current?.select()
                })
              }
            }}
          >
            <option value="all">All Items</option>
            <option value="low-stock">Low Stock</option>
            <option value="below">Below or Equal Quantity</option>
            <option value="above">Above</option>
          </select>

          {(stockFilter === 'below' || stockFilter === 'above') && (
            <>
              <label htmlFor="stock-threshold">Qty:</label>

              <input
                ref={stockThresholdRef}
                id="stock-threshold"
                type="number"
                min="0"
                step="0.001"
                value={stockThreshold}
                onChange={(event) => {
                  setStockThreshold(event.target.value)
                  setSelectedIndex(0)
                }}
              />
            </>
          )}

          <span className="item-count">{visibleProducts.length} items</span>
        </div>

        <div className="item-master-footer">
          <span>↑↓ Select</span>
          <span>F2 Add</span>
          <span>F3 Edit</span>
          <span>F4 Stock Adj</span>
          <span>F5 History</span>
          <span>Enter No Action</span>
          <span>Esc Back</span>
          <span>DELETE Enable/Disable</span>
        </div>

        <div className="item-master-details">
          {!selectedProduct ? (
            <div className="item-master-details-empty">No product selected</div>
          ) : (
            <>
              <div className="item-master-details-title">PRODUCT DETAILS</div>

              <div className="item-master-details-grid">
                <div className="item-master-detail">
                  <span className="item-master-detail-label">Product</span>

                  <span className="item-master-detail-value">{selectedProduct.name}</span>
                </div>

                <div className="item-master-detail">
                  <span className="item-master-detail-label">Barcode</span>

                  <span className="item-master-detail-value">{selectedProduct.barcode || '—'}</span>
                </div>

                <div className="item-master-detail">
                  <span className="item-master-detail-label">MRP</span>

                  <span className="item-master-detail-value">
                    {formatRupees(selectedProduct.mrp_paise)}
                  </span>
                </div>

                <div className="item-master-detail">
                  <span className="item-master-detail-label">Selling Rate</span>

                  <span className="item-master-detail-value">
                    {formatRupees(selectedProduct.selling_price_paise)}
                  </span>
                </div>

                <div className="item-master-detail">
                  <span className="item-master-detail-label">Purchasing Price</span>

                  <span className="item-master-detail-value">
                    {formatRupees(selectedProduct.purchase_price_paise)}
                  </span>
                </div>

                <div className="item-master-detail">
                  <span className="item-master-detail-label">Stock</span>

                  <span className="item-master-detail-value">{selectedProduct.stock_quantity}</span>
                </div>

                <div className="item-master-detail">
                  <span className="item-master-detail-label">Low Stock</span>

                  <span className="item-master-detail-value">
                    {selectedProduct.low_stock_level}
                  </span>
                </div>

                <div className="item-master-detail">
                  <span className="item-master-detail-label">Status</span>

                  <span className="item-master-detail-value">
                    {selectedProduct.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {statusChangeProduct && (
          <ConfirmDialog
            title={statusChangeProduct.is_active ? 'Disable Product' : 'Enable Product'}
            message={
              statusChangeProduct.is_active ? (
                <>
                  Disable <strong>{statusChangeProduct.name}</strong>?
                  <br />
                  This product will no longer appear in normal billing and product search.
                </>
              ) : (
                <>
                  Enable <strong>{statusChangeProduct.name}</strong>?
                  <br />
                  This product will become available in normal billing and product search.
                </>
              )
            }
            confirmText={statusChangeProduct.is_active ? 'Disable' : 'Enable'}
            cancelText="Cancel"
            variant="warning"
            onConfirm={async (): Promise<void> => {
              try {
                setStatusChanging(true)
                setError('')

                if (statusChangeProduct.is_active) {
                  await window.kirana.products.disable(statusChangeProduct.id)
                } else {
                  await window.kirana.products.enable(statusChangeProduct.id)
                }

                setStatusChangeProduct(null)

                await loadProducts()
              } catch (err) {
                const message =
                  err instanceof Error ? err.message : 'Unable to change product status'

                setError(message)
              } finally {
                setStatusChanging(false)
              }
            }}
            onCancel={(): void => {
              if (!statusChanging) {
                setStatusChangeProduct(null)
              }
            }}
          />
        )}

        <DateFilterDialog
          open={stockHistoryDateFilterOpen}
          title="Stock History - Date Filter"
          initialFromDate={stockHistoryDateRange.fromDate}
          initialToDate={stockHistoryDateRange.toDate}
          showPresets
          onApply={(range: DateRange): void => {
            setStockHistoryDateRange(range)

            setStockHistoryDateFilterOpen(false)
          }}
          onCancel={(): void => {
            setStockHistoryDateFilterOpen(false)

            setStockHistoryProduct(null)
          }}
        />

        <BarcodePrintDialog
          open={barcodePrintProduct !== null}
          product={barcodePrintProduct as ProductRecord}
          onClose={(): void => {
            setBarcodePrintProduct(null)

            requestAnimationFrame(() => {
              searchRef.current?.focus()
            })
          }}
        />
      </div>

      <ContextPanel mode="blank" />
    </div>
  )
}

export default ItemMaster
