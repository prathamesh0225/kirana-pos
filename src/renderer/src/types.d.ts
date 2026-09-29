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
