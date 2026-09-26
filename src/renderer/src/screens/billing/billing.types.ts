export type BillingLine = {
  id: number
  saleItemId?: number

  productId: number | null
  productName: string
  isTemporary: boolean
  barcode: string | null

  quantityPrecision: number
  mrpPaise: number

  quantity: number
  freeQuantity: number
  ratePaise: number
  amountPaise: number
}

export type BillingSession = {
  id: string
  billNumber: string
  lines: BillingLine[]
  customerName: string
  customerMobile: string
}

export type SaleListItem = {
  id: number
  billNumber: string
  saleDate: string
  totalPaise: number
  status: string
  refundedPaise: number
  netPaise: number
}

export type BillingMode = 'active' | 'view' | 'modify'
