import type Database from 'better-sqlite3'

export type SaleReturnItemInput = {
  saleItemId: number
  quantity: number
  freeQuantity: number
}

export type SaleReturnInput = {
  saleId: number
  items: SaleReturnItemInput[]
  paymentMethod: 'cash' | 'upi' | 'mixed'
  notes?: string
}

export type SaleReturnResult = {
  returnId: number
  saleId: number
  totalRefundPaise: number
}

export function createSaleReturn(db: Database.Database, input: SaleReturnInput): SaleReturnResult {
  const transaction = db.transaction(() => {
    if (!Number.isInteger(input.saleId) || input.saleId <= 0) {
      throw new Error('Invalid sale')
    }

    if (input.items.length === 0) {
      throw new Error('No items selected for return')
    }

    const sale = db
      .prepare(
        `
        SELECT id, status
        FROM sales
        WHERE id = ?
      `
      )
      .get(input.saleId) as { id: number; status: string } | undefined

    if (!sale) {
      throw new Error('Sale not found')
    }

    if (sale.status === 'cancelled' || sale.status === 'void') {
      throw new Error('This bill cannot be modified')
    }

    const getSaleItem = db.prepare(`
      SELECT
        id,
        sale_id,
        product_id,
        product_name,
        quantity,
        free_quantity,
        rate_paise,
        amount_paise
      FROM sale_items
      WHERE id = ?
        AND sale_id = ?
    `)

    const getReturned = db.prepare(`
      SELECT
        COALESCE(SUM(quantity), 0) AS quantity,
        COALESCE(SUM(free_quantity), 0) AS free_quantity
      FROM sale_return_items
      WHERE sale_item_id = ?
    `)

    const insertReturn = db.prepare(`
      INSERT INTO sale_returns (
        sale_id,
        return_date,
        total_refund_paise,
        status,
        notes
      )
      VALUES (?, datetime('now'), ?, 'completed', ?)
    `)

    const insertReturnItem = db.prepare(`
      INSERT INTO sale_return_items (
        sale_return_id,
        sale_item_id,
        product_id,
        product_name,
        quantity,
        free_quantity,
        rate_paise,
        refund_amount_paise
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const restoreStock = db.prepare(`
      UPDATE products
      SET
        stock_quantity = stock_quantity + ?,
        updated_at = datetime('now')
      WHERE id = ?
    `)

    const insertStockMovement = db.prepare(`
      INSERT INTO stock_movements (
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        notes
      )
      VALUES (?, 'RETURN', ?, 'SALE_RETURN', ?, ?)
    `)

    const insertPayment = db.prepare(`
      INSERT INTO return_payments (
        sale_return_id,
        payment_method,
        amount_paise,
        payment_date
      )
      VALUES (?, ?, ?, datetime('now'))
    `)

    let totalRefundPaise = 0

    const validatedItems: Array<{
      saleItem: {
        id: number
        productId: number | null
        productName: string
        quantity: number
        freeQuantity: number
        ratePaise: number
      }
      quantity: number
      freeQuantity: number
      refundAmountPaise: number
    }> = []

    for (const item of input.items) {
      if (!Number.isInteger(item.saleItemId) || item.saleItemId <= 0) {
        throw new Error('Invalid sale item')
      }

      if (!Number.isFinite(item.quantity) || item.quantity < 0) {
        throw new Error('Invalid return quantity')
      }

      if (!Number.isFinite(item.freeQuantity) || item.freeQuantity < 0) {
        throw new Error('Invalid free return quantity')
      }

      if (item.quantity === 0 && item.freeQuantity === 0) {
        throw new Error('Return quantity must be greater than zero')
      }

      const saleItem = getSaleItem.get(item.saleItemId, input.saleId) as
        | {
            id: number
            product_id: number | null
            product_name: string
            quantity: number
            free_quantity: number
            rate_paise: number
          }
        | undefined

      if (!saleItem) {
        throw new Error('Sale item not found')
      }

      const returned = getReturned.get(item.saleItemId) as {
        quantity: number
        free_quantity: number
      }

      const remainingQuantity = saleItem.quantity - returned.quantity

      const remainingFreeQuantity = saleItem.free_quantity - returned.free_quantity

      if (item.quantity > remainingQuantity + 0.000001) {
        throw new Error(`Return quantity exceeds remaining quantity for ${saleItem.product_name}`)
      }

      if (item.freeQuantity > remainingFreeQuantity + 0.000001) {
        throw new Error(
          `Free return quantity exceeds remaining quantity for ${saleItem.product_name}`
        )
      }

      const refundAmountPaise = Math.round(item.quantity * saleItem.rate_paise)

      totalRefundPaise += refundAmountPaise

      validatedItems.push({
        saleItem: {
          id: saleItem.id,
          productId: saleItem.product_id,
          productName: saleItem.product_name,
          quantity: saleItem.quantity,
          freeQuantity: saleItem.free_quantity,
          ratePaise: saleItem.rate_paise
        },
        quantity: item.quantity,
        freeQuantity: item.freeQuantity,
        refundAmountPaise
      })
    }

    if (totalRefundPaise <= 0) {
      throw new Error('Return must contain at least one paid item or a valid free-item return')
    }

    const returnRecord = insertReturn.run(input.saleId, totalRefundPaise, input.notes ?? null)

    const returnId = Number(returnRecord.lastInsertRowid)

    for (const item of validatedItems) {
      insertReturnItem.run(
        returnId,
        item.saleItem.id,
        item.saleItem.productId,
        item.saleItem.productName,
        item.quantity,
        item.freeQuantity,
        item.saleItem.ratePaise,
        item.refundAmountPaise
      )

      const stockQuantity = item.quantity + item.freeQuantity

      if (item.saleItem.productId !== null && stockQuantity > 0) {
        restoreStock.run(stockQuantity, item.saleItem.productId)

        insertStockMovement.run(
          item.saleItem.productId,
          stockQuantity,
          returnId,
          `Return against bill sale #${input.saleId}`
        )
      }
    }

    if (input.paymentMethod === 'cash') {
      insertPayment.run(returnId, 'cash', totalRefundPaise)
    } else if (input.paymentMethod === 'upi') {
      insertPayment.run(returnId, 'upi', totalRefundPaise)
    } else {
      throw new Error('Mixed refund requires payment amounts')
    }

    const remaining = db
      .prepare(
        `
        SELECT
          COALESCE(SUM(si.amount_paise), 0) AS original_total,
          COALESCE((
            SELECT SUM(sr.total_refund_paise)
            FROM sale_returns sr
            WHERE sr.sale_id = ?
              AND sr.status = 'completed'
          ), 0) AS refunded_total
        FROM sale_items si
        WHERE si.sale_id = ?
      `
      )
      .get(input.saleId, input.saleId) as {
      original_total: number
      refunded_total: number
    }

    const newStatus =
      remaining.refunded_total >= remaining.original_total ? 'returned' : 'partially_returned'

    db.prepare(
      `
      UPDATE sales
      SET status = ?
      WHERE id = ?
    `
    ).run(newStatus, input.saleId)

    return {
      returnId,
      saleId: input.saleId,
      totalRefundPaise
    }
  })

  return transaction()
}
