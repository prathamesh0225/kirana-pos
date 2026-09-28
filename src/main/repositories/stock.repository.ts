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
