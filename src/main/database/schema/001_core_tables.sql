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