//purchase.repository.ts
import { getDatabase } from '../database'

export type PurchaseLineInput = {
  productId: number
  mrpPaise: number
  purchaseRatePaise: number
  sellingRatePaise: number
  quantity: number
  freeQuantity: number
  batchNumber: string | null
  expiryDate: string | null
  amountPaise: number
}

export type CreatePurchaseInput = {
  supplierId: number
  invoiceNumber: string
  purchaseDate: string

  subtotalPaise: number
  taxPaise: number
  discountPaise: number
  totalAmountPaise: number

  paymentMethod: 'CASH' | 'UPI' | 'CREDIT'
  paidPaise: number

  lines: PurchaseLineInput[]
}

export type PurchaseResult = {
  purchaseId: number
  invoiceNumber: string
  totalAmountPaise: number
  paidPaise: number
  balancePaise: number
  paymentMethod: 'CASH' | 'UPI' | 'CREDIT'
}

export type PurchaseHistoryRow = {
  id: number
  invoiceNumber: string
  purchaseDate: string
  supplierId: number
  supplierName: string
  subtotalPaise: number
  discountPaise: number
  taxPaise: number
  totalAmountPaise: number
  paidPaise: number
  balancePaise: number
  paymentMethod: 'CASH' | 'UPI' | 'CREDIT'
}

export type PurchaseDetail = {
  id: number
  invoiceNumber: string
  purchaseDate: string
  supplierId: number
  supplierName: string
  subtotalPaise: number
  discountPaise: number
  taxPaise: number
  totalAmountPaise: number
  paidPaise: number
  balancePaise: number
  paymentMethod: 'CASH' | 'UPI' | 'CREDIT'
  lines: Array<{
    id: number
    productId: number
    productName: string
    barcode: string | null
    batchId: number
    batchNumber: string | null
    expiryDate: string | null
    mrpPaise: number
    purchaseRatePaise: number
    sellingRatePaise: number
    quantity: number
    freeQuantity: number
    amountPaise: number
  }>
}

export type StockBatchRecord = {
  id: number
  productId: number
  batchNumber: string | null
  expiryDate: string | null
  mrpPaise: number
  purchaseRatePaise: number
  sellingRatePaise: number
  quantity: number
}

type ProductRow = {
  id: number
  name: string
  barcode: string | null
  mrp_paise: number
  selling_price_paise: number
  purchase_price_paise: number
  stock_quantity: number
  quantity_precision: number
  is_active: number
}

function validateDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Invalid purchase date.')
  }
}

function validateNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`)
  }
}

function validateQuantity(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`)
  }
}

function validateOptionalQuantity(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} cannot be negative.`)
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''

  return trimmed === '' ? null : trimmed
}

export function createPurchase(input: CreatePurchaseInput): PurchaseResult {
  const db = getDatabase()

  if (!Number.isInteger(input.supplierId) || input.supplierId <= 0) {
    throw new Error('Invalid supplier.')
  }

  const invoiceNumber = input.invoiceNumber.trim()

  if (!invoiceNumber) {
    throw new Error('Supplier invoice number is required.')
  }

  validateDate(input.purchaseDate)

  if (!['CASH', 'UPI', 'CREDIT'].includes(input.paymentMethod)) {
    throw new Error('Invalid payment method.')
  }

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error('Purchase must contain at least one item.')
  }

  const lines = input.lines

  /*
   * ---------------------------------------------------------
   * Calculate subtotal from purchase lines.
   *
   * Free quantity increases stock but does NOT increase
   * the purchase invoice amount.
   * ---------------------------------------------------------
   */

  const subtotalPaise = lines.reduce((total, line) => {
    validateNonNegativeInteger(line.mrpPaise, 'MRP')
    validateNonNegativeInteger(line.purchaseRatePaise, 'Purchase rate')
    validateNonNegativeInteger(line.sellingRatePaise, 'Selling rate')

    validateQuantity(line.quantity, 'Quantity')
    validateOptionalQuantity(line.freeQuantity, 'Free quantity')

    const calculatedAmountPaise = Math.round(line.purchaseRatePaise * line.quantity)

    return total + calculatedAmountPaise
  }, 0)

  if (subtotalPaise <= 0) {
    throw new Error('Purchase subtotal must be greater than zero.')
  }

  /*
   * ---------------------------------------------------------
   * Tax
   * ---------------------------------------------------------
   */

  const taxPaise = input.taxPaise

  if (!Number.isInteger(taxPaise) || taxPaise < 0) {
    throw new Error('Invalid tax amount.')
  }

  /*
   * ---------------------------------------------------------
   * Discount
   * ---------------------------------------------------------
   */

  const discountPaise = input.discountPaise

  if (!Number.isInteger(discountPaise) || discountPaise < 0) {
    throw new Error('Invalid discount amount.')
  }

  if (discountPaise > subtotalPaise + taxPaise) {
    throw new Error('Discount cannot exceed purchase total.')
  }

  /*
   * ---------------------------------------------------------
   * Final total
   *
   * Total = Subtotal + Tax - Discount
   * ---------------------------------------------------------
   */

  const totalAmountPaise = subtotalPaise + taxPaise - discountPaise

  if (totalAmountPaise <= 0) {
    throw new Error('Purchase total must be greater than zero.')
  }

  /*
   * Verify that the total calculated by the backend matches
   * the total supplied by the Purchase Entry screen.
   */
  if (!Number.isInteger(input.totalAmountPaise) || input.totalAmountPaise !== totalAmountPaise) {
    throw new Error('Purchase total does not match the purchase lines.')
  }

  /*
   * ---------------------------------------------------------
   * Payment
   * ---------------------------------------------------------
   */

  let paidPaise = input.paidPaise

  if (!Number.isInteger(paidPaise) || paidPaise < 0) {
    throw new Error('Invalid paid amount.')
  }

  if (input.paymentMethod === 'CASH' || input.paymentMethod === 'UPI') {
    if (paidPaise !== totalAmountPaise) {
      throw new Error('Cash/UPI purchase must be paid in full.')
    }
  }

  if (input.paymentMethod === 'CREDIT') {
    paidPaise = 0
  }

  if (paidPaise > totalAmountPaise) {
    throw new Error('Paid amount cannot exceed purchase total.')
  }

  const balancePaise = totalAmountPaise - paidPaise

  /*
   * ---------------------------------------------------------
   * Database transaction
   * ---------------------------------------------------------
   */

  const transaction = db.transaction(() => {
    /*
     * -------------------------------------------------------
     * Validate supplier
     * -------------------------------------------------------
     */

    const supplier = db
      .prepare(
        `
          SELECT id
          FROM suppliers
          WHERE id = ?
            AND is_active = 1
        `
      )
      .get(input.supplierId) as { id: number } | undefined

    if (!supplier) {
      throw new Error('Supplier not found or disabled.')
    }

    /*
     * -------------------------------------------------------
     * Purchase invoice
     * -------------------------------------------------------
     */

    const purchaseInsert = db.prepare(
      `
        INSERT INTO purchase_invoices (
          invoice_number,
          supplier_id,
          purchase_date,
          subtotal_paise,
          discount_paise,
          tax_paise,
          total_amount_paise,
          paid_paise,
          balance_paise,
          payment_method,
          notes,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
      `
    )

    const now = new Date().toISOString()

    const purchaseResult = purchaseInsert.run(
      invoiceNumber,
      input.supplierId,
      input.purchaseDate,
      subtotalPaise,
      discountPaise,
      taxPaise,
      totalAmountPaise,
      paidPaise,
      balancePaise,
      input.paymentMethod,
      now,
      now
    )

    const purchaseId = Number(purchaseResult.lastInsertRowid)

    /*
     * -------------------------------------------------------
     * Product lookup
     * -------------------------------------------------------
     */

    const productQuery = db.prepare(
      `
        SELECT
          id,
          name,
          barcode,
          mrp_paise,
          selling_price_paise,
          purchase_price_paise,
          stock_quantity,
          quantity_precision,
          is_active
        FROM products
        WHERE id = ?
      `
    )

    /*
     * -------------------------------------------------------
     * Create stock batch
     * -------------------------------------------------------
     */

    const insertBatch = db.prepare(
      `
        INSERT INTO stock_batches (
          product_id,
          batch_number,
          expiry_date,
          mrp_paise,
          purchase_rate_paise,
          selling_rate_paise,
          quantity,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )

    /*
     * -------------------------------------------------------
     * Update existing stock batch
     * -------------------------------------------------------
     */

    const updateBatch = db.prepare(
      `
        UPDATE stock_batches
        SET quantity = quantity + ?,
            updated_at = ?
        WHERE id = ?
      `
    )

    /*
     * -------------------------------------------------------
     * Find matching batch
     * -------------------------------------------------------
     */

    const findBatch = db.prepare(
      `
        SELECT id
        FROM stock_batches
        WHERE product_id = ?
          AND (
            (batch_number = ?)
            OR (batch_number IS NULL AND ? IS NULL)
          )
          AND (
            (expiry_date = ?)
            OR (expiry_date IS NULL AND ? IS NULL)
          )
          AND mrp_paise = ?
          AND purchase_rate_paise = ?
          AND selling_rate_paise = ?
        LIMIT 1
      `
    )

    /*
     * -------------------------------------------------------
     * Purchase item
     * -------------------------------------------------------
     */

    const insertPurchaseItem = db.prepare(
      `
        INSERT INTO purchase_items (
          purchase_invoice_id,
          product_id,
          batch_id,
          mrp_paise,
          purchase_rate_paise,
          selling_rate_paise,
          quantity,
          free_quantity,
          amount_paise,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )

    /*
     * -------------------------------------------------------
     * Update product stock and current pricing
     * -------------------------------------------------------
     */

    const updateProduct = db.prepare(
      `
        UPDATE products
        SET
          stock_quantity = stock_quantity + ?,
          purchase_price_paise = ?,
          selling_price_paise = ?,
          mrp_paise = ?,
          updated_at = ?
        WHERE id = ?
      `
    )

    /*
     * -------------------------------------------------------
     * Stock movement
     * -------------------------------------------------------
     */

    const insertMovement = db.prepare(
      `
        INSERT INTO stock_movements (
          product_id,
          movement_type,
          quantity,
          reference_type,
          reference_id,
          movement_date,
          notes,
          reason,
          batch_id
        )
        VALUES (?, 'PURCHASE', ?, 'PURCHASE', ?, ?, ?, ?, ?)
      `
    )

    /*
     * -------------------------------------------------------
     * Process purchase lines
     * -------------------------------------------------------
     */

    for (const line of lines) {
      const product = productQuery.get(line.productId) as ProductRow | undefined

      if (!product || product.is_active !== 1) {
        throw new Error(`Product ${line.productId} was not found or is disabled.`)
      }

      const precision = product.quantity_precision

      if (precision === 0) {
        if (!Number.isInteger(line.quantity) || !Number.isInteger(line.freeQuantity)) {
          throw new Error(`Invalid quantity for "${product.name}".`)
        }
      }

      const batchNumber = normalizeOptionalText(line.batchNumber)
      const expiryDate = normalizeOptionalText(line.expiryDate)

      let batchId: number

      /*
       * -----------------------------------------------------
       * Find existing matching batch
       * -----------------------------------------------------
       */

      const existingBatch = findBatch.get(
        product.id,
        batchNumber,
        batchNumber,
        expiryDate,
        expiryDate,
        line.mrpPaise,
        line.purchaseRatePaise,
        line.sellingRatePaise
      ) as { id: number } | undefined

      /*
       * Physical stock includes free quantity.
       */
      const physicalQuantity = line.quantity + line.freeQuantity

      if (existingBatch) {
        batchId = existingBatch.id

        updateBatch.run(physicalQuantity, now, batchId)
      } else {
        const batchResult = insertBatch.run(
          product.id,
          batchNumber,
          expiryDate,
          line.mrpPaise,
          line.purchaseRatePaise,
          line.sellingRatePaise,
          physicalQuantity,
          now,
          now
        )

        batchId = Number(batchResult.lastInsertRowid)
      }

      /*
       * -----------------------------------------------------
       * Calculate line amount.
       *
       * Free quantity does NOT add to invoice amount.
       * -----------------------------------------------------
       */

      const lineAmountPaise = Math.round(line.purchaseRatePaise * line.quantity)

      /*
       * -----------------------------------------------------
       * Save purchase item
       * -----------------------------------------------------
       */

      insertPurchaseItem.run(
        purchaseId,
        product.id,
        batchId,
        line.mrpPaise,
        line.purchaseRatePaise,
        line.sellingRatePaise,
        line.quantity,
        line.freeQuantity,
        lineAmountPaise,
        now
      )

      /*
       * -----------------------------------------------------
       * Update product stock and current pricing
       * -----------------------------------------------------
       */

      updateProduct.run(
        physicalQuantity,
        line.purchaseRatePaise,
        line.sellingRatePaise,
        line.mrpPaise,
        now,
        product.id
      )

      /*
       * -----------------------------------------------------
       * Record stock movement
       * -----------------------------------------------------
       */

      insertMovement.run(
        product.id,
        physicalQuantity,
        purchaseId,
        now,
        `Purchase ${invoiceNumber}`,
        'Purchase received',
        batchId
      )
    }

    /*
     * -------------------------------------------------------
     * Return purchase result
     * -------------------------------------------------------
     */

    return {
      purchaseId,
      invoiceNumber,
      totalAmountPaise,
      paidPaise,
      balancePaise,
      paymentMethod: input.paymentMethod
    }
  })

  return transaction()
}

export function listPurchases(limit = 100): PurchaseHistoryRow[] {
  const db = getDatabase()

  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)))

  return db
    .prepare(
      `
        SELECT
          pi.id,
          pi.invoice_number,
          pi.purchase_date,
          pi.supplier_id,
          s.name AS supplier_name,
          pi.subtotal_paise,
          pi.discount_paise,
          pi.tax_paise,
          pi.total_amount_paise,
          pi.paid_paise,
          pi.balance_paise,
          pi.payment_method
        FROM purchase_invoices pi
        INNER JOIN suppliers s
          ON s.id = pi.supplier_id
        ORDER BY
          pi.purchase_date DESC,
          pi.id DESC
        LIMIT ?
      `
    )
    .all(safeLimit)
    .map((row) => {
      const value = row as {
        id: number
        invoice_number: string
        purchase_date: string
        supplier_id: number
        supplier_name: string
        subtotal_paise: number
        discount_paise: number
        tax_paise: number
        total_amount_paise: number
        paid_paise: number
        balance_paise: number
        payment_method: 'CASH' | 'UPI' | 'CREDIT'
      }

      return {
        id: value.id,
        invoiceNumber: value.invoice_number,
        purchaseDate: value.purchase_date,
        supplierId: value.supplier_id,
        supplierName: value.supplier_name,
        subtotalPaise: value.subtotal_paise,
        discountPaise: value.discount_paise,
        taxPaise: value.tax_paise,
        totalAmountPaise: value.total_amount_paise,
        paidPaise: value.paid_paise,
        balancePaise: value.balance_paise,
        paymentMethod: value.payment_method
      }
    })
}

export function getPurchaseById(purchaseId: number): PurchaseDetail | null {
  const db = getDatabase()

  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new Error('Invalid purchase ID.')
  }

  const invoice = db
    .prepare(
      `
        SELECT
          pi.id,
          pi.invoice_number,
          pi.purchase_date,
          pi.supplier_id,
          s.name AS supplier_name,
          pi.subtotal_paise,
          pi.discount_paise,
          pi.tax_paise,
          pi.total_amount_paise,
          pi.paid_paise,
          pi.balance_paise,
          pi.payment_method
        FROM purchase_invoices pi
        INNER JOIN suppliers s
          ON s.id = pi.supplier_id
        WHERE pi.id = ?
      `
    )
    .get(purchaseId) as
    | {
        id: number
        invoice_number: string
        purchase_date: string
        supplier_id: number
        supplier_name: string
        subtotal_paise: number
        discount_paise: number
        tax_paise: number
        total_amount_paise: number
        paid_paise: number
        balance_paise: number
        payment_method: 'CASH' | 'UPI' | 'CREDIT'
      }
    | undefined

  if (!invoice) {
    return null
  }

  const lines = db
    .prepare(
      `
        SELECT
          pui.id,
          pui.product_id,
          p.name AS product_name,
          p.barcode,
          pui.batch_id,
          sb.batch_number,
          sb.expiry_date,
          pui.mrp_paise,
          pui.purchase_rate_paise,
          pui.selling_rate_paise,
          pui.quantity,
          pui.free_quantity,
          pui.amount_paise
        FROM purchase_items pui
        INNER JOIN products p
          ON p.id = pui.product_id
        INNER JOIN stock_batches sb
          ON sb.id = pui.batch_id
        WHERE pui.purchase_invoice_id = ?
        ORDER BY pui.id ASC
      `
    )
    .all(purchaseId) as Array<{
    id: number
    product_id: number
    product_name: string
    barcode: string | null
    batch_id: number
    batch_number: string | null
    expiry_date: string | null
    mrp_paise: number
    purchase_rate_paise: number
    selling_rate_paise: number
    quantity: number
    free_quantity: number
    amount_paise: number
  }>

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    purchaseDate: invoice.purchase_date,
    supplierId: invoice.supplier_id,
    supplierName: invoice.supplier_name,
    subtotalPaise: invoice.subtotal_paise,
    discountPaise: invoice.discount_paise,
    taxPaise: invoice.tax_paise,
    totalAmountPaise: invoice.total_amount_paise,
    paidPaise: invoice.paid_paise,
    balancePaise: invoice.balance_paise,
    paymentMethod: invoice.payment_method,

    lines: lines.map((line) => ({
      id: line.id,
      productId: line.product_id,
      productName: line.product_name,
      barcode: line.barcode,
      batchId: line.batch_id,
      batchNumber: line.batch_number,
      expiryDate: line.expiry_date,
      mrpPaise: line.mrp_paise,
      purchaseRatePaise: line.purchase_rate_paise,
      sellingRatePaise: line.selling_rate_paise,
      quantity: line.quantity,
      freeQuantity: line.free_quantity,
      amountPaise: line.amount_paise
    }))
  }
}

export function updatePurchase(purchaseId: number, input: CreatePurchaseInput): PurchaseResult {
  const db = getDatabase()

  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new Error('Invalid purchase ID.')
  }

  if (!input) {
    throw new Error('Purchase data is required.')
  }

  if (!Number.isInteger(input.supplierId) || input.supplierId <= 0) {
    throw new Error('Invalid supplier.')
  }

  const invoiceNumber = input.invoiceNumber.trim()

  if (!invoiceNumber) {
    throw new Error('Supplier invoice number is required.')
  }

  validateDate(input.purchaseDate)

  if (!['CASH', 'UPI', 'CREDIT'].includes(input.paymentMethod)) {
    throw new Error('Invalid payment method.')
  }

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error('Purchase must contain at least one item.')
  }

  const subtotalPaise = input.lines.reduce((total, line) => {
    validateNonNegativeInteger(line.mrpPaise, 'MRP')
    validateNonNegativeInteger(line.purchaseRatePaise, 'Purchase rate')
    validateNonNegativeInteger(line.sellingRatePaise, 'Selling rate')

    validateQuantity(line.quantity, 'Quantity')
    validateOptionalQuantity(line.freeQuantity, 'Free quantity')

    return total + Math.round(line.purchaseRatePaise * line.quantity)
  }, 0)

  if (subtotalPaise <= 0) {
    throw new Error('Purchase subtotal must be greater than zero.')
  }

  const taxPaise = input.taxPaise

  if (!Number.isInteger(taxPaise) || taxPaise < 0) {
    throw new Error('Invalid tax amount.')
  }

  const discountPaise = input.discountPaise

  if (!Number.isInteger(discountPaise) || discountPaise < 0) {
    throw new Error('Invalid discount amount.')
  }

  if (discountPaise > subtotalPaise + taxPaise) {
    throw new Error('Discount cannot exceed purchase total.')
  }

  const totalAmountPaise = subtotalPaise + taxPaise - discountPaise

  if (totalAmountPaise <= 0) {
    throw new Error('Purchase total must be greater than zero.')
  }

  if (!Number.isInteger(input.totalAmountPaise) || input.totalAmountPaise !== totalAmountPaise) {
    throw new Error('Purchase total does not match the purchase lines.')
  }

  if (totalAmountPaise <= 0) {
    throw new Error('Purchase total must be greater than zero.')
  }

  let paidPaise = input.paidPaise

  if (!Number.isInteger(paidPaise) || paidPaise < 0) {
    throw new Error('Invalid paid amount.')
  }

  if (input.paymentMethod === 'CASH' || input.paymentMethod === 'UPI') {
    if (paidPaise !== totalAmountPaise) {
      throw new Error('Cash/UPI purchase must be paid in full.')
    }
  }

  if (input.paymentMethod === 'CREDIT') {
    paidPaise = 0
  }

  if (paidPaise > totalAmountPaise) {
    throw new Error('Paid amount cannot exceed purchase total.')
  }

  const balancePaise = totalAmountPaise - paidPaise

  const transaction = db.transaction(() => {
    const existingPurchase = db
      .prepare(
        `
          SELECT id
          FROM purchase_invoices
          WHERE id = ?
        `
      )
      .get(purchaseId) as { id: number } | undefined

    if (!existingPurchase) {
      throw new Error('Purchase not found.')
    }

    const supplier = db
      .prepare(
        `
          SELECT id
          FROM suppliers
          WHERE id = ?
            AND is_active = 1
        `
      )
      .get(input.supplierId) as { id: number } | undefined

    if (!supplier) {
      throw new Error('Supplier not found or disabled.')
    }

    /*
     * First reverse the stock effect of the old purchase.
     */
    const oldItems = db
      .prepare(
        `
          SELECT
            id,
            product_id,
            batch_id,
            quantity,
            free_quantity
          FROM purchase_items
          WHERE purchase_invoice_id = ?
        `
      )
      .all(purchaseId) as Array<{
      id: number
      product_id: number
      batch_id: number
      quantity: number
      free_quantity: number
    }>

    const reverseBatch = db.prepare(
      `
        UPDATE stock_batches
        SET
          quantity = quantity - ?,
          updated_at = ?
        WHERE id = ?
      `
    )

    const reverseProduct = db.prepare(
      `
        UPDATE products
        SET
          stock_quantity = stock_quantity - ?,
          updated_at = ?
        WHERE id = ?
      `
    )

    const now = new Date().toISOString()

    for (const item of oldItems) {
      const physicalQuantity = item.quantity + item.free_quantity

      const batch = db
        .prepare(
          `
            SELECT id, quantity
            FROM stock_batches
            WHERE id = ?
          `
        )
        .get(item.batch_id) as
        | {
            id: number
            quantity: number
          }
        | undefined

      if (!batch) {
        throw new Error(`Batch ${item.batch_id} was not found.`)
      }

      if (batch.quantity < physicalQuantity) {
        throw new Error(
          'This purchase cannot be modified because some of its stock has already been consumed.'
        )
      }

      reverseBatch.run(physicalQuantity, now, item.batch_id)

      reverseProduct.run(physicalQuantity, now, item.product_id)
    }

    /*
     * Remove the old purchase stock movements.
     *
     * The purchase itself is being replaced, so the stock ledger is
     * rebuilt from the corrected purchase.
     */
    db.prepare(
      `
        DELETE FROM stock_movements
        WHERE reference_type = 'PURCHASE'
          AND reference_id = ?
      `
    ).run(purchaseId)

    /*
     * Remove old purchase items.
     */
    db.prepare(
      `
        DELETE FROM purchase_items
        WHERE purchase_invoice_id = ?
      `
    ).run(purchaseId)

    /*
     * Update invoice header.
     *
     * Keep the existing schema behavior:
     * subtotal = total before tax/discount,
     * tax = 0,
     * discount = 0.
     */
    db.prepare(
      `
        UPDATE purchase_invoices
        SET
          invoice_number = ?,
          supplier_id = ?,
          purchase_date = ?,
          subtotal_paise = ?,
          discount_paise = ?,
          tax_paise = ?,
          total_amount_paise = ?,
          paid_paise = ?,
          balance_paise = ?,
          payment_method = ?,
          updated_at = ?
        WHERE id = ?
      `
    ).run(
      invoiceNumber,
      input.supplierId,
      input.purchaseDate,
      subtotalPaise,
      discountPaise,
      taxPaise,
      totalAmountPaise,
      paidPaise,
      balancePaise,
      input.paymentMethod,
      now,
      purchaseId
    )

    const productQuery = db.prepare(
      `
        SELECT
          id,
          name,
          quantity_precision,
          is_active
        FROM products
        WHERE id = ?
      `
    )

    const findBatch = db.prepare(
      `
        SELECT id
        FROM stock_batches
        WHERE product_id = ?
          AND (
            (batch_number = ?)
            OR (batch_number IS NULL AND ? IS NULL)
          )
          AND (
            (expiry_date = ?)
            OR (expiry_date IS NULL AND ? IS NULL)
          )
          AND mrp_paise = ?
          AND purchase_rate_paise = ?
          AND selling_rate_paise = ?
        LIMIT 1
      `
    )

    const updateBatch = db.prepare(
      `
        UPDATE stock_batches
        SET
          quantity = quantity + ?,
          updated_at = ?
        WHERE id = ?
      `
    )

    const insertBatch = db.prepare(
      `
        INSERT INTO stock_batches (
          product_id,
          batch_number,
          expiry_date,
          mrp_paise,
          purchase_rate_paise,
          selling_rate_paise,
          quantity,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )

    const insertPurchaseItem = db.prepare(
      `
        INSERT INTO purchase_items (
          purchase_invoice_id,
          product_id,
          batch_id,
          mrp_paise,
          purchase_rate_paise,
          selling_rate_paise,
          quantity,
          free_quantity,
          amount_paise,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )

    const updateProduct = db.prepare(
      `
        UPDATE products
        SET
          stock_quantity = stock_quantity + ?,
          purchase_price_paise = ?,
          selling_price_paise = ?,
          mrp_paise = ?,
          updated_at = ?
        WHERE id = ?
      `
    )

    const insertMovement = db.prepare(
      `
        INSERT INTO stock_movements (
          product_id,
          movement_type,
          quantity,
          reference_type,
          reference_id,
          movement_date,
          notes,
          reason,
          batch_id
        )
        VALUES (?, 'PURCHASE', ?, 'PURCHASE', ?, ?, ?, ?, ?)
      `
    )

    for (const line of input.lines) {
      const product = productQuery.get(line.productId) as
        | {
            id: number
            name: string
            quantity_precision: number
            is_active: number
          }
        | undefined

      if (!product || product.is_active !== 1) {
        throw new Error(`Product ${line.productId} was not found or is disabled.`)
      }

      if (product.quantity_precision === 0) {
        if (!Number.isInteger(line.quantity) || !Number.isInteger(line.freeQuantity)) {
          throw new Error(`Invalid quantity for "${product.name}".`)
        }
      }

      const batchNumber = normalizeOptionalText(line.batchNumber)
      const expiryDate = normalizeOptionalText(line.expiryDate)

      const physicalQuantity = line.quantity + line.freeQuantity

      const existingBatch = findBatch.get(
        product.id,
        batchNumber,
        batchNumber,
        expiryDate,
        expiryDate,
        line.mrpPaise,
        line.purchaseRatePaise,
        line.sellingRatePaise
      ) as { id: number } | undefined

      let batchId: number

      if (existingBatch) {
        batchId = existingBatch.id

        updateBatch.run(physicalQuantity, now, batchId)
      } else {
        const batchResult = insertBatch.run(
          product.id,
          batchNumber,
          expiryDate,
          line.mrpPaise,
          line.purchaseRatePaise,
          line.sellingRatePaise,
          physicalQuantity,
          now,
          now
        )

        batchId = Number(batchResult.lastInsertRowid)
      }

      insertPurchaseItem.run(
        purchaseId,
        product.id,
        batchId,
        line.mrpPaise,
        line.purchaseRatePaise,
        line.sellingRatePaise,
        line.quantity,
        line.freeQuantity,
        line.amountPaise,
        now
      )

      updateProduct.run(
        physicalQuantity,
        line.purchaseRatePaise,
        line.sellingRatePaise,
        line.mrpPaise,
        now,
        product.id
      )

      insertMovement.run(
        product.id,
        physicalQuantity,
        purchaseId,
        now,
        `Purchase ${invoiceNumber}`,
        'Purchase received',
        batchId
      )
    }

    return {
      purchaseId,
      invoiceNumber,
      totalAmountPaise,
      paidPaise,
      balancePaise,
      paymentMethod: input.paymentMethod
    }
  })

  return transaction()
}

export function getAvailableBatchesForProduct(productId: number): StockBatchRecord[] {
  const db = getDatabase()

  const rows = db
    .prepare(
      `
      SELECT
        id,
        product_id,
        batch_number,
        expiry_date,
        mrp_paise,
        purchase_rate_paise,
        selling_rate_paise,
        quantity
      FROM stock_batches
      WHERE product_id = ?
        AND quantity > 0
      ORDER BY
        CASE
          WHEN expiry_date IS NULL OR expiry_date = '' THEN 1
          ELSE 0
        END,
        expiry_date ASC,
        id ASC
      `
    )
    .all(productId) as Array<{
    id: number
    product_id: number
    batch_number: string | null
    expiry_date: string | null
    mrp_paise: number
    purchase_rate_paise: number
    selling_rate_paise: number
    quantity: number
  }>

  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    batchNumber: row.batch_number,
    expiryDate: row.expiry_date,
    mrpPaise: row.mrp_paise,
    purchaseRatePaise: row.purchase_rate_paise,
    sellingRatePaise: row.selling_rate_paise,
    quantity: row.quantity
  }))
}

export function getStockBatchById(batchId: number): StockBatchRecord | undefined {
  const db = getDatabase()

  const row = db
    .prepare(
      `
      SELECT
        id,
        product_id,
        batch_number,
        expiry_date,
        mrp_paise,
        purchase_rate_paise,
        selling_rate_paise,
        quantity
      FROM stock_batches
      WHERE id = ?
      LIMIT 1
      `
    )
    .get(batchId) as
    | {
        id: number
        product_id: number
        batch_number: string | null
        expiry_date: string | null
        mrp_paise: number
        purchase_rate_paise: number
        selling_rate_paise: number
        quantity: number
      }
    | undefined

  if (!row) {
    return undefined
  }

  return {
    id: row.id,
    productId: row.product_id,
    batchNumber: row.batch_number,
    expiryDate: row.expiry_date,
    mrpPaise: row.mrp_paise,
    purchaseRatePaise: row.purchase_rate_paise,
    sellingRatePaise: row.selling_rate_paise,
    quantity: row.quantity
  }
}
