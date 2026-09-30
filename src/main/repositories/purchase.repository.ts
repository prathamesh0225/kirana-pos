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
