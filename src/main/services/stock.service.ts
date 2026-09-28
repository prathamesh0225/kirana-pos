import {
  listStockMovementsForProduct,
  type StockMovementRecord
} from '../repositories/stock.repository'
import { getProductByIdAnyStatus } from './product.service'

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
