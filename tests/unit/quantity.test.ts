import { describe, expect, it } from 'vitest'
import { isQuantityValid, requireValidQuantity, roundQuantity } from '../../src/main/utils/quantity'

describe('quantity utilities', () => {
  it('rounds a quantity to the requested precision', () => {
    expect(roundQuantity(1.23456, 3)).toBe(1.235)
    expect(roundQuantity(1.23456, 2)).toBe(1.23)
    expect(roundQuantity(5, 0)).toBe(5)
  })

  it('accepts valid PCS quantities', () => {
    expect(isQuantityValid(5, 0)).toBe(true)
    expect(isQuantityValid(0, 0)).toBe(true)
  })

  it('rejects decimal PCS quantities', () => {
    expect(isQuantityValid(5.5, 0)).toBe(false)
  })

  it('accepts decimal KG quantities', () => {
    expect(isQuantityValid(1.25, 3)).toBe(true)
    expect(isQuantityValid(1.234, 3)).toBe(true)
  })

  it('rejects quantities beyond the allowed precision', () => {
    expect(isQuantityValid(1.2345, 3)).toBe(false)
  })

  it('rejects negative quantities', () => {
    expect(isQuantityValid(-1, 0)).toBe(false)
  })

  it('accepts a quantity at the allowed precision', () => {
    expect(requireValidQuantity(1.234, 3)).toBe(1.234)
  })

  it('throws when quantity has too many decimal places', () => {
    expect(() => requireValidQuantity(1.2345, 3)).toThrow(
      'Quantity supports up to 3 decimal places'
    )
  })

  it('throws when quantity is negative', () => {
    expect(() => requireValidQuantity(-1, 0)).toThrow('Quantity supports up to 0 decimal places')
  })
})
