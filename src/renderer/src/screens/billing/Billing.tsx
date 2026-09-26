import { useEffect, useMemo, useRef, useState } from 'react'
import './billing.css'
import ItemMaster from '../products/ItemMaster'
import ConfirmDialog from '../../components/confirm-dialog/ConfirmDialog'
import type { BillingLine, BillingSession, BillingMode } from './billing.types'
import Payment, { type PaymentResult } from './Payment'
import ErrorDialog from '../../components/error-dialog/ErrorDialog'

type BillingProps = {
  session: BillingSession
  onSessionChange: React.Dispatch<React.SetStateAction<BillingSession>>
  onBack: () => void
  onAddItem?: () => void
  onEditItem?: (productId: number) => void
  onNewBill: () => void
  onPayment: () => void
  onBillCompleted: (billNumber: string) => void
  onOpenBillHistory: () => void

  mode?: BillingMode
  saleId?: number
  onModifyMode?: () => void
  onHistoricalSaved?: () => void
}

type BillingField = 'product' | 'quantity' | 'free' | 'rate'
type HistoricalAction = 'modify' | 'print' | 'delete'

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

function createBillingSessionFromSale(sale: {
  id: number
  billNumber: string
  saleDate: string
  subtotalPaise: number
  discountPaise: number
  totalPaise: number
  status: string
  items: Array<{
    id: number
    productId: number | null
    productName: string
    barcode: string | null
    mrpPaise: number
    quantity: number
    freeQuantity: number
    ratePaise: number
    amountPaise: number
    quantityPrecision?: number
  }>
}): BillingSession {
  return {
    id: `history-${sale.id}`,
    billNumber: sale.billNumber,
    lines: [
      ...sale.items.map((item) => ({
        id: item.id,
        saleItemId: item.id,

        productId: item.productId,
        productName: item.productName,
        isTemporary: item.productId === null,
        barcode: item.barcode,
        quantityPrecision: item.quantityPrecision ?? 3,
        mrpPaise: item.mrpPaise,
        quantity: item.quantity,
        freeQuantity: item.freeQuantity,
        ratePaise: item.ratePaise,
        amountPaise: item.amountPaise
      })),
      createEmptyLine()
    ],
    customerName: '',
    customerMobile: ''
  }
}

function Billing({
  session,
  onSessionChange,
  onBack,
  onAddItem,
  onEditItem,
  onNewBill,
  onBillCompleted,
  onOpenBillHistory,
  mode = 'active',
  saleId,
  onModifyMode,
  onHistoricalSaved
}: BillingProps): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeField, setActiveField] = useState<BillingField>('product')

  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeNotFound, setBarcodeNotFound] = useState(false)

  const [rateInput, setRateInput] = useState('')

  const [showItemSelector, setShowItemSelector] = useState(false)
  const [showPayment, setShowPayment] = useState(false)

  const [pendingPayment, setPendingPayment] = useState<PaymentResult | null>(null)
  const [showCompleteConfirmation, setShowCompleteConfirmation] = useState(false)
  const [isCompletingSale, setIsCompletingSale] = useState(false)
  const [showPrintConfirmation, setShowPrintConfirmation] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDialogMessage, setErrorDialogMessage] = useState('')

  const [quantityShortcutError, setQuantityShortcutError] = useState('')

  const [historicalSession, setHistoricalSession] = useState<BillingSession | null>(null)

  const [historicalLoading, setHistoricalLoading] = useState(false)

  const [historicalError, setHistoricalError] = useState('')
  const [historicalActionIndex, setHistoricalActionIndex] = useState(-1)

  const [historicalOriginalTotalPaise, setHistoricalOriginalTotalPaise] = useState(0)

  const [showHistoricalPayment, setShowHistoricalPayment] = useState(false)

  const [pendingHistoricalPayment, setPendingHistoricalPayment] = useState<PaymentResult | null>(
    null
  )

  const [showHistoricalRefundConfirmation, setShowHistoricalRefundConfirmation] = useState(false)

  const [isSavingHistoricalBill, setIsSavingHistoricalBill] = useState(false)

  const isHistoricalBill = mode === 'view' || mode === 'modify'
  const isReadOnly = mode === 'view'

  const displaySession = isHistoricalBill && historicalSession ? historicalSession : session

  const { lines } = displaySession

  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const quantityInputRef = useRef<HTMLInputElement>(null)
  const freeInputRef = useRef<HTMLInputElement>(null)
  const rateInputRef = useRef<HTMLInputElement>(null)

  const customerName = displaySession.customerName
  const customerMobile = displaySession.customerMobile

  function updateCurrentSession(updater: (currentSession: BillingSession) => BillingSession): void {
    if (isHistoricalBill) {
      setHistoricalSession((currentSession) =>
        currentSession ? updater(currentSession) : currentSession
      )
      return
    }

    onSessionChange(updater)
  }

  function getHistoricalAction(): HistoricalAction | null {
    if (historicalActionIndex < 0 || historicalActionIndex > 2) {
      return null
    }

    return ['modify', 'print', 'delete'][historicalActionIndex] as HistoricalAction
  }

  function handleHistoricalAction(action: HistoricalAction): void {
    if (action === 'modify') {
      onModifyMode?.()
      return
    }

    if (action === 'print') {
      window.print()
      return
    }

    setShowErrorDialog(true)
    setErrorDialogMessage(
      'Delete/void for historical bills is not enabled yet. The bill has not been changed.'
    )
  }

  const subtotalPaise = useMemo(
    () => lines.reduce((total, line) => total + line.amountPaise, 0),
    [lines]
  )
  // Bill History View, Modify Bill
  useEffect(() => {
    if (!isHistoricalBill || !saleId) {
      setHistoricalSession(null)
      return
    }

    let cancelled = false

    async function loadHistoricalBill(): Promise<void> {
      try {
        setHistoricalLoading(true)
        setHistoricalError('')

        const sale = await window.kirana.billing.getSaleById(saleId)

        if (cancelled) {
          return
        }

        if (!sale) {
          setHistoricalError('Bill not found.')
          return
        }

        setHistoricalOriginalTotalPaise(sale.totalPaise)
        setHistoricalSession(createBillingSessionFromSale(sale))
      } catch (error) {
        if (cancelled) {
          return
        }

        setHistoricalError(error instanceof Error ? error.message : 'Unable to load bill.')
      } finally {
        if (!cancelled) {
          setHistoricalLoading(false)
        }
      }
    }

    void loadHistoricalBill()

    return () => {
      cancelled = true
    }
  }, [isHistoricalBill, saleId])

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
  }, [displaySession.id])

  useEffect(() => {
    setHistoricalActionIndex(-1)
  }, [mode, saleId])

  /*
   * ---------------------------------------------------------
   * Focus management
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (showItemSelector || isReadOnly) {
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
  }, [selectedIndex, activeField, showItemSelector, isReadOnly])

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
      if (isReadOnly) {
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

        if (event.key === 'ArrowRight') {
          event.preventDefault()
          setHistoricalActionIndex((current) => Math.min(current + 1, 2))
          return
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          setHistoricalActionIndex((current) => Math.max(current - 1, 0))
          return
        }

        if (event.key === 'F3' && isReadOnly) {
          event.preventDefault()
          onModifyMode?.()
          return
        }

        if (event.key === 'Enter' && isReadOnly) {
          event.preventDefault()

          const action = getHistoricalAction()

          if (action) {
            handleHistoricalAction(action)
          }

          return
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          onBack()
          return
        }

        if (isReadOnly) {
          return
        }
      }

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

        if (isReadOnly) {
          return
        }

        const lastIndex = lines.length - 1

        setSelectedIndex(lastIndex)
        setActiveField('product')
        setBarcodeInput('')
        setBarcodeNotFound(false)
        return
      }

      if (event.key === 'Delete') {
        event.preventDefault()

        if (isReadOnly) {
          return
        }

        const selectedLine = lines[selectedIndex]

        if (!selectedLine || (selectedLine.productId === null && !selectedLine.isTemporary)) {
          return
        }

        updateCurrentSession((currentSession) => {
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

        // VIEW BILL: F6 does nothing
        if (isReadOnly) {
          return
        }

        // MODIFY BILL: F6 saves the modification
        if (mode === 'modify') {
          void handleSaveHistoricalBill()
          return
        }

        // NORMAL SALE ENTRY: F6 opens Payment
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

      if (event.key === 'F9') {
        event.preventDefault()

        if (isReadOnly) {
          return
        }

        onOpenBillHistory()
        return
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()

        if (isReadOnly) {
          return
        }

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
    isHistoricalBill,
    isReadOnly,
    lines,
    onBack,
    onModifyMode,
    onNewBill,
    onOpenBillHistory,
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
    updateCurrentSession((currentSession) => ({
      ...currentSession,
      customerMobile: value
    }))
  }

  function handleCustomerNameChange(value: string): void {
    updateCurrentSession((currentSession) => ({
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
    if (isReadOnly) {
      return
    }

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
    if (isReadOnly) {
      return
    }

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

    updateCurrentSession((currentSession) => {
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
    if (isReadOnly) {
      return
    }

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

    updateCurrentSession((currentSession) => {
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
    if (isReadOnly) {
      return
    }

    const bottomIndex = lines.length - 1

    setSelectedIndex(bottomIndex)
    setActiveField('product')
    setBarcodeInput('')
    setBarcodeNotFound(false)
    setRateInput('')
    setShowItemSelector(true)
  }

  function handleProductSelected(product: ProductRecord): void {
    if (isReadOnly) {
      return
    }

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

    updateCurrentSession((currentSession) => ({
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

    updateCurrentSession((currentSession) => ({
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

    updateCurrentSession((currentSession) => ({
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

    updateCurrentSession((currentSession) => ({
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

    updateCurrentSession((currentSession) => ({
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

  async function saveHistoricalBill(paymentAdjustment?: {
    type: 'charge' | 'refund'
    method: 'cash' | 'upi'
    amountPaise: number
  }): Promise<void> {
    if (!saleId || !historicalSession) {
      return
    }

    if (isSavingHistoricalBill) {
      return
    }

    const billLines = historicalSession.lines.filter(
      (line) => line.productId !== null || line.isTemporary
    )

    if (billLines.length === 0) {
      setErrorDialogMessage('Cannot save a bill without items.')
      setShowErrorDialog(true)
      return
    }

    for (const line of billLines) {
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        setErrorDialogMessage(`Quantity must be greater than zero for ${line.productName}.`)
        setShowErrorDialog(true)
        return
      }

      if (!Number.isFinite(line.freeQuantity) || line.freeQuantity < 0) {
        setErrorDialogMessage(`Invalid free quantity for ${line.productName}.`)
        setShowErrorDialog(true)
        return
      }

      if (!Number.isFinite(line.ratePaise) || line.ratePaise < 0) {
        setErrorDialogMessage(`Invalid rate for ${line.productName}.`)
        setShowErrorDialog(true)
        return
      }
    }

    try {
      setIsSavingHistoricalBill(true)

      const result = await window.kirana.billing.updateSale({
        saleId,

        customerName: historicalSession.customerName,

        customerMobile: historicalSession.customerMobile,

        lines: billLines.map((line) => ({
          saleItemId: line.saleItemId,

          productId: line.productId,
          productName: line.productName,
          barcode: line.barcode,

          mrpPaise: line.mrpPaise,
          quantity: line.quantity,
          freeQuantity: line.freeQuantity,
          ratePaise: line.ratePaise,

          amountPaise: Math.round(line.quantity * line.ratePaise)
        })),

        paymentAdjustment
      })

      console.log('Historical bill updated:', result)

      onHistoricalSaved?.()
    } catch (error) {
      console.error('Failed to modify bill:', error)

      setErrorDialogMessage(error instanceof Error ? error.message : 'Failed to modify bill.')

      setShowErrorDialog(true)
    } finally {
      setIsSavingHistoricalBill(false)
    }
  }

  function handleSaveHistoricalBill(): void {
    if (!historicalSession) {
      return
    }

    const newTotal = historicalSession.lines.reduce((total, line) => total + line.amountPaise, 0)

    const difference = newTotal - historicalOriginalTotalPaise

    if (difference === 0) {
      void saveHistoricalBill()
      return
    }

    if (difference > 0) {
      setPendingHistoricalPayment(null)
      setShowHistoricalPayment(true)
      return
    }

    setShowHistoricalRefundConfirmation(true)
  }

  function startNextBill(): void {
    setPendingPayment(null)
    setShowPayment(false)
    setShowCompleteConfirmation(false)
    setShowPrintConfirmation(false)

    onNewBill()
  }

  if (isHistoricalBill && historicalLoading) {
    return (
      <div className="billing-screen">
        <div className="billing-title-bar">
          <div>VIEW BILL</div>
        </div>
        <div className="billing-error">Loading bill...</div>
      </div>
    )
  }

  if (isHistoricalBill && historicalError && !historicalSession) {
    return (
      <div className="billing-screen">
        <div className="billing-title-bar">
          <div>VIEW BILL</div>
        </div>
        <div className="billing-error">{historicalError}</div>
        <div className="billing-footer">
          <span>Esc Back</span>
        </div>
      </div>
    )
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
          <div>{isHistoricalBill ? (isReadOnly ? 'VIEW BILL' : 'MODIFY BILL') : 'SALE ENTRY'}</div>
        </div>

        <div className="billing-header">
          <div className="billing-header-column">
            <div className="billing-field">
              <label>Bill No. :</label>
              <strong>{displaySession.billNumber}</strong>
            </div>

            <div className="billing-field">
              <label>Mobile :</label>

              <input
                value={customerMobile}
                onChange={(event) => handleCustomerMobileChange(event.target.value)}
                readOnly={isReadOnly}
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
                readOnly={isReadOnly}
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
                  !isReadOnly &&
                  index === lines.length - 1 &&
                  line.productId === null &&
                  !line.isTemporary

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
                            onFocus={() => setActiveField('product')}
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
                            disabled={isReadOnly}
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
                            disabled={isReadOnly}
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
                            disabled={isReadOnly}
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

        {isReadOnly ? (
          <div className="billing-footer historical-billing-footer">
            <span>↑↓ Select Row</span>

            <button
              type="button"
              className={historicalActionIndex === 0 ? 'billing-action-selected' : ''}
              onClick={() => {
                setHistoricalActionIndex(0)
                handleHistoricalAction('modify')
              }}
            >
              MODIFY
            </button>

            <button
              type="button"
              className={historicalActionIndex === 1 ? 'billing-action-selected' : ''}
              onClick={() => {
                setHistoricalActionIndex(1)
                handleHistoricalAction('print')
              }}
            >
              PRINT
            </button>

            <button
              type="button"
              className={historicalActionIndex === 2 ? 'billing-action-selected' : ''}
              onClick={() => {
                setHistoricalActionIndex(2)
                handleHistoricalAction('delete')
              }}
            >
              DELETE
            </button>

            <span>←→ Actions</span>
            <span>F3 Modify</span>
            <span>Enter Action</span>
            <span>Esc Back</span>
          </div>
        ) : mode === 'modify' ? (
          <div className="billing-footer">
            <span>F2 Add Item</span>
            <span>Enter Add</span>
            <span>Delete Remove</span>
            <span>F6 Save</span>
            <span>Esc Back</span>
          </div>
        ) : (
          <div className="billing-footer">
            <span>F2 Add Item</span>
            <span>Enter Add</span>
            <span>Delete Remove</span>
            <span>F6 Payment</span>
            <span>F9 Bill History</span>
            <span>Esc Back</span>
            <span>Ctrl+N New Bill</span>
            <span>Ctrl+P Reprint</span>
          </div>
        )}
      </div>
      {!isHistoricalBill && showPayment && (
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

      {isHistoricalBill && !isReadOnly && showHistoricalPayment && historicalSession && (
        <Payment
          session={historicalSession}
          totalPaise={
            historicalSession.lines.reduce((total, line) => total + line.amountPaise, 0) -
            historicalOriginalTotalPaise
          }
          onBack={() => {
            setShowHistoricalPayment(false)
            setPendingHistoricalPayment(null)
          }}
          onComplete={(payment: PaymentResult) => {
            if (payment.mode === 'mixed') {
              setQuantityShortcutError('Mixed payment is not supported for bill modification')
              return
            }
            setPendingHistoricalPayment(payment)
            setShowHistoricalPayment(false)
            void saveHistoricalBill({
              type: 'charge',
              method: payment.mode === 'upi' ? 'upi' : 'cash',
              amountPaise: payment.paidPaise
            })
          }}
        />
      )}

      {!isHistoricalBill && showCompleteConfirmation && pendingPayment && (
        <ConfirmDialog
          title="Complete Bill"
          message={`Complete bill ${displaySession.billNumber}?`}
          onConfirm={async () => {
            if (isCompletingSale) {
              return
            }

            if (!pendingPayment) {
              return
            }

            setIsCompletingSale(true)

            try {
              const result = await window.kirana.billing.completeSale({
                billNumber: displaySession.billNumber,
                customerName: displaySession.customerName,
                customerMobile: displaySession.customerMobile,

                lines: lines.filter((line) => line.productId !== null || line.isTemporary),

                payment: pendingPayment
              })

              console.log('Sale completed:', result)

              setShowCompleteConfirmation(false)
              setShowPayment(false)
              setShowPrintConfirmation(true)
            } catch (error) {
              console.error('Failed to complete sale:', error)

              const message = error instanceof Error ? error.message : 'Failed to complete bill.'

              setShowCompleteConfirmation(false)
              setIsCompletingSale(false)
              setPendingPayment(null)
              setShowErrorDialog(true)
              setErrorDialogMessage(message)
            }
          }}
          onCancel={() => {
            setShowCompleteConfirmation(false)
            setPendingPayment(null)
          }}
        />
      )}

      {isHistoricalBill && !isReadOnly && showHistoricalRefundConfirmation && historicalSession && (
        <ConfirmDialog
          title="REFUND"
          message={`Refund ₹${(
            Math.abs(
              historicalSession.lines.reduce((total, line) => total + line.amountPaise, 0) -
                historicalOriginalTotalPaise
            ) / 100
          ).toFixed(2)} to customer?`}
          onConfirm={() => {
            setShowHistoricalRefundConfirmation(false)

            void saveHistoricalBill({
              type: 'refund',
              method: 'cash',
              amountPaise: Math.abs(
                historicalSession.lines.reduce((total, line) => total + line.amountPaise, 0) -
                  historicalOriginalTotalPaise
              )
            })
          }}
          onCancel={() => {
            setShowHistoricalRefundConfirmation(false)
          }}
        />
      )}

      {!isHistoricalBill && showPrintConfirmation && (
        <ConfirmDialog
          title="Print Bill"
          message={`Print bill ${displaySession.billNumber}?`}
          onConfirm={async () => {
            setShowPrintConfirmation(false)
            setPendingPayment(null)

            // Printer integration will be added later.
            await onBillCompleted(displaySession.billNumber)
          }}
          onCancel={async () => {
            setShowPrintConfirmation(false)
            setPendingPayment(null)

            await onBillCompleted(displaySession.billNumber)
          }}
        />
      )}

      {showErrorDialog && (
        <ErrorDialog
          message={errorDialogMessage}
          onClose={() => {
            setShowErrorDialog(false)
            setErrorDialogMessage('')
          }}
        />
      )}
    </>
  )
}

export default Billing
