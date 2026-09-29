import { contextBridge, ipcRenderer } from 'electron'

const api = {
  app: {
    getName: () => 'Kirana Mart POS',

    getVersion: async () => {
      const info = await ipcRenderer.invoke('app:getInfo')
      return info.version
    },

    getInfo: async () => {
      return ipcRenderer.invoke('app:getInfo')
    }
  },

  database: {
    test: () => ipcRenderer.invoke('database:test'),

    backup: () => ipcRenderer.invoke('database:backup')
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

    enable: (productId: number) => ipcRenderer.invoke('products:enable', productId),

    adjustStock: (
      productId: number,
      data: {
        quantity: number
        reason: string
      }
    ) => ipcRenderer.invoke('products:adjustStock', productId, data),

    getStockHistory: (productId: number, fromDate?: string | null, toDate?: string | null) =>
      ipcRenderer.invoke('products:getStockHistory', productId, fromDate, toDate)
  },

  billing: {
    getSlots: () => ipcRenderer.invoke('billing:getSlots'),

    allocateNextBillNumber: (slotId: 0 | 1) =>
      ipcRenderer.invoke('billing:allocateNextBillNumber', slotId),

    completeSale: (input: unknown) => ipcRenderer.invoke('billing:completeSale', input),

    processSaleReturn: (input: unknown) => ipcRenderer.invoke('billing:processSaleReturn', input),

    listSales: (limit?: number) => ipcRenderer.invoke('billing:listSales', limit),

    getDashboardSalesSummary: () => ipcRenderer.invoke('billing:getDashboardSalesSummary'),

    getSaleById: (saleId: number) => ipcRenderer.invoke('billing:getSaleById', saleId),

    updateSale: (input: {
      saleId: number
      customerName?: string
      customerMobile?: string
      lines: Array<{
        saleItemId?: number
        productId: number | null
        productName: string
        barcode: string | null
        mrpPaise: number
        quantity: number
        freeQuantity: number
        ratePaise: number
        amountPaise: number
      }>
      paymentAdjustment?: {
        type: 'charge' | 'refund'
        method: 'cash' | 'upi'
        amountPaise: number
      }
    }) => ipcRenderer.invoke('billing:updateSale', input),
    //window.kirana.billing.repairCompletedSlot()
    repairCompletedSlot: () => ipcRenderer.invoke('billing:repairCompletedSlot')
  },

  printer: {
    list: () => ipcRenderer.invoke('printer:list'),

    test: (printerName: string) => ipcRenderer.invoke('printer:test', printerName),

    printReceipt: (printerName: string, receipt: unknown) =>
      ipcRenderer.invoke('printer:printReceipt', printerName, receipt),
    rawReceiptTest: (printerName: string) =>
      ipcRenderer.invoke('printer:rawReceiptTest', printerName)
  },

  settings: {
    getPrinter: () => ipcRenderer.invoke('settings:getPrinter'),

    setPrinter: (printerName: string | null) =>
      ipcRenderer.invoke('settings:setPrinter', printerName)
  }
}

contextBridge.exposeInMainWorld('kirana', api)
