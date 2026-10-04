//purchase.ipc.ts
import { ipcMain } from 'electron'

import {
  completePurchase,
  getPurchase,
  getPurchases,
  modifyPurchase,
  checkInvoiceNumber
} from '../services/purchase.service'

import type { CreatePurchaseInput } from '../repositories/purchase.repository'

export function registerPurchaseIpc(): void {
  ipcMain.handle('purchase:complete', (_event, input: CreatePurchaseInput) => {
    return completePurchase(input)
  })

  ipcMain.handle('purchase:list', (_event, limit?: number) => {
    return getPurchases(limit)
  })

  ipcMain.handle('purchase:get', (_event, purchaseId: number) => {
    return getPurchase(purchaseId)
  })

  ipcMain.handle('purchase:update', (_event, purchaseId: number, input: CreatePurchaseInput) => {
    return modifyPurchase(purchaseId, input)
  })

  ipcMain.handle(
    'purchase:check-invoice-number',
    (_event, invoiceNumber: string, purchaseId?: number) => {
      return checkInvoiceNumber(invoiceNumber, purchaseId)
    }
  )
}
