import {
  createSupplier,
  getSupplierById,
  listSuppliers,
  setSupplierActive,
  updateSupplier
} from '../repositories/supplier.repository'

export type SupplierInput = {
  name: string
  mobile?: string
  address?: string
  gstin?: string
  openingBalancePaise?: number
  balanceType?: 'NONE' | 'PAYABLE' | 'RECEIVABLE'
}

function validateSupplier(data: SupplierInput): void {
  if (!data.name.trim()) {
    throw new Error('Supplier name is required.')
  }

  if ((data.openingBalancePaise ?? 0) < 0) {
    throw new Error('Opening balance cannot be negative.')
  }
}

export function getSuppliers(includeInactive = false) {
  return listSuppliers(includeInactive)
}

export function getSupplier(id: number) {
  return getSupplierById(id)
}

export function addSupplier(data: SupplierInput) {
  validateSupplier(data)

  return createSupplier({
    ...data,
    openingBalancePaise: data.openingBalancePaise ?? 0,
    balanceType: data.balanceType ?? 'NONE'
  })
}

export function editSupplier(id: number, data: SupplierInput) {
  validateSupplier(data)

  if (!getSupplierById(id)) {
    throw new Error('Supplier not found.')
  }

  return updateSupplier(id, {
    ...data,
    openingBalancePaise: data.openingBalancePaise ?? 0,
    balanceType: data.balanceType ?? 'NONE'
  })
}

export function changeSupplierStatus(id: number, active: boolean): void {
  if (!getSupplierById(id)) {
    throw new Error('Supplier not found.')
  }

  setSupplierActive(id, active)
}
