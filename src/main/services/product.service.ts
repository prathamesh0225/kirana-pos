import {
  createProduct,
  disableProduct,
  enableProduct,
  findProductByBarcode,
  findProductById,
  findProductByIdAnyStatus,
  listProducts,
  searchProducts,
  updateProduct,
  type CreateProductData,
  type ProductRecord,
  type UpdateProductData
} from '../repositories/product.repository'

import { requireValidQuantity } from '../utils/quantity'

import { nowIso } from '../utils/dates'

import { requireNonEmpty, requireNonNegative, requirePositive } from '../utils/validation'

export const PRODUCT_UNITS = ['PCS', 'KG', 'GRAM', 'LITRE', 'ML', 'BOX', 'PACK', 'DOZEN'] as const

export type ProductUnit = (typeof PRODUCT_UNITS)[number]

const DEFAULT_QUANTITY_PRECISION: Record<ProductUnit, number> = {
  PCS: 0,
  KG: 3,
  GRAM: 0,
  LITRE: 3,
  ML: 0,
  BOX: 0,
  PACK: 0,
  DOZEN: 0
}

function requireValidUnit(unit?: string): ProductUnit {
  const cleanUnit = unit?.trim().toUpperCase() || 'PCS'

  if (!PRODUCT_UNITS.includes(cleanUnit as ProductUnit)) {
    throw new Error(`Invalid product unit: ${cleanUnit}`)
  }

  return cleanUnit as ProductUnit
}

function getQuantityPrecision(unit: ProductUnit, requestedPrecision?: number): number {
  const defaultPrecision = DEFAULT_QUANTITY_PRECISION[unit]

  if (requestedPrecision === undefined) {
    return defaultPrecision
  }

  if (!Number.isInteger(requestedPrecision) || requestedPrecision < 0 || requestedPrecision > 3) {
    throw new Error('Quantity precision must be an integer from 0 to 3')
  }

  return requestedPrecision
}

export function getProductByBarcode(barcode: string): ProductRecord | undefined {
  const cleanBarcode = requireNonEmpty(barcode, 'Barcode')

  return findProductByBarcode(cleanBarcode)
}

export function getProductById(productId: number): ProductRecord | undefined {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('Invalid product ID')
  }

  return findProductById(productId)
}

export function getProductByIdAnyStatus(productId: number): ProductRecord | undefined {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('Invalid product ID')
  }

  return findProductByIdAnyStatus(productId)
}

export function listProductCatalog(
  limit = 100,
  status: 'active' | 'disabled' | 'all' = 'active'
): ProductRecord[] {
  if (!Number.isInteger(limit) || limit <= 0 || limit > 500) {
    throw new Error('Invalid product list limit')
  }

  if (!['active', 'disabled', 'all'].includes(status)) {
    throw new Error('Invalid product status filter')
  }

  return listProducts(limit, status)
}

export function searchProductCatalog(
  searchTerm: string,
  limit = 20,
  status: 'active' | 'disabled' | 'all' = 'active'
): ProductRecord[] {
  const cleanSearchTerm = searchTerm.trim()

  if (!cleanSearchTerm) {
    return []
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
    throw new Error('Invalid search limit')
  }

  if (!['active', 'disabled', 'all'].includes(status)) {
    throw new Error('Invalid product status filter')
  }

  return searchProducts(cleanSearchTerm, limit, status)
}

function validateProductData(data: {
  name: string
  barcode?: string
  categoryId?: number
  unit?: string
  quantityPrecision?: number
  mrpPaise: number
  sellingPricePaise: number
  purchasePricePaise: number
  lowStockLevel?: number
}): {
  name: string
  barcode?: string
  categoryId?: number
  unit: ProductUnit
  quantityPrecision: number
  mrpPaise: number
  sellingPricePaise: number
  purchasePricePaise: number
  lowStockLevel: number
} {
  const name = requireNonEmpty(data.name, 'Product name')
  const barcode = data.barcode?.trim() || undefined

  const unit = requireValidUnit(data.unit)

  const quantityPrecision = getQuantityPrecision(unit, data.quantityPrecision)

  if (!Number.isFinite(data.mrpPaise) || data.mrpPaise < 0) {
    throw new Error('MRP cannot be negative')
  }

  requirePositive(data.sellingPricePaise, 'Selling price')
  requireNonNegative(data.purchasePricePaise, 'Purchase price')

  const lowStockLevel = data.lowStockLevel ?? 0

  requireValidQuantity(lowStockLevel, quantityPrecision, 'Low stock level')

  if (data.categoryId !== undefined) {
    if (!Number.isInteger(data.categoryId) || data.categoryId <= 0) {
      throw new Error('Invalid category')
    }
  }

  return {
    name,
    barcode,
    categoryId: data.categoryId,
    unit,
    quantityPrecision,
    mrpPaise: data.mrpPaise,
    sellingPricePaise: data.sellingPricePaise,
    purchasePricePaise: data.purchasePricePaise,
    lowStockLevel
  }
}

export function addProduct(data: CreateProductData): ProductRecord {
  const validated = validateProductData(data)

  const stockQuantity = data.stockQuantity ?? 0

  requireValidQuantity(stockQuantity, validated.quantityPrecision, 'Stock quantity')

  if (validated.barcode) {
    const existingProduct = findProductByBarcode(validated.barcode)

    if (existingProduct) {
      throw new Error('A product with this barcode already exists')
    }
  }

  return createProduct(
    {
      ...validated,
      stockQuantity
    },
    nowIso()
  )
}

export function editProduct(productId: number, data: UpdateProductData): ProductRecord {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('Invalid product ID')
  }

  const existingProduct = findProductByIdAnyStatus(productId)

  if (!existingProduct) {
    throw new Error('Product not found')
  }

  const validated = validateProductData(data)

  if (existingProduct.stock_quantity !== 0) {
    if (existingProduct.unit !== validated.unit) {
      throw new Error(
        `Cannot change unit from ${existingProduct.unit} to ${validated.unit}. ` +
          `This product currently has ${existingProduct.stock_quantity} ${existingProduct.unit} in stock. ` +
          `Please clear or adjust the existing stock before changing the unit.`
      )
    }

    requireValidQuantity(
      existingProduct.stock_quantity,
      validated.quantityPrecision,
      'Existing stock quantity'
    )
  }

  if (validated.barcode) {
    const productWithBarcode = findProductByBarcode(validated.barcode)

    if (productWithBarcode && productWithBarcode.id !== productId) {
      throw new Error('A product with this barcode already exists')
    }
  }

  return updateProduct(productId, validated, nowIso())
}

export function restoreProduct(productId: number): void {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('Invalid product ID')
  }

  const existingProduct = findProductByIdAnyStatus(productId)

  if (!existingProduct) {
    throw new Error('Product not found')
  }

  if (existingProduct.is_active === 1) {
    throw new Error('Product is already active')
  }

  enableProduct(productId, nowIso())
}

export function removeProduct(productId: number): void {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('Invalid product ID')
  }

  const existingProduct = findProductById(productId)

  if (!existingProduct) {
    throw new Error('Product not found')
  }

  disableProduct(productId, nowIso())
}
