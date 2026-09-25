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
      }
    }
  }
}

export {}
