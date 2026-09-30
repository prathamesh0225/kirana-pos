import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from '../../components/confirm-dialog/ConfirmDialog'
import './supplier-master.css'

type SupplierMasterProps = {
  mode?: 'manage' | 'select'
  onBack: () => void
  onSelectSupplier?: (supplier: Supplier) => void
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`
}

function SupplierMaster({
  mode = 'manage',
  onBack,
  onSelectSupplier
}: SupplierMasterProps): React.JSX.Element {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [statusFilter, setStatusFilter] = useState<'active' | 'disabled' | 'all'>('active')

  const [statusChangeSupplier, setStatusChangeSupplier] = useState<Supplier | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)

  async function loadSuppliers(): Promise<void> {
    try {
      setLoading(true)
      setError('')

      const allSuppliers = await window.kirana.supplier.list(true)

      const filtered = allSuppliers.filter((supplier) => {
        if (statusFilter === 'active' && !supplier.isActive) {
          return false
        }

        if (statusFilter === 'disabled' && supplier.isActive) {
          return false
        }

        if (!searchTerm.trim()) {
          return true
        }

        const term = searchTerm.trim().toLowerCase()

        return (
          supplier.name.toLowerCase().includes(term) ||
          (supplier.mobile ?? '').toLowerCase().includes(term) ||
          (supplier.gstin ?? '').toLowerCase().includes(term)
        )
      })

      setSuppliers(filtered)
      setSelectedIndex(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSuppliers()
  }, [searchTerm, statusFilter])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (showForm || statusChangeSupplier) {
        return
      }

      if (event.key === 'Enter' && mode === 'select') {
        event.preventDefault()

        const selectedSupplier = suppliers[selectedIndex]

        if (selectedSupplier) {
          onSelectSupplier?.(selectedSupplier)
        }

        return
      }

      if (event.key === 'F2') {
        event.preventDefault()

        if (mode === 'select') {
          // F2 is handled by opening the existing supplier form.
          setShowForm(true)
          setEditingSupplier(null)
          return
        }

        // existing F2 logic
        setShowForm(true)
        setEditingSupplier(null)
        return
      }

      if (event.key === 'F3') {
        event.preventDefault()

        const supplier = suppliers[selectedIndex]

        if (supplier) {
          setEditingSupplier(supplier)
          setShowForm(true)
        }

        return
      }

      if (event.key === 'Delete') {
        event.preventDefault()

        const supplier = suppliers[selectedIndex]

        if (supplier) {
          setStatusChangeSupplier(supplier)
        }

        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()

        setSelectedIndex((current) => {
          if (suppliers.length === 0) {
            return 0
          }

          return Math.min(current + 1, suppliers.length - 1)
        })

        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()

        setSelectedIndex((current) => Math.max(current - 1, 0))

        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()

        if (searchTerm) {
          setSearchTerm('')
          searchRef.current?.focus()
          return
        }

        onBack()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return (): void => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onBack, searchTerm, selectedIndex, showForm, statusChangeSupplier, suppliers])

  if (showForm) {
    return (
      <SupplierForm
        supplier={editingSupplier}
        onSaved={async (): Promise<void> => {
          setShowForm(false)
          setEditingSupplier(null)
          await loadSuppliers()

          requestAnimationFrame(() => {
            searchRef.current?.focus()
          })
        }}
        onCancel={(): void => {
          setShowForm(false)
          setEditingSupplier(null)

          requestAnimationFrame(() => {
            searchRef.current?.focus()
          })
        }}
      />
    )
  }

  const selectedSupplier = suppliers[selectedIndex]

  return (
    <div className="supplier-master">
      <div className="supplier-master-header">
        <div className="supplier-title">
          {mode === 'select' ? 'SELECT SUPPLIER' : 'SUPPLIER MASTER'}
        </div>

        <div className="supplier-master-shortcuts">
          <span>↑↓ Select</span>
          <span>F2 Add</span>
          <span>F3 Edit</span>
          <span>DELETE Enable/Disable</span>
          <span>Esc Back</span>
        </div>
      </div>

      <div className="supplier-master-search-row">
        <label htmlFor="supplier-search">Search:</label>

        <input
          ref={searchRef}
          id="supplier-search"
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />

        <label htmlFor="supplier-status-filter">Status:</label>

        <select
          id="supplier-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'active' | 'disabled' | 'all')}
        >
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="all">All</option>
        </select>

        <span className="supplier-count">{suppliers.length} suppliers</span>
      </div>

      <div className="supplier-master-table-wrap">
        <table className="supplier-master-table">
          <thead>
            <tr>
              <th className="supplier-select-column"></th>
              <th>Supplier</th>
              <th>Mobile</th>
              <th>GSTIN</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="supplier-table-message">
                  Loading...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={6} className="supplier-table-message error">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && suppliers.length === 0 && (
              <tr>
                <td colSpan={6} className="supplier-table-message">
                  No suppliers found
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              suppliers.map((supplier, index) => {
                const selected = index === selectedIndex

                return (
                  <tr
                    key={supplier.id}
                    className={selected ? 'selected-row' : ''}
                    onClick={(): void => {
                      setSelectedIndex(index)
                      searchRef.current?.focus()
                    }}
                    onDoubleClick={(): void => {
                      setEditingSupplier(supplier)
                      setShowForm(true)
                    }}
                  >
                    <td className="supplier-select-column">{selected ? '>' : ''}</td>

                    <td>{supplier.name}</td>

                    <td>{supplier.mobile || '—'}</td>

                    <td>{supplier.gstin || '—'}</td>

                    <td className="money-column">{formatRupees(supplier.openingBalancePaise)}</td>

                    <td>{supplier.isActive ? 'Active' : 'Disabled'}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      <div className="supplier-master-details">
        {!selectedSupplier ? (
          <div className="supplier-master-details-empty">No supplier selected</div>
        ) : (
          <>
            <div className="supplier-master-details-title">SUPPLIER DETAILS</div>

            <div className="supplier-master-details-grid">
              <div className="supplier-master-detail">
                <span className="supplier-master-detail-label">Supplier</span>

                <span className="supplier-master-detail-value">{selectedSupplier.name}</span>
              </div>

              <div className="supplier-master-detail">
                <span className="supplier-master-detail-label">Mobile</span>

                <span className="supplier-master-detail-value">
                  {selectedSupplier.mobile || '—'}
                </span>
              </div>

              <div className="supplier-master-detail">
                <span className="supplier-master-detail-label">GSTIN</span>

                <span className="supplier-master-detail-value">
                  {selectedSupplier.gstin || '—'}
                </span>
              </div>

              <div className="supplier-master-detail">
                <span className="supplier-master-detail-label">Opening Balance</span>

                <span className="supplier-master-detail-value">
                  {formatRupees(selectedSupplier.openingBalancePaise)}
                </span>
              </div>

              <div className="supplier-master-detail">
                <span className="supplier-master-detail-label">Balance Type</span>

                <span className="supplier-master-detail-value">{selectedSupplier.balanceType}</span>
              </div>

              <div className="supplier-master-detail">
                <span className="supplier-master-detail-label">Status</span>

                <span className="supplier-master-detail-value">
                  {selectedSupplier.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>

              <div className="supplier-master-detail supplier-master-detail-wide">
                <span className="supplier-master-detail-label">Address</span>

                <span className="supplier-master-detail-value">
                  {selectedSupplier.address || '—'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="supplier-master-footer">
        {mode === 'select' ? (
          <>
            <span>↑↓ Select</span>
            <span>Enter Choose</span>
            <span>F2 New Supplier</span>
            <span>Esc Cancel</span>
          </>
        ) : (
          <>
            <span>F2 Add</span>
            <span>F3 Edit</span>
            <span>Delete Enable/Disable</span>
            <span>Esc Back</span>
          </>
        )}
      </div>

      {statusChangeSupplier && (
        <ConfirmDialog
          title={statusChangeSupplier.isActive ? 'Disable Supplier' : 'Enable Supplier'}
          message={
            statusChangeSupplier.isActive ? (
              <>
                Disable <strong>{statusChangeSupplier.name}</strong>
                ?
                <br />
                This supplier will no longer appear in normal purchase entry.
              </>
            ) : (
              <>
                Enable <strong>{statusChangeSupplier.name}</strong>
                ?
                <br />
                This supplier will become available in purchase entry.
              </>
            )
          }
          confirmText={statusChangeSupplier.isActive ? 'Disable' : 'Enable'}
          cancelText="Cancel"
          variant="warning"
          onConfirm={async (): Promise<void> => {
            try {
              await window.kirana.supplier.setActive(
                statusChangeSupplier.id,
                !statusChangeSupplier.isActive
              )

              setStatusChangeSupplier(null)
              await loadSuppliers()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unable to change supplier status')
            }
          }}
          onCancel={(): void => {
            setStatusChangeSupplier(null)
          }}
        />
      )}
    </div>
  )
}

type SupplierFormProps = {
  supplier: Supplier | null
  onSaved: () => Promise<void>
  onCancel: () => void
}

function SupplierForm({ supplier, onSaved, onCancel }: SupplierFormProps): React.JSX.Element {
  const [name, setName] = useState(supplier?.name ?? '')
  const [mobile, setMobile] = useState(supplier?.mobile ?? '')
  const [gstin, setGstin] = useState(supplier?.gstin ?? '')
  const [address, setAddress] = useState(supplier?.address ?? '')
  const [openingBalance, setOpeningBalance] = useState(
    supplier ? (supplier.openingBalancePaise / 100).toFixed(2) : '0.00'
  )
  const [balanceType, setBalanceType] = useState<'NONE' | 'PAYABLE' | 'RECEIVABLE'>(
    supplier?.balanceType ?? 'NONE'
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const nameRef = useRef<HTMLInputElement>(null)
  const mobileRef = useRef<HTMLInputElement>(null)
  const gstinRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)
  const balanceRef = useRef<HTMLInputElement>(null)
  const balanceTypeRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  async function save(): Promise<void> {
    if (!name.trim()) {
      setError('Supplier name is required.')
      nameRef.current?.focus()
      return
    }

    const balance = Number(openingBalance)

    if (!Number.isFinite(balance) || balance < 0) {
      setError('Enter a valid opening balance.')
      balanceRef.current?.focus()
      return
    }

    try {
      setSaving(true)
      setError('')

      const data = {
        name,
        mobile,
        address,
        gstin,
        openingBalancePaise: Math.round(balance * 100),
        balanceType
      }

      if (supplier) {
        await window.kirana.supplier.update(supplier.id, data)
      } else {
        await window.kirana.supplier.create(data)
      }

      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save supplier')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()

        if (!saving) {
          onCancel()
        }

        return
      }

      if (event.key !== 'Enter') {
        return
      }

      event.preventDefault()

      if (event.shiftKey) {
        return
      }

      const target = event.target

      if (target === nameRef.current) {
        mobileRef.current?.focus()
      } else if (target === mobileRef.current) {
        gstinRef.current?.focus()
      } else if (target === gstinRef.current) {
        addressRef.current?.focus()
      } else if (target === addressRef.current) {
        balanceRef.current?.focus()
      } else if (target === balanceRef.current) {
        balanceTypeRef.current?.focus()
      } else if (target === balanceTypeRef.current) {
        void save()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return (): void => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  })

  return (
    <div className="supplier-master">
      <div className="supplier-form">
        <div className="supplier-form-header">
          <div className="supplier-master-title">{supplier ? 'EDIT SUPPLIER' : 'ADD SUPPLIER'}</div>
        </div>

        <div className="supplier-form-body">
          <div className="supplier-form-row">
            <label>Name:</label>
            <input
              ref={nameRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={saving}
            />
          </div>

          <div className="supplier-form-row">
            <label>Mobile:</label>
            <input
              ref={mobileRef}
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              disabled={saving}
            />
          </div>

          <div className="supplier-form-row">
            <label>GSTIN:</label>
            <input
              ref={gstinRef}
              value={gstin}
              onChange={(event) => setGstin(event.target.value.toUpperCase())}
              disabled={saving}
            />
          </div>

          <div className="supplier-form-row">
            <label>Address:</label>
            <input
              ref={addressRef}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              disabled={saving}
            />
          </div>

          <div className="supplier-form-row">
            <label>Opening Balance:</label>
            <input
              ref={balanceRef}
              value={openingBalance}
              onChange={(event) => setOpeningBalance(event.target.value)}
              disabled={saving}
            />
          </div>

          <div className="supplier-form-row">
            <label>Balance Type:</label>
            <select
              ref={balanceTypeRef}
              value={balanceType}
              onChange={(event) =>
                setBalanceType(event.target.value as 'NONE' | 'PAYABLE' | 'RECEIVABLE')
              }
              disabled={saving}
            >
              <option value="NONE">NONE</option>
              <option value="PAYABLE">PAYABLE</option>
              <option value="RECEIVABLE">RECEIVABLE</option>
            </select>
          </div>

          {error && <div className="supplier-form-error">{error}</div>}
        </div>

        <div className="supplier-form-footer">
          <span>Enter Next / Save</span>
          <span>Esc Cancel</span>
        </div>
      </div>
    </div>
  )
}

export default SupplierMaster
