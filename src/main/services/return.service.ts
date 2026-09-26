import { getDatabase } from '../database'
import {
  createSaleReturn,
  type SaleReturnInput,
  type SaleReturnResult
} from '../repositories/return.repository'

export type ProcessSaleReturnInput = SaleReturnInput

export function processSaleReturn(input: ProcessSaleReturnInput): SaleReturnResult {
  const db = getDatabase()

  return createSaleReturn(db, input)
}
