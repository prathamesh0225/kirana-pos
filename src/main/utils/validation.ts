export function requireNonEmpty(value: string, fieldName: string): string {
  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error(`${fieldName} is required`)
  }

  return trimmed
}

export function requirePositive(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be greater than zero`)
  }

  return value
}

export function requireNonNegative(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} cannot be negative`)
  }

  return value
}
