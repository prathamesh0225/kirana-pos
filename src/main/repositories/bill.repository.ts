//bill.repository.ts
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

/**
 * Ensures that a bill number is available for a new sale.
 *
 * Normal case:
 *   - supplied number is unused -> return it unchanged.
 *
 * Repair case:
 *   - supplied number is already used and a billing slot owns it
 *     -> advance that slot to the next unused sequence number.
 *
 * Stale UI / auto-repair case:
 *   - supplied number is already used but no billing slot owns it
 *     -> find a currently unused billing slot, assign it a fresh
 *        sequence number, and return that number.
 *
 * This function is intended to be called from an existing
 * database transaction.
 */
export function ensureAvailableBillNumber(db: Database.Database, billNumber: string): string {
  const existingSale = db
    .prepare(
      `
      SELECT 1
      FROM sales
      WHERE bill_number = ?
      LIMIT 1
      `
    )
    .get(billNumber)

  /*
   * Current bill number is available.
   */
  if (!existingSale) {
    return billNumber
  }

  /*
   * The current bill number has already been used.
   *
   * First try to find the billing slot that owns it.
   */
  const slot = db
    .prepare(
      `
      SELECT slot_id
      FROM billing_slots
      WHERE bill_number = ?
      LIMIT 1
      `
    )
    .get(billNumber) as { slot_id: 0 | 1 } | undefined

  /*
   * ---------------------------------------------------------
   * NORMAL REPAIR
   * ---------------------------------------------------------
   *
   * The used bill number still belongs to a billing slot.
   * Advance that exact slot.
   */
  if (slot) {
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

    const updateSlot = db.prepare(`
      UPDATE billing_slots
      SET bill_number = ?
      WHERE slot_id = ?
    `)

    while (true) {
      const sequence = getNextNumber.get() as { next_number: number } | undefined

      if (!sequence) {
        throw new Error('Bill number sequence is not initialized')
      }

      const newBillNumber = formatBillNumber(sequence.next_number)

      updateSequence.run()

      const alreadyUsed = db
        .prepare(
          `
          SELECT 1
          FROM sales
          WHERE bill_number = ?
          LIMIT 1
          `
        )
        .get(newBillNumber)

      if (alreadyUsed) {
        continue
      }

      updateSlot.run(newBillNumber, slot.slot_id)

      return newBillNumber
    }
  }

  /*
   * ---------------------------------------------------------
   * STALE BILLING SLOT AUTO-REPAIR
   * ---------------------------------------------------------
   *
   * The supplied bill number is already used, but neither
   * billing slot owns it anymore.
   *
   * This can happen when an old/stale bill number is still
   * present in the Billing screen after the slots have already
   * advanced.
   *
   * Find a slot whose current bill number is NOT already used.
   */
  const availableSlot = db
    .prepare(
      `
      SELECT bs.slot_id
      FROM billing_slots bs
      WHERE NOT EXISTS (
        SELECT 1
        FROM sales s
        WHERE s.bill_number = bs.bill_number
      )
      ORDER BY bs.slot_id
      LIMIT 1
      `
    )
    .get() as { slot_id: 0 | 1 } | undefined

  /*
   * If both slots themselves are already used, we still need
   * a slot to repair. Use slot 0 as the deterministic fallback.
   */
  const repairSlotId: 0 | 1 = availableSlot?.slot_id ?? 0

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

  const updateSlot = db.prepare(`
    UPDATE billing_slots
    SET bill_number = ?
    WHERE slot_id = ?
  `)

  /*
   * Generate a completely fresh number and assign it
   * to the repaired billing slot.
   */
  while (true) {
    const sequence = getNextNumber.get() as { next_number: number } | undefined

    if (!sequence) {
      throw new Error('Bill number sequence is not initialized')
    }

    const newBillNumber = formatBillNumber(sequence.next_number)

    /*
     * Consume this sequence number regardless of whether
     * it turns out to already exist in sales.
     */
    updateSequence.run()

    const alreadyUsed = db
      .prepare(
        `
        SELECT 1
        FROM sales
        WHERE bill_number = ?
        LIMIT 1
        `
      )
      .get(newBillNumber)

    if (alreadyUsed) {
      continue
    }

    updateSlot.run(newBillNumber, repairSlotId)

    return newBillNumber
  }
}
