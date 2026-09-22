interface ProductRecord {
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

interface Window {
  kirana: {
    app: {
      getName: () => string
      getVersion: () => string
      ping: () => Promise<{
        success: boolean
        message: string
      }>
    }

    database: {
      test: () => Promise<{
        success: boolean
        version: number
      }>
    }

    products: {
      getByBarcode: (barcode: string) => Promise<ProductRecord | undefined>

      getById: (productId: number) => Promise<ProductRecord | undefined>

      getByIdAnyStatus: (productId: number) => Promise<ProductRecord | undefined>

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
      }) => Promise<ProductRecord>

      list: (limit?: number, status?: 'active' | 'disabled' | 'all') => Promise<ProductRecord[]>

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
      ) => Promise<ProductRecord>

      disable: (productId: number) => Promise<{ success: boolean }>
      enable: (productId: number) => Promise<{ success: boolean }>
    }
  }
}
