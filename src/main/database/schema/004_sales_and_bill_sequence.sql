CREATE TABLE IF NOT EXISTS bill_number_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_number INTEGER NOT NULL
);

INSERT OR IGNORE INTO bill_number_sequence (id, next_number)
VALUES (1, 1);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_mobile TEXT NOT NULL DEFAULT '',
  subtotal_paise INTEGER NOT NULL,
  total_paise INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  barcode TEXT,
  quantity REAL NOT NULL,
  free_quantity REAL NOT NULL DEFAULT 0,
  rate_paise INTEGER NOT NULL,
  amount_paise INTEGER NOT NULL,
  is_temporary INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  payment_mode TEXT NOT NULL,
  cash_paise INTEGER NOT NULL DEFAULT 0,
  upi_paise INTEGER NOT NULL DEFAULT 0,
  paid_paise INTEGER NOT NULL,
  change_paise INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);