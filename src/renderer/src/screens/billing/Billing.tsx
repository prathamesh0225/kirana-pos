import { useEffect, useMemo, useRef, useState } from 'react'
import './billing.css'
import type { BillingLine, BillingSession } from './billing.types'
import ItemMaster from '../products/ItemMaster'

type BillingProps = {
  onBack: () => void
  onAddItem?: () => void
  onEditItem?: (productId: number) => void
}

type BillingField = 'product' | 'quantity' | 'free' | 'rate'

const EMPTY_LINE: BillingLine = {
  id: 1,
  productId: null,
  productName: '',
  isTemporary: false,
  barcode: null,
  quantityPrecision: 0,
  mrpPaise: 0,
  quantity: 0,
  freeQuantity: 0,
  ratePaise: 0,
  amountPaise: 0
}

function formatRupees(paise: number): string {
  return (paise / 100).toFixed(2)
}

function createEmptyLine(): BillingLine {
  return {
    ...EMPTY_LINE,
    id: Date.now() + Math.random()
  }
}

function calculateAmount(quantity: number, ratePaise: number): number {
  if (!Number.isFinite(quantity) || quantity < 0) {
    return 0
  }

  if (!Number.isInteger(ratePaise) || ratePaise < 0) {
    return 0
  }

  return Math.round(quantity * ratePaise)
}

function Billing({ onBack, onAddItem, onEditItem }: BillingProps): React.JSX.Element {
  const [lines, setLines] = useState<BillingLine[]>([EMPTY_LINE])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeField, setActiveField] = useState<BillingField>('product')

  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeNotFound, setBarcodeNotFound] = useState(false)
  const [rateInput, setRateInput] = useState('')
  const [showItemSelector, setShowItemSelector] = useState(false)

  const [customerName, setCustomerName] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')

  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const quantityInputRef = useRef<HTMLInputElement>(null)
  const freeInputRef = useRef<HTMLInputElement>(null)
  const rateInputRef = useRef<HTMLInputElement>(null)

  const subtotalPaise = useMemo(
    () => lines.reduce((total, line) => total + line.amountPaise, 0),
    [lines]
  )

  /*
   * ---------------------------------------------------------
   * Focus management
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (showItemSelector) {
      return
    }

    const frame = requestAnimationFrame(() => {
      if (activeField === 'product') {
        barcodeInputRef.current?.focus()
      }

      if (activeField === 'quantity') {
        quantityInputRef.current?.focus()
        quantityInputRef.current?.select()
      }

      if (activeField === 'free') {
        freeInputRef.current?.focus()
        freeInputRef.current?.select()
      }

      if (activeField === 'rate') {
        rateInputRef.current?.focus()
        rateInputRef.current?.select()
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [selectedIndex, activeField, showItemSelector])

  /*
   * ---------------------------------------------------------
   * Billing keyboard shortcuts
   * ---------------------------------------------------------
   *
   * Enter is deliberately NOT handled globally here.
   *
   * Enter inside:
   *   - product input
   *   - quantity input
   *   - free input
   *   - rate input
   *
   * is handled by those controls themselves.
   *
   * For an already-added product row, Enter starts QTY.
   */

  useEffect(() => {
    if (showItemSelector) {
      return
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'ArrowDown') {
        event.preventDefault()

        setSelectedIndex((current) => {
          return Math.min(current + 1, lines.length - 1)
        })

        setActiveField('product')
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()

        setSelectedIndex((current) => {
          return Math.max(current - 1, 0)
        })

        setActiveField('product')
        return
      }

      if (event.key === 'F2') {
        event.preventDefault()

        const lastIndex = lines.length - 1

        setSelectedIndex(lastIndex)
        setActiveField('product')
        setBarcodeNotFound(false)
        return
      }

      if (event.key === 'Delete') {
        event.preventDefault()

        const selectedLine = lines[selectedIndex]

        if (!selectedLine || (selectedLine.productId === null && !selectedLine.isTemporary)) {
          return
        }

        if (lines.length === 1) {
          return
        }

        setLines((currentLines) => currentLines.filter((_, index) => index !== selectedIndex))

        setSelectedIndex((currentIndex) => {
          const newLength = lines.length - 1

          if (newLength <= 0) {
            return 0
          }

          return Math.min(currentIndex, newLength - 1)
        })

        setActiveField('product')
        return
      }

      if (event.key === 'F6') {
        event.preventDefault()

        // Payment screen will be connected here.
        console.log('F6 Payment')
        return
      }

      if (event.key === 'F8') {
        event.preventDefault()

        // Complete & Print will be connected here.
        console.log('F8 Complete & Print')
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()

        if (barcodeNotFound) {
          setBarcodeNotFound(false)
          setBarcodeInput('')
          setActiveField('product')
          return
        }

        onBack()
        return
      }

      /*
       * Existing product row:
       *
       * Product row selected
       *       ↓ Enter
       * QTY
       */
      if (
        event.key === 'Enter' &&
        (lines[selectedIndex]?.productId !== null || lines[selectedIndex]?.isTemporary) &&
        activeField === 'product'
      ) {
        event.preventDefault()

        setActiveField('quantity')
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeField, barcodeNotFound, lines, onBack, selectedIndex, showItemSelector])

  /*
   * ---------------------------------------------------------
   * Barcode input
   * ---------------------------------------------------------
   */

  function handleBarcodeChange(value: string): void {
    setBarcodeInput(value)
    setBarcodeNotFound(false)
  }

  async function lookupBarcode(): Promise<void> {
    const barcode = barcodeInput.trim()

    if (!barcode) {
      return
    }

    try {
      const product = await window.kirana.products.getByBarcode(barcode)

      /*
       * Unknown barcode:
       *
       * Do NOT open Item Master.
       * Do NOT create a permanent product.
       *
       * Create a temporary General Item in this bill.
       */
      if (!product) {
        addTemporaryGeneralItem(barcode)
        return
      }

      addProductToBottomRow(product)
    } catch (error) {
      console.error('Barcode lookup failed:', error)
    }
  }

  /*
   * ---------------------------------------------------------
   * Add normal product
   * ---------------------------------------------------------
   */

  function addProductToBottomRow(product: ProductRecord): void {
    const newProductLine: BillingLine = {
      productId: product.id,
      productName: product.name,
      isTemporary: false,
      barcode: product.barcode,
      quantityPrecision: product.quantity_precision,
      mrpPaise: product.mrp_paise,
      quantity: 1,
      freeQuantity: 0,
      ratePaise: product.selling_price_paise,
      amountPaise: product.selling_price_paise
    }

    setLines((current) => {
      const bottomIndex = current.length - 1

      return [...current.slice(0, bottomIndex), newProductLine, createEmptyLine()]
    })

    // IMPORTANT: clear the previous barcode.
    setBarcodeInput('')
    setBarcodeNotFound(false)

    // Go directly to the new blank row.
    setSelectedIndex((current) => current + 1)
    setActiveField('product')
  }

  /*
   * ---------------------------------------------------------
   * Temporary General Item
   * ---------------------------------------------------------
   */

  function addTemporaryGeneralItem(barcode: string): void {
    const bottomIndex = lines.length - 1

    setLines((currentLines) =>
      currentLines.map((line, index) =>
        index === bottomIndex
          ? {
              ...line,
              productId: null,
              productName: 'General Item',
              isTemporary: true,
              barcode,
              quantityPrecision: 0,
              mrpPaise: 0,
              quantity: 1,
              freeQuantity: 0,
              ratePaise: 0,
              amountPaise: 0
            }
          : line
      )
    )

    setBarcodeInput('')
    setBarcodeNotFound(false)
    setSelectedIndex(bottomIndex)
    setActiveField('quantity')
  }

  /*
   * ---------------------------------------------------------
   * Item Master selection
   * ---------------------------------------------------------
   */

  function openItemSelector(): void {
    const bottomIndex = lines.length - 1

    setSelectedIndex(bottomIndex)
    setActiveField('product')
    setBarcodeInput('')
    setBarcodeNotFound(false)
    setShowItemSelector(true)
  }

  function handleProductSelected(product: ProductRecord): void {
    setShowItemSelector(false)

    const bottomIndex = lines.length - 1

    const newProductLine: BillingLine = {
      ...lines[bottomIndex],
      productId: product.id,
      productName: product.name,
      isTemporary: false,
      barcode: product.barcode ?? null,
      quantityPrecision: product.quantity_precision,
      mrpPaise: product.mrp_paise,
      quantity: 1,
      freeQuantity: 0,
      ratePaise: product.selling_price_paise,
      amountPaise: product.selling_price_paise
    }

    setLines((currentLines) => [
      ...currentLines.slice(0, bottomIndex),
      newProductLine,
      createEmptyLine()
    ])

    // Product added with default QTY = 1.
    // Move directly to the next blank row.
    setSelectedIndex(bottomIndex + 1)
    setActiveField('product')
    setBarcodeInput('')
    setBarcodeNotFound(false)
  }

  /*
   * ---------------------------------------------------------
   * Quantity
   * ---------------------------------------------------------
   */

  function handleQuantityChange(value: string): void {
    const quantity = value === '' ? 0 : Number(value)

    if (!Number.isFinite(quantity) || quantity < 0) {
      return
    }

    const line = lines[selectedIndex]

    if (!line) {
      return
    }

    setLines((currentLines) =>
      currentLines.map((currentLine, index) =>
        index === selectedIndex
          ? {
              ...currentLine,
              quantity,
              amountPaise: calculateAmount(quantity, currentLine.ratePaise)
            }
          : currentLine
      )
    )
  }

  function handleQuantityEnter(): void {
    setActiveField('free')
  }

  /*
   * ---------------------------------------------------------
   * Free quantity
   * ---------------------------------------------------------
   */

  function handleFreeChange(value: string): void {
    const freeQuantity = value === '' ? 0 : Number(value)

    if (!Number.isFinite(freeQuantity) || freeQuantity < 0) {
      return
    }

    setLines((currentLines) =>
      currentLines.map((currentLine, index) =>
        index === selectedIndex
          ? {
              ...currentLine,
              freeQuantity
            }
          : currentLine
      )
    )
  }

  function handleFreeEnter(): void {
    const line = lines[selectedIndex]

    if (line) {
      setRateInput(line.ratePaise === 0 ? '' : (line.ratePaise / 100).toString())
    }

    setActiveField('rate')
  }

  /*
   * ---------------------------------------------------------
   * Rate
   * ---------------------------------------------------------
   */

  function handleRateChange(value: string): void {
    // Allow empty value and up to 2 decimal places.
    if (!/^\d*(\.\d{0,2})?$/.test(value)) {
      return
    }

    setRateInput(value)
  }

  function commitRate(): void {
    const rate = rateInput === '' ? 0 : Number(rateInput)

    if (!Number.isFinite(rate) || rate < 0) {
      return
    }

    const ratePaise = Math.round(rate * 100)

    setLines((currentLines) =>
      currentLines.map((currentLine, index) =>
        index === selectedIndex
          ? {
              ...currentLine,
              ratePaise,
              amountPaise: calculateAmount(currentLine.quantity, ratePaise)
            }
          : currentLine
      )
    )

    handleRateEnter()
  }

  function handleRateEnter(): void {
    setSelectedIndex((current) => {
      const nextIndex = current + 1

      // Never go beyond the final blank row.
      return Math.min(nextIndex, lines.length - 1)
    })

    setActiveField('product')
  }

  function focusAndSelectInput(ref: React.RefObject<HTMLInputElement | null>): void {
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.select()
    })
  }

  useEffect(() => {
    if (showItemSelector) {
      return
    }

    const frame = requestAnimationFrame(() => {
      if (activeField === 'product') {
        barcodeInputRef.current?.focus()
        return
      }

      if (activeField === 'quantity') {
        quantityInputRef.current?.focus()
        quantityInputRef.current?.select()
        return
      }

      if (activeField === 'free') {
        freeInputRef.current?.focus()
        freeInputRef.current?.select()
        return
      }

      if (activeField === 'rate') {
        rateInputRef.current?.focus()
        rateInputRef.current?.select()
        return
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [selectedIndex, activeField, showItemSelector])

  /*
   * ---------------------------------------------------------
   * Render Item Master selection mode
   * ---------------------------------------------------------
   */

  if (showItemSelector) {
    return (
      <ItemMaster
        mode="select"
        onBack={() => {
          setShowItemSelector(false)
          setSelectedIndex(lines.length - 1)
          setActiveField('product')
        }}
        onAddItem={() => {
          /*
           * Permanent Add Item remains owned by the existing
           * Item Master/App flow.
           */
          onAddItem?.()
        }}
        onEditItem={(productId) => {
          /*
           * Permanent Edit Item remains owned by the
           * existing Item Master/App flow.
           */
          onEditItem?.(productId)
        }}
        onSelectItem={handleProductSelected}
      />
    )
  }

  /*
   * ---------------------------------------------------------
   * Billing UI
   * ---------------------------------------------------------
   */

  return (
    <div className="billing-screen">
      <div className="billing-title-bar">
        <div>SALE ENTRY</div>
      </div>

      <div className="billing-header">
        <div className="billing-header-column">
          <div className="billing-field">
            <label>Bill No. :</label>
            <strong>A000001</strong>
          </div>

          <div className="billing-field">
            <label>Mobile :</label>

            <input
              value={customerMobile}
              onChange={(event) => setCustomerMobile(event.target.value)}
            />
          </div>
        </div>

        <div className="billing-header-column">
          <div className="billing-field">
            <label>Date :</label>
            <strong>{new Date().toLocaleDateString('en-IN')}</strong>
          </div>

          <div className="billing-field">
            <label>Name :</label>

            <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </div>
        </div>
      </div>

      <div className="billing-grid-wrapper">
        <table className="billing-table">
          <thead>
            <tr>
              <th className="product-column">PRODUCT</th>
              <th>MRP</th>
              <th>QTY</th>
              <th>FREE</th>
              <th>RATE</th>
              <th>AMOUNT</th>
            </tr>
          </thead>

          <tbody>
            {lines.map((line, index) => {
              const selected = index === selectedIndex
              const isBottomBlank =
                index === lines.length - 1 && line.productId === null && !line.isTemporary

              return (
                <tr
                  key={line.id}
                  className={selected ? 'billing-row-selected' : ''}
                  onClick={() => {
                    setSelectedIndex(index)

                    if (line.productId === null && !line.isTemporary) {
                      setActiveField('product')
                      return
                    }

                    setActiveField('product')
                  }}
                >
                  <td className="product-column">
                    {isBottomBlank && selected ? (
                      <div className="product-entry">
                        <input
                          ref={barcodeInputRef}
                          value={barcodeInput}
                          onChange={(event) => handleBarcodeChange(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter') {
                              return
                            }

                            event.preventDefault()
                            event.stopPropagation()

                            /*
                             * Blank row:
                             *
                             * Enter with text = barcode lookup.
                             * Enter without text = Item Master.
                             */
                            if (barcodeInput.trim()) {
                              void lookupBarcode()
                            } else {
                              openItemSelector()
                            }
                          }}
                          placeholder="Scan / search product"
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>
                    ) : (
                      <span className={line.isTemporary ? 'temporary-general-item' : ''}>
                        {line.productName}
                      </span>
                    )}
                  </td>

                  <td className="number-cell">
                    {line.mrpPaise > 0 ? formatRupees(line.mrpPaise) : ''}
                  </td>

                  <td className="number-cell">
                    {line.productId !== null || line.isTemporary ? (
                      selected && activeField === 'quantity' ? (
                        <input
                          ref={quantityInputRef}
                          className="billing-number-input"
                          type="number"
                          min="0"
                          step={line.quantityPrecision === 0 ? '1' : '0.001'}
                          value={line.quantity === 0 ? '' : line.quantity}
                          onChange={(event) => handleQuantityChange(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              event.stopPropagation()
                              handleQuantityEnter()
                            }
                          }}
                        />
                      ) : (
                        line.quantity
                      )
                    ) : (
                      ''
                    )}
                  </td>

                  <td className="number-cell">
                    {line.productId !== null || line.isTemporary ? (
                      selected && activeField === 'free' ? (
                        <input
                          ref={freeInputRef}
                          className="billing-number-input"
                          type="number"
                          min="0"
                          step={line.quantityPrecision === 0 ? '1' : '0.001'}
                          value={line.freeQuantity === 0 ? '' : line.freeQuantity}
                          onChange={(event) => handleFreeChange(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              event.stopPropagation()
                              handleFreeEnter()
                            }
                          }}
                        />
                      ) : (
                        line.freeQuantity
                      )
                    ) : (
                      ''
                    )}
                  </td>

                  <td className="number-cell">
                    {line.productId !== null || line.isTemporary ? (
                      selected && activeField === 'rate' ? (
                        <input
                          ref={rateInputRef}
                          className="billing-number-input"
                          type="text"
                          inputMode="decimal"
                          value={rateInput}
                          onFocus={() => {
                            setRateInput(
                              line.ratePaise === 0 ? '' : (line.ratePaise / 100).toString()
                            )
                          }}
                          onChange={(event) => {
                            handleRateChange(event.target.value)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              event.stopPropagation()
                              commitRate()
                            }
                          }}
                        />
                      ) : line.ratePaise > 0 ? (
                        formatRupees(line.ratePaise)
                      ) : (
                        ''
                      )
                    ) : (
                      ''
                    )}
                  </td>

                  <td className="number-cell amount-cell">
                    {line.amountPaise > 0 ? formatRupees(line.amountPaise) : ''}
                  </td>
                </tr>
              )
            })}

            {Array.from({
              length: Math.max(8, 12 - lines.length)
            }).map((_, index) => (
              <tr key={`empty-${index}`} className="empty-row">
                <td colSpan={6} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="billing-summary">
        <div>
          <span>Subtotal</span>
          <strong>₹{formatRupees(subtotalPaise)}</strong>
        </div>

        <div>
          <span>Discount</span>
          <strong>₹0.00</strong>
        </div>

        <div className="billing-total">
          <span>TOTAL</span>
          <strong>₹{formatRupees(subtotalPaise)}</strong>
        </div>
      </div>

      {barcodeNotFound && (
        <div className="billing-not-found">
          Product not found — General Item created for this bill
        </div>
      )}

      <div className="billing-footer">
        <span>F2 Add Item</span>
        <span>Enter Add</span>
        <span>Delete Remove</span>
        <span>F6 Payment</span>
        <span>F8 Complete &amp; Print</span>
        <span>Esc Back</span>
        <span>Ctrl+N New Bill</span>
        <span>Ctrl+P Reprint</span>
      </div>
    </div>
  )
}

export default Billing
