import type Database from 'better-sqlite3'

export type SaleListItem = {
  id: number
  billNumber: string
  saleDate: string
  totalPaise: number
  status: string
  refundedPaise: number
  netPaise: number
}

export type SaleDetail = {
  id: number
  billNumber: string
  saleDate: string
  subtotalPaise: number
  discountPaise: number
  totalPaise: number
  status: string
  items: SaleDetailItem[]
  payments: SalePayment[]
  returns: SaleReturnSummary[]
  refundedPaise: number
  netPaise: number
}

export type SaleDetailItem = {
  id: number
  productId: number | null
  productName: string
  barcode: string | null
  mrpPaise: number
  quantity: number
  freeQuantity: number
  ratePaise: number
  amountPaise: number
}

export type SalePayment = {
  id: number
  paymentMethod: string
  amountPaise: number
}

export type SaleReturnSummary = {
  id: number
  returnDate: string
  totalRefundPaise: number
  status: string
}

export function listSales(db: Database.Database, limit = 100): SaleListItem[] {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 500))

  const rows = db
    .prepare(
      `
      SELECT
        s.id,
        s.bill_number,
        s.sale_date,
        s.total_paise,
        s.status,

        COALESCE(
          (
            SELECT SUM(sm.adjustment_amount_paise)
            FROM sale_modifications sm
            WHERE sm.sale_id = s.id
              AND sm.adjustment_type = 'refund'
          ),
          0
        ) AS refunded_paise

      FROM sales s
      ORDER BY s.id DESC
      LIMIT ?
      `
    )
    .all(safeLimit) as Array<{
    id: number
    bill_number: string
    sale_date: string
    total_paise: number
    status: string
    refunded_paise: number
  }>

  return rows.map((sale) => ({
    id: sale.id,
    billNumber: sale.bill_number,
    saleDate: sale.sale_date,
    totalPaise: sale.total_paise,
    status: sale.status,
    refundedPaise: sale.refunded_paise,
    netPaise: sale.total_paise + sale.refunded_paise
  }))
}

export function getSaleById(db: Database.Database, saleId: number): SaleDetail | null {
  const sale = db
    .prepare(
      `
      SELECT
        id,
        bill_number,
        sale_date,
        subtotal_paise,
        discount_paise,
        total_paise,
        status
      FROM sales
      WHERE id = ?
      `
    )
    .get(saleId) as
    | {
        id: number
        bill_number: string
        sale_date: string
        subtotal_paise: number
        discount_paise: number
        total_paise: number
        status: string
      }
    | undefined

  if (!sale) {
    return null
  }

  const items = db
    .prepare(
      `
      SELECT
        id,
        product_id,
        product_name,
        barcode,
        mrp_paise,
        quantity,
        free_quantity,
        rate_paise,
        amount_paise
      FROM sale_items
      WHERE sale_id = ?
      ORDER BY id ASC
      `
    )
    .all(saleId)
    .map((row) => {
      const item = row as {
        id: number
        product_id: number | null
        product_name: string
        barcode: string | null
        mrp_paise: number
        quantity: number
        free_quantity: number
        rate_paise: number
        amount_paise: number
      }

      return {
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        barcode: item.barcode,
        mrpPaise: item.mrp_paise,
        quantity: item.quantity,
        freeQuantity: item.free_quantity,
        ratePaise: item.rate_paise,
        amountPaise: item.amount_paise
      }
    })

  const payments = db
    .prepare(
      `
      SELECT
        id,
        payment_method,
        amount_paise
      FROM payments
      WHERE sale_id = ?
      ORDER BY id ASC
      `
    )
    .all(saleId)
    .map((row) => {
      const payment = row as {
        id: number
        payment_method: string
        amount_paise: number
      }

      return {
        id: payment.id,
        paymentMethod: payment.payment_method,
        amountPaise: payment.amount_paise
      }
    })

  const returns = db
    .prepare(
      `
      SELECT
        id,
        return_date,
        total_refund_paise,
        status
      FROM sale_returns
      WHERE sale_id = ?
      ORDER BY id ASC
      `
    )
    .all(saleId)
    .map((row) => {
      const saleReturn = row as {
        id: number
        return_date: string
        total_refund_paise: number
        status: string
      }

      return {
        id: saleReturn.id,
        returnDate: saleReturn.return_date,
        totalRefundPaise: saleReturn.total_refund_paise,
        status: saleReturn.status
      }
    })

  const refundedPaise = returns
    .filter((saleReturn) => saleReturn.status === 'completed')
    .reduce((sum, saleReturn) => sum + saleReturn.totalRefundPaise, 0)

  return {
    id: sale.id,
    billNumber: sale.bill_number,
    saleDate: sale.sale_date,
    subtotalPaise: sale.subtotal_paise,
    discountPaise: sale.discount_paise,
    totalPaise: sale.total_paise,
    status: sale.status,
    items,
    payments,
    returns,
    refundedPaise,
    netPaise: sale.total_paise - refundedPaise
  }
}
