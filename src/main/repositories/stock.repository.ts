import { getDatabase } from '../database'

export type StockMovementRecord = {
  id: number
  productId: number
  movementType: string
  quantity: number
  referenceType: string | null
  referenceId: number | null
  movementDate: string
  notes: string | null
  reason: string | null
}

export function listStockMovementsForProduct(
  productId: number,
  fromDate?: string | null,
  toDate?: string | null
): StockMovementRecord[] {
  const db = getDatabase()

  let sql = `
    SELECT
      id,
      product_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      movement_date,
      notes,
      reason
    FROM stock_movements
    WHERE product_id = ?
  `

  const params: Array<string | number> = [productId]

  if (fromDate) {
    sql += ` AND movement_date >= ?`
    params.push(`${fromDate}T00:00:00.000`)
  }

  if (toDate) {
    sql += ` AND movement_date < ?`

    const date = new Date(`${toDate}T00:00:00`)

    date.setDate(date.getDate() + 1)

    const nextDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    params.push(`${nextDate}T00:00:00.000`)
  }

  sql += `
    ORDER BY movement_date DESC, id DESC
  `

  const rows = db.prepare(sql).all(...params) as Array<{
    id: number
    product_id: number
    movement_type: string
    quantity: number
    reference_type: string | null
    reference_id: number | null
    movement_date: string
    notes: string | null
    reason: string | null
  }>

  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    movementType: row.movement_type,
    quantity: row.quantity,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    movementDate: row.movement_date,
    notes: row.notes,
    reason: row.reason
  }))
}

export type StockBatchRecord = {
  id: number
  product_id: number
  batch_number: string | null
  expiry_date: string | null
  mrp_paise: number
  purchase_rate_paise: number
  selling_rate_paise: number
  quantity: number
  created_at: string
  updated_at: string
}

export type SaveStockBatchInput = {
  id?: number
  batchNumber: string | null
  expiryDate: string | null
  mrpPaise: number
  purchaseRatePaise: number
  sellingRatePaise: number
  quantity: number
}

export function listStockBatches(productId: number): StockBatchRecord[] {
  return getDatabase()
    .prepare(
      `
      SELECT id, product_id, batch_number, expiry_date,
        mrp_paise, purchase_rate_paise, selling_rate_paise,
        quantity, created_at, updated_at
      FROM stock_batches
      WHERE product_id = ?
      ORDER BY
  CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
  CASE WHEN expiry_date IS NOT NULL THEN expiry_date END ASC,
  CASE WHEN expiry_date IS NULL THEN id END DESC,
  id ASC
    `
    )
    .all(productId) as StockBatchRecord[]
}

export function saveStockBatch(
  productId: number,
  input: SaveStockBatchInput,
  now: string
): StockBatchRecord {
  const db = getDatabase()

  return db.transaction(() => {
    const product = db
      .prepare('SELECT id, stock_quantity FROM products WHERE id = ?')
      .get(productId) as { id: number; stock_quantity: number } | undefined

    if (!product) throw new Error('Product not found')

    let oldQuantity = 0
    let batchId = input.id

    if (batchId !== undefined) {
      const existing = db
        .prepare(
          `
        SELECT id, product_id, quantity
        FROM stock_batches
        WHERE id = ?
      `
        )
        .get(batchId) as { id: number; product_id: number; quantity: number } | undefined

      if (!existing || existing.product_id !== productId) {
        throw new Error('Batch not found')
      }

      oldQuantity = existing.quantity

      db.prepare(
        `
        UPDATE stock_batches
        SET batch_number = ?,
            expiry_date = ?,
            mrp_paise = ?,
            purchase_rate_paise = ?,
            selling_rate_paise = ?,
            quantity = ?,
            updated_at = ?
        WHERE id = ? AND product_id = ?
      `
      ).run(
        input.batchNumber,
        input.expiryDate,
        input.mrpPaise,
        input.purchaseRatePaise,
        input.sellingRatePaise,
        input.quantity,
        now,
        batchId,
        productId
      )
    } else {
      const result = db
        .prepare(
          `
        INSERT INTO stock_batches (
          product_id, batch_number, expiry_date,
          mrp_paise, purchase_rate_paise, selling_rate_paise,
          quantity, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          productId,
          input.batchNumber,
          input.expiryDate,
          input.mrpPaise,
          input.purchaseRatePaise,
          input.sellingRatePaise,
          input.quantity,
          now,
          now
        )

      batchId = Number(result.lastInsertRowid)
    }

    const difference = input.quantity - oldQuantity

    if (difference !== 0) {
      db.prepare(
        `
        UPDATE products
        SET stock_quantity = stock_quantity + ?, updated_at = ?
        WHERE id = ?
      `
      ).run(difference, now, productId)

      db.prepare(
        `
        INSERT INTO stock_movements (
          product_id, movement_type, quantity,
          reference_type, reference_id,
          movement_date, notes, reason, batch_id
        )
        VALUES (?, 'ADJUSTMENT', ?, 'BATCH_ADJUSTMENT', ?, ?, ?, ?, ?)
      `
      ).run(
        productId,
        difference,
        batchId,
        now,
        'Batch-wise stock adjustment',
        'Batch-wise stock adjustment',
        batchId
      )
    }

    return db
      .prepare(
        `
      SELECT id, product_id, batch_number, expiry_date,
        mrp_paise, purchase_rate_paise, selling_rate_paise,
        quantity, created_at, updated_at
      FROM stock_batches
      WHERE id = ?
    `
      )
      .get(batchId) as StockBatchRecord
  })()
}

export function deleteStockBatch(productId: number, batchId: number): void {
  const db = getDatabase()

  db.transaction(() => {
    const batch = db
      .prepare(
        `
        SELECT id, product_id, quantity
        FROM stock_batches
        WHERE id = ? AND product_id = ?
        `
      )
      .get(batchId, productId) as { id: number; product_id: number; quantity: number } | undefined

    if (!batch) {
      throw new Error('Batch not found')
    }

    if (batch.quantity !== 0) {
      throw new Error('Only batches with zero stock can be deleted')
    }

    const purchaseReference = db
      .prepare(
        `
        SELECT id
        FROM purchase_items
        WHERE batch_id = ?
        LIMIT 1
        `
      )
      .get(batchId)

    if (purchaseReference) {
      throw new Error('This batch is linked to purchase history and cannot be permanently deleted')
    }

    // Preserve stock movement history, but detach it from this batch.
    db.prepare(
      `
      UPDATE stock_movements
      SET batch_id = NULL
      WHERE batch_id = ?
      `
    ).run(batchId)

    db.prepare(
      `
      DELETE FROM stock_batches
      WHERE id = ? AND product_id = ?
      `
    ).run(batchId, productId)
  })()
}
