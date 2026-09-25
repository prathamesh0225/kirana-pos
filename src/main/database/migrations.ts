import { getDatabase } from './index'

type Migration = {
  version: number
  name: string
  sql: string
}
// Never delete or modify existing migrations. Only add new migrations at the end of the list.
const migrations: Migration[] = [
  {
    version: 1,
    name: 'core_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mobile TEXT,
        address TEXT,
        gstin TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mobile TEXT,
        address TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
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

        FOREIGN KEY (category_id)
          REFERENCES categories(id)
      );

      CREATE INDEX IF NOT EXISTS idx_products_barcode
        ON products(barcode);

      CREATE INDEX IF NOT EXISTS idx_products_name
        ON products(name);

      CREATE INDEX IF NOT EXISTS idx_products_category
        ON products(category_id);
    `
  },
  {
    version: 2,
    name: 'sales_and_stock',
    sql: `
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER,
        sale_date TEXT NOT NULL,
        subtotal_paise INTEGER NOT NULL DEFAULT 0,
        discount_paise INTEGER NOT NULL DEFAULT 0,
        total_paise INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'completed',

        FOREIGN KEY (customer_id)
          REFERENCES customers(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sales_bill_number
        ON sales(bill_number);

      CREATE INDEX IF NOT EXISTS idx_sales_date
        ON sales(sale_date);

      CREATE INDEX IF NOT EXISTS idx_sales_customer
        ON sales(customer_id);


      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,

        product_name TEXT NOT NULL,
        barcode TEXT,
        mrp_paise INTEGER NOT NULL DEFAULT 0,
        quantity REAL NOT NULL,
        free_quantity REAL NOT NULL DEFAULT 0,
        rate_paise INTEGER NOT NULL DEFAULT 0,
        amount_paise INTEGER NOT NULL DEFAULT 0,

        FOREIGN KEY (sale_id)
          REFERENCES sales(id),

        FOREIGN KEY (product_id)
          REFERENCES products(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sale_items_sale
        ON sale_items(sale_id);

      CREATE INDEX IF NOT EXISTS idx_sale_items_product
        ON sale_items(product_id);


      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        payment_method TEXT NOT NULL,
        amount_paise INTEGER NOT NULL,
        payment_date TEXT NOT NULL,

        FOREIGN KEY (sale_id)
          REFERENCES sales(id)
      );

      CREATE INDEX IF NOT EXISTS idx_payments_sale
        ON payments(sale_id);

      CREATE INDEX IF NOT EXISTS idx_payments_date
        ON payments(payment_date);


      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        movement_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        reference_type TEXT,
        reference_id INTEGER,
        movement_date TEXT NOT NULL,
        notes TEXT,

        FOREIGN KEY (product_id)
          REFERENCES products(id)
      );

      CREATE INDEX IF NOT EXISTS idx_stock_movements_product
        ON stock_movements(product_id);

      CREATE INDEX IF NOT EXISTS idx_stock_movements_date
        ON stock_movements(movement_date);

      CREATE INDEX IF NOT EXISTS idx_stock_movements_reference
        ON stock_movements(reference_type, reference_id);
    `
  },
  {
    version: 3,
    name: 'product_units',
    sql: `
      ALTER TABLE products
        ADD COLUMN unit TEXT NOT NULL DEFAULT 'PCS';

      ALTER TABLE products
        ADD COLUMN quantity_precision INTEGER NOT NULL DEFAULT 0;
    `
  },
  {
    version: 4,
    name: 'bill_number_sequence',
    sql: `
    CREATE TABLE IF NOT EXISTS bill_number_sequence (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      next_number INTEGER NOT NULL
    );

    INSERT OR IGNORE INTO bill_number_sequence (
      id,
      next_number
    )
    VALUES (1, 1);
  `
  },
  {
    version: 5,
    name: 'sale_items_for_billing',
    sql: `
    DROP TABLE IF EXISTS sale_items;

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

      FOREIGN KEY (sale_id)
        REFERENCES sales(id),

      FOREIGN KEY (product_id)
        REFERENCES products(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sale_items_sale
      ON sale_items(sale_id);

    CREATE INDEX IF NOT EXISTS idx_sale_items_product
      ON sale_items(product_id);
  `
  },
  {
    version: 6,
    name: 'billing_slots',
    sql: `
    CREATE TABLE IF NOT EXISTS billing_slots (
      slot_id INTEGER PRIMARY KEY,
      bill_number TEXT NOT NULL
    );
  `
  }
]

export function runMigrations(): void {
  const db = getDatabase()

  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)

  const getMigration = db.prepare(`
    SELECT version
    FROM migrations
    WHERE version = ?
  `)

  const insertMigration = db.prepare(`
    INSERT INTO migrations (
      version,
      name,
      applied_at
    )
    VALUES (?, ?, ?)
  `)

  const applyMigration = db.transaction((migration: Migration) => {
    migration.sql.split(';').forEach((statement) => {
      const trimmedStatement = statement.trim()

      if (trimmedStatement) {
        db.exec(trimmedStatement)
      }
    })

    insertMigration.run(migration.version, migration.name, new Date().toISOString())
  })

  for (const migration of migrations) {
    const existing = getMigration.get(migration.version) as
      | {
          version: number
        }
      | undefined

    if (!existing) {
      applyMigration(migration)
    }
  }
}
