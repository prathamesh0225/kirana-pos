import { getDatabase } from '../database'

export type Supplier = {
  id: number
  name: string
  mobile: string | null
  address: string | null
  gstin: string | null
  openingBalancePaise: number
  balanceType: 'NONE' | 'PAYABLE' | 'RECEIVABLE'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type SupplierRow = {
  id: number
  name: string
  mobile: string | null
  address: string | null
  gstin: string | null
  opening_balance_paise: number
  balance_type: 'NONE' | 'PAYABLE' | 'RECEIVABLE'
  is_active: number
  created_at: string
  updated_at: string
}

function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    address: row.address,
    gstin: row.gstin,
    openingBalancePaise: row.opening_balance_paise,
    balanceType: row.balance_type,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listSuppliers(includeInactive = false): Supplier[] {
  const db = getDatabase()

  const rows = includeInactive
    ? db
        .prepare(
          `
          SELECT
            id,
            name,
            mobile,
            address,
            gstin,
            opening_balance_paise,
            balance_type,
            is_active,
            created_at,
            updated_at
          FROM suppliers
          ORDER BY name COLLATE NOCASE ASC
        `
        )
        .all()
    : db
        .prepare(
          `
          SELECT
            id,
            name,
            mobile,
            address,
            gstin,
            opening_balance_paise,
            balance_type,
            is_active,
            created_at,
            updated_at
          FROM suppliers
          WHERE is_active = 1
          ORDER BY name COLLATE NOCASE ASC
        `
        )
        .all()

  return (rows as SupplierRow[]).map(mapSupplier)
}

export function getSupplierById(id: number): Supplier | null {
  const db = getDatabase()

  const row = db
    .prepare(
      `
      SELECT
        id,
        name,
        mobile,
        address,
        gstin,
        opening_balance_paise,
        balance_type,
        is_active,
        created_at,
        updated_at
      FROM suppliers
      WHERE id = ?
    `
    )
    .get(id) as SupplierRow | undefined

  return row ? mapSupplier(row) : null
}

export function createSupplier(data: {
  name: string
  mobile?: string
  address?: string
  gstin?: string
  openingBalancePaise?: number
  balanceType?: 'NONE' | 'PAYABLE' | 'RECEIVABLE'
}): Supplier {
  const db = getDatabase()
  const now = new Date().toISOString()

  const result = db
    .prepare(
      `
      INSERT INTO suppliers (
        name,
        mobile,
        address,
        gstin,
        opening_balance_paise,
        balance_type,
        is_active,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `
    )
    .run(
      data.name.trim(),
      data.mobile?.trim() || null,
      data.address?.trim() || null,
      data.gstin?.trim() || null,
      data.openingBalancePaise ?? 0,
      data.balanceType ?? 'NONE',
      now,
      now
    )

  return getSupplierById(Number(result.lastInsertRowid))!
}

export function updateSupplier(
  id: number,
  data: {
    name: string
    mobile?: string
    address?: string
    gstin?: string
    openingBalancePaise?: number
    balanceType?: 'NONE' | 'PAYABLE' | 'RECEIVABLE'
  }
): Supplier {
  const db = getDatabase()
  const now = new Date().toISOString()

  db.prepare(
    `
    UPDATE suppliers
    SET
      name = ?,
      mobile = ?,
      address = ?,
      gstin = ?,
      opening_balance_paise = ?,
      balance_type = ?,
      updated_at = ?
    WHERE id = ?
  `
  ).run(
    data.name.trim(),
    data.mobile?.trim() || null,
    data.address?.trim() || null,
    data.gstin?.trim() || null,
    data.openingBalancePaise ?? 0,
    data.balanceType ?? 'NONE',
    now,
    id
  )

  const supplier = getSupplierById(id)

  if (!supplier) {
    throw new Error('Supplier not found.')
  }

  return supplier
}

export function setSupplierActive(id: number, active: boolean): void {
  const db = getDatabase()

  db.prepare(
    `
    UPDATE suppliers
    SET
      is_active = ?,
      updated_at = ?
    WHERE id = ?
  `
  ).run(active ? 1 : 0, new Date().toISOString(), id)
}
