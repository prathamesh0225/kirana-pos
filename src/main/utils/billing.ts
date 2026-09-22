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

  if (
    !Number.isInteger(input.quantityPrecision) ||
    input.quantityPrecision < 0 ||
    input.quantityPrecision > 3
  ) {
    throw new Error('Invalid quantity precision')
  }

  const quantity = roundQuantity(input.quantity, input.quantityPrecision)
  const freeQuantity = roundQuantity(input.freeQuantity, input.quantityPrecision)

  const amountPaise = Math.round(quantity * input.sellingPricePaise)

  return {
    quantity,
    freeQuantity,
    sellingPricePaise: input.sellingPricePaise,
    amountPaise
  }
}

function roundQuantity(quantity: number, precision: number): number {
  const factor = 10 ** precision

  return Math.round((quantity + Number.EPSILON) * factor) / factor
}
