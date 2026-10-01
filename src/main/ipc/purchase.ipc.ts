//purchase.ipc.ts
import { ipcMain } from 'electron'

import {
  completePurchase,
  getPurchase,
  getPurchases,
  modifyPurchase
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
}
