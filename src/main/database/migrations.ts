//migrations.ts
import path from 'node:path'

import { getDatabase, getDatabaseBackupDirectory } from './index'

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
  },
  {
    version: 7,
    name: 'sale_returns',
    sql: `
    CREATE TABLE IF NOT EXISTS sale_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      return_date TEXT NOT NULL,
      total_refund_paise INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      notes TEXT,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sale_returns_sale_id
      ON sale_returns(sale_id);

    CREATE TABLE IF NOT EXISTS sale_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_return_id INTEGER NOT NULL,
      sale_item_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      free_quantity REAL NOT NULL DEFAULT 0,
      rate_paise INTEGER NOT NULL DEFAULT 0,
      refund_amount_paise INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (sale_return_id) REFERENCES sale_returns(id),
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sale_return_items_return_id
      ON sale_return_items(sale_return_id);

    CREATE INDEX IF NOT EXISTS idx_sale_return_items_sale_item_id
      ON sale_return_items(sale_item_id);

    CREATE TABLE IF NOT EXISTS return_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_return_id INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      amount_paise INTEGER NOT NULL DEFAULT 0,
      payment_date TEXT NOT NULL,
      FOREIGN KEY (sale_return_id) REFERENCES sale_returns(id)
    );

    CREATE INDEX IF NOT EXISTS idx_return_payments_return_id
      ON return_payments(sale_return_id);
  `
  },
  {
    version: 8,
    name: 'sale_modifications',
    sql: `
    CREATE TABLE IF NOT EXISTS sale_modifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      original_total_paise INTEGER NOT NULL,
      new_total_paise INTEGER NOT NULL,
      adjustment_type TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      adjustment_amount_paise INTEGER NOT NULL DEFAULT 0,
      modification_date TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sale_modifications_sale_id
      ON sale_modifications(sale_id);
  `
  },
  {
    version: 9,
    name: 'printer_settings',
    sql: `
    CREATE TABLE IF NOT EXISTS printer_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      printer_name TEXT
    );

    INSERT OR IGNORE INTO printer_settings (
      id,
      printer_name
    ) VALUES (
      1,
      NULL
    );
  `
  },
  {
    version: 10,
    name: 'stock_adjustment_reason',
    sql: `
    ALTER TABLE stock_movements
ADD COLUMN reason TEXT;
    `
  },
  {
    version: 11,
    name: 'v2_purchase_batch',
    sql: `
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    gstin TEXT,

    opening_balance_paise INTEGER NOT NULL DEFAULT 0,

    balance_type TEXT NOT NULL DEFAULT 'NONE'
        CHECK (balance_type IN ('NONE', 'PAYABLE', 'RECEIVABLE')),

    is_active INTEGER NOT NULL DEFAULT 1,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS purchase_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    invoice_number TEXT NOT NULL,
    supplier_id INTEGER NOT NULL,

    purchase_date TEXT NOT NULL,

    subtotal_paise INTEGER NOT NULL DEFAULT 0,
    discount_paise INTEGER NOT NULL DEFAULT 0,
    tax_paise INTEGER NOT NULL DEFAULT 0,

    total_amount_paise INTEGER NOT NULL DEFAULT 0,

    paid_paise INTEGER NOT NULL DEFAULT 0,
    balance_paise INTEGER NOT NULL DEFAULT 0,

    notes TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (supplier_id)
        REFERENCES suppliers(id)
);


CREATE TABLE IF NOT EXISTS stock_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    product_id INTEGER NOT NULL,

    batch_number TEXT,
    expiry_date TEXT,

    mrp_paise INTEGER NOT NULL,
    purchase_rate_paise INTEGER NOT NULL,
    selling_rate_paise INTEGER NOT NULL,

    quantity REAL NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (product_id)
        REFERENCES products(id)
);


CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    purchase_invoice_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,

    mrp_paise INTEGER NOT NULL,
    purchase_rate_paise INTEGER NOT NULL,
    selling_rate_paise INTEGER NOT NULL,

    quantity REAL NOT NULL,
    free_quantity REAL NOT NULL DEFAULT 0,

    amount_paise INTEGER NOT NULL,

    created_at TEXT NOT NULL,

    FOREIGN KEY (purchase_invoice_id)
        REFERENCES purchase_invoices(id)
        ON DELETE CASCADE,

    FOREIGN KEY (product_id)
        REFERENCES products(id),

    FOREIGN KEY (batch_id)
        REFERENCES stock_batches(id)
);


ALTER TABLE stock_movements
ADD COLUMN batch_id INTEGER REFERENCES stock_batches(id);`
  },
  {
    version: 12,
    name: 'v2_supplier_fields',
    sql: `
      ALTER TABLE suppliers
        ADD COLUMN opening_balance_paise INTEGER NOT NULL DEFAULT 0;

      ALTER TABLE suppliers
        ADD COLUMN balance_type TEXT NOT NULL DEFAULT 'NONE'
          CHECK (balance_type IN ('NONE', 'PAYABLE', 'RECEIVABLE'));

      ALTER TABLE suppliers
        ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
    `
  },
  {
    version: 13,
    name: 'purchase_payment_method',
    sql: `
    ALTER TABLE purchase_invoices
      ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'CREDIT'
        CHECK (payment_method IN ('CASH', 'UPI', 'CREDIT'));
  `
  }
]

export async function runMigrations(): Promise<void> {
  const db = getDatabase()

  const migrationsTableExists = db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = 'migrations'
      `
    )
    .get()

  if (!migrationsTableExists) {
    db.exec(`
      CREATE TABLE migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `)
  }

  const latestMigration = migrations[migrations.length - 1]

  const currentMigration = db
    .prepare(
      `
      SELECT MAX(version) AS version
      FROM migrations
      `
    )
    .get() as { version: number | null }

  const currentVersion = currentMigration.version ?? 0
  const latestVersion = latestMigration.version

  if (currentVersion >= latestVersion) {
    return
  }

  // Existing database is being upgraded.
  // Make a safety backup before changing its schema.
  if (currentVersion > 0) {
    const backupDirectory = getDatabaseBackupDirectory()

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    const backupPath = path.join(
      backupDirectory,
      `before-migration-${currentVersion}-to-${latestVersion}-${timestamp}.db`
    )

    console.log(`Creating migration backup: ${backupPath}`)

    await db.backup(backupPath)

    console.log('Migration backup created successfully.')
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue
    }

    console.log(`Applying migration ${migration.version}`)

    const transaction = db.transaction(() => {
      db.exec(migration.sql)

      db.prepare(
        `
        INSERT INTO migrations (
          version,
          applied_at
        )
        VALUES (?, ?)
        `
      ).run(migration.version, new Date().toISOString())
    })

    transaction()

    console.log(`Migration ${migration.version} applied.`)
  }
}
