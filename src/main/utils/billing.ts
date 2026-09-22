import { requireValidQuantity } from './quantity'

export type BillingLineInput = {
  quantity: number
  freeQuantity: number
  sellingPricePaise: number
  quantityPrecision: number
}

export type BillingLineResult = {
  quantity: number
  freeQuantity: number
  sellingPricePaise: number
  amountPaise: number
}

export function calculateBillingLine(input: BillingLineInput): BillingLineResult {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error('Quantity must be greater than zero')
  }

  if (!Number.isFinite(input.freeQuantity) || input.freeQuantity < 0) {
    throw new Error('Free quantity cannot be negative')
  }

  if (!Number.isInteger(input.sellingPricePaise) || input.sellingPricePaise < 0) {
    throw new Error('Invalid selling price')
  }

  const quantity = requireValidQuantity(input.quantity, input.quantityPrecision, 'Quantity')

  const freeQuantity = requireValidQuantity(
    input.freeQuantity,
    input.quantityPrecision,
    'Free quantity'
  )

  const amountPaise = Math.round(quantity * input.sellingPricePaise)

  return {
    quantity,
    freeQuantity,
    sellingPricePaise: input.sellingPricePaise,
    amountPaise
  }
}
