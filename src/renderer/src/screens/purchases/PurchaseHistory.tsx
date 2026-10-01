import { useEffect, useMemo, useState } from 'react'
import './purchase-history.css'

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

export default function PurchaseHistory({
  onBack,
  onModifyPurchase
}: PurchaseHistoryProps): React.JSX.Element {
  const [purchases, setPurchases] = useState<PurchaseHistoryRow[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadPurchases(): Promise<void> {
    try {
      setLoading(true)
      setError('')

      const result = await window.kirana.purchase.list(200)

      setPurchases(result)
      setSelectedIndex(0)
    } catch (err) {
      console.error('Purchase history load failed:', err)

      setError(err instanceof Error ? err.message : 'Unable to load purchase history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPurchases()
  }, [])

  const filteredPurchases = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return purchases
    }

    return purchases.filter((purchase) => {
      return (
        purchase.invoiceNumber.toLowerCase().includes(query) ||
        purchase.supplierName.toLowerCase().includes(query) ||
        purchase.paymentMethod.toLowerCase().includes(query)
      )
    })
  }, [purchases, search])

  useEffect(() => {
    if (selectedIndex >= filteredPurchases.length) {
      setSelectedIndex(Math.max(filteredPurchases.length - 1, 0))
    }
  }, [filteredPurchases.length, selectedIndex])

  useEffect(() => {
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

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()

        setSelectedIndex((current) =>
          Math.min(current + 1, Math.max(filteredPurchases.length - 1, 0))
        )

        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()

        setSelectedIndex((current) => Math.max(current - 1, 0))

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
  }, [filteredPurchases, selectedIndex, onBack, onModifyPurchase])

  return (
    <div className="purchase-history">
      <div className="purchase-history-header">
        <div>
          <div className="purchase-history-title">PURCHASE HISTORY</div>

          <div className="purchase-history-subtitle">
            Enter = Modify &nbsp;&nbsp; ↑↓ = Select &nbsp;&nbsp; F5 = Refresh &nbsp;&nbsp; Esc =
            Back
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

      {error && <div className="purchase-history-error">{error}</div>}

      <div className="purchase-history-table-wrapper">
        <table className="purchase-history-table">
          <thead>
            <tr>
              <th>DATE</th>
              <th>INVOICE</th>
              <th>SUPPLIER</th>
              <th>SUBTOTAL</th>
              <th>TAX</th>
              <th>DISCOUNT</th>
              <th>TOTAL</th>
              <th>PAID</th>
              <th>BALANCE</th>
              <th>PAYMENT</th>
              <th>ACTION</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="purchase-history-empty">
                  Loading purchase history...
                </td>
              </tr>
            ) : filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan={11} className="purchase-history-empty">
                  No purchases found.
                </td>
              </tr>
            ) : (
              filteredPurchases.map((purchase, index) => {
                const selected = index === selectedIndex

                return (
                  <tr
                    key={purchase.id}
                    className={selected ? 'purchase-history-row-selected' : ''}
                    onClick={() => {
                      setSelectedIndex(index)
                    }}
                    onDoubleClick={() => {
                      void onModifyPurchase(purchase.id)
                    }}
                  >
                    <td>{formatDate(purchase.purchaseDate)}</td>

                    <td>{purchase.invoiceNumber}</td>

                    <td>{purchase.supplierName}</td>

                    <td>₹{formatMoney(purchase.subtotalPaise)}</td>

                    <td>₹{formatMoney(purchase.taxPaise)}</td>

                    <td>₹{formatMoney(purchase.discountPaise)}</td>

                    <td>
                      <strong>₹{formatMoney(purchase.totalAmountPaise)}</strong>
                    </td>

                    <td>₹{formatMoney(purchase.paidPaise)}</td>

                    <td>₹{formatMoney(purchase.balancePaise)}</td>

                    <td>{purchase.paymentMethod}</td>

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
  )
}
