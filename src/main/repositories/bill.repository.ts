import type Database from 'better-sqlite3'

export type BillingSlot = {
  slotId: 0 | 1
  billNumber: string
}

function formatBillNumber(number: number): string {
  return `A${String(number).padStart(6, '0')}`
}

/**
 * Returns the two persistent billing slots.
 *
 * If the slots don't exist yet, they are created using the
 * current bill number sequence.
 */
export function getBillingSlots(db: Database.Database): [BillingSlot, BillingSlot] {
  const transaction = db.transaction(() => {
    const getSlot = db.prepare(`
      SELECT slot_id, bill_number
      FROM billing_slots
      WHERE slot_id = ?
    `)

    const getNextNumber = db.prepare(`
      SELECT next_number
      FROM bill_number_sequence
      WHERE id = 1
    `)

    const updateSequence = db.prepare(`
      UPDATE bill_number_sequence
      SET next_number = next_number + 1
      WHERE id = 1
    `)

    const insertSlot = db.prepare(`
      INSERT INTO billing_slots (slot_id, bill_number)
      VALUES (?, ?)
    `)

    for (const slotId of [0, 1] as const) {
      const existing = getSlot.get(slotId) as { slot_id: number; bill_number: string } | undefined

      if (existing) {
        continue
      }

      const sequence = getNextNumber.get() as { next_number: number } | undefined

      if (!sequence) {
        throw new Error('Bill number sequence is not initialized')
      }

      const billNumber = formatBillNumber(sequence.next_number)

      updateSequence.run()
      insertSlot.run(slotId, billNumber)
    }

    const slot0 = getSlot.get(0) as { slot_id: number; bill_number: string } | undefined

    const slot1 = getSlot.get(1) as { slot_id: number; bill_number: string } | undefined

    if (!slot0 || !slot1) {
      throw new Error('Billing slots could not be initialized')
    }

    return [
      {
        slotId: 0,
        billNumber: slot0.bill_number
      },
      {
        slotId: 1,
        billNumber: slot1.bill_number
      }
    ] as [BillingSlot, BillingSlot]
  })

  return transaction()
}

/**
 * Gets the next unused bill number and assigns it to a
 * completed billing slot.
 *
 * This should only be called AFTER the sale is successfully completed.
 */
export function allocateNextBillNumberForSlot(db: Database.Database, slotId: 0 | 1): string {
  const transaction = db.transaction(() => {
    const getSlot = db.prepare(`
      SELECT bill_number
      FROM billing_slots
      WHERE slot_id = ?
    `)

    const slot = getSlot.get(slotId) as { bill_number: string } | undefined

    if (!slot) {
      throw new Error(`Billing slot ${slotId} does not exist`)
    }

    const sequence = db
      .prepare(
        `
        SELECT next_number
        FROM bill_number_sequence
        WHERE id = 1
      `
      )
      .get() as { next_number: number } | undefined

    if (!sequence) {
      throw new Error('Bill number sequence is not initialized')
    }

    const newBillNumber = formatBillNumber(sequence.next_number)

    db.prepare(
      `
      UPDATE bill_number_sequence
      SET next_number = next_number + 1
      WHERE id = 1
    `
    ).run()

    db.prepare(
      `
      UPDATE billing_slots
      SET bill_number = ?
      WHERE slot_id = ?
    `
    ).run(newBillNumber, slotId)

    return newBillNumber
  })

  return transaction()
}
