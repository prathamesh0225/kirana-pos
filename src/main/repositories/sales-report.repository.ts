import type Database from 'better-sqlite3'

export type SalesReportFilters = {
  fromDate: string | null
  toDate: string | null
}

export type SalesReportData = {
  daily: Array<{
    date: string
    firstBillNumber: string
    lastBillNumber: string
    billCount: number
    salesPaise: number
  }>
  bills: Array<{
    id: number
    billNumber: string
    saleDate: string
    status: string
    totalPaise: number
    refundedPaise: number
    netPaise: number
  }>
  products: Array<{
    productName: string
    quantity: number
    salesPaise: number
  }>
  payments: Array<{
    paymentMethod: string
    amountPaise: number
  }>
}

export function getSalesReport(
  db: Database.Database,
  filters: SalesReportFilters
): SalesReportData {
  const conditions = ["s.status NOT IN ('cancelled', 'void')"]
  const params: string[] = []

  if (filters.fromDate) {
    conditions.push('date(s.sale_date) >= date(?)')
    params.push(filters.fromDate)
  }

  if (filters.toDate) {
    conditions.push('date(s.sale_date) <= date(?)')
    params.push(filters.toDate)
  }

  const where = conditions.join(' AND ')

  const daily = db
    .prepare(
      `
    SELECT
      date(s.sale_date) AS date,
      MIN(s.bill_number) AS firstBillNumber,
      MAX(s.bill_number) AS lastBillNumber,
      COUNT(*) AS billCount,
      SUM(
        s.total_paise - COALESCE((
          SELECT SUM(sr.total_refund_paise)
          FROM sale_returns sr
          WHERE sr.sale_id = s.id
            AND sr.status = 'completed'
        ), 0)
      ) AS salesPaise
    FROM sales s
    WHERE ${where}
    GROUP BY date(s.sale_date)
    ORDER BY date(s.sale_date) DESC
  `
    )
    .all(...params) as SalesReportData['daily']

  const bills = db
    .prepare(
      `
    SELECT
      s.id,
      s.bill_number AS billNumber,
      s.sale_date AS saleDate,
      s.status,
      s.total_paise AS totalPaise,
      COALESCE((
        SELECT SUM(sr.total_refund_paise)
        FROM sale_returns sr
        WHERE sr.sale_id = s.id
          AND sr.status = 'completed'
      ), 0) AS refundedPaise,
      s.total_paise - COALESCE((
        SELECT SUM(sr.total_refund_paise)
        FROM sale_returns sr
        WHERE sr.sale_id = s.id
          AND sr.status = 'completed'
      ), 0) AS netPaise
    FROM sales s
    WHERE ${where}
    ORDER BY s.sale_date DESC, s.id DESC
  `
    )
    .all(...params) as SalesReportData['bills']

  const products = db
    .prepare(
      `
    SELECT
      si.product_name AS productName,
      SUM(si.quantity) AS quantity,
      SUM(si.amount_paise) AS salesPaise
    FROM sale_items si
    INNER JOIN sales s ON s.id = si.sale_id
    WHERE ${where}
    GROUP BY si.product_name
    ORDER BY salesPaise DESC, productName ASC
  `
    )
    .all(...params) as SalesReportData['products']

  const payments = db
    .prepare(
      `
    SELECT
      UPPER(p.payment_method) AS paymentMethod,
      SUM(p.amount_paise) AS amountPaise
    FROM payments p
    INNER JOIN sales s ON s.id = p.sale_id
    WHERE ${where}
    GROUP BY UPPER(p.payment_method)
    ORDER BY amountPaise DESC
  `
    )
    .all(...params) as SalesReportData['payments']

  return { daily, bills, products, payments }
}
