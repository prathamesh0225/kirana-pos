export function roundQuantity(quantity: number, precision: number): number {
  if (!Number.isFinite(quantity)) {
    throw new Error('Invalid quantity')
  }

  if (!Number.isInteger(precision) || precision < 0 || precision > 3) {
    throw new Error('Invalid quantity precision')
  }

  const factor = 10 ** precision

  return Math.round((quantity + Number.EPSILON) * factor) / factor
}

export function isQuantityValid(quantity: number, precision: number): boolean {
  if (!Number.isFinite(quantity)) {
    return false
  }

  if (!Number.isInteger(precision) || precision < 0 || precision > 3) {
    return false
  }

  if (quantity < 0) {
    return false
  }

  const rounded = roundQuantity(quantity, precision)

  return Math.abs(quantity - rounded) < 0.000000001
}

export function requireValidQuantity(
  quantity: number,
  precision: number,
  fieldName = 'Quantity'
): number {
  if (!isQuantityValid(quantity, precision)) {
    throw new Error(`${fieldName} supports up to ${precision} decimal places`)
  }

  return roundQuantity(quantity, precision)
}
