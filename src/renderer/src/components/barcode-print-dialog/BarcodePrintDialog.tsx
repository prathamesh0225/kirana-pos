import { useEffect, useRef, useState } from 'react'
import './barcode-print-dialog.css'

type BarcodePrintDialogProps = {
  open: boolean
  product: ProductRecord
  onClose: () => void
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`
}

function BarcodePrintDialog({
  open,
  product,
  onClose
}: BarcodePrintDialogProps): React.JSX.Element | null {
  const [quantity, setQuantity] = useState('2')
  const [extraText, setExtraText] = useState('')
  const [printerName, setPrinterName] = useState('')
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')

  const quantityInputRef = useRef<HTMLInputElement>(null)

  /*
   * ---------------------------------------------------------
   * OPEN DIALOG
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!open) {
      return
    }

    setQuantity('2')
    setExtraText('')
    setError('')

    void loadPrinters()

    /*
     * Put keyboard focus directly on quantity.
     *
     * Small timeout is intentional because the dialog has to
     * be mounted before the input can receive focus.
     */
    const timer = window.setTimeout(() => {
      quantityInputRef.current?.focus()
      quantityInputRef.current?.select()
    }, 50)

    return () => {
      window.clearTimeout(timer)
    }
  }, [open])

  /*
   * ---------------------------------------------------------
   * ESCAPE KEY
   * ---------------------------------------------------------
   */

//   useEffect(() => {
//     if (!open) {
//       return
//     }

//     function handleKeyDown(event: KeyboardEvent): void {
//       if (event.key === 'Escape') {
//         event.preventDefault()

//         if (!printing) {
//           onClose()
//         }
//       }
//     }

//     window.addEventListener('keydown', handleKeyDown)

//     return () => {
//       window.removeEventListener('keydown', handleKeyDown)
//     }
//   }, [open, printing, onClose])

  /*
   * ---------------------------------------------------------
   * LOAD PRINTERS
   * ---------------------------------------------------------
   */

  async function loadPrinters(): Promise<void> {
    try {
      setLoadingPrinters(true)

      const result = await window.kirana.printer.list()

      setPrinters(result)

      /*
       * Prefer TSC TE244.
       */
      const tscPrinter = result.find((printer) => {
        const text = `${printer.name} ${printer.displayName}`.toLowerCase()

        return text.includes('tsc') || text.includes('te244')
      })

      setPrinterName(tscPrinter?.name ?? result[0]?.name ?? '')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load printers'

      setError(message)
    } finally {
      setLoadingPrinters(false)
    }
  }

  /*
   * ---------------------------------------------------------
   * PRINT
   * ---------------------------------------------------------
   */

  async function handlePrint(): Promise<void> {
    if (printing) {
      return
    }

    setError('')

    const parsedQuantity = Number(quantity)

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setError('Enter a valid number of rows.')

      quantityInputRef.current?.focus()
      return
    }

    if (!printerName) {
      setError('Select the barcode printer.')
      return
    }

    if (!product.barcode?.trim()) {
      setError('This product does not have a barcode.')
      return
    }

    try {
      setPrinting(true)

      await window.kirana.printer.printBarcode({
        printerName,
        barcode: product.barcode,

        shopName: 'Gurumauli Super Shopee',

        productName: product.name,

        mrpPaise: product.mrp_paise,

        sellingPricePaise: product.selling_price_paise,

        /*
         * quantity = NUMBER OF ROWS
         *
         * 1 = 2 barcodes
         * 2 = 4 barcodes
         * 3 = 6 barcodes
         */
        quantity: parsedQuantity,

        extraText: extraText.trim()
      })

      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to print barcode labels'

      setError(message)
    } finally {
      setPrinting(false)
    }
  }

  /*
   * ---------------------------------------------------------
   * DON'T RENDER
   * ---------------------------------------------------------
   */

  if (!open) {
    return null
  }

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <div
      className="barcode-dialog-overlay"
      onMouseDown={(event) => {
        /*
         * Prevent clicks on the overlay from stealing focus
         * from inputs/selects inside the dialog.
         */
        if (event.target === event.currentTarget) {
          event.preventDefault()
        }
      }}
    >
      <div
        className="barcode-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="barcode-print-title"
        onKeyDown={(event) => {
          event.stopPropagation()

          if (event.key === 'Escape') {
            event.preventDefault()

            if (!printing) {
              onClose()
            }
          }
        }}
        onKeyUp={(event) => {
          event.stopPropagation()
        }}
      >
        {/* HEADER */}

        <div className="barcode-dialog-header">
          <div id="barcode-print-title">PRINT BARCODE</div>

          <button type="button" onClick={onClose} disabled={printing} tabIndex={-1}>
            ×
          </button>
        </div>

        {/* BODY */}

        <div className="barcode-dialog-body">
          {/* PRODUCT INFORMATION */}

          <div className="barcode-product">
            <div>
              <span>Product</span>
              <strong>{product.name}</strong>
            </div>

            <div>
              <span>Barcode</span>
              <strong>{product.barcode || '—'}</strong>
            </div>

            <div>
              <span>MRP</span>
              <strong>{formatRupees(product.mrp_paise)}</strong>
            </div>

            <div>
              <span>Rate</span>
              <strong>{formatRupees(product.selling_price_paise)}</strong>
            </div>
          </div>

          {/* PRINTER */}

          <label>
            Barcode Printer
            <select
              value={printerName}
              onChange={(event) => {
                setPrinterName(event.target.value)
                setError('')
              }}
              disabled={loadingPrinters || printing}
            >
              <option value="">Select printer</option>

              {printers.map((printer) => (
                <option key={printer.name} value={printer.name}>
                  {printer.displayName || printer.name}
                </option>
              ))}
            </select>
          </label>

          {/* QUANTITY */}

          <label>
            Number of rows
            <input
              ref={quantityInputRef}
              type="text"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => {
                const value = event.target.value

                if (/^\d*$/.test(value)) {
                  setQuantity(value)
                  setError('')
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handlePrint()
                }
              }}
              disabled={printing}
            />
            <small>
              1 row = 2 barcodes&nbsp;&nbsp;•&nbsp;&nbsp; 2 rows = 4
              barcodes&nbsp;&nbsp;•&nbsp;&nbsp; 3 rows = 6 barcodes
            </small>
          </label>

          {/* EXTRA TEXT */}

          <label>
            Extra text
            <input
              type="text"
              value={extraText}
              onChange={(event) => {
                setExtraText(event.target.value)
                setError('')
              }}
              placeholder="Example: EXP 12/2027"
              disabled={printing}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handlePrint()
                }
              }}
            />
          </label>

          {/* ERROR */}

          {error && <div className="barcode-dialog-error">{error}</div>}
        </div>

        {/* FOOTER */}

        <div className="barcode-dialog-footer">
          <button type="button" onClick={onClose} disabled={printing}>
            Cancel
          </button>

          <button
            type="button"
            className="primary"
            onClick={() => void handlePrint()}
            disabled={printing || loadingPrinters}
          >
            {printing ? 'Printing...' : 'Print Barcode'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BarcodePrintDialog
