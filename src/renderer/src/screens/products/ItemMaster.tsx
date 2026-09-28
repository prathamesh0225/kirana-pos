import { useEffect, useRef, useState } from 'react'
import './item-master.css'
import ConfirmDialog from '../../components/confirm-dialog/ConfirmDialog'
import DateFilterDialog, {
  type DateRange
} from '../../components/date-filter-dialog/DateFilterDialog'
import StockAdjustment from './StockAdjustment'
import StockHistory from './StockHistory'

type ItemMasterProps = {
  mode?: 'manage' | 'select'
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

function ItemMaster({
  mode = 'manage',
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

  const [stockAdjustmentProduct, setStockAdjustmentProduct] = useState<ProductRecord | null>(null)

  const [stockHistoryProduct, setStockHistoryProduct] = useState<ProductRecord | null>(null)

  const [stockHistoryDateFilterOpen, setStockHistoryDateFilterOpen] = useState(false)

  const [stockHistoryDateRange, setStockHistoryDateRange] = useState<DateRange>({
    fromDate: getToday(),
    toDate: getToday()
  })

  const searchRef = useRef<HTMLInputElement>(null)

  async function loadProducts(): Promise<void> {
    try {
      setLoading(true)
      setError('')

      const result = searchTerm.trim()
        ? await window.kirana.products.search(searchTerm, 100, statusFilter)
        : await window.kirana.products.list(100, statusFilter)

      setProducts(result)
      setSelectedIndex(0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load products'

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProducts()
  }, [searchTerm, statusFilter])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      /*
       * Child screen/dialog currently owns the keyboard.
       * Item Master must not process any shortcuts.
       */
      if (stockHistoryDateFilterOpen || stockAdjustmentProduct || stockHistoryProduct) {
        return
      }

      if (event.key === 'F2') {
        event.preventDefault()
        onAddItem()
        return
      }

      if (event.key === 'F3') {
        event.preventDefault()

        const selectedProduct = products[selectedIndex]

        if (selectedProduct) {
          onEditItem(selectedProduct.id)
        }

        return
      }

      if (event.key === 'F4') {
        event.preventDefault()

        if (mode !== 'manage') {
          return
        }

        const selectedProduct = products[selectedIndex]

        if (selectedProduct) {
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

        const selectedProduct = products[selectedIndex]

        if (!selectedProduct) {
          return
        }

        setStockHistoryProduct(selectedProduct)
        setStockHistoryDateFilterOpen(true)

        return
      }

      if (event.key === 'Enter' && mode === 'select') {
        event.preventDefault()

        const selectedProduct = products[selectedIndex]

        if (selectedProduct && onSelectItem) {
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
          if (products.length === 0) {
            return 0
          }

          return Math.min(current + 1, products.length - 1)
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

        const selectedProduct = products[selectedIndex]

        if (selectedProduct) {
          setStatusChangeProduct(selectedProduct)
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
    products,
    searchTerm,
    selectedIndex,
    stockAdjustmentProduct,
    stockHistoryDateFilterOpen,
    stockHistoryProduct
  ])

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setSearchTerm(event.target.value)
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
          requestAnimationFrame(() => searchRef.current?.focus())
        }}
      />
    )
  }

  return (
    <div className="item-master">
      <div className="item-master-header">
        <div className="item-master-title">ITEM MASTER</div>

        <div className="item-master-shortcuts">
          <span>↑↓ Select</span>
          <span>F2 Add</span>
          <span>F3 Edit</span>
          <span>F4 Stock Adj</span>
          <span>F5 History</span>
          <span>F6 Low Stock</span>
          <span>Enter No Action</span>
          <span>Esc Back</span>
          <span>DELETE Enable/Disable</span>
        </div>
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

        <span className="item-count">{products.length} items</span>
      </div>

      <div className="item-master-table-wrap">
        <table className="item-master-table">
          <thead>
            <tr>
              <th className="select-column"></th>
              <th>Product</th>
              <th>Barcode</th>
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

            {!loading && !error && products.length === 0 && (
              <tr>
                <td colSpan={8} className="table-message">
                  No products found
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              products.map((product, index) => {
                const selected = index === selectedIndex

                return (
                  <tr
                    key={product.id}
                    className={selected ? 'selected-row' : ''}
                    onClick={(): void => {
                      setSelectedIndex(index)

                      searchRef.current?.focus()
                    }}
                    onDoubleClick={(): void => {
                      onEditItem(product.id)
                    }}
                  >
                    <td className="select-column">{selected ? '>' : ''}</td>

                    <td>{product.name}</td>

                    <td>{product.barcode ?? ''}</td>

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

      <div className="item-master-footer">
        <span>↑↓ Select</span>
        <span>F2 Add</span>
        <span>F3 Edit</span>
        <span>F4 Stock Adj</span>
        <span>F5 History</span>
        <span>F6 Low Stock</span>
        <span>Enter No Action</span>
        <span>Esc Back</span>
        <span>DELETE Enable/Disable</span>
      </div>

      {statusChangeProduct && (
        <ConfirmDialog
          title={statusChangeProduct.is_active ? 'Disable Product' : 'Enable Product'}
          message={
            statusChangeProduct.is_active ? (
              <>
                Disable <strong>{statusChangeProduct.name}</strong>
                ?
                <br />
                This product will no longer appear in normal billing and product search.
              </>
            ) : (
              <>
                Enable <strong>{statusChangeProduct.name}</strong>
                ?
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
              const message = err instanceof Error ? err.message : 'Unable to change product status'

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
    </div>
  )
}

export default ItemMaster
