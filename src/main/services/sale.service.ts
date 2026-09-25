import { getDatabase } from '../database'

export type CompleteSaleLine = {
  productId: number | null
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
    if (input.lines.length === 0) {
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
     * Validate every line before writing anything.
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
       * Real products must still exist, be active and have
       * enough stock.
       *
       * Temporary General Items do not affect stock.
       */
      if (line.productId !== null) {
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

        if (product.stock_quantity < requiredStock) {
          throw new Error(`Insufficient stock for ${line.productName}`)
        }
      }
    }

    const now = new Date().toISOString()

    /*
     * Save the sale.
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
     * Save sale lines and update stock.
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

    const updateStock = db.prepare(`
      UPDATE products
      SET
        stock_quantity = stock_quantity - ?,
        updated_at = ?
      WHERE id = ?
    `)

    const insertStockMovement = db.prepare(`
      INSERT INTO stock_movements (
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        movement_date,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

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

      if (line.productId !== null) {
        const stockQuantity = line.quantity + line.freeQuantity

        updateStock.run(stockQuantity, now, line.productId)

        insertStockMovement.run(
          line.productId,
          'SALE',
          -stockQuantity,
          'SALE',
          saleId,
          now,
          `Bill ${input.billNumber}`
        )
      }
    }

    /*
     * Record payment.
     *
     * We record the amount applied to the sale,
     * not the cash tendered above the total.
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
