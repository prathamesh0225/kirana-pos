import { useEffect, useRef, useState } from 'react'
import './item-master.css'
import ConfirmDialog from '../../components/confirm-dialog/ConfirmDialog'
type ItemMasterProps = {
  onBack: () => void
  onAddItem: () => void
  onEditItem: (productId: number) => void
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`
}

function ItemMaster({ onBack, onAddItem, onEditItem }: ItemMasterProps): React.JSX.Element {
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusChangeProduct, setStatusChangeProduct] = useState<ProductRecord | null>(null)
  const [statusChanging, setStatusChanging] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'active' | 'disabled' | 'all'>('active')

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

      if (event.key === 'Escape') {
        event.preventDefault()

        if (searchTerm) {
          setSearchTerm('')
          searchRef.current?.focus()
          return
        }

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

        setSelectedIndex((current) => {
          return Math.max(current - 1, 0)
        })

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

      // IMPORTANT:
      // Enter intentionally does nothing here.
      //
      // Enter-to-add-product belongs to the Billing
      // product-search context only.
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onAddItem, onBack, onEditItem, products, searchTerm, selectedIndex])

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setSearchTerm(event.target.value)
  }

  return (
    <div className="item-master">
      <div className="item-master-header">
        <div className="item-master-title">ITEM MASTER</div>

        <div className="item-master-shortcuts">
          <span>F2 Add</span>
          <span>F3 Edit</span>
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
                <td colSpan={7} className="table-message">
                  Loading...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={7} className="table-message error">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && products.length === 0 && (
              <tr>
                <td colSpan={7} className="table-message">
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
                    onClick={() => {
                      setSelectedIndex(index)
                      searchRef.current?.focus()
                    }}
                    onDoubleClick={() => {
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
          onConfirm={async () => {
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
          onCancel={() => {
            if (!statusChanging) {
              setStatusChangeProduct(null)
            }
          }}
        />
      )}
    </div>
  )
}

export default ItemMaster
