import { useEffect, useRef, useState } from 'react'
import type { BillingSession } from './billing.types'

export type PaymentMode = 'cash' | 'upi' | 'mixed'

export type PaymentResult = {
  mode: PaymentMode
  cashPaise: number
  upiPaise: number
  paidPaise: number
  changePaise: number
}

type PaymentProps = {
  session: BillingSession
  totalPaise: number
  onBack: () => void
  onComplete: (payment: PaymentResult) => void
}

function formatRupees(paise: number): string {
  return (paise / 100).toFixed(2)
}

function parsePaise(value: string): number {
  const amount = Number(value)

  if (!Number.isFinite(amount) || amount < 0) {
    return 0
  }

  return Math.round(amount * 100)
}

function Payment({ session, totalPaise, onBack, onComplete }: PaymentProps): React.JSX.Element {
  const [mode, setMode] = useState<PaymentMode>('cash')

  const [cashInput, setCashInput] = useState(formatRupees(totalPaise))

  const [upiInput, setUpiInput] = useState('')

  const [mixedCashInput, setMixedCashInput] = useState(formatRupees(totalPaise))

  const [mixedUpiInput, setMixedUpiInput] = useState('0.00')

  const [error, setError] = useState('')

  const cashInputRef = useRef<HTMLInputElement>(null)
  const upiInputRef = useRef<HTMLInputElement>(null)
  const mixedCashInputRef = useRef<HTMLInputElement>(null)
  const mixedUpiInputRef = useRef<HTMLInputElement>(null)

  /*
   * ---------------------------------------------------------
   * Reset payment when opened for a bill.
   * ---------------------------------------------------------
   */

  useEffect(() => {
    setMode('cash')
    setCashInput(formatRupees(totalPaise))
    setUpiInput('')
    setMixedCashInput(formatRupees(totalPaise))
    setMixedUpiInput('0.00')
    setError('')

    requestAnimationFrame(() => {
      cashInputRef.current?.focus()
      cashInputRef.current?.select()
    })
  }, [session.id, totalPaise])

  /*
   * ---------------------------------------------------------
   * Payment values
   * ---------------------------------------------------------
   */

  const cashPaise = parsePaise(mode === 'mixed' ? mixedCashInput : cashInput)

  const upiPaise = parsePaise(mode === 'mixed' ? mixedUpiInput : upiInput)

  const paidPaise = mode === 'cash' ? cashPaise : mode === 'upi' ? upiPaise : cashPaise + upiPaise

  const changePaise = paidPaise > totalPaise ? paidPaise - totalPaise : 0

  /*
   * ---------------------------------------------------------
   * Focus helpers
   * ---------------------------------------------------------
   */

  function focusCash(): void {
    requestAnimationFrame(() => {
      if (mode === 'mixed') {
        mixedCashInputRef.current?.focus()
        mixedCashInputRef.current?.select()
        return
      }

      cashInputRef.current?.focus()
      cashInputRef.current?.select()
    })
  }

  function focusUpi(): void {
    requestAnimationFrame(() => {
      if (mode === 'mixed') {
        mixedUpiInputRef.current?.focus()
        mixedUpiInputRef.current?.select()
        return
      }

      upiInputRef.current?.focus()
      upiInputRef.current?.select()
    })
  }

  /*
   * ---------------------------------------------------------
   * Payment mode
   * ---------------------------------------------------------
   */

  function selectCash(): void {
    setMode('cash')
    setError('')
    setCashInput(formatRupees(totalPaise))

    requestAnimationFrame(() => {
      cashInputRef.current?.focus()
      cashInputRef.current?.select()
    })
  }

  function selectUpi(): void {
    setMode('upi')
    setError('')
    setUpiInput(formatRupees(totalPaise))

    requestAnimationFrame(() => {
      upiInputRef.current?.focus()
      upiInputRef.current?.select()
    })
  }

  function selectMixed(): void {
    setMode('mixed')
    setError('')

    setMixedCashInput(formatRupees(totalPaise))
    setMixedUpiInput('0.00')

    requestAnimationFrame(() => {
      mixedCashInputRef.current?.focus()
      mixedCashInputRef.current?.select()
    })
  }

  /*
   * ---------------------------------------------------------
   * Mixed payment calculation
   * ---------------------------------------------------------
   *
   * UPI is automatically calculated from:
   *
   * UPI = TOTAL - CASH
   *
   * The cashier only needs to enter the cash amount.
   */

  function handleMixedCashChange(value: string): void {
    if (!/^\d*(\.\d{0,2})?$/.test(value)) {
      return
    }

    setMixedCashInput(value)
    setError('')

    const cashPaiseValue = parsePaise(value)

    const remainingUpiPaise = Math.max(totalPaise - cashPaiseValue, 0)

    setMixedUpiInput(formatRupees(remainingUpiPaise))
  }

  /*
   * ---------------------------------------------------------
   * Validation
   * ---------------------------------------------------------
   */

  function validatePayment(): boolean {
    setError('')

    if (mode === 'cash') {
      if (cashPaise < totalPaise) {
        setError('Cash received is less than the bill total')

        focusCash()
        return false
      }

      return true
    }

    if (mode === 'upi') {
      if (upiPaise !== totalPaise) {
        setError('UPI amount must equal the bill total')

        focusUpi()
        return false
      }

      return true
    }

    /*
     * Mixed payment:
     *
     * UPI is calculated automatically, so this should
     * normally always equal the total.
     */
    if (cashPaise > totalPaise) {
      return true
    }

    if (cashPaise + upiPaise !== totalPaise) {
      setError('Cash + UPI must equal the bill total')

      focusCash()
      return false
    }

    return true
  }

  /*
   * ---------------------------------------------------------
   * Complete
   * ---------------------------------------------------------
   */

  function completePayment(): void {
    if (!validatePayment()) {
      return
    }

    onComplete({
      mode,
      cashPaise,
      upiPaise,
      paidPaise,
      changePaise
    })
  }

  /*
   * ---------------------------------------------------------
   * Enter navigation
   * ---------------------------------------------------------
   */

  function handleEnter(): void {
    /*
     * Cash → Complete
     */
    if (mode === 'cash') {
      completePayment()
      return
    }

    /*
     * UPI → Complete
     */
    if (mode === 'upi') {
      completePayment()
      return
    }

    /*
     * Mixed:
     *
     * Cash → UPI → Complete
     *
     * Even though UPI is automatically calculated,
     * we keep the Enter flow so the cashier can see
     * the calculated amount before completing.
     */
    if (mode === 'mixed') {
      const activeElement = document.activeElement

      if (activeElement === mixedCashInputRef.current) {
        mixedUpiInputRef.current?.focus()
        mixedUpiInputRef.current?.select()
        setError('')
        return
      }

      if (activeElement === mixedUpiInputRef.current) {
        completePayment()
        return
      }

      focusCash()
    }
  }

  /*
   * ---------------------------------------------------------
   * Keyboard
   * ---------------------------------------------------------
   */

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onBack()
      return
    }

    if (event.key === 'F2') {
      event.preventDefault()
      event.stopPropagation()
      selectCash()
      return
    }

    if (event.key === 'F3') {
      event.preventDefault()
      event.stopPropagation()
      selectUpi()
      return
    }

    if (event.key === 'F4') {
      event.preventDefault()
      event.stopPropagation()
      selectMixed()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      handleEnter()
    }
  }

  /*
   * ---------------------------------------------------------
   * Normal amount change
   * ---------------------------------------------------------
   */

  function handleAmountChange(value: string, setter: (value: string) => void): void {
    if (!/^\d*(\.\d{0,2})?$/.test(value)) {
      return
    }

    setter(value)
    setError('')
  }

  return (
    <div className="payment-overlay" onKeyDown={handleKeyDown}>
      <div className="payment-dialog">
        <div className="payment-title">PAYMENT</div>

        <div className="payment-header">
          <div>
            <span>Bill No. :</span>
            <strong>{session.billNumber}</strong>
          </div>

          <div>
            <span>Total :</span>
            <strong>₹{formatRupees(totalPaise)}</strong>
          </div>
        </div>

        <div className="payment-body">
          <div className="payment-row payment-total">
            <span>TOTAL</span>

            <strong>₹{formatRupees(totalPaise)}</strong>
          </div>

          {mode === 'cash' && (
            <>
              <div className="payment-row payment-active-row">
                <label htmlFor="payment-cash">CASH</label>

                <input
                  ref={cashInputRef}
                  id="payment-cash"
                  type="text"
                  inputMode="decimal"
                  value={cashInput}
                  onChange={(event) => handleAmountChange(event.target.value, setCashInput)}
                  onFocus={(event) => event.currentTarget.select()}
                  autoComplete="off"
                />
              </div>

              <div className="payment-row">
                <span>CHANGE</span>

                <strong>₹{formatRupees(changePaise)}</strong>
              </div>
            </>
          )}

          {mode === 'upi' && (
            <div className="payment-row payment-active-row">
              <label htmlFor="payment-upi">UPI</label>

              <input
                ref={upiInputRef}
                id="payment-upi"
                type="text"
                inputMode="decimal"
                value={upiInput}
                onChange={(event) => handleAmountChange(event.target.value, setUpiInput)}
                onFocus={(event) => event.currentTarget.select()}
                autoComplete="off"
              />
            </div>
          )}

          {mode === 'mixed' && (
            <>
              <div className="payment-row payment-active-row">
                <label htmlFor="payment-mixed-cash">CASH</label>

                <input
                  ref={mixedCashInputRef}
                  id="payment-mixed-cash"
                  type="text"
                  inputMode="decimal"
                  value={mixedCashInput}
                  onChange={(event) => handleMixedCashChange(event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  autoComplete="off"
                />
              </div>

              <div className="payment-row">
                <label htmlFor="payment-mixed-upi">UPI</label>

                <input
                  ref={mixedUpiInputRef}
                  id="payment-mixed-upi"
                  type="text"
                  inputMode="decimal"
                  value={mixedUpiInput}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                  autoComplete="off"
                />
              </div>

              {changePaise > 0 && (
                <div className="payment-row">
                  <span>CHANGE</span>

                  <strong>₹{formatRupees(changePaise)}</strong>
                </div>
              )}
            </>
          )}

          <div className="payment-row">
            <span>PAID</span>

            <strong>₹{formatRupees(paidPaise)}</strong>
          </div>

          {error && <div className="payment-error">{error}</div>}
        </div>

        <div className="payment-footer">
          <span>F2 Cash</span>
          <span>F3 UPI</span>
          <span>F4 Mixed</span>
          <span>Enter Complete</span>
          <span>Esc Back</span>
        </div>
      </div>
    </div>
  )
}

export default Payment
