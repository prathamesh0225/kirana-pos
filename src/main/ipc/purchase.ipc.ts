import { ipcMain } from 'electron'
import { completePurchase, type CreatePurchaseInput } from '../services/purchase.service'

export function registerPurchaseIpc(): void {
  ipcMain.handle('purchase:complete', (_event, input: CreatePurchaseInput) => {
    return completePurchase(input)
  })
}
