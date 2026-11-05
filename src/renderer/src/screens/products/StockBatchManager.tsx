import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import './stock-batch-manager.css'

type BatchForm = {
  id?: number
  batchNumber: string
  expiryDate: string
  mrp: string
  purchaseRate: string
  sellingRate: string
  stock: string
}

type Props = {
  product: ProductRecord
  onClose: (saved: boolean) => void
}

type ConfirmAction = 'save' | 'discard' | null

const fields: Array<keyof BatchForm> = [
  'batchNumber',
  'expiryDate',
  'mrp',
  'purchaseRate',
  'sellingRate',
  'stock'
]

const emptyRow = (): BatchForm => ({
  batchNumber: '',
  expiryDate: '',
  mrp: '',
  purchaseRate: '',
  sellingRate: '',
  stock: ''
})

function StockBatchManager({ product, onClose }: Props): React.JSX.Element {
  const [rows, setRows] = useState<BatchForm[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [selectedRow, setSelectedRow] = useState(0)
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<number | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [deleting, setDeleting] = useState(false)

  const refs = useRef<Array<Array<HTMLInputElement | null>>>([])
  const windowRef = useRef<HTMLDivElement>(null)
  const initialRowsRef = useRef<BatchForm[]>([])

  const isDirty = JSON.stringify(rows) !== JSON.stringify(initialRowsRef.current)

  // Load existing batches.
  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const batches = await window.kirana.products.getStockBatches(product.id)

        const loadedRows: BatchForm[] = [
          ...batches.map((batch) => ({
            id: batch.id,
            batchNumber: batch.batch_number ?? '',
            expiryDate: batch.expiry_date ?? '',
            mrp: (batch.mrp_paise / 100).toFixed(2),
            purchaseRate: (batch.purchase_rate_paise / 100).toFixed(2),
            sellingRate: (batch.selling_rate_paise / 100).toFixed(2),
            stock: String(batch.quantity)
          })),
          emptyRow()
        ]

        initialRowsRef.current = JSON.parse(JSON.stringify(loadedRows))
        setRows(loadedRows)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load batches')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [product.id])

  // Focus the batch window when loading finishes.
  useEffect(() => {
    if (!loading) {
      setSelectedRow(0)

      requestAnimationFrame(() => {
        windowRef.current?.focus()
      })
    }
  }, [loading])

  function updateRow(rowIndex: number, field: keyof BatchForm, value: string): void {
    setRows((current) =>
      current.map((row, index) => (index === rowIndex ? { ...row, [field]: value } : row))
    )

    setError('')
  }

  function hasData(row: BatchForm): boolean {
    return Boolean(
      row.batchNumber.trim() ||
      row.expiryDate ||
      row.mrp ||
      row.purchaseRate ||
      row.sellingRate ||
      row.stock
    )
  }

  function focus(row: number, field: number): void {
    setSelectedRow(row)

    requestAnimationFrame(() => {
      const input = refs.current[row]?.[field]
      input?.focus()
      input?.select()
    })
  }

  // Select a complete row without focusing an input.
  function selectRow(row: number): void {
    setSelectedRow(row)

    requestAnimationFrame(() => {
      windowRef.current?.focus()
    })
  }

  function requestClose(): void {
    if (saving || deleting) return

    if (isDirty) {
      setConfirmAction('discard')
      return
    }

    onClose(false)
  }

  function requestSave(): void {
    if (saving || loading || deleting) return

    if (!rows.some(hasData)) {
      setError('There are no batch changes to save')
      return
    }

    setConfirmAction('save')
  }

  function addBlankRowAndFocus(): void {
    const newRowIndex = rows.length

    setRows((current) => [...current, emptyRow()])
    setSelectedRow(newRowIndex)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        refs.current[newRowIndex]?.[0]?.focus()
      })
    })
  }

  // Keyboard navigation while editing a field.
  function handleInputKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    field: number
  ): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      selectRow(row)
      return
    }

    if (event.key === 'Delete') {
      event.preventDefault()
      event.stopPropagation()

      if (hasData(rows[row])) {
        setDeleteConfirmRow(row)
      }
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      event.stopPropagation()

      if (field < fields.length - 1) {
        focus(row, field + 1)
      }
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      event.stopPropagation()

      if (field > 0) {
        focus(row, field - 1)
      }
      return
    }

    if (event.key !== 'Enter') return

    event.preventDefault()
    event.stopPropagation()

    // Move to the next field in the current row.
    if (field < fields.length - 1) {
      focus(row, field + 1)
      return
    }

    const currentRow = rows[row]

    // Last field of the final blank row.
    if (row === rows.length - 1) {
      if (hasData(currentRow)) {
        // Add another blank row and focus its first field.
        addBlankRowAndFocus()
      } else {
        // Empty final row: request save confirmation.
        requestSave()
      }
      return
    }

    // Last field of an existing row: highlight next complete row.
    selectRow(row + 1)
  }

  // Keyboard navigation when a complete row is selected.
  function handleWindowKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (confirmAction !== null || deleteConfirmRow !== null) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setConfirmAction(null)
        setDeleteConfirmRow(null)

        requestAnimationFrame(() => {
          windowRef.current?.focus()
        })
      }

      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      requestClose()
      return
    }

    if (event.target !== event.currentTarget) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      event.stopPropagation()
      selectRow(Math.min(selectedRow + 1, rows.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      selectRow(Math.max(selectedRow - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()

      if (selectedRow === rows.length - 1 && hasData(rows[selectedRow])) {
        focus(selectedRow, 0)
      } else if (selectedRow === rows.length - 1) {
        focus(selectedRow, 0)
      } else {
        focus(selectedRow, 0)
      }

      return
    }

    if (event.key === 'Delete') {
      event.preventDefault()
      event.stopPropagation()

      const row = rows[selectedRow]

      if (row && hasData(row)) {
        setDeleteConfirmRow(selectedRow)
      }
    }
  }

  // Permanently delete a batch.
  async function confirmDelete(): Promise<void> {
    if (deleteConfirmRow === null) return

    const rowIndex = deleteConfirmRow
    const row = rows[rowIndex]

    if (!row) return

    if (Number(row.stock) !== 0) {
      setError('Batch can only be deleted when stock is 0')
      setDeleteConfirmRow(null)
      return
    }

    try {
      setDeleting(true)
      setError('')

      if (row.id !== undefined) {
        await window.kirana.products.deleteStockBatch(product.id, row.id)
      }

      setRows((current) => {
        const updated = current.filter((_, index) => index !== rowIndex)

        if (updated.length === 0 || hasData(updated[updated.length - 1])) {
          updated.push(emptyRow())
        }

        return updated
      })

      setSelectedRow(Math.min(rowIndex, Math.max(0, rows.length - 2)))
      setDeleteConfirmRow(null)

      requestAnimationFrame(() => {
        windowRef.current?.focus()
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete batch')
    } finally {
      setDeleting(false)
    }
  }

  // Save all batch rows.
  async function saveChanges(): Promise<void> {
    try {
      setSaving(true)
      setError('')

      for (const row of rows.filter(hasData)) {
        if (!row.mrp || !row.purchaseRate || !row.sellingRate || !row.stock) {
          throw new Error(`Complete all fields for batch ${row.batchNumber || '(unnamed)'}`)
        }

        const amount = (value: string): number => {
          const parsed = Number(value)

          if (!Number.isFinite(parsed) || parsed < 0) {
            throw new Error('Enter valid prices and stock')
          }

          return Math.round(parsed * 100)
        }

        const quantity = Number(row.stock)

        if (!Number.isFinite(quantity) || quantity < 0) {
          throw new Error(`Invalid stock for batch ${row.batchNumber || '(unnamed)'}`)
        }

        await window.kirana.products.saveStockBatch(product.id, {
          id: row.id,
          batchNumber: row.batchNumber.trim(),
          expiryDate: row.expiryDate || null,
          mrpPaise: amount(row.mrp),
          purchaseRatePaise: amount(row.purchaseRate),
          sellingRatePaise: amount(row.sellingRate),
          quantity
        })
      }

      initialRowsRef.current = JSON.parse(JSON.stringify(rows))
      setConfirmAction(null)
      onClose(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save batches')
      setConfirmAction(null)
    } finally {
      setSaving(false)
    }
  }

  function handleConfirmationKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setConfirmAction(null)
      setDeleteConfirmRow(null)

      requestAnimationFrame(() => {
        windowRef.current?.focus()
      })

      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()

      if (confirmAction === 'save') {
        void saveChanges()
      } else if (confirmAction === 'discard') {
        onClose(false)
      }
    }
  }

  return (
    <div className="batch-overlay">
      <div ref={windowRef} className="batch-window" tabIndex={-1} onKeyDown={handleWindowKeyDown}>
        {/* Header */}
        <div className="batch-header">
          <div>
            <strong>BATCH-WISE STOCK ADJUSTMENT</strong>
            <div>
              {product.name} | {product.barcode || 'No Barcode'}
            </div>
          </div>

          <button type="button" disabled={saving || deleting} onClick={requestClose}>
            ✕
          </button>
        </div>

        {/* Batch table */}
        <div className="batch-table-wrap">
          <table className="batch-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Expiry</th>
                <th>MRP</th>
                <th>Purchase Rate</th>
                <th>Selling Rate</th>
                <th>Stock</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>Loading batches...</td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => (
                  <tr
                    key={row.id ?? `new-${rowIndex}`}
                    className={[
                      rowIndex === selectedRow ? 'batch-selected-row' : '',
                      rowIndex === rows.length - 1 ? 'batch-new-row' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => selectRow(rowIndex)}
                  >
                    {fields.map((field, fieldIndex) => (
                      <td key={field}>
                        <input
                          ref={(element) => {
                            if (!refs.current[rowIndex]) {
                              refs.current[rowIndex] = []
                            }

                            refs.current[rowIndex][fieldIndex] = element
                          }}
                          type={field === 'expiryDate' ? 'date' : 'text'}
                          inputMode={
                            ['mrp', 'purchaseRate', 'sellingRate', 'stock'].includes(field)
                              ? 'decimal'
                              : undefined
                          }
                          placeholder={
                            rowIndex === rows.length - 1 && field === 'batchNumber'
                              ? 'New batch'
                              : ''
                          }
                          value={row[field]}
                          disabled={saving || deleting}
                          onClick={(event) => event.stopPropagation()}
                          onFocus={() => setSelectedRow(rowIndex)}
                          onChange={(event) => updateRow(rowIndex, field, event.target.value)}
                          onKeyDown={(event) => handleInputKeyDown(event, rowIndex, fieldIndex)}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="batch-summary">
          Product stock: {product.stock_quantity}
          <span>
            Batch total:{' '}
            {rows.filter(hasData).reduce((total, row) => total + (Number(row.stock) || 0), 0)}
          </span>
        </div>

        {error && <div className="batch-error">{error}</div>}

        {/* Footer */}
        <div className="batch-footer">
          <span>↑ ↓: Select Row</span>
          <span>Enter: Edit / Next Row</span>
          <span>← →: Previous / Next Field</span>
          <span>Delete: Delete Selected Row</span>
          <span>Esc: Close</span>

          <div>
            <button type="button" disabled={saving || deleting} onClick={requestClose}>
              Cancel
            </button>

            <button type="button" disabled={saving || loading || deleting} onClick={requestSave}>
              Save Changes
            </button>
          </div>
        </div>

        {/* Save / discard confirmation */}
        {confirmAction !== null && (
          <div className="batch-confirm-backdrop">
            <div
              className="batch-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="batch-action-title"
              tabIndex={-1}
              onKeyDown={handleConfirmationKeyDown}
            >
              <h3 id="batch-action-title">
                {confirmAction === 'save' ? 'Save Changes?' : 'Discard Changes?'}
              </h3>

              <p>
                {confirmAction === 'save'
                  ? 'Are you sure you want to save all batch changes?'
                  : 'You have unsaved changes. Are you sure you want to close without saving?'}
              </p>

              <div className="batch-confirm-actions">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setConfirmAction(null)

                    requestAnimationFrame(() => {
                      windowRef.current?.focus()
                    })
                  }}
                >
                  No
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (confirmAction === 'save') {
                      void saveChanges()
                    } else {
                      onClose(false)
                    }
                  }}
                >
                  {saving ? 'Saving...' : confirmAction === 'save' ? 'Yes, Save' : 'Yes, Discard'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {deleteConfirmRow !== null && (
          <div className="batch-confirm-backdrop">
            <div
              className="batch-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="batch-delete-title"
            >
              <h3 id="batch-delete-title">Delete Batch?</h3>

              <p>
                Are you sure you want to permanently delete this batch? This action cannot be
                undone.
              </p>

              <div className="batch-confirm-actions">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteConfirmRow(null)

                    requestAnimationFrame(() => {
                      windowRef.current?.focus()
                    })
                  }}
                >
                  No
                </button>

                <button type="button" disabled={deleting} onClick={() => void confirmDelete()}>
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StockBatchManager
