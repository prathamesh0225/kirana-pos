import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'

let testDb: Database.Database

vi.mock('../../src/main/database', () => ({
  getDatabase: () => testDb
}))

import { completeSale, type CompleteSaleInput } from '../../src/main/services/sale.service'

describe('completeSale', () => {
  beforeEach(() => {
    testDb = new Database(':memory:')

    testDb.pragma('foreign_keys = ON')

    testDb.exec(`
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mobile TEXT,
        address TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        category_id INTEGER,
        mrp_paise INTEGER NOT NULL DEFAULT 0,
        selling_price_paise INTEGER NOT NULL DEFAULT 0,
        purchase_price_paise INTEGER NOT NULL DEFAULT 0,
        stock_quantity REAL NOT NULL DEFAULT 0,
        low_stock_level REAL NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT 'PCS',
        quantity_precision INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER,
        sale_date TEXT NOT NULL,
        subtotal_paise INTEGER NOT NULL DEFAULT 0,
        discount_paise INTEGER NOT NULL DEFAULT 0,
        total_paise INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'completed',
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );

      CREATE TABLE sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        barcode TEXT,
        mrp_paise INTEGER NOT NULL DEFAULT 0,
        quantity REAL NOT NULL,
        free_quantity REAL NOT NULL DEFAULT 0,
        rate_paise INTEGER NOT NULL DEFAULT 0,
        amount_paise INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );

      CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        payment_method TEXT NOT NULL,
        amount_paise INTEGER NOT NULL,
        payment_date TEXT NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id)
      );

      CREATE TABLE stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        movement_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        reference_type TEXT,
        reference_id INTEGER,
        movement_date TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `)
  })

  afterEach(() => {
    testDb.close()
  })

  function createProduct(stockQuantity: number, isActive = 1): number {
    const result = testDb
      .prepare(
        `
        INSERT INTO products (
          barcode,
          name,
          mrp_paise,
          selling_price_paise,
          purchase_price_paise,
          stock_quantity,
          low_stock_level,
          is_active,
          created_at,
          updated_at,
          unit,
          quantity_precision
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        `TEST-${Date.now()}-${Math.random()}`,
        'Test Product',
        10000,
        9000,
        8000,
        stockQuantity,
        2,
        isActive,
        new Date().toISOString(),
        new Date().toISOString(),
        'PCS',
        0
      )

    return Number(result.lastInsertRowid)
  }

  function createSaleInput(
    productId: number | null,
    quantity: number,
    freeQuantity = 0
  ): CompleteSaleInput {
    const amountPaise = Math.round(quantity * 9000)

    return {
      billNumber: `TEST-${Date.now()}-${Math.random()}`,
      customerName: '',
      customerMobile: '',
      lines: [
        {
          productId,
          productName: productId === null ? 'General Item' : 'Test Product',
          barcode: productId === null ? null : 'TEST-BARCODE',
          mrpPaise: 10000,
          quantity,
          freeQuantity,
          ratePaise: 9000,
          amountPaise
        }
      ],
      payment: {
        mode: 'cash',
        cashPaise: amountPaise,
        upiPaise: 0,
        paidPaise: amountPaise,
        changePaise: 0
      }
    }
  }

  it('deducts sold quantity from stock', () => {
    const productId = createProduct(10)

    const input = createSaleInput(productId, 3)

    completeSale(input)

    const product = testDb
      .prepare(
        `
        SELECT stock_quantity
        FROM products
        WHERE id = ?
      `
      )
      .get(productId) as {
      stock_quantity: number
    }

    expect(product.stock_quantity).toBe(7)
  })

  it('deducts sold quantity plus free quantity from stock', () => {
    const productId = createProduct(10)

    const input = createSaleInput(productId, 3, 1)

    completeSale(input)

    const product = testDb
      .prepare(
        `
        SELECT stock_quantity
        FROM products
        WHERE id = ?
      `
      )
      .get(productId) as {
      stock_quantity: number
    }

    expect(product.stock_quantity).toBe(6)
  })

  it('creates a SALE stock movement', () => {
    const productId = createProduct(10)

    const input = createSaleInput(productId, 3, 1)

    const result = completeSale(input)

    const movement = testDb
      .prepare(
        `
        SELECT
          product_id,
          movement_type,
          quantity,
          reference_type,
          reference_id
        FROM stock_movements
        WHERE product_id = ?
      `
      )
      .get(productId) as {
      product_id: number
      movement_type: string
      quantity: number
      reference_type: string
      reference_id: number
    }

    expect(movement.product_id).toBe(productId)
    expect(movement.movement_type).toBe('SALE')
    expect(movement.quantity).toBe(-4)
    expect(movement.reference_type).toBe('SALE')
    expect(movement.reference_id).toBe(result.saleId)
  })

  it('rejects a sale when stock is insufficient', () => {
    const productId = createProduct(3)

    const input = createSaleInput(productId, 4)

    expect(() => completeSale(input)).toThrow('Insufficient stock for Test Product')

    const product = testDb
      .prepare(
        `
        SELECT stock_quantity
        FROM products
        WHERE id = ?
      `
      )
      .get(productId) as {
      stock_quantity: number
    }

    expect(product.stock_quantity).toBe(3)

    const sales = testDb.prepare('SELECT COUNT(*) AS count FROM sales').get() as {
      count: number
    }

    expect(sales.count).toBe(0)

    const movements = testDb.prepare('SELECT COUNT(*) AS count FROM stock_movements').get() as {
      count: number
    }

    expect(movements.count).toBe(0)
  })

  it('does not change stock for a General Item', () => {
    const input = createSaleInput(null, 2)

    const result = completeSale(input)

    expect(result.saleId).toBeGreaterThan(0)

    const movements = testDb.prepare('SELECT COUNT(*) AS count FROM stock_movements').get() as {
      count: number
    }

    expect(movements.count).toBe(0)

    const saleItem = testDb
      .prepare(
        `
        SELECT product_id
        FROM sale_items
        WHERE sale_id = ?
      `
      )
      .get(result.saleId) as {
      product_id: number | null
    }

    expect(saleItem.product_id).toBeNull()
  })

  it('rejects a disabled product', () => {
    const productId = createProduct(10, 0)

    const input = createSaleInput(productId, 1)

    expect(() => completeSale(input)).toThrow('Product is disabled: Test Product')

    const product = testDb
      .prepare(
        `
        SELECT stock_quantity
        FROM products
        WHERE id = ?
      `
      )
      .get(productId) as {
      stock_quantity: number
    }

    expect(product.stock_quantity).toBe(10)
  })

  it('records the payment', () => {
    const productId = createProduct(10)

    const input = createSaleInput(productId, 2)

    const result = completeSale(input)

    const payment = testDb
      .prepare(
        `
        SELECT
          payment_method,
          amount_paise
        FROM payments
        WHERE sale_id = ?
      `
      )
      .get(result.saleId) as {
      payment_method: string
      amount_paise: number
    }

    expect(payment.payment_method).toBe('CASH')
    expect(payment.amount_paise).toBe(18000)
  })
})
