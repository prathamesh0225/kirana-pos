import { ipcMain } from 'electron'

import {
  addSupplier,
  changeSupplierStatus,
  editSupplier,
  getSupplier,
  getSuppliers
} from '../services/supplier.service'

export function registerSupplierIpc(): void {
  ipcMain.handle('supplier:list', (_event, includeInactive = false) => {
    return getSuppliers(Boolean(includeInactive))
  })

  ipcMain.handle('supplier:get', (_event, id: number) => {
    return getSupplier(Number(id))
  })

  ipcMain.handle('supplier:create', (_event, data) => {
    return addSupplier(data)
  })

  ipcMain.handle('supplier:update', (_event, id: number, data) => {
    return editSupplier(Number(id), data)
  })

  ipcMain.handle('supplier:setActive', (_event, id: number, active: boolean) => {
    changeSupplierStatus(Number(id), Boolean(active))
  })
}
