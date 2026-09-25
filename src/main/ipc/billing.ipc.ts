import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { allocateNextBillNumberForSlot, getBillingSlots } from '../repositories/bill.repository'
import { completeSale, type CompleteSaleInput } from '../services/sale.service'

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
}
