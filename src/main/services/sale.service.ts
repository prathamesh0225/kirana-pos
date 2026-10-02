import { getDatabase } from '../database'
import { getTodaySalesSummary } from '../repositories/sale.repository'

export type TodaySalesSummary = {
  totalSalesPaise: number
  billsToday: number
}

export function getDashboardSalesSummary(): TodaySalesSummary {
  const db = getDatabase()

  const now = new Date()

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

  const startOfNextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)

  return getTodaySalesSummary(db, startOfDay.toISOString(), startOfNextDay.toISOString())
}

export type CompleteSaleLine = {
  productId: number | null

  /*
   * null/undefined = sell from normal item-master stock.
   *
   * A value = manually selected stock batch.
   *
   * IMPORTANT:
   * We never automatically select a batch here.
   */
  batchId?: number | null

  productName: string
  barcode: string | null
  mrpPaise: number
  quantity: number
  freeQuantity: number
  ratePaise: number
  amountPaise: number
}

export type CompleteSalePayment = {
  mode: 'cash' | 'upi' | 'mixed'
  cashPaise: number
  upiPaise: number
  paidPaise: number
  changePaise: number
}

export type CompleteSaleInput = {
  billNumber: string
  customerId?: number | null
  customerName: string
  customerMobile: string
  lines: CompleteSaleLine[]
  payment: CompleteSalePayment
}

export type CompleteSaleResult = {
  saleId: number
  billNumber: string
}

export function completeSale(input: CompleteSaleInput): CompleteSaleResult {
  const db = getDatabase()

  const transaction = db.transaction(() => {
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Cannot complete an empty bill')
    }

    const totalPaise = input.lines.reduce((total, line) => total + line.amountPaise, 0)

    if (totalPaise <= 0) {
      throw new Error('Bill total must be greater than zero')
    }

    if (input.payment.paidPaise < totalPaise) {
      throw new Error('Payment is less than the bill total')
    }

    /*
     * ---------------------------------------------------------
     * Validate every line before writing anything.
     * ---------------------------------------------------------
     */
    for (const line of input.lines) {
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        throw new Error(`Quantity must be greater than zero for ${line.productName}`)
      }

      if (!Number.isFinite(line.freeQuantity) || line.freeQuantity < 0) {
        throw new Error(`Free quantity cannot be negative for ${line.productName}`)
      }

      if (!Number.isInteger(line.ratePaise) || line.ratePaise < 0) {
        throw new Error(`Invalid rate for ${line.productName}`)
      }

      /*
       * -------------------------------------------------------
       * General Item
       *
       * productId === null means this is a temporary/general
       * billing item.
       *
       * It does not affect stock.
       * -------------------------------------------------------
       */
      if (line.productId === null) {
        continue
      }

      /*
       * -------------------------------------------------------
       * Product / Item Master validation
       * -------------------------------------------------------
       */
      const product = db
        .prepare(
          `
          SELECT
            id,
            is_active,
            stock_quantity
          FROM products
          WHERE id = ?
          `
        )
        .get(line.productId) as
        | {
            id: number
            is_active: number
            stock_quantity: number
          }
        | undefined

      if (!product) {
        throw new Error(`Product not found: ${line.productName}`)
      }

      if (product.is_active !== 1) {
        throw new Error(`Product is disabled: ${line.productName}`)
      }

      const requiredStock = line.quantity + line.freeQuantity

      /*
       * -------------------------------------------------------
       * ALWAYS validate product-level stock.
       *
       * This preserves the existing billing flow.
       *
       * If the product has no batch selected, this is the
       * stock source that will be used.
       * -------------------------------------------------------
       */
      if (product.stock_quantity < requiredStock) {
        throw new Error(`Insufficient stock for ${line.productName}`)
      }

      /*
       * -------------------------------------------------------
       * MANUAL BATCH MODE
       *
       * A batch is checked ONLY when the billing UI explicitly
       * supplies batchId.
       *
       * We DO NOT search for a batch.
       * We DO NOT select FIFO.
       * We DO NOT select FEFO.
       * We DO NOT automatically select any batch.
       * -------------------------------------------------------
       */
      if (line.batchId != null) {
        const batch = db
          .prepare(
            `
            SELECT
              id,
              product_id,
              quantity
            FROM stock_batches
            WHERE id = ?
            LIMIT 1
            `
          )
          .get(line.batchId) as
          | {
              id: number
              product_id: number
              quantity: number
            }
          | undefined

        if (!batch) {
          throw new Error(`Batch not found for ${line.productName}`)
        }

        /*
         * Prevent selecting another product's batch.
         */
        if (batch.product_id !== line.productId) {
          throw new Error(`Selected batch does not belong to ${line.productName}`)
        }

        /*
         * The selected batch itself must have enough stock.
         */
        if (batch.quantity < requiredStock) {
          throw new Error(`Insufficient batch stock for ${line.productName}`)
        }
      }

      /*
       * If batchId is null/undefined:
       *
       * No batch validation happens.
       *
       * The product is sold directly from item-master stock.
       */
    }

    const now = new Date().toISOString()

    /*
     * ---------------------------------------------------------
     * Save sale
     * ---------------------------------------------------------
     */
    const saleResult = db
      .prepare(
        `
        INSERT INTO sales (
          bill_number,
          customer_id,
          sale_date,
          subtotal_paise,
          discount_paise,
          total_paise,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(input.billNumber, input.customerId ?? null, now, totalPaise, 0, totalPaise, 'completed')

    const saleId = Number(saleResult.lastInsertRowid)

    /*
     * ---------------------------------------------------------
     * Sale item
     *
     * NOTE:
     * This keeps the existing sale_items schema unchanged.
     * batchId is tracked through stock_movements for now.
     * ---------------------------------------------------------
     */
    const insertSaleItem = db.prepare(`
      INSERT INTO sale_items (
        sale_id,
        product_id,
        product_name,
        barcode,
        mrp_paise,
        quantity,
        free_quantity,
        rate_paise,
        amount_paise
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    /*
     * ---------------------------------------------------------
     * Product stock
     *
     * Used for:
     *
     * 1. Products without a selected batch
     * 2. Products with a selected batch
     *
     * This preserves the existing product-level stock quantity.
     * ---------------------------------------------------------
     */
    const updateStock = db.prepare(`
      UPDATE products
      SET
        stock_quantity = stock_quantity - ?,
        updated_at = ?
      WHERE id = ?
    `)

    /*
     * ---------------------------------------------------------
     * Selected batch stock
     *
     * This is ONLY executed when the user manually selected
     * a batch.
     * ---------------------------------------------------------
     */
    const updateBatchStock = db.prepare(`
      UPDATE stock_batches
      SET
        quantity = quantity - ?,
        updated_at = ?
      WHERE id = ?
    `)

    /*
     * ---------------------------------------------------------
     * Stock movement
     *
     * batch_id will be:
     *
     * - selected batch ID when manually selected
     * - NULL when selling from item-master stock
     * ---------------------------------------------------------
     */
    const insertStockMovement = db.prepare(`
      INSERT INTO stock_movements (
        product_id,
        batch_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        movement_date,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    /*
     * ---------------------------------------------------------
     * Save sale lines + update stock
     * ---------------------------------------------------------
     */
    for (const line of input.lines) {
      insertSaleItem.run(
        saleId,
        line.productId,
        line.productName,
        line.barcode,
        line.mrpPaise,
        line.quantity,
        line.freeQuantity,
        line.ratePaise,
        line.amountPaise
      )

      /*
       * General Item:
       *
       * No product stock.
       * No batch stock.
       * No stock movement.
       */
      if (line.productId === null) {
        continue
      }

      const stockQuantity = line.quantity + line.freeQuantity

      /*
       * -------------------------------------------------------
       * ALWAYS update product-level stock.
       *
       * This is important because products.stock_quantity is
       * your existing item-master stock balance.
       * -------------------------------------------------------
       */
      updateStock.run(stockQuantity, now, line.productId)

      /*
       * -------------------------------------------------------
       * ONLY update a batch when the user manually selected it.
       *
       * There is intentionally NO:
       *
       * - FIFO lookup
       * - FEFO lookup
       * - first batch lookup
       * - automatic batch assignment
       * -------------------------------------------------------
       */
      if (line.batchId != null) {
        updateBatchStock.run(stockQuantity, now, line.batchId)
      }

      /*
       * -------------------------------------------------------
       * Record stock movement.
       *
       * Negative quantity means stock was consumed.
       * -------------------------------------------------------
       */
      insertStockMovement.run(
        line.productId,
        line.batchId ?? null,
        'SALE',
        -stockQuantity,
        'SALE',
        saleId,
        now,
        `Bill ${input.billNumber}`
      )
    }

    /*
     * ---------------------------------------------------------
     * Record payment
     * ---------------------------------------------------------
     *
     * We record the amount applied to the sale,
     * not the cash tendered above the total.
     * ---------------------------------------------------------
     */

    if (input.payment.mode === 'cash') {
      db.prepare(
        `
        INSERT INTO payments (
          sale_id,
          payment_method,
          amount_paise,
          payment_date
        )
        VALUES (?, ?, ?, ?)
        `
      ).run(saleId, 'CASH', totalPaise, now)
    }

    if (input.payment.mode === 'upi') {
      db.prepare(
        `
        INSERT INTO payments (
          sale_id,
          payment_method,
          amount_paise,
          payment_date
        )
        VALUES (?, ?, ?, ?)
        `
      ).run(saleId, 'UPI', totalPaise, now)
    }

    if (input.payment.mode === 'mixed') {
      const cashApplied = Math.min(input.payment.cashPaise, totalPaise)

      const upiApplied = totalPaise - cashApplied

      if (cashApplied > 0) {
        db.prepare(
          `
          INSERT INTO payments (
            sale_id,
            payment_method,
            amount_paise,
            payment_date
          )
          VALUES (?, ?, ?, ?)
          `
        ).run(saleId, 'CASH', cashApplied, now)
      }

      if (upiApplied > 0) {
        db.prepare(
          `
          INSERT INTO payments (
            sale_id,
            payment_method,
            amount_paise,
            payment_date
          )
          VALUES (?, ?, ?, ?)
          `
        ).run(saleId, 'UPI', upiApplied, now)
      }
    }

    return {
      saleId,
      billNumber: input.billNumber
    }
  })

  return transaction()
}
