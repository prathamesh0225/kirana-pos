//product.repository.ts
import { getDatabase } from '../database'

export type ProductRecord = {
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

export type CreateProductData = {
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
}

export type UpdateProductData = {
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

function getProductSelectSql(): string {
  return `
    SELECT
      id,
      barcode,
      name,
      category_id,
      unit,
      quantity_precision,
      mrp_paise,
      selling_price_paise,
      purchase_price_paise,
      stock_quantity,
      low_stock_level,
      is_active,
      created_at,
      updated_at
    FROM products
  `
}

export function findProductByBarcode(barcode: string): ProductRecord | undefined {
  const db = getDatabase()

  return db
    .prepare(
      `
      ${getProductSelectSql()}
      WHERE barcode = ?
        AND is_active = 1
      LIMIT 1
    `
    )
    .get(barcode) as ProductRecord | undefined
}

const INTERNAL_BARCODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateBarcodeCandidate(): string {
  let barcode = ''

  for (let i = 0; i < 7; i++) {
    const index = Math.floor(Math.random() * INTERNAL_BARCODE_CHARACTERS.length)
    barcode += INTERNAL_BARCODE_CHARACTERS[index]
  }

  return barcode
}

export function generateUniqueBarcode(): string {
  const db = getDatabase()

  /*
   * Try multiple candidates rather than relying on
   * randomness alone.
   */
  for (let attempt = 0; attempt < 1000; attempt++) {
    const barcode = generateBarcodeCandidate()

    const existing = db
      .prepare(
        `
        SELECT id
        FROM products
        WHERE barcode = ?
        LIMIT 1
        `
      )
      .get(barcode)

    if (!existing) {
      return barcode
    }
  }

  throw new Error('Unable to generate a unique barcode')
}

export function findProductByName(
  name: string,
  excludeProductId?: number
): ProductRecord | undefined {
  const db = getDatabase()

  if (excludeProductId !== undefined) {
    return db
      .prepare(
        `
        ${getProductSelectSql()}
        WHERE TRIM(name) COLLATE NOCASE = TRIM(?)
          AND id != ?
        LIMIT 1
        `
      )
      .get(name, excludeProductId) as ProductRecord | undefined
  }

  return db
    .prepare(
      `
      ${getProductSelectSql()}
      WHERE TRIM(name) COLLATE NOCASE = TRIM(?)
      LIMIT 1
      `
    )
    .get(name) as ProductRecord | undefined
}

export function findProductById(productId: number): ProductRecord | undefined {
  const db = getDatabase()

  return db
    .prepare(
      `
      ${getProductSelectSql()}
      WHERE id = ?
        AND is_active = 1
      LIMIT 1
    `
    )
    .get(productId) as ProductRecord | undefined
}

export function findProductByIdAnyStatus(productId: number): ProductRecord | undefined {
  const db = getDatabase()

  return db
    .prepare(
      `
      ${getProductSelectSql()}
      WHERE id = ?
      LIMIT 1
    `
    )
    .get(productId) as ProductRecord | undefined
}

export function listProducts(
  limit = 100,
  status: 'active' | 'disabled' | 'all' = 'active'
): ProductRecord[] {
  const db = getDatabase()

  const statusCondition =
    status === 'active' ? 'WHERE is_active = 1' : status === 'disabled' ? 'WHERE is_active = 0' : ''

  return db
    .prepare(
      `
      ${getProductSelectSql()}
      ${statusCondition}
      ORDER BY name COLLATE NOCASE
      LIMIT ?
    `
    )
    .all(limit) as ProductRecord[]
}
export function searchProducts(
  searchTerm: string,
  limit = 20,
  status: 'active' | 'disabled' | 'all' = 'active'
): ProductRecord[] {
  const db = getDatabase()
  const term = `%${searchTerm.trim()}%`

  const statusCondition =
    status === 'active' ? 'AND is_active = 1' : status === 'disabled' ? 'AND is_active = 0' : ''

  return db
    .prepare(
      `
      ${getProductSelectSql()}
      WHERE (
        name LIKE ?
        OR barcode LIKE ?
      )
      ${statusCondition}
      ORDER BY name COLLATE NOCASE
      LIMIT ?
    `
    )
    .all(term, term, limit) as ProductRecord[]
}

export function createProduct(data: CreateProductData, now: string): ProductRecord {
  const db = getDatabase()

  const result = db
    .prepare(
      `
      INSERT INTO products (
  barcode,
  name,
  category_id,
  unit,
  quantity_precision,
  mrp_paise,
  selling_price_paise,
  purchase_price_paise,
  stock_quantity,
  low_stock_level,
  is_active,
  created_at,
  updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `
    )
    .run(
      data.barcode ?? null,
      data.name,
      data.categoryId ?? null,
      data.unit ?? 'PCS',
      data.quantityPrecision ?? 0,
      data.mrpPaise,
      data.sellingPricePaise,
      data.purchasePricePaise,
      data.stockQuantity ?? 0,
      data.lowStockLevel ?? 0,
      now,
      now
    )

  const product = findProductById(Number(result.lastInsertRowid))

  if (!product) {
    throw new Error('Product was created but could not be loaded')
  }

  return product
}

export function updateProduct(
  productId: number,
  data: UpdateProductData,
  now: string
): ProductRecord {
  const db = getDatabase()

  db.prepare(
    `
    UPDATE products
    SET
      barcode = ?,
      name = ?,
      category_id = ?,
      unit = ?,
      quantity_precision = ?,
      mrp_paise = ?,
      selling_price_paise = ?,
      purchase_price_paise = ?,
      low_stock_level = ?,
      updated_at = ?
    WHERE id = ?
  `
  ).run(
    data.barcode ?? null,
    data.name,
    data.categoryId ?? null,
    data.unit,
    data.quantityPrecision,
    data.mrpPaise,
    data.sellingPricePaise,
    data.purchasePricePaise,
    data.lowStockLevel ?? 0,
    now,
    productId
  )

  const product = findProductByIdAnyStatus(productId)

  if (!product) {
    throw new Error('Product was updated but could not be loaded')
  }

  return product
}

export function disableProduct(productId: number, now: string): void {
  const db = getDatabase()

  db.prepare(
    `
    UPDATE products
    SET
      is_active = 0,
      updated_at = ?
    WHERE id = ?
      AND is_active = 1
  `
  ).run(now, productId)
}

export function enableProduct(productId: number, now: string): void {
  const db = getDatabase()

  db.prepare(
    `
    UPDATE products
    SET
      is_active = 1,
      updated_at = ?
    WHERE id = ?
      AND is_active = 0
  `
  ).run(now, productId)
}

export function adjustProductStock(
  productId: number,
  quantity: number,
  reason: string,
  now: string
): ProductRecord {
  const db = getDatabase()

  return db.transaction(() => {
    const product = findProductByIdAnyStatus(productId)

    if (!product) {
      throw new Error('Product not found')
    }

    const newStock = product.stock_quantity + quantity

    if (newStock < 0) {
      throw new Error('Stock cannot become negative')
    }

    db.prepare(
      `
      UPDATE products
      SET
        stock_quantity = ?,
        updated_at = ?
      WHERE id = ?
      `
    ).run(newStock, now, productId)

    /*
     * Stock movement quantity is signed:
     *
     * +3 = stock added
     * -2 = stock removed
     */
    db.prepare(
      `
  INSERT INTO stock_movements (
    product_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    movement_date,
    reason
  )
  VALUES (?, 'ADJUSTMENT', ?, 'MANUAL_ADJUSTMENT', NULL, ?, ?)
  `
    ).run(productId, quantity, now, reason)

    const updatedProduct = findProductByIdAnyStatus(productId)

    if (!updatedProduct) {
      throw new Error('Product was adjusted but could not be loaded')
    }

    return updatedProduct
  })()
}
