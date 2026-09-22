import { contextBridge, ipcRenderer } from 'electron'

const api = {
  app: {
    getName: () => 'Kirana Mart POS',
    getVersion: () => '0.1.0',
    ping: () => ipcRenderer.invoke('app:ping')
  },

  database: {
    test: () => ipcRenderer.invoke('database:test')
  },

  products: {
    getByBarcode: (barcode: string) => ipcRenderer.invoke('products:getByBarcode', barcode),

    getById: (productId: number) => ipcRenderer.invoke('products:getById', productId),

    getByIdAnyStatus: (productId: number) =>
      ipcRenderer.invoke('products:getByIdAnyStatus', productId),

    list: (limit?: number, status?: 'active' | 'disabled' | 'all') =>
      ipcRenderer.invoke('products:list', limit, status),

    search: (searchTerm: string, limit?: number, status?: 'active' | 'disabled' | 'all') =>
      ipcRenderer.invoke('products:search', searchTerm, limit, status),

    create: (data: {
      barcode?: string
      name: string
      categoryId?: number
      unit?: string
      quantityPrecision?: number
      mrpPaise: number
      sellingPricePaise: number
      purchasePricePaise: number
      stockQuantity?: number
      lowStockLevel?: number
    }) => ipcRenderer.invoke('products:create', data),

    update: (
      productId: number,
      data: {
        barcode?: string
        name: string
        categoryId?: number
        unit?: string
        quantityPrecision?: number
        mrpPaise: number
        sellingPricePaise: number
        purchasePricePaise: number
        lowStockLevel?: number
      }
    ) => ipcRenderer.invoke('products:update', productId, data),

    disable: (productId: number) => ipcRenderer.invoke('products:disable', productId),

    enable: (productId: number) => ipcRenderer.invoke('products:enable', productId)
  }
}

contextBridge.exposeInMainWorld('kirana', api)
