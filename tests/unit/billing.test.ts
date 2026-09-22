import { describe, expect, it } from 'vitest'
import { calculateBillingLine } from '../../src/main/utils/billing'

describe('calculateBillingLine', () => {
  it('calculates a normal PCS line', () => {
    const result = calculateBillingLine({
      quantity: 5,
      freeQuantity: 0,
      sellingPricePaise: 1250,
      quantityPrecision: 0
    })

    expect(result.quantity).toBe(5)
    expect(result.freeQuantity).toBe(0)
    expect(result.sellingPricePaise).toBe(1250)
    expect(result.amountPaise).toBe(6250)
  })

  it('does not charge for free quantity', () => {
    const result = calculateBillingLine({
      quantity: 10,
      freeQuantity: 2,
      sellingPricePaise: 900,
      quantityPrecision: 0
    })

    expect(result.quantity).toBe(10)
    expect(result.freeQuantity).toBe(2)
    expect(result.amountPaise).toBe(9000)
  })

  it('calculates decimal KG quantities', () => {
    const result = calculateBillingLine({
      quantity: 1.25,
      freeQuantity: 0,
      sellingPricePaise: 8000,
      quantityPrecision: 3
    })

    expect(result.quantity).toBe(1.25)
    expect(result.amountPaise).toBe(10000)
  })

  it('accepts decimal free quantity for KG', () => {
    const result = calculateBillingLine({
      quantity: 1.5,
      freeQuantity: 0.25,
      sellingPricePaise: 12000,
      quantityPrecision: 3
    })

    expect(result.quantity).toBe(1.5)
    expect(result.freeQuantity).toBe(0.25)
    expect(result.amountPaise).toBe(18000)
  })

  it('rejects quantity beyond configured precision', () => {
    expect(() =>
      calculateBillingLine({
        quantity: 1.2345,
        freeQuantity: 0,
        sellingPricePaise: 8000,
        quantityPrecision: 3
      })
    ).toThrow('Quantity supports up to 3 decimal places')
  })

  it('rejects negative free quantity', () => {
    expect(() =>
      calculateBillingLine({
        quantity: 5,
        freeQuantity: -1,
        sellingPricePaise: 1000,
        quantityPrecision: 0
      })
    ).toThrow('Free quantity cannot be negative')
  })

  it('rejects a zero quantity', () => {
    expect(() =>
      calculateBillingLine({
        quantity: 0,
        freeQuantity: 0,
        sellingPricePaise: 1000,
        quantityPrecision: 0
      })
    ).toThrow('Quantity must be greater than zero')
  })

  it('rejects an invalid selling price', () => {
    expect(() =>
      calculateBillingLine({
        quantity: 1,
        freeQuantity: 0,
        sellingPricePaise: -100,
        quantityPrecision: 0
      })
    ).toThrow('Invalid selling price')
  })
})
