import { ElectronAPI } from '@electron-toolkit/preload'

type PrinterInfo = {
  name: string
  displayName: string
  description: string
}

type ProductRecord = {
  id: number
  barcode: string | null
  name: string
  category_id: number | null
  unit: string
  quantity_precision: number
  mrp_paise: number
  selling_price_paise: number
  purchase_price_paise: number
  stock_quantity: number
  low_stock_level: number
  is_active: number
  created_at: string
  updated_at: string
}

type EscPosReceiptLine = {
  productName: string
  mrpPaise: number
  quantity: number
  freeQuantity: number
  ratePaise: number
  amountPaise: number
}

type EscPosReceipt = {
  billNumber: string
  saleDate: string

  customerName?: string
  customerMobile?: string

  lines: EscPosReceiptLine[]

  totalMrpPaise: number
  discountPaise: number
  totalAmountPaise: number

  paymentMethod?: 'cash' | 'upi' | 'mixed'
  paidPaise?: number
  changePaise?: number
}

type StockMovementRecord = {
  id: number
  productId: number
  movementType: string
  quantity: number
  referenceType: string | null
  referenceId: number | null
  movementDate: string
  notes: string | null
  reason: string | null
}

declare global {
  interface Window {
    electron: ElectronAPI

    api: unknown

    kirana: {
      app: {
        getName: () => string
        getVersion: () => Promise<string>
        getInfo: () => Promise<{
          name: string
          version: string
        }>
      }

      database: {
        test: () => Promise<{
          success: boolean
          migrationVersion: number
        }>

        backup: () => Promise<{
          canceled: boolean
          filePath?: string
        }>
      }

      products: {
        getByBarcode: (barcode: string) => Promise<ProductRecord | undefined>

        getById: (productId: number) => Promise<ProductRecord | undefined>

        getByIdAnyStatus: (productId: number) => Promise<ProductRecord | undefined>

        list: (limit?: number, status?: 'active' | 'disabled' | 'all') => Promise<ProductRecord[]>

        search: (
          searchTerm: string,
          limit?: number,
          status?: 'active' | 'disabled' | 'all'
        ) => Promise<ProductRecord[]>

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
        }) => Promise<ProductRecord[]>

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
        ) => Promise<ProductRecord[]>

        disable: (productId: number) => Promise<unknown>

        enable: (productId: number) => Promise<unknown>

        adjustStock: (
          productId: number,
          data: {
            quantity: number
            reason: string
          }
        ) => Promise<unknown>

        getStockHistory: (
          productId: number,
          fromDate?: string | null,
          toDate?: string | null
        ) => Promise<StockMovementRecord[]>
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

        getDashboardSalesSummary: () => Promise<{
          totalSalesPaise: number
          billsToday: number
        }>

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

        repairCompletedSlot: () => Promise<string>
      }

      printer: {
        list: () => Promise<PrinterInfo[]>

        test: (printerName: string) => Promise<void>

        printReceipt: (printerName: string, receipt: EscPosReceipt) => Promise<void>

        rawReceiptTest: (printerName: string) => Promise<void>
      }

      settings: {
        getPrinter: () => Promise<{
          printerName: string | null
        }>

        setPrinter: (printerName: string | null) => Promise<{
          printerName: string | null
        }>
      }
    }
  }
}

export {}
