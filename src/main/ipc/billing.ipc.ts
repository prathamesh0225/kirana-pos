import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { allocateNextBillNumberForSlot, getBillingSlots } from '../repositories/bill.repository'
import { completeSale, type CompleteSaleInput } from '../services/sale.service'
import { processSaleReturn, type ProcessSaleReturnInput } from '../services/return.service'
import { listSales, getSaleById } from '../repositories/sale.repository'
import { updateSale, type UpdateSaleInput } from '../services/sale-update.service'

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

  ipcMain.handle('billing:getSaleById', (_event, saleId: number) => {
    const db = getDatabase()
    return getSaleById(db, saleId)
  })

  ipcMain.handle('billing:updateSale', (_event, input: UpdateSaleInput) => {
    return updateSale(input)
  })
}
