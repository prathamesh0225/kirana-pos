import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { allocateNextBillNumberForSlot, getBillingSlots } from '../repositories/bill.repository'
import {
  completeSale,
  getDashboardSalesSummary,
  type CompleteSaleInput
} from '../services/sale.service'
import { processSaleReturn, type ProcessSaleReturnInput } from '../services/return.service'
import { listSales, getSaleById } from '../repositories/sale.repository'
import { updateSale, type UpdateSaleInput } from '../services/sale-update.service'
import { getAvailableBatchesForProduct } from '../repositories/purchase.repository'

export function registerBillingIpc(): void {
  ipcMain.handle('billing:getSlots', () => {
    const db = getDatabase()
    return getBillingSlots(db)
  })

  ipcMain.handle('billing:allocateNextBillNumber', (_event, slotId: 0 | 1) => {
    if (slotId !== 0 && slotId !== 1) {
      throw new Error('Invalid billing slot')
    }

    const db = getDatabase()

    return allocateNextBillNumberForSlot(db, slotId)
  })

  ipcMain.handle('billing:completeSale', (_event, input: CompleteSaleInput) => {
    return completeSale(input)
  })

  ipcMain.handle('billing:processSaleReturn', (_event, input: ProcessSaleReturnInput) => {
    return processSaleReturn(input)
  })

  ipcMain.handle('billing:listSales', (_event, limit?: number) => {
    const db = getDatabase()
    return listSales(db, limit)
  })

  ipcMain.handle('billing:getDashboardSalesSummary', () => {
    return getDashboardSalesSummary()
  })

  ipcMain.handle('billing:getSaleById', (_event, saleId: number) => {
    const db = getDatabase()
    return getSaleById(db, saleId)
  })

  ipcMain.handle('billing:updateSale', (_event, input: UpdateSaleInput) => {
    return updateSale(input)
  })

  ipcMain.handle('billing:repairCompletedSlot', () => {
    const db = getDatabase()

    const existingSale = db
      .prepare(
        `
      SELECT bill_number
      FROM sales
      WHERE bill_number = 'A000030'
    `
      )
      .get() as { bill_number: string } | undefined

    if (!existingSale) {
      throw new Error('A000030 was not found in completed sales')
    }

    return allocateNextBillNumberForSlot(db, 1)
  })
}

ipcMain.handle('billing:getAvailableBatches', (_event, productId: number) => {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('Invalid product ID')
  }

  return getAvailableBatchesForProduct(productId)
})
