import { useEffect, useRef, useState } from 'react'
import './date-filter-dialog.css'

export type DateRange = {
  fromDate: string | null
  toDate: string | null
}

type DateFilterDialogProps = {
  open: boolean
  title?: string
  initialFromDate?: string | null
  initialToDate?: string | null
  showPresets?: boolean
  onApply: (range: DateRange) => void
  onCancel: () => void
}

type DateField = 'from' | 'to'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDisplayDate(value: string | null): string {
  if (!value) {
    return ''
  }

  const parts = value.split('-')

  if (parts.length !== 3) {
    return ''
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function getToday(): string {
  const now = new Date()

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function getMonthStart(): string {
  const now = new Date()

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}

function getYesterday(): string {
  const date = new Date()

  date.setDate(date.getDate() - 1)

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getThisWeekStart(): string {
  const date = new Date()
  const day = date.getDay()

  const difference = day === 0 ? -6 : 1 - day

  date.setDate(date.getDate() + difference)

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getLastMonthRange(): DateRange {
  const now = new Date()

  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const month = now.getMonth() === 0 ? 12 : now.getMonth()

  const lastDay = new Date(year, month, 0).getDate()

  return {
    fromDate: `${year}-${pad(month)}-01`,
    toDate: `${year}-${pad(month)}-${pad(lastDay)}`
  }
}

function isValidDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day)

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function parseDateInput(value: string): string | null {
  const input = value.trim().replace(/\D/g, '')

  if (!input) {
    return null
  }

  const now = new Date()

  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  let day: number
  let month: number
  let year: number

  if (input.length <= 2) {
    day = Number(input)
    month = currentMonth
    year = currentYear
  } else if (input.length === 4) {
    day = Number(input.slice(0, 2))
    month = Number(input.slice(2, 4))
    year = currentYear
  } else if (input.length === 6) {
    day = Number(input.slice(0, 2))
    month = Number(input.slice(2, 4))

    const shortYear = Number(input.slice(4, 6))

    year = shortYear >= 70 ? 1900 + shortYear : 2000 + shortYear
  } else if (input.length === 8) {
    day = Number(input.slice(0, 2))
    month = Number(input.slice(2, 4))
    year = Number(input.slice(4, 8))
  } else {
    return null
  }

  if (!isValidDate(year, month, day)) {
    return null
  }

  return `${year}-${pad(month)}-${pad(day)}`
}

function DateFilterDialog({
  open,
  title = 'Date Filter',
  initialFromDate = null,
  initialToDate = null,
  showPresets = true,
  onApply,
  onCancel
}: DateFilterDialogProps): React.ReactElement | null {
  const [fromInput, setFromInput] = useState('')
  const [toInput, setToInput] = useState('')

  const [activeField, setActiveField] = useState<DateField>('from')

  const [error, setError] = useState<string | null>(null)

  /*
   * TRUE when the current values are ready to apply.
   *
   * This is set after:
   *
   * 1. A preset is selected
   * 2. The user presses Enter on To Date once
   */
  const [readyToApply, setReadyToApply] = useState(false)

  const fromRef = useRef<HTMLInputElement>(null)

  const toRef = useRef<HTMLInputElement>(null)

  useEffect((): void => {
    if (!open) {
      return
    }

    setFromInput(formatDisplayDate(initialFromDate ?? getToday()))

    setToInput(formatDisplayDate(initialToDate ?? getToday()))

    setActiveField('from')
    setError(null)

    /*
     * Initial dates are displayed but not yet submitted.
     */
    setReadyToApply(false)

    requestAnimationFrame((): void => {
      fromRef.current?.focus()
      fromRef.current?.select()
    })
  }, [open, initialFromDate, initialToDate])

  if (!open) {
    return null
  }

  /*
   * Validate and apply the current dates.
   */
  const applyFilter = (): void => {
    const fromDate = parseDateInput(fromInput)
    const toDate = parseDateInput(toInput)

    if (fromInput.trim() && !fromDate) {
      setError('Invalid From Date.')

      fromRef.current?.focus()

      return
    }

    if (toInput.trim() && !toDate) {
      setError('Invalid To Date.')

      toRef.current?.focus()

      return
    }

    if (fromDate && toDate && fromDate > toDate) {
      setError('From Date cannot be after To Date.')

      fromRef.current?.focus()

      return
    }

    /*
     * Stop the current Enter event from reaching
     * Bill History / App keyboard handlers.
     */
    onApply({
      fromDate,
      toDate
    })
  }

  /*
   * Select a quick range.
   *
   * IMPORTANT:
   * This does NOT immediately apply.
   *
   * The next Enter applies it.
   */
  const applyPreset = (range: DateRange): void => {
    setFromInput(formatDisplayDate(range.fromDate))

    setToInput(formatDisplayDate(range.toDate))

    setError(null)

    /*
     * A preset is now ready to apply.
     */
    setReadyToApply(true)

    /*
     * Keep focus inside the dialog.
     */
    requestAnimationFrame((): void => {
      fromRef.current?.focus()
      fromRef.current?.select()

      setActiveField('from')
    })
  }

  const handleDateKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    field: DateField
  ): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()

      /*
       * If the user already pressed Enter on To Date
       * once, the next Enter applies the filter.
       */
      if (field === 'to' && readyToApply) {
        applyFilter()
        return
      }

      /*
       * Validate the current field.
       */
      const parsed = parseDateInput(event.currentTarget.value)

      if (event.currentTarget.value.trim() && !parsed) {
        setError(field === 'from' ? 'Invalid From Date.' : 'Invalid To Date.')

        return
      }

      const formatted = parsed ? formatDisplayDate(parsed) : ''

      /*
       * FROM DATE
       *
       * Enter moves to To Date.
       */
      if (field === 'from') {
        setFromInput(formatted)

        setReadyToApply(false)

        toRef.current?.focus()
        toRef.current?.select()

        setActiveField('to')

        return
      }

      /*
       * TO DATE
       *
       * First Enter only validates and prepares
       * the filter.
       *
       * It does NOT apply yet.
       */
      setToInput(formatted)

      setReadyToApply(true)

      setActiveField('to')

      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()

      onCancel()

      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()

      if (field === 'to') {
        fromRef.current?.focus()
        fromRef.current?.select()

        setActiveField('from')
      }

      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()

      if (field === 'from') {
        toRef.current?.focus()
        toRef.current?.select()

        setActiveField('to')
      }
    }
  }

  /*
   * Handle Enter at the dialog level.
   *
   * This is particularly important after clicking
   * a preset button.
   */
  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter') {
      return
    }

    /*
     * Input fields handle their own Enter.
     */
    if (event.target === fromRef.current || event.target === toRef.current) {
      return
    }

    if (!readyToApply) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    applyFilter()
  }

  return (
    <div className="date-filter-overlay" onKeyDown={handleDialogKeyDown}>
      <div className="date-filter-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="date-filter-title">{title}</div>

        <div className="date-filter-body">
          <div className="date-filter-row">
            <label htmlFor="date-filter-from">From Date</label>

            <input
              id="date-filter-from"
              ref={fromRef}
              type="text"
              inputMode="numeric"
              value={fromInput}
              placeholder="DD/MM/YYYY"
              onFocus={(): void => {
                setActiveField('from')
              }}
              onChange={(event): void => {
                setFromInput(event.target.value)

                setError(null)

                /*
                 * User changed the date,
                 * so the previous ready state is invalid.
                 */
                setReadyToApply(false)
              }}
              onKeyDown={(event): void => handleDateKeyDown(event, 'from')}
            />
          </div>

          <div className="date-filter-row">
            <label htmlFor="date-filter-to">To Date</label>

            <input
              id="date-filter-to"
              ref={toRef}
              type="text"
              inputMode="numeric"
              value={toInput}
              placeholder="DD/MM/YYYY"
              onFocus={(): void => {
                setActiveField('to')
              }}
              onChange={(event): void => {
                setToInput(event.target.value)

                setError(null)

                setReadyToApply(false)
              }}
              onKeyDown={(event): void => handleDateKeyDown(event, 'to')}
            />
          </div>

          {error && <div className="date-filter-error">{error}</div>}

          {showPresets && (
            <div className="date-filter-presets">
              <div className="date-filter-presets-title">Quick Range</div>

              <div className="date-filter-preset-buttons">
                <button
                  type="button"
                  onClick={(event): void => {
                    event.preventDefault()
                    event.stopPropagation()

                    applyPreset({
                      fromDate: getToday(),
                      toDate: getToday()
                    })
                  }}
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={(event): void => {
                    event.preventDefault()
                    event.stopPropagation()

                    applyPreset({
                      fromDate: getYesterday(),
                      toDate: getYesterday()
                    })
                  }}
                >
                  Yesterday
                </button>

                <button
                  type="button"
                  onClick={(event): void => {
                    event.preventDefault()
                    event.stopPropagation()

                    applyPreset({
                      fromDate: getThisWeekStart(),
                      toDate: getToday()
                    })
                  }}
                >
                  This Week
                </button>

                <button
                  type="button"
                  onClick={(event): void => {
                    event.preventDefault()
                    event.stopPropagation()

                    applyPreset({
                      fromDate: getMonthStart(),
                      toDate: getToday()
                    })
                  }}
                >
                  This Month
                </button>

                <button
                  type="button"
                  onClick={(event): void => {
                    event.preventDefault()
                    event.stopPropagation()

                    applyPreset(getLastMonthRange())
                  }}
                >
                  Last Month
                </button>

                <button
                  type="button"
                  onClick={(event): void => {
                    event.preventDefault()
                    event.stopPropagation()

                    applyPreset({
                      fromDate: null,
                      toDate: null
                    })
                  }}
                >
                  All
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="date-filter-footer">
          <span>{activeField === 'from' ? 'From Date' : 'To Date'}</span>

          <span>Enter Apply</span>

          <span>←→ Fields</span>

          <span>Esc Cancel</span>
        </div>
      </div>
    </div>
  )
}

export default DateFilterDialog
