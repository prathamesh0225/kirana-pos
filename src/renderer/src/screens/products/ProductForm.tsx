import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from '../../components/confirm-dialog/ConfirmDialog'
import './product-form.css'

const PRODUCT_UNITS = ['PCS', 'KG', 'GRAM', 'LITRE', 'ML', 'BOX', 'PACK', 'DOZEN'] as const

type ProductUnit = (typeof PRODUCT_UNITS)[number]

const DEFAULT_QUANTITY_PRECISION: Record<ProductUnit, number> = {
  PCS: 0,
  KG: 3,
  GRAM: 0,
  LITRE: 3,
  ML: 0,
  BOX: 0,
  PACK: 0,
  DOZEN: 0
}

type ProductFormProps = {
  productId?: number
  initialBarcode?: string
  onSaved: () => void
  onCancel: () => void
}

type FormData = {
  barcode: string
  name: string
  unit: ProductUnit
  quantityPrecision: number
  mrp: string
  sellingPrice: string
  purchasePrice: string
  lowStockLevel: string
  stockQuantity: string
}

type DialogType = 'save' | 'exit' | null

function ProductForm({
  productId,
  initialBarcode,
  onSaved,
  onCancel
}: ProductFormProps): React.JSX.Element {
  const isEdit = productId !== undefined

  const [form, setForm] = useState<FormData>({
    barcode: initialBarcode ?? '',
    name: '',
    unit: 'PCS' as ProductUnit,
    quantityPrecision: 0,
    mrp: '',
    sellingPrice: '',
    purchasePrice: '',
    lowStockLevel: '',
    stockQuantity: ''
  })

  const [originalForm, setOriginalForm] = useState<FormData | null>(null)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<DialogType>(null)

  const barcodeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const unitRef = useRef<HTMLSelectElement>(null)
  const mrpRef = useRef<HTMLInputElement>(null)
  const sellingPriceRef = useRef<HTMLInputElement>(null)
  const purchasePriceRef = useRef<HTMLInputElement>(null)
  const lowStockRef = useRef<HTMLInputElement>(null)
  const stockRef = useRef<HTMLInputElement>(null)

  const fieldRefs = [
    barcodeRef,
    nameRef,
    unitRef,
    mrpRef,
    sellingPriceRef,
    purchasePriceRef,
    lowStockRef,
    ...(isEdit ? [] : [stockRef])
  ]

  const isDirty = isEdit
    ? originalForm !== null && JSON.stringify(form) !== JSON.stringify(originalForm)
    : Object.values(form).some((value) => {
        if (typeof value === 'string') {
          return value.trim() !== ''
        }

        return value !== 0
      })

  /*
   * Load existing product when editing.
   *
   * When Add Item is opened, barcode gets focus
   * immediately.
   */
  useEffect(() => {
    if (!isEdit || productId === undefined) {
      requestAnimationFrame(() => {
        barcodeRef.current?.focus()
      })

      return
    }
    const currentProductId = productId
    async function loadProduct(): Promise<void> {
      try {
        setLoading(true)
        setError('')

        const product = await window.kirana.products.getByIdAnyStatus(currentProductId)

        if (!product) {
          throw new Error('Product not found')
        }

        const loadedForm: FormData = {
          barcode: product.barcode ?? '',
          name: product.name,
          unit: (product.unit || 'PCS') as ProductUnit,
          quantityPrecision: product.quantity_precision ?? 0,
          mrp: (product.mrp_paise / 100).toFixed(2),
          sellingPrice: (product.selling_price_paise / 100).toFixed(2),
          purchasePrice: (product.purchase_price_paise / 100).toFixed(2),
          lowStockLevel: String(product.low_stock_level),
          stockQuantity: String(product.stock_quantity)
        }

        setForm(loadedForm)
        setOriginalForm(loadedForm)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load product')
      } finally {
        setLoading(false)

        /*
         * Important:
         * F3 -> Edit must immediately activate
         * the keyboard without requiring a mouse click.
         */
        requestAnimationFrame(() => {
          barcodeRef.current?.focus()
          barcodeRef.current?.select()
        })
      }
    }

    void loadProduct()
  }, [isEdit, productId])

  function updateField(field: keyof FormData, value: string): void {
    setForm((current) => ({
      ...current,
      [field]: value
    }))

    setError('')
  }

  function moveToField(index: number): void {
    const ref = fieldRefs[index]

    if (!ref?.current) {
      return
    }

    ref.current.focus()
    if (ref.current instanceof HTMLInputElement) {
      ref.current.select()
    }
  }

  function moveNext(currentIndex: number): void {
    const nextIndex = currentIndex + 1

    if (nextIndex < fieldRefs.length) {
      moveToField(nextIndex)
      return
    }

    /*
     * Final field:
     * Enter does NOT save directly.
     *
     * It opens the reusable confirmation dialog.
     */
    openSaveConfirmation()
  }

  function movePrevious(currentIndex: number): void {
    const previousIndex = currentIndex - 1

    if (previousIndex >= 0) {
      moveToField(previousIndex)
    }
  }

  function handleFieldKeyDown(
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    index: number
  ): void {
    /*
     * Enter:
     * move to next field.
     *
     * Final field:
     * open confirmation.
     */
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      moveNext(index)
      return
    }

    /*
     * Select fields:
     *
     * Let ArrowUp / ArrowDown change the
     * selected option normally.
     */
    if (event.currentTarget instanceof HTMLSelectElement) {
      return
    }

    /*
     * Down arrow:
     * move to next field when cursor is at
     * the end of the current text.
     */
    if (event.key === 'ArrowDown') {
      const input = event.currentTarget

      if (input.selectionStart === input.value.length || input.inputMode === 'decimal') {
        event.preventDefault()
        moveNext(index)
      }

      return
    }

    /*
     * Up arrow:
     * move to previous field when cursor is
     * at the beginning of the current text.
     */
    if (event.key === 'ArrowUp') {
      const input = event.currentTarget

      if (input.selectionStart === 0 || input.inputMode === 'decimal') {
        event.preventDefault()
        movePrevious(index)
      }

      return
    }
  }

  function rupeesToPaise(value: string): number {
    const number = Number(value)

    if (!Number.isFinite(number)) {
      throw new Error('Invalid money value')
    }

    return Math.round(number * 100)
  }

  function validateForm(): void {
    if (!form.name.trim()) {
      throw new Error('Product name is required')
    }

    const mrp = Number(form.mrp)
    const sellingPrice = Number(form.sellingPrice)
    const purchasePrice = Number(form.purchasePrice)

    const lowStockLevel = Number(form.lowStockLevel || '0')

    if (!Number.isFinite(mrp) || mrp < 0) {
      throw new Error('Invalid MRP')
    }

    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      throw new Error('Selling price must be greater than zero')
    }

    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      throw new Error('Purchase price cannot be negative')
    }

    if (!Number.isFinite(lowStockLevel) || lowStockLevel < 0) {
      throw new Error('Invalid low stock level')
    }

    /*
     * Opening stock is only relevant when
     * creating a new item.
     */
    if (!isEdit) {
      const stockQuantity = Number(form.stockQuantity || '0')

      if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
        throw new Error('Invalid opening stock')
      }
    }
  }

  function openSaveConfirmation(): void {
    try {
      validateForm()

      /*
       * This ONLY opens the dialog.
       * It does not save anything.
       */
      setDialog('save')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please check the entered values')
    }
  }

  function requestExit(): void {
    /*
     * If nothing has been entered/changed,
     * there is nothing to confirm.
     */
    if (!isDirty) {
      onCancel()
      return
    }

    /*
     * Unsaved changes:
     * show reusable exit confirmation.
     */
    setDialog('exit')
  }

  async function saveProduct(): Promise<void> {
    /*
     * SAFETY CHECK:
     *
     * The database can only be modified after
     * the Save confirmation has been opened.
     *
     * The only caller should be the Yes button
     * in ConfirmDialog.
     */
    if (dialog !== 'save') {
      return
    }

    try {
      setSaving(true)
      setError('')

      const data = {
        barcode: form.barcode.trim() || undefined,
        name: form.name.trim(),
        unit: form.unit,
        quantityPrecision: form.quantityPrecision,
        mrpPaise: rupeesToPaise(form.mrp),
        sellingPricePaise: rupeesToPaise(form.sellingPrice),
        purchasePricePaise: rupeesToPaise(form.purchasePrice),
        lowStockLevel: Number(form.lowStockLevel || '0')
      }
      if (isEdit && productId !== undefined) {
        await window.kirana.products.update(productId, data)
      } else {
        await window.kirana.products.create({
          ...data,
          stockQuantity: Number(form.stockQuantity || '0')
        })
      }

      /*
       * Save succeeded.
       */
      setDialog(null)
      onSaved()
    } catch (err) {
      /*
       * Keep the form open if saving fails.
       *
       * The user can correct the problem and
       * try Save again.
       */
      setDialog(null)

      setError(err instanceof Error ? err.message : 'Unable to save product')
    } finally {
      setSaving(false)
    }
  }

  /*
   * Screen-level Escape handling.
   *
   * This works even if the user hasn't clicked
   * inside an input.
   */
  useEffect(() => {
    function handleScreenKeyDown(event: KeyboardEvent): void {
      /*
       * ConfirmDialog owns the keyboard while open.
       */
      if (dialog !== null) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        requestExit()
      }
    }

    window.addEventListener('keydown', handleScreenKeyDown)

    return () => {
      window.removeEventListener('keydown', handleScreenKeyDown)
    }
  }, [dialog, isDirty])

  if (loading) {
    return (
      <div className="product-form">
        <div className="product-form-loading">Loading item...</div>
      </div>
    )
  }

  return (
    <div className="product-form">
      <div className="product-form-header">
        <div>
          <div className="product-form-title">{isEdit ? 'Edit Item' : 'Add Item'}</div>

          <div className="product-form-subtitle">
            {isEdit ? 'Update item details' : 'Enter new item details'}
          </div>
        </div>

        <div className="product-form-shortcuts">
          <span>Enter Next</span>
          <span>↑↓ Navigate</span>
          <span>Esc Exit</span>
        </div>
      </div>

      <form
        className="product-form-body"
        onSubmit={(event) => {
          /*
           * Never allow browser form submission
           * to save the product.
           *
           * Our keyboard flow controls saving.
           */
          event.preventDefault()
        }}
      >
        <div className="product-fields">
          <label>
            <span>Barcode</span>

            <input
              ref={barcodeRef}
              value={form.barcode}
              onChange={(event) => updateField('barcode', event.target.value)}
              onKeyDown={(event) => handleFieldKeyDown(event, 0)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <label>
            <span>Product Name</span>

            <input
              ref={nameRef}
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              onKeyDown={(event) => handleFieldKeyDown(event, 1)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <label>
            <span>Unit</span>

            <select
              ref={unitRef}
              value={form.unit}
              onKeyDown={(event) => handleFieldKeyDown(event, 2)}
              onChange={(event) => {
                const unit = event.target.value as ProductUnit

                setForm((current) => ({
                  ...current,
                  unit,
                  quantityPrecision: DEFAULT_QUANTITY_PRECISION[unit]
                }))
              }}
            >
              {PRODUCT_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>MRP</span>

            <input
              ref={mrpRef}
              className="number-input"
              inputMode="decimal"
              value={form.mrp}
              onChange={(event) => updateField('mrp', event.target.value)}
              onKeyDown={(event) => handleFieldKeyDown(event, 3)}
            />
          </label>

          <label>
            <span>Selling Rate</span>

            <input
              ref={sellingPriceRef}
              className="number-input"
              inputMode="decimal"
              value={form.sellingPrice}
              onChange={(event) => updateField('sellingPrice', event.target.value)}
              onKeyDown={(event) => handleFieldKeyDown(event, 4)}
            />
          </label>

          <label>
            <span>Purchase Rate</span>

            <input
              ref={purchasePriceRef}
              className="number-input"
              inputMode="decimal"
              value={form.purchasePrice}
              onChange={(event) => updateField('purchasePrice', event.target.value)}
              onKeyDown={(event) => handleFieldKeyDown(event, 5)}
            />
          </label>

          <label>
            <span>Low Stock Level ({form.unit})</span>

            <input
              ref={lowStockRef}
              className="number-input"
              inputMode="decimal"
              value={form.lowStockLevel}
              onChange={(event) => updateField('lowStockLevel', event.target.value)}
              onKeyDown={(event) => handleFieldKeyDown(event, 6)}
            />
          </label>

          {!isEdit && (
            <label>
              <span>Opening Stock ({form.unit})</span>

              <input
                ref={stockRef}
                className="number-input"
                inputMode="decimal"
                value={form.stockQuantity}
                onChange={(event) => updateField('stockQuantity', event.target.value)}
                onKeyDown={(event) => handleFieldKeyDown(event, 7)}
              />
            </label>
          )}

          {isEdit && (
            <div className="stock-note">
              Stock is changed through purchases, sales and inventory adjustments.
            </div>
          )}
        </div>

        {error && <div className="product-form-error">{error}</div>}

        <div className="product-form-footer">
          <div className="footer-hints">
            <span>Enter Next</span>
            <span>↑↓ Navigate</span>
            <span>Esc Exit</span>
          </div>

          <button type="button" onClick={openSaveConfirmation} disabled={saving}>
            Save
          </button>

          <button type="button" onClick={requestExit} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>

      {/* SAVE / UPDATE CONFIRMATION */}
      {dialog === 'save' && (
        <ConfirmDialog
          title={isEdit ? 'Confirm Changes' : 'Confirm Save'}
          message={
            <>
              {isEdit ? 'Save changes to ' : 'Save '}
              <strong>{form.name.trim() || 'this item'}</strong>?
            </>
          }
          confirmText="Yes"
          cancelText="No"
          onConfirm={() => {
            void saveProduct()
          }}
          onCancel={() => {
            setDialog(null)

            requestAnimationFrame(() => {
              fieldRefs[fieldRefs.length - 1]?.current?.focus()
            })
          }}
        />
      )}

      {/* EXIT WITHOUT SAVING CONFIRMATION */}
      {dialog === 'exit' && (
        <ConfirmDialog
          title="Exit Without Saving"
          message={
            <>
              Discard changes to <strong>{form.name.trim() || 'this item'}</strong>?
            </>
          }
          confirmText="Yes"
          cancelText="No"
          variant="warning"
          onConfirm={() => {
            setDialog(null)
            onCancel()
          }}
          onCancel={() => {
            setDialog(null)

            requestAnimationFrame(() => {
              fieldRefs[fieldRefs.length - 1]?.current?.focus()
            })
          }}
        />
      )}
    </div>
  )
}

export default ProductForm
