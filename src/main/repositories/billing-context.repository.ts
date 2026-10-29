import { getDatabase } from '../database'

export type BillingContextProduct = {
  productId: number
  productName: string
  stockQuantity: number
  lowStockLevel: number
  soldQuantity: number
  expiryDate?: string | null
}

export type BillingContextData = {
  urgentStock: BillingContextProduct[]
  topSellers: BillingContextProduct[]
  expiringStock: BillingContextProduct[]
}

export function getBillingContextData(): BillingContextData {
  const db = getDatabase()

  /*
   * ---------------------------------------------------------
   * 1. LOW STOCK + HIGH DEMAND
   *
   * Products which are currently at/below their low-stock level
   * but have actually been selling during the last 30 days.
   *
   * Higher sold quantity = higher urgency.
   * ---------------------------------------------------------
   */

  const urgentStock = db
    .prepare(
      `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.stock_quantity,
        p.low_stock_level,

        COALESCE(
          (
            SELECT SUM(si.quantity)
            FROM sale_items si
            INNER JOIN sales s
              ON s.id = si.sale_id
            WHERE si.product_id = p.id
              AND s.status = 'completed'
              AND date(s.sale_date) >= date('now', 'localtime', '-30 days')
          ),
          0
        ) AS sold_quantity

      FROM products p

      WHERE p.is_active = 1
        AND p.stock_quantity <= p.low_stock_level

        AND EXISTS (
          SELECT 1
          FROM sale_items si
          INNER JOIN sales s
            ON s.id = si.sale_id
          WHERE si.product_id = p.id
            AND s.status = 'completed'
            AND date(s.sale_date) >= date('now', 'localtime', '-30 days')
        )

      ORDER BY
        sold_quantity DESC,
        p.stock_quantity ASC,
        p.name COLLATE NOCASE ASC
      `
    )
    .all() as Array<{
    product_id: number
    product_name: string
    stock_quantity: number
    low_stock_level: number
    sold_quantity: number
  }>

  /*
   * ---------------------------------------------------------
   * 2. TOP SELLERS
   *
   * Highest quantity sold during the last 30 days.
   * ---------------------------------------------------------
   */

  const topSellers = db
    .prepare(
      `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.stock_quantity,
        p.low_stock_level,
        SUM(si.quantity) AS sold_quantity

      FROM sale_items si

      INNER JOIN sales s
        ON s.id = si.sale_id

      INNER JOIN products p
        ON p.id = si.product_id

      WHERE s.status = 'completed'
        AND date(s.sale_date) >= date('now', 'localtime', '-30 days')
        AND p.is_active = 1

      GROUP BY
        p.id,
        p.name,
        p.stock_quantity,
        p.low_stock_level

      ORDER BY
        sold_quantity DESC,
        p.name COLLATE NOCASE ASC

      LIMIT 15
      `
    )
    .all() as Array<{
    product_id: number
    product_name: string
    stock_quantity: number
    low_stock_level: number
    sold_quantity: number
  }>

  /*
   * ---------------------------------------------------------
   * 3. EXPIRING STOCK
   *
   * Products with stock available in batches which expire
   * within the next 30 days.
   *
   * Higher stock quantity is shown first because those are
   * the products where expiry can create a bigger loss.
   * ---------------------------------------------------------
   */

  const expiringStock = db
    .prepare(
      `
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.stock_quantity,
      p.low_stock_level,
      SUM(sb.quantity) AS batch_quantity,

      MIN(
        CASE
          WHEN sb.expiry_date GLOB '[0-9][0-9]/[0-9][0-9]/[0-9][0-9][0-9][0-9]'
            THEN
              substr(sb.expiry_date, 7, 4)
              || '-' ||
              substr(sb.expiry_date, 4, 2)
              || '-' ||
              substr(sb.expiry_date, 1, 2)
          ELSE sb.expiry_date
        END
      ) AS expiry_date

    FROM stock_batches sb

    INNER JOIN products p
      ON p.id = sb.product_id

    WHERE p.is_active = 1
      AND sb.quantity > 0
      AND sb.expiry_date IS NOT NULL
      AND sb.expiry_date != ''

      AND date(
        CASE
          WHEN sb.expiry_date GLOB '[0-9][0-9]/[0-9][0-9]/[0-9][0-9][0-9][0-9]'
            THEN
              substr(sb.expiry_date, 7, 4)
              || '-' ||
              substr(sb.expiry_date, 4, 2)
              || '-' ||
              substr(sb.expiry_date, 1, 2)
          ELSE sb.expiry_date
        END
      ) >= date('now', 'localtime')

      AND date(
        CASE
          WHEN sb.expiry_date GLOB '[0-9][0-9]/[0-9][0-9]/[0-9][0-9][0-9][0-9]'
            THEN
              substr(sb.expiry_date, 7, 4)
              || '-' ||
              substr(sb.expiry_date, 4, 2)
              || '-' ||
              substr(sb.expiry_date, 1, 2)
          ELSE sb.expiry_date
        END
      ) <= date('now', 'localtime', '+30 days')

    GROUP BY
      p.id,
      p.name,
      p.stock_quantity,
      p.low_stock_level

    ORDER BY
      batch_quantity DESC,
      expiry_date ASC,
      p.name COLLATE NOCASE ASC
    `
    )
    .all() as Array<{
    product_id: number
    product_name: string
    stock_quantity: number
    low_stock_level: number
    batch_quantity: number
    expiry_date: string
  }>

  return {
    urgentStock: urgentStock.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      stockQuantity: row.stock_quantity,
      lowStockLevel: row.low_stock_level,
      soldQuantity: row.sold_quantity
    })),

    topSellers: topSellers.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      stockQuantity: row.stock_quantity,
      lowStockLevel: row.low_stock_level,
      soldQuantity: row.sold_quantity
    })),

    expiringStock: expiringStock.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      stockQuantity: row.stock_quantity,
      lowStockLevel: row.low_stock_level,
      soldQuantity: 0,
      expiryDate: row.expiry_date
    }))
  }
}
