//PurchaseEntry.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import './purchase-entry.css'
import ItemMaster from '../products/ItemMaster'
import SupplierMaster from '../suppliers/SupplierMaster'
import ConfirmationDialog from '../../components/confirm-dialog/ConfirmDialog'
import ProductForm from '../products/ProductForm'

type PurchaseEntryProps = {
  supplier: Supplier | null
  purchaseId?: number
  onSupplierSelected: (supplier: Supplier) => void
  onBack: () => void
  onOpenHistory: () => void
}

type PurchaseField =
  | 'supplier'
  | 'invoice'
  | 'date'
  | 'product'
  | 'mrp'
  | 'purchase'
  | 'selling'
  | 'quantity'
  | 'free'
  | 'batch'
  | 'expiry'

type PaymentMethod = 'CASH' | 'UPI' | 'CREDIT'

type PurchaseLine = {
  id: number
  productId: number | null
  productName: string
  barcode: string | null
  quantityPrecision: number

  // OLD values from Product Master
  oldMrpPaise: number
  oldPurchaseRatePaise: number
  oldSellingRatePaise: number

  // NEW values for this purchase
  mrpPaise: number
  purchaseRatePaise: number
  sellingRatePaise: number

  quantity: number
  freeQuantity: number

  batchNumber: string
  expiryDate: string

  amountPaise: number
}

function createEmptyLine(): PurchaseLine {
  return {
    id: Date.now() + Math.random(),
    productId: null,
    productName: '',
    barcode: null,
    quantityPrecision: 0,

    oldMrpPaise: 0,
    oldPurchaseRatePaise: 0,
    oldSellingRatePaise: 0,

    mrpPaise: 0,
    purchaseRatePaise: 0,
    sellingRatePaise: 0,

    quantity: 0,
    freeQuantity: 0,

    batchNumber: '',
    expiryDate: '',

    amountPaise: 0
  }
}

function formatMoney(paise: number): string {
  return (paise / 100).toFixed(2)
}

function formatSignedMoney(paise: number): string {
  if (paise === 0) {
    return '—'
  }

  const sign = paise > 0 ? '+' : '-'

  return `${sign}₹${formatMoney(Math.abs(paise))}`
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

// function formatSignedPercent(value: number): string {
//   if (Math.abs(value) < 0.005) {
//     return '—'
//   }

//   const sign = value > 0 ? '+' : '-'

//   return `${sign}${Math.abs(value).toFixed(2)}%`
// }

function calculateAmount(quantity: number, purchaseRatePaise: number): number {
  if (!Number.isFinite(quantity) || quantity < 0) {
    return 0
  }

  if (!Number.isInteger(purchaseRatePaise) || purchaseRatePaise < 0) {
    return 0
  }

  return Math.round(quantity * purchaseRatePaise)
}

function calculateProfitPaise(sellingPaise: number, purchasePaise: number): number {
  if (purchasePaise <= 0 || sellingPaise <= 0) {
    return 0
  }

  return sellingPaise - purchasePaise
}

function calculateMargin(sellingPaise: number, purchasePaise: number): number | null {
  if (sellingPaise <= 0 || purchasePaise <= 0) {
    return null
  }

  const profit = sellingPaise - purchasePaise

  return (profit / sellingPaise) * 100
}

function todayIso(): string {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatDisplayDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate
  }

  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

function parseDisplayDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())

  if (!match) {
    return null
  }

  const [, dayText, monthText, yearText] = match

  const day = Number(dayText)
  const month = Number(monthText)
  const year = Number(yearText)

  const date = new Date(year, month - 1, day)

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }

  return `${yearText}-${monthText}-${dayText}`
}

export default function PurchaseEntry({
  supplier,
  purchaseId,
  onSupplierSelected,
  onBack,
  onOpenHistory
}: PurchaseEntryProps): React.JSX.Element {
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayIso)
  const [invoiceDateInput, setInvoiceDateInput] = useState(() => formatDisplayDate(todayIso()))

  const [lines, setLines] = useState<PurchaseLine[]>([createEmptyLine()])
  //   const [loadingPurchase, setLoadingPurchase] = useState(false)

  const [selectedIndex, setSelectedIndex] = useState(0)

  const [activeField, setActiveField] = useState<PurchaseField>('supplier')

  const [showItemSelector, setShowItemSelector] = useState(false)
  const [showSupplierSelector, setShowSupplierSelector] = useState(false)
  const [showPayment, setShowPayment] = useState(false)

  const [itemFormMode, setItemFormMode] = useState<'add' | 'edit' | null>(null)
  const [itemFormProductId, setItemFormProductId] = useState<number | null>(null)

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')

  const [barcodeInput, setBarcodeInput] = useState('')
  const [productNotFound, setProductNotFound] = useState(false)

  const [editInput, setEditInput] = useState('')

  const [saveMessage, setSaveMessage] = useState('')
  const [saving, setSaving] = useState(false)

  /*
   * Tax / Discount
   *
   * These are UI-level purchase bill adjustments.
   */
  const [taxInput, setTaxInput] = useState('')
  const [discountInput, setDiscountInput] = useState('')

  const supplierRef = useRef<HTMLButtonElement>(null)
  const invoiceRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  const productInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const selectedRowRef = useRef<HTMLTableRowElement | null>(null)

  const selectedLine = lines[selectedIndex]

  const [finalizeStep, setFinalizeStep] = useState<'TAX' | 'DISCOUNT' | 'PAYMENT' | null>(null)

  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false)

  const taxInputRef = useRef<HTMLInputElement>(null)
  const discountInputRef = useRef<HTMLInputElement>(null)
  const paymentRef = useRef<HTMLDivElement>(null)

  /*
   * ---------------------------------------------------------
   * Totals
   * ---------------------------------------------------------
   */

  const purchaseLines = useMemo(() => lines.filter((line) => line.productId !== null), [lines])

  const totalPaidQuantity = useMemo(
    () => purchaseLines.reduce((total, line) => total + line.quantity, 0),
    [purchaseLines]
  )

  const totalFreeQuantity = useMemo(
    () => purchaseLines.reduce((total, line) => total + line.freeQuantity, 0),
    [purchaseLines]
  )

  const subtotalPaise = useMemo(
    () => purchaseLines.reduce((total, line) => total + line.amountPaise, 0),
    [purchaseLines]
  )

  const taxPaise = Math.round((Number(taxInput) || 0) * 100)

  const discountPaise = Math.round((Number(discountInput) || 0) * 100)

  const totalPaise = Math.max(0, subtotalPaise + taxPaise - discountPaise)

  /*
   * ---------------------------------------------------------
   * Selected product OLD / NEW calculations
   * ---------------------------------------------------------
   *
   * OLD purchase price is intentionally unavailable because
   * the supplied ProductRecord does not expose a historical
   * purchase-price field.
   */

  const newProfitPaise = selectedLine
    ? calculateProfitPaise(selectedLine.sellingRatePaise, selectedLine.purchaseRatePaise)
    : 0

  const newMargin = selectedLine
    ? calculateMargin(selectedLine.sellingRatePaise, selectedLine.purchaseRatePaise)
    : null

  function handleInvoiceDateChange(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 8)

    let formatted = digits

    if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`
    }

    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
    }

    setInvoiceDateInput(formatted)
    setSaveMessage('')

    const parsedDate = parseDisplayDate(formatted)

    if (parsedDate) {
      setInvoiceDate(parsedDate)
    }
  }

  function handleInvoiceDateBlur(): void {
    const parsedDate = parseDisplayDate(invoiceDateInput)

    if (parsedDate) {
      setInvoiceDate(parsedDate)
      setInvoiceDateInput(formatDisplayDate(parsedDate))
      setSaveMessage('')
      return
    }

    setInvoiceDateInput(formatDisplayDate(invoiceDate))
    setSaveMessage('Please enter purchase date as DD/MM/YYYY.')
  }
  /*
   * ---------------------------------------------------------
   * Initial focus
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      supplierRef.current?.focus()
    })

    return () => cancelAnimationFrame(frame)
  }, [])

  /*
   * ---------------------------------------------------------
   * Focus management
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (showItemSelector || showSupplierSelector || showPayment) {
      return
    }

    const frame = requestAnimationFrame(() => {
      if (activeField === 'supplier') {
        supplierRef.current?.focus()
        return
      }

      if (activeField === 'invoice') {
        invoiceRef.current?.focus()
        invoiceRef.current?.select()
        return
      }

      if (activeField === 'date') {
        dateRef.current?.focus()
        return
      }

      if (
        activeField === 'product' &&
        selectedLine &&
        selectedLine.productId === null &&
        selectedIndex === lines.length - 1
      ) {
        productInputRef.current?.focus()
        return
      }

      if (
        activeField === 'mrp' ||
        activeField === 'purchase' ||
        activeField === 'selling' ||
        activeField === 'quantity' ||
        activeField === 'free' ||
        activeField === 'batch' ||
        activeField === 'expiry'
      ) {
        editInputRef.current?.focus()
        editInputRef.current?.select()
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [
    activeField,
    selectedIndex,
    selectedLine,
    lines.length,
    showItemSelector,
    showSupplierSelector,
    showPayment
  ])

  useEffect(() => {
    if (!purchaseId) {
      return
    }

    let cancelled = false

    async function loadPurchase(): Promise<void> {
      try {
        if (purchaseId === undefined) {
          return
        }
        const purchase = await window.kirana.purchase.get(purchaseId)

        if (!purchase) {
          console.error('Purchase not found:', purchaseId)
          return
        }

        if (cancelled) {
          return
        }

        /*
         * Load invoice information
         */
        setInvoiceNumber(purchase.invoiceNumber)
        setInvoiceDate(purchase.purchaseDate)
        setInvoiceDateInput(formatDisplayDate(purchase.purchaseDate))

        /*
         * Load payment information
         */
        setPaymentMethod(purchase.paymentMethod)

        /*
         * Load tax / discount
         */
        setTaxInput(String(purchase.taxPaise / 100))
        setDiscountInput(String(purchase.discountPaise / 100))

        /*
         * Load purchase lines
         */
        const loadedLines: PurchaseLine[] = purchase.lines.map((line) => ({
          id: line.id,

          productId: line.productId,
          productName: line.productName,
          barcode: line.barcode,

          quantityPrecision: 0,

          oldMrpPaise: line.mrpPaise,
          oldPurchaseRatePaise: line.purchaseRatePaise,
          oldSellingRatePaise: line.sellingRatePaise,

          mrpPaise: line.mrpPaise,
          purchaseRatePaise: line.purchaseRatePaise,
          sellingRatePaise: line.sellingRatePaise,

          quantity: line.quantity,
          freeQuantity: line.freeQuantity,

          batchNumber: line.batchNumber ?? '',
          expiryDate: line.expiryDate ?? '',

          amountPaise: line.amountPaise
        }))

        setLines([...loadedLines, createEmptyLine()])

        setSelectedIndex(0)
      } catch (error) {
        console.error('Unable to load purchase:', error)
      }
    }

    void loadPurchase()

    return () => {
      cancelled = true
    }
  }, [purchaseId])

  useEffect(() => {
    if (!showPayment) {
      return
    }

    const frame = requestAnimationFrame(() => {
      paymentRef.current?.focus()
    })

    return () => cancelAnimationFrame(frame)
  }, [showPayment])

  /*
   * ---------------------------------------------------------
   * Keep selected row visible
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      selectedRowRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: 'auto'
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [selectedIndex])

  /*
   * ---------------------------------------------------------
   * Line helpers
   * ---------------------------------------------------------
   */

  function updateLine(index: number, update: Partial<PurchaseLine>): void {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              ...update
            }
          : line
      )
    )
  }

  function ensureBlankLine(): void {
    setLines((current) => {
      const last = current[current.length - 1]

      if (last && last.productId === null && last.productName === '') {
        return current
      }

      return [...current, createEmptyLine()]
    })
  }

  function removeSelectedLine(): void {
    const line = lines[selectedIndex]

    if (!line || line.productId === null) {
      return
    }

    setLines((current) => {
      const remaining = current.filter((_, index) => index !== selectedIndex)

      if (remaining.length === 0) {
        return [createEmptyLine()]
      }

      const last = remaining[remaining.length - 1]

      if (last.productId !== null || last.productName !== '') {
        remaining.push(createEmptyLine())
      }

      return remaining
    })

    setSelectedIndex((current) => {
      const newLength = Math.max(lines.length - 1, 1)

      return Math.min(current, newLength - 1)
    })

    setActiveField('product')
    setBarcodeInput('')
    setProductNotFound(false)
    setEditInput('')
    setSaveMessage('')
  }

  /*
   * ---------------------------------------------------------
   * Product selection
   * ---------------------------------------------------------
   */

  function openItemSelector(): void {
    const bottomIndex = lines.length - 1

    setSelectedIndex(bottomIndex)
    setActiveField('product')
    setBarcodeInput('')
    setProductNotFound(false)
    setEditInput('')
    setShowItemSelector(true)
  }

  function addProduct(product: ProductRecord): void {
    const bottomIndex = lines.length - 1

    const newProductLine: PurchaseLine = {
      id: Date.now() + Math.random(),
      productId: product.id,
      productName: product.name,
      barcode: product.barcode ?? null,
      quantityPrecision: product.quantity_precision,

      // OLD Product Master values
      oldMrpPaise: product.mrp_paise,
      oldPurchaseRatePaise: product.purchase_price_paise,
      oldSellingRatePaise: product.selling_price_paise,

      // NEW purchase values
      mrpPaise: product.mrp_paise,
      purchaseRatePaise: product.purchase_price_paise,
      sellingRatePaise: product.selling_price_paise,

      quantity: 0,
      freeQuantity: 0,
      batchNumber: '',
      expiryDate: '',
      amountPaise: 0
    }

    setLines((current) => {
      const currentBottomIndex = current.length - 1

      return [...current.slice(0, currentBottomIndex), newProductLine, createEmptyLine()]
    })

    setShowItemSelector(false)

    setBarcodeInput('')
    setProductNotFound(false)
    setSaveMessage('')
    setFinalizeStep(null)

    /*
     * IMPORTANT:
     * Stay on the newly added product row.
     *
     * Do NOT move to the blank row.
     */
    setSelectedIndex(bottomIndex)

    /*
     * Start the field sequence at MRP.
     */
    setEditInput(product.mrp_paise === 0 ? '' : (product.mrp_paise / 100).toString())

    setActiveField('mrp')
  }

  function handleProductSelected(product: ProductRecord): void {
    addProduct(product)
  }

  /*
   * ---------------------------------------------------------
   * Barcode
   * ---------------------------------------------------------
   */

  function handleBarcodeChange(value: string): void {
    setBarcodeInput(value)
    setProductNotFound(false)
    setSaveMessage('')
  }

  async function lookupBarcode(): Promise<void> {
    const barcode = barcodeInput.trim()

    if (!barcode) {
      openItemSelector()
      return
    }

    try {
      const product = await window.kirana.products.getByBarcode(barcode)

      if (!product) {
        setProductNotFound(true)
        return
      }

      addProduct(product)
    } catch (error) {
      console.error('Purchase product lookup failed:', error)

      setProductNotFound(true)
    }
  }

  /*
   * ---------------------------------------------------------
   * Current edit value
   * ---------------------------------------------------------
   */

  /*
   * ---------------------------------------------------------
   * Edit input
   * ---------------------------------------------------------
   */

  function handleEditInputChange(value: string): void {
    if (activeField === 'mrp' || activeField === 'purchase' || activeField === 'selling') {
      if (!/^\d*(\.\d{0,2})?$/.test(value)) {
        return
      }
    }

    if (activeField === 'quantity' || activeField === 'free') {
      if (!/^\d*(\.\d*)?$/.test(value)) {
        return
      }

      if (selectedLine?.quantityPrecision === 0 && !/^\d*$/.test(value)) {
        return
      }
    }

    setEditInput(value)
    setSaveMessage('')
  }

  /*
   * ---------------------------------------------------------
   * Commit current field
   * ---------------------------------------------------------
   */

  function commitCurrentEdit(): boolean {
    if (!selectedLine) {
      return false
    }

    if (activeField === 'mrp') {
      const value = editInput.trim() === '' ? 0 : Number(editInput)

      if (!Number.isFinite(value) || value < 0) {
        return false
      }

      updateLine(selectedIndex, {
        mrpPaise: Math.round(value * 100)
      })

      return true
    }

    if (activeField === 'purchase') {
      const value = editInput.trim() === '' ? 0 : Number(editInput)

      if (!Number.isFinite(value) || value < 0) {
        return false
      }

      const purchaseRatePaise = Math.round(value * 100)

      updateLine(selectedIndex, {
        purchaseRatePaise,
        amountPaise: calculateAmount(selectedLine.quantity, purchaseRatePaise)
      })

      return true
    }

    if (activeField === 'selling') {
      const value = editInput.trim() === '' ? 0 : Number(editInput)

      if (!Number.isFinite(value) || value < 0) {
        return false
      }

      updateLine(selectedIndex, {
        sellingRatePaise: Math.round(value * 100)
      })

      return true
    }

    if (activeField === 'quantity') {
      const value = editInput.trim() === '' ? 0 : Number(editInput)

      if (!Number.isFinite(value) || value < 0) {
        return false
      }

      const precision = selectedLine.quantityPrecision

      if (precision === 0 && !Number.isInteger(value)) {
        return false
      }

      const factor = 10 ** precision
      const rounded = Math.round(value * factor) / factor

      if (rounded !== value) {
        return false
      }

      updateLine(selectedIndex, {
        quantity: value,
        amountPaise: calculateAmount(value, selectedLine.purchaseRatePaise)
      })

      return true
    }

    if (activeField === 'free') {
      const value = editInput.trim() === '' ? 0 : Number(editInput)

      if (!Number.isFinite(value) || value < 0) {
        return false
      }

      const precision = selectedLine.quantityPrecision

      if (precision === 0 && !Number.isInteger(value)) {
        return false
      }

      const factor = 10 ** precision
      const rounded = Math.round(value * factor) / factor

      if (rounded !== value) {
        return false
      }

      updateLine(selectedIndex, {
        freeQuantity: value
      })

      return true
    }

    if (activeField === 'batch') {
      updateLine(selectedIndex, {
        batchNumber: editInput.trim()
      })

      return true
    }

    if (activeField === 'expiry') {
      updateLine(selectedIndex, {
        expiryDate: editInput.trim()
      })

      return true
    }

    return true
  }

  /*
   * ---------------------------------------------------------
   * Purchase table navigation
   * ---------------------------------------------------------
   */

  function canLeaveCurrentPurchaseField(): boolean {
    if (!selectedLine) {
      return false
    }

    switch (activeField) {
      case 'mrp':
        if (!editInput.trim()) {
          setSaveMessage('MRP is required.')
          return false
        }

        return true

      case 'purchase':
        if (!editInput.trim()) {
          setSaveMessage('Purchase rate is required.')
          return false
        }

        return true

      case 'selling':
        if (!editInput.trim()) {
          setSaveMessage('Selling rate is required.')
          return false
        }

        return true

      case 'quantity': {
        const value = editInput.trim()

        if (!value) {
          setSaveMessage('Quantity is required.')
          return false
        }

        const quantity = Number(value)

        if (!Number.isFinite(quantity) || quantity <= 0) {
          setSaveMessage('Quantity must be greater than 0.')
          return false
        }

        return true
      }

      case 'free':
        // Blank Free means 0.
        return true

      case 'batch':
        // Optional.
        return true

      case 'expiry':
        // Optional.
        return true

      default:
        return true
    }
  }

  function moveToNextPurchaseField(): void {
    if (!selectedLine) {
      return
    }

    if (
      activeField === 'mrp' ||
      activeField === 'purchase' ||
      activeField === 'selling' ||
      activeField === 'quantity' ||
      activeField === 'free' ||
      activeField === 'batch' ||
      activeField === 'expiry'
    ) {
      if (!canLeaveCurrentPurchaseField()) {
        return
      }
    }

    switch (activeField) {
      case 'supplier':
        setShowSupplierSelector(true)
        return

      case 'invoice':
        setActiveField('date')
        return

      case 'date':
        setSelectedIndex(lines.length - 1)
        setActiveField('product')
        setBarcodeInput('')
        setProductNotFound(false)
        return

      case 'product':
        if (selectedLine.productId !== null) {
          setEditInput(selectedLine.mrpPaise === 0 ? '' : (selectedLine.mrpPaise / 100).toString())

          setActiveField('mrp')
          return
        }

        openItemSelector()
        return

      case 'mrp':
        if (!commitCurrentEdit()) {
          return
        }

        setEditInput(
          selectedLine.purchaseRatePaise === 0
            ? ''
            : (selectedLine.purchaseRatePaise / 100).toString()
        )

        setActiveField('purchase')
        return

      case 'purchase':
        if (!commitCurrentEdit()) {
          return
        }

        setEditInput(
          selectedLine.sellingRatePaise === 0
            ? ''
            : (selectedLine.sellingRatePaise / 100).toString()
        )

        setActiveField('selling')
        return

      case 'selling':
        if (!commitCurrentEdit()) {
          return
        }

        setEditInput(selectedLine.quantity === 0 ? '' : String(selectedLine.quantity))

        setActiveField('quantity')
        return

      case 'quantity':
        if (!commitCurrentEdit()) {
          return
        }

        setEditInput('')

        setActiveField('free')
        return

      case 'free':
        if (!commitCurrentEdit()) {
          return
        }

        setEditInput(selectedLine.batchNumber)
        setActiveField('batch')
        return

      case 'batch':
        if (!commitCurrentEdit()) {
          return
        }

        setEditInput(selectedLine.expiryDate)
        setActiveField('expiry')
        return

      case 'expiry': {
        if (!commitCurrentEdit()) {
          return
        }

        ensureBlankLine()

        setSelectedIndex((current) => Math.min(current + 1, lines.length))

        setActiveField('product')
        setBarcodeInput('')
        setEditInput('')
        setProductNotFound(false)

        return
      }
    }
  }

  const hasUnsavedChanges = () => {
    const hasProducts = lines.some((line) => line.productId !== null)

    return (
      hasProducts ||
      supplier !== null ||
      invoiceNumber.trim() !== '' ||
      invoiceDate !== todayIso() ||
      taxInput.trim() !== '' ||
      discountInput.trim() !== ''
    )
  }

  const requestLeave = () => {
    if (!hasUnsavedChanges()) {
      onBack()
      return
    }
    setShowLeaveConfirmation(true)
  }

  /*
   * ---------------------------------------------------------
   * Keyboard navigation
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (showItemSelector || showSupplierSelector || showPayment) {
      return
    }

    function handleKeyDown(event: KeyboardEvent): void {
      /*
       * Confirmation dialog owns the keyboard while it is open.
       */
      if (showLeaveConfirmation) {
        return
      }

      /*
       * IMPORTANT:
       * This handler is registered in CAPTURE mode below.
       *
       * Therefore F2 / F4 / Esc work even when Tax or Discount
       * input calls event.stopPropagation().
       */

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()

        /*
         * Leaving Purchase Entry always goes through the
         * unsaved-changes confirmation when required.
         */
        requestLeave()

        return
      }

      if (event.key === 'F2') {
        event.preventDefault()
        event.stopPropagation()

        /*
         * F2 = Add Item.
         *
         * The last line is the blank Product row in Purchase Entry.
         * Select it and immediately focus Product.
         */
        const lastIndex = lines.length - 1

        setSelectedIndex(lastIndex)
        setActiveField('product')
        setBarcodeInput('')
        setProductNotFound(false)
        setEditInput('')
        setSaveMessage('')
        setFinalizeStep(null)

        requestAnimationFrame(() => {
          productInputRef.current?.focus()
          productInputRef.current?.select()
        })

        return
      }

      if (event.key === 'F4') {
        event.preventDefault()
        event.stopPropagation()

        setShowSupplierSelector(true)
        setFinalizeStep(null)

        return
      }

      if (event.key === 'F9') {
        event.preventDefault()
        event.stopPropagation()

        setFinalizeStep(null)

        onOpenHistory()

        return
      }

      if (event.key === 'F6') {
        event.preventDefault()
        event.stopPropagation()

        if (finalizeStep === null) {
          setFinalizeStep('TAX')

          requestAnimationFrame(() => {
            taxInputRef.current?.focus()
            taxInputRef.current?.select()
          })

          return
        }

        if (finalizeStep === 'TAX') {
          setFinalizeStep('DISCOUNT')

          requestAnimationFrame(() => {
            discountInputRef.current?.focus()
            discountInputRef.current?.select()
          })

          return
        }

        if (finalizeStep === 'DISCOUNT') {
          setFinalizeStep('PAYMENT')
          setShowPayment(true)

          return
        }

        /*
         * Safety fallback.
         */
        setShowPayment(false)
        setFinalizeStep('TAX')

        requestAnimationFrame(() => {
          taxInputRef.current?.focus()
          taxInputRef.current?.select()
        })

        return
      }

      /*
       * Normal Tax / Discount typing is left to the input itself.
       *
       * F2/F4/F6/Esc were already handled above.
       */
      const target = event.target as HTMLElement | null

      if (
        target instanceof HTMLInputElement &&
        target.classList.contains('purchase-summary-input')
      ) {
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()

        /*
         * Once a product has been added, do not allow
         * Arrow navigation to bypass its fields.
         */
        if (selectedLine?.productId !== null && activeField !== 'product') {
          return
        }

        /*
         * Product field / blank row can still use
         * Arrow navigation.
         */
        if (event.key === 'ArrowDown') {
          setSelectedIndex((current) => Math.min(current + 1, lines.length - 1))
        } else {
          setSelectedIndex((current) => Math.max(current - 1, 0))
        }

        setActiveField('product')
        setBarcodeInput('')
        setProductNotFound(false)
        setEditInput('')
        setFinalizeStep(null)

        return
      }

      if (event.key === 'Delete') {
        event.preventDefault()

        removeSelectedLine()

        return
      }

      if (event.key !== 'Enter') {
        return
      }

      if (event.target === productInputRef.current) {
        return
      }

      if (event.target === invoiceRef.current) {
        return
      }

      event.preventDefault()

      moveToNextPurchaseField()
    }

    /*
     * CAPTURE MODE IS THE IMPORTANT PART.
     *
     * true = window receives the event before the Tax/Discount
     * input's onKeyDown can call stopPropagation().
     */
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [
    activeField,
    lines,
    onBack,
    selectedIndex,
    showItemSelector,
    showPayment,
    showSupplierSelector,
    barcodeInput,
    editInput,
    selectedLine,
    showLeaveConfirmation,
    finalizeStep,
    supplier,
    invoiceNumber,
    invoiceDate,
    invoiceDateInput,
    taxInput,
    discountInput
  ])
  /*
   * ---------------------------------------------------------
   * Supplier selector
   * ---------------------------------------------------------
   */

  if (showSupplierSelector) {
    return (
      <SupplierMaster
        mode="select"
        onBack={() => {
          setShowSupplierSelector(false)
          setActiveField('supplier')
        }}
        onSelectSupplier={(selectedSupplier) => {
          onSupplierSelected(selectedSupplier)
          setShowSupplierSelector(false)
          setActiveField('invoice')
        }}
      />
    )
  }

  /*
   * ---------------------------------------------------------
   * Item Master selector
   * ---------------------------------------------------------
   */

  if (showItemSelector) {
    if (itemFormMode === 'add') {
      return (
        <ProductForm
          onSaved={() => {
            setItemFormMode(null)
          }}
          onCancel={() => {
            setItemFormMode(null)
          }}
        />
      )
    }

    if (itemFormMode === 'edit' && itemFormProductId !== null) {
      return (
        <ProductForm
          productId={itemFormProductId}
          onSaved={() => {
            setItemFormMode(null)
            setItemFormProductId(null)
          }}
          onCancel={() => {
            setItemFormMode(null)
            setItemFormProductId(null)
          }}
        />
      )
    }

    return (
      <ItemMaster
        mode="manage"
        onBack={() => {
          setShowItemSelector(false)

          setSelectedIndex(lines.length - 1)
          setActiveField('product')
          setBarcodeInput('')
          setProductNotFound(false)
        }}
        onSelectItem={handleProductSelected}
        onAddItem={() => {
          setItemFormMode('add')
        }}
        onEditItem={(productId) => {
          setItemFormProductId(productId)
          setItemFormMode('edit')
        }}
      />
    )
  }

  /*
   * ---------------------------------------------------------
   * Validation
   * ---------------------------------------------------------
   */

  async function validateInvoiceNumberOnEnter(): Promise<boolean> {
    const value = invoiceNumber.trim()

    if (!value) {
      setSaveMessage('Invoice number is required.')

      requestAnimationFrame(() => {
        invoiceRef.current?.focus()
      })

      return false
    }

    try {
      const duplicate = await window.kirana.purchase.checkInvoiceNumber(value, purchaseId)

      if (duplicate) {
        setSaveMessage(`Invoice number "${value}" already exists.`)

        requestAnimationFrame(() => {
          invoiceRef.current?.focus()
          invoiceRef.current?.select()
        })

        return false
      }

      setSaveMessage('')

      return true
    } catch (error) {
      console.error('Invoice number validation failed:', error)

      setSaveMessage('Unable to validate invoice number.')

      requestAnimationFrame(() => {
        invoiceRef.current?.focus()
      })

      return false
    }
  }

  function validatePurchase(): string | null {
    if (!supplier) {
      return 'Please select a supplier.'
    }

    if (!invoiceNumber.trim()) {
      return 'Please enter supplier invoice number.'
    }

    if (!invoiceDate) {
      return 'Please enter purchase date.'
    }

    if (!parseDisplayDate(invoiceDateInput)) {
      return 'Please enter purchase date as DD/MM/YYYY.'
    }

    if (purchaseLines.length === 0) {
      return 'Please add at least one item.'
    }

    for (let index = 0; index < purchaseLines.length; index += 1) {
      const line = purchaseLines[index]
      const row = index + 1

      if (!line.productId) {
        return `Row ${row}: product is required.`
      }

      if (line.mrpPaise < 0) {
        return `Row ${row}: invalid MRP.`
      }

      if (line.purchaseRatePaise <= 0) {
        return `Row ${row}: purchase price must be greater than zero.`
      }

      if (line.sellingRatePaise < 0) {
        return `Row ${row}: invalid selling price.`
      }

      if (line.quantity <= 0) {
        return `Row ${row}: quantity must be greater than zero.`
      }

      if (line.freeQuantity < 0) {
        return `Row ${row}: invalid free quantity.`
      }
    }

    if (subtotalPaise <= 0) {
      return 'Purchase subtotal must be greater than zero.'
    }

    if (discountPaise > subtotalPaise + taxPaise) {
      return 'Discount cannot exceed the purchase total.'
    }

    return null
  }

  /*
   * ---------------------------------------------------------
   * Payment
   * ---------------------------------------------------------
   */

  //   function openPayment(): void {
  //     if (saving) {
  //       return
  //     }

  //     const validationError = validatePurchase()

  //     if (validationError) {
  //       setSaveMessage(validationError)
  //       return
  //     }

  //     setSaveMessage('')
  //     setPaymentMethod('CASH')
  //     setShowPayment(true)
  //   }

  async function savePurchase(): Promise<void> {
    if (saving) {
      return
    }

    const validationError = validatePurchase()

    if (validationError) {
      setShowPayment(false)
      setFinalizeStep(null)
      setSaveMessage(validationError)
      return
    }

    if (!supplier) {
      return
    }

    setSaving(true)
    setSaveMessage('')

    try {
      /*
       * Keep the existing purchase API contract.
       *
       * Tax / discount are currently UI-level values because
       * the supplied existing purchase IPC contract was not
       * shown to accept them.
       */
      const payload = {
        supplierId: supplier.id,

        invoiceNumber: invoiceNumber.trim(),

        purchaseDate: invoiceDate,

        subtotalPaise,

        taxPaise,

        discountPaise,

        totalAmountPaise: totalPaise,

        paymentMethod,

        paidPaise: paymentMethod === 'CREDIT' ? 0 : totalPaise,

        lines: purchaseLines.map((line) => ({
          productId: line.productId as number,

          mrpPaise: line.mrpPaise,
          purchaseRatePaise: line.purchaseRatePaise,
          sellingRatePaise: line.sellingRatePaise,

          quantity: line.quantity,
          freeQuantity: line.freeQuantity,

          amountPaise: calculateAmount(line.quantity, line.purchaseRatePaise),

          batchNumber: line.batchNumber.trim() || null,
          expiryDate: line.expiryDate.trim() || null
        }))
      }

      if (purchaseId) {
        await window.kirana.purchase.update(purchaseId, payload)
      } else {
        await window.kirana.purchase.complete(payload)
      }

      setShowPayment(false)
      setFinalizeStep(null)
      setInvoiceNumber('')
      setInvoiceDate(todayIso())
      setInvoiceDateInput(formatDisplayDate(todayIso()))
      setLines([createEmptyLine()])

      setSelectedIndex(0)
      setActiveField('supplier')

      setBarcodeInput('')
      setEditInput('')
      setProductNotFound(false)

      setTaxInput('')
      setDiscountInput('')

      setSaveMessage('Purchase saved successfully.')

      window.setTimeout(() => {
        setSaveMessage('')
      }, 1500)
    } catch (error) {
      console.error('Purchase save failed:', error)

      const message = error instanceof Error ? error.message : 'Failed to save purchase.'

      setShowPayment(false)
      setSaveMessage(message)
    } finally {
      setSaving(false)
    }
  }

  /*
   * ---------------------------------------------------------
   * Payment screen
   * ---------------------------------------------------------
   */

  if (showPayment) {
    return (
      <div
        ref={paymentRef}
        className="purchase-entry"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()

            setShowPayment(false)
            setSaveMessage('')
            setFinalizeStep(null)
            return
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            event.stopPropagation()

            setPaymentMethod((current) => {
              if (current === 'CASH') {
                return 'UPI'
              }

              if (current === 'UPI') {
                return 'CREDIT'
              }

              return 'CASH'
            })

            return
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            event.stopPropagation()

            setPaymentMethod((current) => {
              if (current === 'CREDIT') {
                return 'UPI'
              }

              if (current === 'UPI') {
                return 'CASH'
              }

              return 'CREDIT'
            })

            return
          }

          if (event.key === 'Enter') {
            event.preventDefault()
            event.stopPropagation()

            if (!saving) {
              void savePurchase()
            }
          }
        }}
      >
        <div className="purchase-title">
          <div>PURCHASE PAYMENT</div>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              width: 420,
              border: '1px solid #31516b',
              background: '#edf4f8',
              padding: 20,
              fontFamily: 'Courier New, monospace'
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 'bold',
                marginBottom: 18
              }}
            >
              PURCHASE PAYMENT
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #aebdca'
              }}
            >
              <span>TOTAL</span>

              <strong>₹{formatMoney(totalPaise)}</strong>
            </div>

            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  fontWeight: 'bold',
                  marginBottom: 8
                }}
              >
                PAYMENT METHOD
              </div>

              <div
                style={{
                  padding: '8px 10px',
                  background: paymentMethod === 'CASH' ? '#31516b' : '#edf4f8',
                  color: paymentMethod === 'CASH' ? '#ffffff' : '#000000'
                }}
              >
                {paymentMethod === 'CASH' ? '> ' : '  '}
                CASH
              </div>

              <div
                style={{
                  padding: '8px 10px',
                  background: paymentMethod === 'UPI' ? '#31516b' : '#edf4f8',
                  color: paymentMethod === 'UPI' ? '#ffffff' : '#000000'
                }}
              >
                {paymentMethod === 'UPI' ? '> ' : '  '}
                UPI
              </div>

              <div
                style={{
                  padding: '8px 10px',
                  background: paymentMethod === 'CREDIT' ? '#31516b' : '#edf4f8',
                  color: paymentMethod === 'CREDIT' ? '#ffffff' : '#000000'
                }}
              >
                {paymentMethod === 'CREDIT' ? '> ' : '  '}
                CREDIT
              </div>
            </div>

            {saveMessage && (
              <div
                style={{
                  marginTop: 15,
                  padding: 8,
                  background: '#f7dddd',
                  color: '#8b0000'
                }}
              >
                {saveMessage}
              </div>
            )}

            <div
              style={{
                marginTop: 20,
                paddingTop: 10,
                borderTop: '1px solid #aebdca',
                fontSize: 14
              }}
            >
              ↑↓ Select &nbsp;&nbsp; Enter Save &nbsp;&nbsp; Esc Cancel
            </div>
          </div>
        </div>
      </div>
    )
  }

  /*
   * ---------------------------------------------------------
   * Main Purchase Entry
   * ---------------------------------------------------------
   */

  return (
    <div className="purchase-entry" tabIndex={-1}>
      <div className="purchase-title">
        <div>PURCHASE ENTRY</div>
      </div>

      {/* HEADER */}
      <div className="purchase-header">
        <div className="purchase-header-column">
          <div className="purchase-field">
            <label>Supplier :</label>

            <button
              ref={supplierRef}
              type="button"
              className="purchase-supplier-button"
              onClick={() => setShowSupplierSelector(true)}
              onFocus={() => setActiveField('supplier')}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.stopPropagation()

                  setShowSupplierSelector(true)

                  return
                }

                if (event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()

                  setShowSupplierSelector(true)
                }
              }}
            >
              {supplier?.name || '[ Select Supplier ]'}
            </button>
          </div>

          <div className="purchase-field">
            <label>
              Invoice<span className="purchase-required">*</span> :
            </label>

            <input
              ref={invoiceRef}
              value={invoiceNumber}
              required
              onChange={(event) => {
                setInvoiceNumber(event.target.value)
                setSaveMessage('')
              }}
              onFocus={() => setActiveField('invoice')}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') {
                  return
                }

                event.preventDefault()
                event.stopPropagation()

                void (async () => {
                  const valid = await validateInvoiceNumberOnEnter()

                  if (!valid) {
                    return
                  }

                  /*
                   * Invoice is unique.
                   * Continue to Product field.
                   */
                  setSelectedIndex(0)
                  setActiveField('product')
                  setBarcodeInput('')
                  setEditInput('')
                })()
              }}
            />
          </div>
        </div>

        <div className="purchase-header-column">
          <div className="purchase-field">
            <label>Date :</label>

            <input
              ref={dateRef}
              type="text"
              value={invoiceDateInput}
              placeholder="DD/MM/YYYY"
              maxLength={10}
              inputMode="numeric"
              onChange={(event) => {
                handleInvoiceDateChange(event.target.value)
              }}
              onBlur={handleInvoiceDateBlur}
              onFocus={() => {
                setActiveField('date')
              }}
            />
          </div>

          <div className="purchase-field">
            <label>Items :</label>

            <strong>{purchaseLines.length}</strong>
          </div>
        </div>
      </div>

      {/* UPPER HALF - PURCHASE TABLE */}
      <div className="purchase-grid-wrapper">
        <table className="purchase-table">
          <thead>
            <tr>
              <th className="product-column">PRODUCT</th>
              <th>MRP</th>
              <th>PURCH</th>
              <th>SELL</th>
              <th>QTY</th>
              <th>FREE</th>
              <th>BATCH</th>
              <th>EXPIRY</th>
              <th>AMOUNT</th>
            </tr>
          </thead>
        </table>

        <div className="purchase-items-scroll">
          <table className="purchase-table">
            <tbody>
              {lines.map((line, index) => {
                const selected = index === selectedIndex

                const isBottomBlank =
                  index === lines.length - 1 && line.productId === null && line.productName === ''

                return (
                  <tr
                    key={line.id}
                    ref={selected ? selectedRowRef : undefined}
                    className={selected ? 'purchase-row-selected' : ''}
                    onClick={() => {
                      /*
                       * STRICT RULE:
                       * Once editing a product line has started,
                       * clicking another row cannot bypass the
                       * remaining purchase fields.
                       */
                      if (
                        selectedLine?.productId !== null &&
                        activeField !== 'product' &&
                        index !== selectedIndex
                      ) {
                        return
                      }

                      setSelectedIndex(index)

                      /*
                       * Blank row starts at Product.
                       * Existing product rows should not be reset
                       * back to Product when clicked.
                       */
                      if (line.productId === null) {
                        setActiveField('product')
                        setEditInput('')
                        setBarcodeInput('')
                        setProductNotFound(false)
                      }

                      setSaveMessage('')
                      setFinalizeStep(null)
                    }}
                  >
                    {/* PRODUCT */}
                    <td className="product-column">
                      {isBottomBlank && selected ? (
                        <div className="purchase-product-entry">
                          <input
                            ref={productInputRef}
                            value={barcodeInput}
                            onChange={(event) => handleBarcodeChange(event.target.value)}
                            onFocus={() => setActiveField('product')}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter') {
                                return
                              }

                              event.preventDefault()
                              event.stopPropagation()

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
                        <span>{line.productName}</span>
                      )}
                    </td>

                    {/* MRP */}
                    <td className="number-cell">
                      {line.productId !== null ? (
                        selected && activeField === 'mrp' ? (
                          <input
                            ref={editInputRef}
                            className="purchase-number-input"
                            type="text"
                            inputMode="decimal"
                            value={editInput}
                            onChange={(event) => handleEditInputChange(event.target.value)}
                          />
                        ) : line.mrpPaise > 0 ? (
                          formatMoney(line.mrpPaise)
                        ) : (
                          ''
                        )
                      ) : (
                        ''
                      )}
                    </td>

                    {/* PURCHASE */}
                    <td className="number-cell">
                      {line.productId !== null ? (
                        selected && activeField === 'purchase' ? (
                          <input
                            ref={editInputRef}
                            className="purchase-number-input"
                            type="text"
                            inputMode="decimal"
                            value={editInput}
                            onChange={(event) => handleEditInputChange(event.target.value)}
                          />
                        ) : line.purchaseRatePaise > 0 ? (
                          formatMoney(line.purchaseRatePaise)
                        ) : (
                          ''
                        )
                      ) : (
                        ''
                      )}
                    </td>

                    {/* SELLING */}
                    <td className="number-cell">
                      {line.productId !== null ? (
                        selected && activeField === 'selling' ? (
                          <input
                            ref={editInputRef}
                            className="purchase-number-input"
                            type="text"
                            inputMode="decimal"
                            value={editInput}
                            onChange={(event) => handleEditInputChange(event.target.value)}
                          />
                        ) : line.sellingRatePaise > 0 ? (
                          formatMoney(line.sellingRatePaise)
                        ) : (
                          ''
                        )
                      ) : (
                        ''
                      )}
                    </td>

                    {/* QTY */}
                    <td className="number-cell">
                      {line.productId !== null ? (
                        selected && activeField === 'quantity' ? (
                          <input
                            ref={editInputRef}
                            className="purchase-number-input"
                            type="text"
                            inputMode="decimal"
                            value={editInput}
                            onChange={(event) => handleEditInputChange(event.target.value)}
                          />
                        ) : line.quantity > 0 ? (
                          line.quantity
                        ) : (
                          ''
                        )
                      ) : (
                        ''
                      )}
                    </td>

                    {/* FREE */}
                    <td className="number-cell">
                      {line.productId !== null ? (
                        selected && activeField === 'free' ? (
                          <input
                            ref={editInputRef}
                            className="purchase-number-input"
                            type="text"
                            inputMode="decimal"
                            value={editInput}
                            onChange={(event) => handleEditInputChange(event.target.value)}
                          />
                        ) : line.freeQuantity > 0 ? (
                          line.freeQuantity
                        ) : (
                          ''
                        )
                      ) : (
                        ''
                      )}
                    </td>

                    {/* BATCH */}
                    <td>
                      {line.productId !== null ? (
                        selected && activeField === 'batch' ? (
                          <input
                            ref={editInputRef}
                            className="purchase-text-input"
                            type="text"
                            value={editInput}
                            placeholder="Optional"
                            onChange={(event) => handleEditInputChange(event.target.value)}
                          />
                        ) : (
                          line.batchNumber
                        )
                      ) : (
                        ''
                      )}
                    </td>

                    {/* EXPIRY */}
                    <td>
                      {line.productId !== null ? (
                        selected && activeField === 'expiry' ? (
                          <input
                            ref={editInputRef}
                            className="purchase-text-input"
                            type="text"
                            value={editInput}
                            placeholder="Optional"
                            onChange={(event) => handleEditInputChange(event.target.value)}
                          />
                        ) : (
                          line.expiryDate
                        )
                      ) : (
                        ''
                      )}
                    </td>

                    {/* AMOUNT */}
                    <td className="number-cell amount-cell">
                      {line.amountPaise > 0 ? formatMoney(line.amountPaise) : ''}
                    </td>
                  </tr>
                )
              })}

              {Array.from({
                length: Math.max(8, 12 - lines.length)
              }).map((_, index) => (
                <tr key={`empty-${index}`} className="empty-row">
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="purchase-footer">
          <span>F2 Add Item</span>
          <span>Enter Next</span>
          <span>F4 Supplier</span>
          <span>F9 History</span>
          <span>Delete Remove</span>
          <span>F6 Save</span>
          <span>Esc Back</span>
        </div>

        {productNotFound && (
          <div className="purchase-not-found">
            Product not found. Scan again or press Enter on an empty product field to open Item
            Master.
          </div>
        )}

        {saveMessage && <div className="purchase-error">{saveMessage}</div>}
      </div>

      {/* LOWER HALF */}
      <div className="purchase-bottom-panel">
        {/* OLD VS NEW */}
        <section className="purchase-product-details">
          <div className="purchase-section-title">
            SELECTED PRODUCT
            {selectedLine?.productName ? ` : ${selectedLine.productName}` : ''}
          </div>

          {selectedLine?.productId ? (
            <table className="purchase-comparison-table">
              <thead>
                <tr>
                  <th />
                  <th>MRP</th>
                  <th>PURCHASE</th>
                  <th>SELLING</th>
                  <th>PROFIT</th>
                  <th>MARGIN</th>
                </tr>
              </thead>

              <tbody>
                {/* OLD */}
                <tr>
                  <td className="comparison-label">OLD</td>

                  <td>₹{formatMoney(selectedLine.oldMrpPaise)}</td>

                  <td>₹{formatMoney(selectedLine.oldPurchaseRatePaise)}</td>

                  <td>₹{formatMoney(selectedLine.oldSellingRatePaise)}</td>

                  <td>—</td>

                  <td>—</td>
                </tr>

                {/* NEW */}
                <tr className="comparison-new-row">
                  <td className="comparison-label">NEW</td>

                  <td>₹{formatMoney(selectedLine.mrpPaise)}</td>

                  <td>₹{formatMoney(selectedLine.purchaseRatePaise)}</td>

                  <td>₹{formatMoney(selectedLine.sellingRatePaise)}</td>

                  <td>
                    {selectedLine.purchaseRatePaise > 0 ? `₹${formatMoney(newProfitPaise)}` : '—'}
                  </td>

                  <td>{newMargin !== null ? formatPercent(newMargin) : '—'}</td>
                </tr>

                {/* CHANGE */}
                <tr className="comparison-change-row">
                  <td className="comparison-label">CHANGE</td>

                  <td>{formatSignedMoney(selectedLine.mrpPaise - selectedLine.oldMrpPaise)}</td>

                  <td>
                    {formatSignedMoney(
                      selectedLine.purchaseRatePaise - selectedLine.oldPurchaseRatePaise
                    )}
                  </td>

                  <td>
                    {formatSignedMoney(
                      selectedLine.sellingRatePaise - selectedLine.oldSellingRatePaise
                    )}
                  </td>

                  <td>—</td>

                  <td>—</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="purchase-no-selection">
              Select a product to view OLD vs NEW pricing and margin.
            </div>
          )}
        </section>

        {/* PURCHASE SUMMARY */}
        <section className="purchase-summary-panel">
          <div className="purchase-section-title">PURCHASE SUMMARY</div>

          <div className="purchase-summary-row">
            <span>SUBTOTAL</span>

            <strong>₹{formatMoney(subtotalPaise)}</strong>
          </div>

          <div className="purchase-summary-row">
            <span>TAX</span>

            <input
              ref={taxInputRef}
              className="purchase-summary-input"
              value={taxInput}
              onChange={(event) => {
                setTaxInput(event.target.value)
                setFinalizeStep('TAX')
              }}
              onKeyDown={(event) => {
                event.stopPropagation()

                if (event.key === 'F6') {
                  event.preventDefault()

                  setFinalizeStep('DISCOUNT')

                  requestAnimationFrame(() => {
                    discountInputRef.current?.focus()
                    discountInputRef.current?.select()
                  })
                }
              }}
            />
          </div>

          <div className="purchase-summary-row">
            <span>DISCOUNT</span>

            <input
              ref={discountInputRef}
              className="purchase-summary-input"
              value={discountInput}
              onChange={(event) => {
                setDiscountInput(event.target.value)
                setFinalizeStep('DISCOUNT')
              }}
              onKeyDown={(event) => {
                event.stopPropagation()

                if (event.key === 'F6') {
                  event.preventDefault()

                  setFinalizeStep('PAYMENT')
                  setShowPayment(true)
                }
              }}
            />
          </div>

          <div className="purchase-summary-total">
            <span>TOTAL AMOUNT</span>

            <strong>₹{formatMoney(totalPaise)}</strong>
          </div>
        </section>
      </div>

      {/* EXISTING QUICK SUMMARY */}
      <div className="purchase-summary">
        <div>
          <span>ITEMS</span>
          <strong>{purchaseLines.length}</strong>
        </div>

        <div>
          <span>QTY</span>
          <strong>{totalPaidQuantity}</strong>
        </div>

        <div>
          <span>FREE</span>
          <strong>{totalFreeQuantity}</strong>
        </div>

        <div className="purchase-total">
          <span>TOTAL</span>
          <strong>₹{formatMoney(totalPaise)}</strong>
        </div>
      </div>
      {showLeaveConfirmation && (
        <ConfirmationDialog
          title="Leave Purchase Entry?"
          message="This purchase has unsaved changes. Do you want to leave without saving?"
          confirmText="Yes"
          cancelText="No"
          variant="warning"
          onConfirm={() => {
            setShowLeaveConfirmation(false)
            setFinalizeStep(null)
            onBack()
          }}
          onCancel={() => {
            setShowLeaveConfirmation(false)
          }}
        />
      )}
    </div>
  )
}
