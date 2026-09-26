import { getDatabase } from '../database'
import { requireValidQuantity } from '../utils/quantity'

export type UpdateSaleLine = {
  saleItemId?: number
  productId: number | null
  productName: string
  barcode: string | null
  mrpPaise: number
  quantity: number
  freeQuantity: number
  ratePaise: number
  amountPaise: number
}

export type SalePaymentAdjustment = {
  type: 'charge' | 'refund'
  method: 'cash' | 'upi'
  amountPaise: number
}

export type UpdateSaleInput = {
  saleId: number
  customerName?: string
  customerMobile?: string
  lines: UpdateSaleLine[]
  paymentAdjustment?: SalePaymentAdjustment
}

export type UpdateSaleResult = {
  saleId: number
  billNumber: string
  totalPaise: number
  adjustmentPaise: number
}

type ExistingSaleItem = {
  id: number
  product_id: number | null
  product_name: string
  quantity: number
  free_quantity: number
  rate_paise: number
  amount_paise: number
}

function calculateAmount(quantity: number, ratePaise: number): number {
  return Math.round(quantity * ratePaise)
}

export function updateSale(input: UpdateSaleInput): UpdateSaleResult {
  const db = getDatabase()

  if (input.lines.length === 0) {
    throw new Error('Bill must contain at least one item')
  }

  return db.transaction(() => {
    const sale = db
      .prepare(
        `
        SELECT
          id,
          bill_number,
          total_paise,
          status
        FROM sales
        WHERE id = ?
      `
      )
      .get(input.saleId) as
      | {
          id: number
          bill_number: string
          total_paise: number
          status: string
        }
      | undefined

    if (!sale) {
      throw new Error('Sale not found')
    }

    if (sale.status !== 'completed' && sale.status !== 'modified') {
      throw new Error('Only completed or modified bills can be modified')
    }

    const originalItems = db
      .prepare(
        `
        SELECT
          id,
          product_id,
          product_name,
          quantity,
          free_quantity,
          rate_paise,
          amount_paise
        FROM sale_items
        WHERE sale_id = ?
        ORDER BY id
      `
      )
      .all(input.saleId) as ExistingSaleItem[]

    const originalTotal = sale.total_paise

    let newTotal = 0

    for (const line of input.lines) {
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        throw new Error(`Invalid quantity for ${line.productName}`)
      }

      if (!Number.isFinite(line.freeQuantity) || line.freeQuantity < 0) {
        throw new Error(`Invalid free quantity for ${line.productName}`)
      }

      if (!Number.isFinite(line.ratePaise) || line.ratePaise < 0) {
        throw new Error(`Invalid rate for ${line.productName}`)
      }

      const amountPaise = calculateAmount(line.quantity, line.ratePaise)

      if (amountPaise < 0) {
        throw new Error(`Invalid amount for ${line.productName}`)
      }

      newTotal += amountPaise
    }

    const difference = newTotal - originalTotal

    if (difference > 0) {
      if (
        !input.paymentAdjustment ||
        input.paymentAdjustment.type !== 'charge' ||
        input.paymentAdjustment.amountPaise !== difference
      ) {
        throw new Error('Additional payment is required')
      }
    }

    if (difference < 0) {
      const refundAmount = Math.abs(difference)

      if (
        !input.paymentAdjustment ||
        input.paymentAdjustment.type !== 'refund' ||
        input.paymentAdjustment.amountPaise !== refundAmount
      ) {
        throw new Error('Refund confirmation is required')
      }
    }

    /*
     * Bills which already have returns are intentionally blocked.
     * This keeps stock/accounting changes predictable.
     */
    const returnCount = db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM sale_return_items sri
        INNER JOIN sale_items si
          ON si.id = sri.sale_item_id
        WHERE si.sale_id = ?
      `
      )
      .get(input.saleId) as { count: number }

    if (returnCount.count > 0) {
      throw new Error('A bill with returns cannot be modified')
    }

    const originalById = new Map<number, ExistingSaleItem>()

    for (const item of originalItems) {
      originalById.set(item.id, item)
    }

    const consumedOriginalIds = new Set<number>()

    const insertStockMovement = db.prepare(`
      INSERT INTO stock_movements (
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        movement_date
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const updateStock = db.prepare(`
      UPDATE products
      SET
        stock_quantity = stock_quantity + ?,
        updated_at = datetime('now')
      WHERE id = ?
    `)

    const getProduct = db.prepare(`
      SELECT
        id,
        name,
        is_active,
        stock_quantity
      FROM products
      WHERE id = ?
    `)

    /*
     * Existing line -> modify
     * New line -> insert
     * Removed line -> restore stock
     */
    for (const line of input.lines) {
      const amountPaise = calculateAmount(line.quantity, line.ratePaise)

      const newStockUsed = line.quantity + line.freeQuantity

      if (line.saleItemId !== undefined) {
        const oldItem = originalById.get(line.saleItemId)

        if (!oldItem) {
          throw new Error(`Invalid sale item: ${line.saleItemId}`)
        }

        consumedOriginalIds.add(oldItem.id)

        const oldStockUsed = oldItem.quantity + oldItem.free_quantity

        /*
         * Same product:
         *
         * positive delta = return stock
         * negative delta = consume more stock
         */
        if (oldItem.product_id === line.productId) {
          if (line.productId !== null) {
            const stockDelta = oldStockUsed - newStockUsed

            if (stockDelta !== 0) {
              updateStock.run(stockDelta, line.productId)

              insertStockMovement.run(
                line.productId,
                stockDelta > 0 ? 'RETURN' : 'SALE',
                Math.abs(stockDelta),
                'SALE_MODIFICATION',
                input.saleId,
                new Date().toISOString()
              )
            }
          }
        } else {
          /*
           * Product changed.
           *
           * Return old product stock.
           */
          if (oldItem.product_id !== null) {
            updateStock.run(oldStockUsed, oldItem.product_id)

            insertStockMovement.run(
              oldItem.product_id,
              'RETURN',
              oldStockUsed,
              'SALE_MODIFICATION',
              input.saleId,
              new Date().toISOString()
            )
          }

          /*
           * Consume new product stock.
           */
          if (line.productId !== null) {
            const product = getProduct.get(line.productId) as
              | {
                  id: number
                  name: string
                  is_active: number
                  stock_quantity: number
                }
              | undefined

            if (!product) {
              throw new Error(`Product not found: ${line.productName}`)
            }

            if (!product.is_active) {
              throw new Error(`Product is disabled: ${line.productName}`)
            }

            if (product.stock_quantity < newStockUsed) {
              throw new Error(`Insufficient stock for ${line.productName}`)
            }

            updateStock.run(-newStockUsed, line.productId)

            insertStockMovement.run(
              line.productId,
              'SALE',
              newStockUsed,
              'SALE_MODIFICATION',
              input.saleId,
              new Date().toISOString()
            )
          }
        }

        db.prepare(
          `
          UPDATE sale_items
          SET
            product_id = ?,
            product_name = ?,
            barcode = ?,
            mrp_paise = ?,
            quantity = ?,
            free_quantity = ?,
            rate_paise = ?,
            amount_paise = ?
          WHERE id = ?
            AND sale_id = ?
        `
        ).run(
          line.productId,
          line.productName,
          line.barcode,
          line.mrpPaise,
          line.quantity,
          line.freeQuantity,
          line.ratePaise,
          amountPaise,
          line.saleItemId,
          input.saleId
        )
      } else {
        /*
         * New product line.
         */
        if (line.productId !== null) {
          const product = getProduct.get(line.productId) as
            | {
                id: number
                name: string
                is_active: number
                stock_quantity: number
              }
            | undefined

          if (!product) {
            throw new Error(`Product not found: ${line.productName}`)
          }

          if (!product.is_active) {
            throw new Error(`Product is disabled: ${line.productName}`)
          }

          if (product.stock_quantity < newStockUsed) {
            throw new Error(`Insufficient stock for ${line.productName}`)
          }

          updateStock.run(-newStockUsed, line.productId)

          insertStockMovement.run(
            line.productId,
            'SALE',
            newStockUsed,
            'SALE_MODIFICATION',
            input.saleId,
            new Date().toISOString()
          )
        }

        db.prepare(
          `
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
        `
        ).run(
          input.saleId,
          line.productId,
          line.productName,
          line.barcode,
          line.mrpPaise,
          line.quantity,
          line.freeQuantity,
          line.ratePaise,
          amountPaise
        )
      }
    }

    /*
     * Original lines which no longer exist:
     * restore their stock and delete their sale_items row.
     */
    for (const oldItem of originalItems) {
      if (consumedOriginalIds.has(oldItem.id)) {
        continue
      }

      const stockUsed = oldItem.quantity + oldItem.free_quantity

      if (oldItem.product_id !== null && stockUsed > 0) {
        updateStock.run(stockUsed, oldItem.product_id)

        insertStockMovement.run(
          oldItem.product_id,
          'RETURN',
          stockUsed,
          'SALE_MODIFICATION',
          input.saleId,
          new Date().toISOString()
        )
      }

      db.prepare(
        `
        DELETE FROM sale_items
        WHERE id = ?
          AND sale_id = ?
      `
      ).run(oldItem.id, input.saleId)
    }

    /*
     * Update the bill to its corrected amount.
     */
    db.prepare(
      `
  UPDATE sales
  SET
    subtotal_paise = ?,
    total_paise = ?,
    status = 'modified'
  WHERE id = ?
  `
    ).run(newTotal, newTotal, input.saleId)

    const adjustmentAmount = Math.abs(difference)

    if (adjustmentAmount > 0) {
      const adjustmentType = difference > 0 ? 'charge' : 'refund'

      const paymentMethod = input.paymentAdjustment?.method ?? 'cash'

      /*
       * Record the bill modification itself.
       *
       * This is separate from a customer product return.
       */
      db.prepare(
        `
        INSERT INTO sale_modifications (
          sale_id,
          original_total_paise,
          new_total_paise,
          adjustment_type,
          payment_method,
          adjustment_amount_paise,
          modification_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        input.saleId,
        originalTotal,
        newTotal,
        adjustmentType,
        paymentMethod,
        adjustmentAmount,
        new Date().toISOString()
      )

      /*
       * If the corrected bill is higher, collect
       * the additional amount as a payment.
       */
      if (difference > 0) {
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
        ).run(input.saleId, paymentMethod, adjustmentAmount, new Date().toISOString())
      }
    }

    return {
      saleId: input.saleId,
      billNumber: sale.bill_number,
      totalPaise: newTotal,
      adjustmentPaise: difference
    }
  })()
}
