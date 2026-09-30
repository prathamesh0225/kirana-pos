import {
  createPurchase,
  type CreatePurchaseInput,
  type PurchaseResult
} from '../repositories/purchase.repository'

export function completePurchase(input: CreatePurchaseInput): PurchaseResult {
  if (!input) {
    throw new Error('Purchase data is required.')
  }

  return createPurchase(input)
}
