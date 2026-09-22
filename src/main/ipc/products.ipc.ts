import { ipcMain } from 'electron'

import {
  addProduct,
  editProduct,
  getProductByBarcode,
  getProductById,
  listProductCatalog,
  removeProduct,
  restoreProduct,
  searchProductCatalog,
  getProductByIdAnyStatus
} from '../services/product.service'

export function registerProductIpc(): void {
  ipcMain.handle('products:getByBarcode', (_, barcode: string) => {
    return getProductByBarcode(barcode)
  })

  ipcMain.handle('products:getById', (_, productId: number) => {
    return getProductById(productId)
  })

  ipcMain.handle('products:list', (_, limit?: number, status?: 'active' | 'disabled' | 'all') => {
    return listProductCatalog(limit, status)
  })

  ipcMain.handle(
    'products:search',
    (_, searchTerm: string, limit?: number, status?: 'active' | 'disabled' | 'all') => {
      return searchProductCatalog(searchTerm, limit, status)
    }
  )

  ipcMain.handle('products:create', (_, data) => {
    return addProduct(data)
  })

  ipcMain.handle('products:update', (_, productId: number, data) => {
    return editProduct(productId, data)
  })

  ipcMain.handle('products:disable', (_, productId: number) => {
    removeProduct(productId)

    return {
      success: true
    }
  })

  ipcMain.handle('products:enable', (_, productId: number) => {
    restoreProduct(productId)

    return {
      success: true
    }
  })

  ipcMain.handle('products:getByIdAnyStatus', (_, productId: number) => {
    return getProductByIdAnyStatus(productId)
  })
}
