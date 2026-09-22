export function rupeesToPaise(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Invalid money value')
  }

  return Math.round(value * 100)
}

export function paiseToRupees(value: number): number {
  if (!Number.isInteger(value)) {
    throw new Error('Money must be stored as integer paise')
  }

  return value / 100
}

export function formatRupees(valuePaise: number): string {
  if (!Number.isInteger(valuePaise)) {
    throw new Error('Money must be stored as integer paise')
  }

  return `₹${(valuePaise / 100).toFixed(2)}`
}
