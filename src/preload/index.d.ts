import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI

    api: unknown

    kirana: {
      app: {
        getName: () => string
        getVersion: () => string
        ping: () => Promise<unknown>
      }

      database: {
        test: () => Promise<unknown>
      }

      products: {
        getByBarcode: (barcode: string) => Promise<unknown>

        getById: (productId: number) => Promise<unknown>

        getByIdAnyStatus: (productId: number) => Promise<unknown>

        list: (limit?: number, status?: 'active' | 'disabled' | 'all') => Promise<unknown>

        search: (
          searchTerm: string,
          limit?: number,
          status?: 'active' | 'disabled' | 'all'
        ) => Promise<unknown>

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
        }) => Promise<unknown>

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
        ) => Promise<unknown>

        disable: (productId: number) => Promise<unknown>

        enable: (productId: number) => Promise<unknown>
      }

      billing: {
        getSlots: () => Promise<
          [
            {
              slotId: 0
              billNumber: string
            },
            {
              slotId: 1
              billNumber: string
            }
          ]
        >

        allocateNextBillNumber: (slotId: 0 | 1) => Promise<string>

        completeSale: (input: unknown) => Promise<{
          saleId: number
          billNumber: string
        }>

        processSaleReturn: (input: unknown) => Promise<{
          returnId: number
          saleId: number
          totalRefundPaise: number
        }>

        listSales: (limit?: number) => Promise<
          Array<{
            id: number
            billNumber: string
            saleDate: string
            totalPaise: number
            status: string
            refundedPaise: number
            netPaise: number
          }>
        >

        getSaleById: (saleId: number) => Promise<{
          id: number
          billNumber: string
          saleDate: string
          subtotalPaise: number
          discountPaise: number
          totalPaise: number
          status: string
          items: Array<{
            id: number
            productId: number | null
            productName: string
            barcode: string | null
            mrpPaise: number
            quantity: number
            freeQuantity: number
            ratePaise: number
            amountPaise: number
          }>
          payments: Array<{
            id: number
            paymentMethod: string
            amountPaise: number
          }>
          returns: Array<{
            id: number
            returnDate: string
            totalRefundPaise: number
            status: string
          }>
          refundedPaise: number
          netPaise: number
        } | null>

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
        }) => Promise<{
          saleId: number
          billNumber: string
          totalPaise: number
          adjustmentPaise: number
        }>
      }
    }
  }
}

export {}
