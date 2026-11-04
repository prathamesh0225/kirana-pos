import {
  listStockMovementsForProduct,
  type StockMovementRecord
} from '../repositories/stock.repository'
import { getProductByIdAnyStatus } from './product.service'

import {
  listStockBatches,
  saveStockBatch,
  type SaveStockBatchInput
} from '../repositories/stock.repository'

import { requireValidQuantity } from '../utils/quantity'

export function getStockHistory(
  productId: number,
  fromDate?: string | null,
  toDate?: string | null
): StockMovementRecord[] {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('Invalid product ID.')
  }

  const product = getProductByIdAnyStatus(productId)

  if (!product) {
    throw new Error('Product not found.')
  }

  return listStockMovementsForProduct(productId, fromDate, toDate)
}

export function getProductStockBatches(productId: number) {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('Invalid product ID')
  }

  const product = getProductByIdAnyStatus(productId)

  if (!product) throw new Error('Product not found')

  return listStockBatches(productId)
}

export function saveProductStockBatch(productId: number, input: SaveStockBatchInput) {
  const product = getProductByIdAnyStatus(productId)

  if (!product) throw new Error('Product not found')
  if (!product.is_active) {
    throw new Error('Cannot adjust batches for a disabled product')
  }

  if (input.id !== undefined && (!Number.isInteger(input.id) || input.id <= 0)) {
    throw new Error('Invalid batch ID')
  }

  const batchNumber = input.batchNumber?.trim() || null
  const expiryDate = input.expiryDate?.trim() || null

  if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
    throw new Error('Invalid expiry date')
  }

  for (const [value, label] of [
    [input.mrpPaise, 'MRP'],
    [input.purchaseRatePaise, 'Purchase rate'],
    [input.sellingRatePaise, 'Selling rate']
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Invalid ${label}`)
    }
  }

  if (input.sellingRatePaise <= 0) {
    throw new Error('Selling rate must be greater than zero')
  }

  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    throw new Error('Stock cannot be negative')
  }

  requireValidQuantity(input.quantity, product.quantity_precision, 'Batch stock')

  return saveStockBatch(
    productId,
    {
      ...input,
      batchNumber,
      expiryDate
    },
    new Date().toISOString()
  )
}
