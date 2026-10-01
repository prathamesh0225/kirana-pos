//purchase.service.ts
import {
  createPurchase,
  getPurchaseById,
  listPurchases,
  updatePurchase,
  type CreatePurchaseInput,
  type PurchaseDetail,
  type PurchaseHistoryRow,
  type PurchaseResult
} from '../repositories/purchase.repository'

export function completePurchase(input: CreatePurchaseInput): PurchaseResult {
  if (!input) {
    throw new Error('Purchase data is required.')
  }

  return createPurchase(input)
}

export function getPurchases(limit?: number): PurchaseHistoryRow[] {
  return listPurchases(limit)
}

export function getPurchase(purchaseId: number): PurchaseDetail | null {
  return getPurchaseById(purchaseId)
}

export function modifyPurchase(purchaseId: number, input: CreatePurchaseInput): PurchaseResult {
  if (!input) {
    throw new Error('Purchase data is required.')
  }

  return updatePurchase(purchaseId, input)
}
