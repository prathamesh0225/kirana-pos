import { useEffect, useMemo, useRef, useState } from 'react'
import './billing.css'
import ItemMaster from '../products/ItemMaster'
import ConfirmDialog from '../../components/confirm-dialog/ConfirmDialog'
import type { BillingLine, BillingSession } from './billing.types'
import Payment, { type PaymentResult } from './Payment'

type BillingProps = {
  session: BillingSession
  onSessionChange: React.Dispatch<React.SetStateAction<BillingSession>>
  onBack: () => void
  onAddItem?: () => void
  onEditItem?: (productId: number) => void
  onNewBill: () => void
  onPayment: () => void
  onBillCompleted: (billNumber: string) => void
}

type BillingField = 'product' | 'quantity' | 'free' | 'rate'

function formatRupees(paise: number): string {
  return (paise / 100).toFixed(2)
}

function createEmptyLine(): BillingLine {
  return {
    id: Date.now() + Math.random(),
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

function Billing({
  session,
  onSessionChange,
  onBack,
  onAddItem,
  onEditItem,
  onNewBill,
  onBillCompleted
}: BillingProps): React.JSX.Element {
  const { lines } = session

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeField, setActiveField] = useState<BillingField>('product')

  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeNotFound, setBarcodeNotFound] = useState(false)

  const [rateInput, setRateInput] = useState('')

  const [showItemSelector, setShowItemSelector] = useState(false)
  const [showPayment, setShowPayment] = useState(false)

  const [pendingPayment, setPendingPayment] = useState<PaymentResult | null>(null)
  const [showCompleteConfirmation, setShowCompleteConfirmation] = useState(false)
  const [showPrintConfirmation, setShowPrintConfirmation] = useState(false)

  const [quantityShortcutError, setQuantityShortcutError] = useState('')

  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const quantityInputRef = useRef<HTMLInputElement>(null)
  const freeInputRef = useRef<HTMLInputElement>(null)
  const rateInputRef = useRef<HTMLInputElement>(null)

  const customerName = session.customerName
  const customerMobile = session.customerMobile

  const subtotalPaise = useMemo(
    () => lines.reduce((total, line) => total + line.amountPaise, 0),
    [lines]
  )

  /*
   * ---------------------------------------------------------
   * Restore Billing UI after returning from Item Master/Form
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const bottomIndex = Math.max(lines.length - 1, 0)

    setSelectedIndex(bottomIndex)
    setActiveField('product')
    setBarcodeInput('')
    setRateInput('')
    setBarcodeNotFound(false)
    setQuantityShortcutError('')
  }, [session.id])

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
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [selectedIndex, activeField, showItemSelector])

  /*
   * ---------------------------------------------------------
   * Billing keyboard shortcuts
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (showItemSelector) {
      return
    }

    function validateBillBeforePayment(): string | null {
      const billLines = lines.filter((line) => line.productId !== null || line.isTemporary)

      if (billLines.length === 0) {
        return 'Cannot proceed to payment. Bill has no items.'
      }

      for (const line of billLines) {
        if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
          return `Quantity must be greater than zero for ${line.productName}.`
        }

        if (!Number.isFinite(line.ratePaise) || line.ratePaise < 0) {
          return `Invalid rate for ${line.productName}.`
        }

        if (line.isTemporary && line.ratePaise <= 0) {
          return `Enter a rate for ${line.productName} before payment.`
        }
      }

      return null
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'ArrowDown') {
        event.preventDefault()

        setSelectedIndex((current) => Math.min(current + 1, lines.length - 1))

        setActiveField('product')
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()

        setSelectedIndex((current) => Math.max(current - 1, 0))

        setActiveField('product')
        return
      }

      if (event.key === 'F2') {
        event.preventDefault()

        const lastIndex = lines.length - 1

        setSelectedIndex(lastIndex)
        setActiveField('product')
        setBarcodeInput('')
        setBarcodeNotFound(false)
        return
      }

      if (event.key === 'Delete') {
        event.preventDefault()

        const selectedLine = lines[selectedIndex]

        /*
         * Blank row cannot be deleted.
         *
         * Normal product OR temporary General Item can be deleted.
         */
        if (!selectedLine || (selectedLine.productId === null && !selectedLine.isTemporary)) {
          return
        }

        onSessionChange((currentSession) => {
          const remainingLines = currentSession.lines.filter((_, index) => index !== selectedIndex)

          return {
            ...currentSession,
            lines: remainingLines.length > 0 ? remainingLines : [createEmptyLine()]
          }
        })

        setSelectedIndex((currentIndex) => {
          const newLength = Math.max(lines.length - 1, 1)
          return Math.min(currentIndex, newLength - 1)
        })

        setActiveField('product')
        setBarcodeInput('')
        setRateInput('')
        return
      }

      if (event.key === 'F6') {
        event.preventDefault()
        event.stopPropagation()

        const validationError = validateBillBeforePayment()

        if (validationError) {
          setQuantityShortcutError(validationError)
          return
        }

        setActiveField('product')

        setQuantityShortcutError('')
        setShowPayment(true)
        return
      }

      if (event.key === 'F8') {
        event.preventDefault()

        // Complete & Print will be connected here.
        console.log('F8 Complete & Print')
        return
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        onNewBill()
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
       * Existing product OR General Item:
       *
       * Product row
       *      ↓ Enter
       * QTY
       */
      const selectedLine = lines[selectedIndex]

      if (
        event.key === 'Enter' &&
        activeField === 'product' &&
        selectedLine &&
        (selectedLine.productId !== null || selectedLine.isTemporary)
      ) {
        event.preventDefault()
        setActiveField('quantity')
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    activeField,
    barcodeNotFound,
    lines,
    onBack,
    onSessionChange,
    selectedIndex,
    showItemSelector
  ])

  /*
   * ---------------------------------------------------------
   * Customer fields
   * ---------------------------------------------------------
   */

  function handleCustomerMobileChange(value: string): void {
    onSessionChange((currentSession) => ({
      ...currentSession,
      customerMobile: value
    }))
  }

  function handleCustomerNameChange(value: string): void {
    onSessionChange((currentSession) => ({
      ...currentSession,
      customerName: value
    }))
  }

  /*
   * ---------------------------------------------------------
   * Barcode
   * ---------------------------------------------------------
   */

  function handleBarcodeChange(value: string): void {
    setBarcodeInput(value)
    setBarcodeNotFound(false)
    setQuantityShortcutError('')
  }

  async function lookupBarcode(): Promise<void> {
    const barcode = barcodeInput.trim()

    if (!barcode) {
      return
    }

    try {
      const product = await window.kirana.products.getByBarcode(barcode)

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
      id: Date.now() + Math.random(),
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

    const bottomIndex = lines.length - 1

    onSessionChange((currentSession) => {
      const currentBottomIndex = currentSession.lines.length - 1

      return {
        ...currentSession,
        lines: [
          ...currentSession.lines.slice(0, currentBottomIndex),
          newProductLine,
          createEmptyLine()
        ]
      }
    })

    /*
     * IMPORTANT:
     * Clear previous barcode so the new blank row is actually blank.
     */
    setBarcodeInput('')
    setBarcodeNotFound(false)

    /*
     * Product was added with QTY = 1.
     * Go directly to the next blank row.
     */
    setSelectedIndex(bottomIndex + 1)
    setActiveField('product')
    setRateInput('')
  }

  /*
   * ---------------------------------------------------------
   * Temporary General Item
   * ---------------------------------------------------------
   */

  function addTemporaryGeneralItem(barcode: string): void {
    const bottomIndex = lines.length - 1

    const generalItemLine: BillingLine = {
      ...lines[bottomIndex],
      id: Date.now() + Math.random(),
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

    onSessionChange((currentSession) => {
      const currentBottomIndex = currentSession.lines.length - 1

      return {
        ...currentSession,
        lines: [
          ...currentSession.lines.slice(0, currentBottomIndex),
          generalItemLine,
          createEmptyLine()
        ]
      }
    })

    setBarcodeInput('')
    setBarcodeNotFound(false)

    /*
     * General Item needs editing, so select the General Item
     * rather than the new blank row.
     */
    setSelectedIndex(bottomIndex)
    setActiveField('quantity')
    setRateInput('')
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
    setRateInput('')
    setShowItemSelector(true)
  }

  function handleProductSelected(product: ProductRecord): void {
    const bottomIndex = lines.length - 1

    const newProductLine: BillingLine = {
      id: Date.now() + Math.random(),
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

    onSessionChange((currentSession) => ({
      ...currentSession,
      lines: [
        ...currentSession.lines.slice(0, currentSession.lines.length - 1),
        newProductLine,
        createEmptyLine()
      ]
    }))

    setShowItemSelector(false)

    setBarcodeInput('')
    setBarcodeNotFound(false)
    setRateInput('')

    /*
     * Same behavior as barcode:
     * QTY defaults to 1 and cursor goes to next blank row.
     */
    setSelectedIndex(bottomIndex + 1)
    setActiveField('product')
  }

  /*
   * ---------------------------------------------------------
   * Quantity
   * ---------------------------------------------------------
   */

  function handleQuickQuantity(value: string): boolean {
    const input = value.trim()
    const match = input.match(/^\+(\d+(?:\.\d+)?)$/)

    // Starts with +, so it belongs to quick-quantity handling.
    if (input.startsWith('+') && !match) {
      setQuantityShortcutError('Invalid quantity shortcut. Example: +5')
      setBarcodeInput('')
      return true
    }

    if (!match) {
      return false
    }

    const quantity = Number(match[1])

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setQuantityShortcutError('Quantity must be greater than zero')
      setBarcodeInput('')
      return true
    }

    const previousIndex = selectedIndex - 1

    if (previousIndex < 0) {
      setQuantityShortcutError('No previous item to change quantity')
      setBarcodeInput('')
      return true
    }

    const previousLine = lines[previousIndex]

    if (!previousLine || (previousLine.productId === null && !previousLine.isTemporary)) {
      setQuantityShortcutError('No previous item to change quantity')
      setBarcodeInput('')
      return true
    }

    const precision = previousLine.quantityPrecision

    if (precision === 0 && !Number.isInteger(quantity)) {
      setQuantityShortcutError(
        `${previousLine.productName} uses PCS and does not support decimal quantity`
      )
      setBarcodeInput('')
      return true
    }

    const factor = 10 ** precision
    const roundedQuantity = Math.round(quantity * factor) / factor

    if (roundedQuantity !== quantity) {
      setQuantityShortcutError(
        `Quantity supports up to ${precision} decimal place${precision === 1 ? '' : 's'}`
      )
      setBarcodeInput('')
      return true
    }

    onSessionChange((currentSession) => ({
      ...currentSession,
      lines: currentSession.lines.map((line, index) =>
        index === previousIndex
          ? {
              ...line,
              quantity,
              amountPaise: calculateAmount(quantity, line.ratePaise)
            }
          : line
      )
    }))

    setQuantityShortcutError('')
    setBarcodeInput('')
    setSelectedIndex(lines.length - 1)
    setActiveField('product')

    return true
  }

  function handleQuantityChange(value: string): void {
    const quantity = value === '' ? 0 : Number(value)

    if (!Number.isFinite(quantity) || quantity < 0) {
      return
    }

    onSessionChange((currentSession) => ({
      ...currentSession,
      lines: currentSession.lines.map((currentLine, index) =>
        index === selectedIndex
          ? {
              ...currentLine,
              quantity,
              amountPaise: calculateAmount(quantity, currentLine.ratePaise)
            }
          : currentLine
      )
    }))
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

    onSessionChange((currentSession) => ({
      ...currentSession,
      lines: currentSession.lines.map((currentLine, index) =>
        index === selectedIndex
          ? {
              ...currentLine,
              freeQuantity
            }
          : currentLine
      )
    }))
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
    /*
     * Keep rate as text while typing.
     *
     * This allows:
     * 1
     * 12
     * 120
     * 120.5
     * 120.50
     *
     * without React changing the value underneath the cursor.
     */
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

    onSessionChange((currentSession) => ({
      ...currentSession,
      lines: currentSession.lines.map((currentLine, index) =>
        index === selectedIndex
          ? {
              ...currentLine,
              ratePaise,
              amountPaise: calculateAmount(currentLine.quantity, ratePaise)
            }
          : currentLine
      )
    }))

    handleRateEnter()
  }

  function handleRateEnter(): void {
    const currentIndex = selectedIndex

    /*
     * Move exactly one row down.
     *
     * If the next row is another product, select it.
     * If the current row is the last product, select blank row.
     */
    setSelectedIndex((current) => Math.min(current + 1, lines.length - 1))

    setActiveField('product')
    setBarcodeInput('')
    setRateInput('')
  }

  function startNextBill(): void {
    setPendingPayment(null)
    setShowPayment(false)
    setShowCompleteConfirmation(false)
    setShowPrintConfirmation(false)

    onNewBill()
  }

  /*
   * ---------------------------------------------------------
   * Item Master selection mode
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
          setBarcodeInput('')
          setRateInput('')
        }}
        onAddItem={() => {
          /*
           * App owns ProductForm navigation.
           *
           * Billing session remains safely stored in App.
           */
          onAddItem?.()
        }}
        onEditItem={(productId) => {
          /*
           * App owns ProductForm navigation.
           *
           * Billing session remains safely stored in App.
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
    <>
      <div className="billing-screen">
        <div className="billing-title-bar">
          <div>SALE ENTRY</div>
        </div>

        <div className="billing-header">
          <div className="billing-header-column">
            <div className="billing-field">
              <label>Bill No. :</label>
              <strong>{session.billNumber}</strong>
            </div>

            <div className="billing-field">
              <label>Mobile :</label>

              <input
                value={customerMobile}
                onChange={(event) => handleCustomerMobileChange(event.target.value)}
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

              <input
                value={customerName}
                onChange={(event) => handleCustomerNameChange(event.target.value)}
              />
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
                      setActiveField('product')

                      if (line.productId === null && !line.isTemporary) {
                        setBarcodeInput('')
                      }
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

                              if (barcodeInput.trim()) {
                                if (handleQuickQuantity(barcodeInput)) {
                                  return
                                }

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
                              /*
                               * Load current rate into the editing
                               * value and select it.
                               */
                              setRateInput(
                                line.ratePaise === 0 ? '' : (line.ratePaise / 100).toString()
                              )
                            }}
                            onChange={(event) => handleRateChange(event.target.value)}
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
          {quantityShortcutError && <div className="billing-error">{quantityShortcutError}</div>}

          {barcodeNotFound && (
            <div className="billing-not-found">
              Product not found — General Item created for this bill
            </div>
          )}
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
      {showPayment && (
        <Payment
          session={session}
          totalPaise={subtotalPaise}
          onBack={() => {
            setShowPayment(false)
          }}
          onComplete={(payment: PaymentResult) => {
            setPendingPayment(payment)
            setShowCompleteConfirmation(true)
            setShowPayment(false)
          }}
        />
      )}

      {showCompleteConfirmation && pendingPayment && (
        <ConfirmDialog
          title="Complete Bill"
          message={`Complete bill ${session.billNumber}?`}
          onConfirm={async () => {
            if (!pendingPayment) {
              return
            }

            try {
              const result = await window.kirana.billing.completeSale({
                billNumber: session.billNumber,
                customerName: session.customerName,
                customerMobile: session.customerMobile,

                lines: lines.filter((line) => line.productId !== null || line.isTemporary),

                payment: pendingPayment
              })

              console.log('Sale completed:', result)

              setShowCompleteConfirmation(false)
              setPendingPayment(null)
              setShowPayment(false)

              await onBillCompleted(result.billNumber)
            } catch (error) {
              console.error('Failed to complete sale:', error)

              const message = error instanceof Error ? error.message : 'Failed to complete bill.'

              setShowCompleteConfirmation(false)
              setPendingPayment(null)

              alert(message)
            }
          }}
          onCancel={() => {
            setShowCompleteConfirmation(false)
            setPendingPayment(null)
          }}
        />
      )}

      {showPrintConfirmation && (
        <ConfirmDialog
          title="Print Bill"
          message={`Print bill ${session.billNumber}?`}
          onConfirm={() => {
            setShowPrintConfirmation(false)

            // Printer integration will go here.
            console.log('Print bill:', session.billNumber)

            startNextBill()
          }}
          onCancel={() => {
            setShowPrintConfirmation(false)

            // No printer required.
            startNextBill()
          }}
        />
      )}
    </>
  )
}

export default Billing
