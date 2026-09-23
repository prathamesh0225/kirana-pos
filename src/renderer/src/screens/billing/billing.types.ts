export type BillingLine = {
  id: number
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
  lines: BillingLine[]
  customerName: string
  customerMobile: string
}
