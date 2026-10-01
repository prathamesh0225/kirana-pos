//App.tsx
import { useEffect, useState } from 'react'
import Billing from './screens/billing/Billing'
import ItemMaster from './screens/products/ItemMaster'
import ProductForm from './screens/products/ProductForm'
import BillHistory from './screens/billing/BillHistory'
import { Dashboard } from './screens/dashboard/Dashboard'
import { AppShell } from './components/app-shell/AppShell'
import type { BillingSession } from './screens/billing/billing.types'
import ConfirmDialog from './components/confirm-dialog/ConfirmDialog'
import { Settings } from './screens/settings/Settings'
import { QuitBackupScreen } from './components/quit-backup/QuitBackupScreen'
import PurchaseEntry from './screens/purchases/PurchaseEntry'
import PurchaseHistory from './screens/purchases/PurchaseHistory'

type HistoricalBillMode = 'view' | 'modify'

type Screen =
  | {
      type: 'dashboard'
    }
  | {
      type: 'billing'
    }
  | {
      type: 'settings'
    }
  | {
      type: 'item-master'
      returnTo: 'dashboard' | 'billing'
    }
  | {
      type: 'add-item'
      initialBarcode?: string
      returnTo: 'dashboard' | 'billing'
    }
  | {
      type: 'edit-item'
      productId: number
      returnTo: 'dashboard' | 'billing'
    }
  | {
      type: 'bill-history'
      returnTo: 'dashboard' | 'billing'
    }
  | {
      type: 'historical-bill'
      saleId: number
      mode: HistoricalBillMode
    }
  | {
      type: 'purchase-entry'
      purchaseId?: number
    }
  | {
      type: 'purchase-history'
    }

function createEmptyBillingLine() {
  return {
    id: Date.now() + Math.random(),
    productId: null,
    productName: '',
    isTemporary: false,
    barcode: null,
    quantityPrecision: 0,
    mrpPaise: 0,
    quantity: 0,
    freeQuantity: 0,
    ratePaise: 0,
    amountPaise: 0
  }
}

function createNewBillingSession(billNumber: string): BillingSession {
  return {
    id: crypto.randomUUID(),
    billNumber,
    lines: [createEmptyBillingLine()],
    customerName: '',
    customerMobile: ''
  }
}

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>({
    type: 'dashboard'
  })

  /*
   * Exactly two active billing sessions.
   *
   * These are the two live bills/counters.
   * Historical bills NEVER use these sessions.
   */
  const [billingSessions, setBillingSessions] = useState<[BillingSession, BillingSession] | null>(
    null
  )

  const [activeBillingIndex, setActiveBillingIndex] = useState<0 | 1>(0)

  /*
   * Historical bill session.
   *
   * This is separate from the two active billing sessions.
   */
  const [historicalBillingSession, setHistoricalBillingSession] = useState<BillingSession | null>(
    null
  )

  const [showExitBillingConfirm, setShowExitBillingConfirm] = useState(false)

  const [showQuitConfirm, setShowQuitConfirm] = useState(false)

  const [quitBackupStatus, setQuitBackupStatus] = useState<
    'backing-up' | 'success' | 'error' | null
  >(null)

  const [quitBackupError, setQuitBackupError] = useState<string | undefined>(undefined)

  const [purchaseSupplier, setPurchaseSupplier] = useState<Supplier | null>(null)

  async function handleQuitApplication(): Promise<void> {
    if (quitBackupStatus !== null) {
      return
    }

    setShowQuitConfirm(true)
  }

  async function performQuitBackup(): Promise<void> {
    if (quitBackupStatus !== null) {
      return
    }

    setShowQuitConfirm(false)
    setQuitBackupError(undefined)
    setQuitBackupStatus('backing-up')

    try {
      await window.kirana.database.backupOnExit()

      setQuitBackupStatus('success')

      await new Promise((resolve) => {
        window.setTimeout(resolve, 700)
      })

      await window.kirana.app.quit()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create database backup.'

      setQuitBackupError(message)
      setQuitBackupStatus('error')
    }
  }

  /*
   * Load the two persistent billing slots.
   */
  useEffect(() => {
    async function loadBillingSlots(): Promise<void> {
      const slots = await window.kirana.billing.getSlots()

      setBillingSessions([
        createNewBillingSession(slots[0].billNumber),
        createNewBillingSession(slots[1].billNumber)
      ])
    }

    void loadBillingSlots()
  }, [])

  /*
   * Update only the currently active bill.
   */
  function updateActiveBillingSession(
    update: BillingSession | ((current: BillingSession) => BillingSession)
  ): void {
    setBillingSessions((currentSessions) => {
      if (!currentSessions) {
        return currentSessions
      }

      const updatedSessions: [BillingSession, BillingSession] = [...currentSessions] as [
        BillingSession,
        BillingSession
      ]

      const currentSession = currentSessions[activeBillingIndex]

      updatedSessions[activeBillingIndex] =
        typeof update === 'function' ? update(currentSession) : update

      return updatedSessions
    })
  }

  function clearActiveBillingSession(): void {
    setBillingSessions((currentSessions) => {
      if (!currentSessions) {
        return currentSessions
      }

      const updatedSessions: [BillingSession, BillingSession] = [...currentSessions] as [
        BillingSession,
        BillingSession
      ]

      const currentSession = currentSessions[activeBillingIndex]

      updatedSessions[activeBillingIndex] = {
        ...currentSession,
        id: crypto.randomUUID(),
        lines: [createEmptyBillingLine()],
        customerName: '',
        customerMobile: ''
      }

      return updatedSessions
    })
  }

  /*
   * Ctrl+N switches between the two active billing slots.
   */
  function handleNewBill(): void {
    setActiveBillingIndex((currentIndex) => (currentIndex === 0 ? 1 : 0))
  }

  function handleMenuSelect(menu: string): void {
    switch (menu) {
      case 'dashboard':
        setScreen({ type: 'dashboard' })
        break

      case 'billing':
        setScreen({ type: 'billing' })
        break

      case 'history':
        setScreen({
          type: 'bill-history',
          returnTo: 'dashboard'
        })
        break

      case 'items':
        setScreen({ type: 'item-master', returnTo: 'dashboard' })
        break

      case 'settings':
        setScreen({
          type: 'settings'
        })
        break

      case 'purchase':
        setPurchaseSupplier(null)

        setScreen({
          type: 'purchase-entry'
        })
        break

      default:
        console.log(`Menu "${menu}" is not implemented yet.`)
        break
    }
  }

  /*
   * Open Bill History.
   */
  function handleOpenBillHistory(): void {
    setScreen({
      type: 'bill-history',
      returnTo: 'billing'
    })
  }

  /*
   * Open a historical bill in the SAME Billing UI.
   *
   * Billing.tsx will load the actual sale using saleId.
   * We only change the screen here.
   */
  function handleOpenHistoricalBill(saleId: number): void {
    setHistoricalBillingSession(null)

    setScreen({
      type: 'historical-bill',
      saleId,
      mode: 'view'
    })
  }

  /*
   * Switch the historical bill from VIEW -> MODIFY.
   *
   * Same Billing.tsx.
   * No separate Modify Bill screen.
   */
  function handleModifyHistoricalBill(): void {
    if (screen.type !== 'historical-bill') {
      return
    }

    setScreen({
      ...screen,
      mode: 'modify'
    })
  }

  function handleOpenPurchaseHistory(): void {
    setScreen({
      type: 'purchase-history'
    })
  }

  /*
   * Return from historical bill to Bill History.
   */
  function handleBackFromHistoricalBill(): void {
    setHistoricalBillingSession(null)

    setScreen({
      type: 'bill-history',
      returnTo: 'dashboard'
    })
  }

  const activeBillingSession = billingSessions === null ? null : billingSessions[activeBillingIndex]

  if (quitBackupStatus !== null) {
    return <QuitBackupScreen status={quitBackupStatus} errorMessage={quitBackupError} />
  }

  /*
   * Billing sessions are still loading.
   */
  if (screen.type === 'billing' && activeBillingSession === null) {
    return <div>Loading billing...</div>
  }

  /*
   * =========================================================
   * DASHBOARD
   * =========================================================
   */
  if (screen.type === 'dashboard') {
    return (
      <>
        <AppShell
          activeMenu="dashboard"
          onMenuSelect={handleMenuSelect}
          onQuit={handleQuitApplication}
        >
          <Dashboard
            onOpenBilling={() => {
              setScreen({
                type: 'billing'
              })
            }}
            onOpenItems={() => {
              setScreen({
                type: 'item-master',
                returnTo: 'dashboard'
              })
            }}
            onOpenBillHistory={() => {
              setScreen({
                type: 'bill-history',
                returnTo: 'dashboard'
              })
            }}
            onOpenSettings={() => {
              setScreen({
                type: 'settings'
              })
            }}
          />
        </AppShell>

        {showQuitConfirm && (
          <ConfirmDialog
            title="Quit Kirana?"
            message="A database backup will be created before the application closes. Do you want to continue?"
            onConfirm={() => {
              void performQuitBackup()
            }}
            onCancel={() => {
              setShowQuitConfirm(false)
            }}
          />
        )}
      </>
    )
  }

  /*
   * =========================================================
   * ACTIVE BILLING
   * =========================================================
   */
  if (screen.type === 'billing') {
    return (
      <>
        <Billing
          session={activeBillingSession!}
          onSessionChange={updateActiveBillingSession}
          mode="active"
          onNewBill={handleNewBill}
          onBillCompleted={async () => {
            const newBillNumber =
              await window.kirana.billing.allocateNextBillNumber(activeBillingIndex)

            setBillingSessions((currentSessions) => {
              if (!currentSessions) {
                return currentSessions
              }

              const updatedSessions: [BillingSession, BillingSession] = [...currentSessions]

              updatedSessions[activeBillingIndex] = createNewBillingSession(newBillNumber)

              return updatedSessions
            })
          }}
          onBack={() => {
            const hasItems = activeBillingSession?.lines.some(
              (line) => line.productId !== null || line.isTemporary
            )

            if (!hasItems) {
              setScreen({
                type: 'dashboard'
              })
              return
            }

            setShowExitBillingConfirm(true)
          }}
          onAddItem={() => {
            setScreen({
              type: 'add-item',
              returnTo: 'billing'
            })
          }}
          onEditItem={(productId) => {
            setScreen({
              type: 'edit-item',
              productId,
              returnTo: 'billing'
            })
          }}
          onOpenBillHistory={handleOpenBillHistory}
        />
        {showExitBillingConfirm && (
          <ConfirmDialog
            title="Leave Billing?"
            message="Current bill will be cleared. Do you want to continue?"
            onConfirm={() => {
              clearActiveBillingSession()
              setShowExitBillingConfirm(false)
              setScreen({
                type: 'dashboard'
              })
            }}
            onCancel={() => {
              setShowExitBillingConfirm(false)
            }}
          />
        )}
      </>
    )
  }

  /*
   * =========================================================
   * BILL HISTORY
   * =========================================================
   *
   * Enter  -> same Billing UI in VIEW mode
   * F3     -> same Billing UI in MODIFY mode
   */
  if (screen.type === 'bill-history') {
    return (
      <BillHistory
        onBack={() => {
          setScreen({
            type: screen.returnTo
          })
        }}
        onOpenBill={(saleId) => {
          handleOpenHistoricalBill(saleId)
        }}
        onModifyBill={(saleId) => {
          setHistoricalBillingSession(null)

          setScreen({
            type: 'historical-bill',
            saleId,
            mode: 'modify'
          })
        }}
      />
    )
  }

  /*
   * =========================================================
   * HISTORICAL BILL
   * =========================================================
   *
   * IMPORTANT:
   *
   * This uses the SAME Billing.tsx.
   *
   * mode="view"
   *      -> read-only
   *
   * mode="modify"
   *      -> editable
   *
   * It does NOT touch billingSessions.
   */
  if (screen.type === 'historical-bill') {
    /*
     * Billing.tsx loads the historical sale itself using saleId.
     *
     * We still need a session object because Billing.tsx requires
     * one. This temporary session is only a safe container while
     * the historical sale is loading.
     */
    const temporaryHistoricalSession: BillingSession =
      historicalBillingSession ?? createNewBillingSession('')

    return (
      <Billing
        session={temporaryHistoricalSession}
        onSessionChange={(update) => {
          /*
           * Historical bill edits stay completely separate from
           * the two active billing sessions.
           */
          setHistoricalBillingSession((currentSession) => {
            const baseSession = currentSession ?? temporaryHistoricalSession

            return typeof update === 'function' ? update(baseSession) : update
          })
        }}
        mode={screen.mode}
        saleId={screen.saleId}
        onModifyMode={handleModifyHistoricalBill}
        onBack={handleBackFromHistoricalBill}
        onAddItem={() => {
          /*
           * Historical bills cannot add new Item Master products
           * from this flow.
           */
        }}
        onEditItem={() => {
          /*
           * Historical bills do not open ProductForm from here.
           */
        }}
        onNewBill={() => {
          /*
           * Ctrl+N is intentionally blocked by Billing.tsx
           * while viewing/modifying a historical bill.
           */
        }}
        onBillCompleted={() => {
          /*
           * Historical bills are not completed again.
           */
        }}
        onOpenBillHistory={() => {
          handleOpenBillHistory()
        }}
      />
    )
  }

  /*
   * =========================================================
   * ADD ITEM
   * =========================================================
   */
  if (screen.type === 'add-item') {
    return (
      <ProductForm
        initialBarcode={screen.initialBarcode}
        onSaved={() => {
          setScreen({
            type: 'item-master',
            returnTo: screen.returnTo
          })
        }}
        onCancel={() => {
          setScreen({
            type: 'item-master',
            returnTo: screen.returnTo
          })
        }}
      />
    )
  }

  /*
   * =========================================================
   * EDIT ITEM
   * =========================================================
   */
  if (screen.type === 'edit-item') {
    return (
      <ProductForm
        productId={screen.productId}
        onSaved={() => {
          setScreen({
            type: 'item-master',
            returnTo: screen.returnTo
          })
        }}
        onCancel={() => {
          setScreen({
            type: 'item-master',
            returnTo: screen.returnTo
          })
        }}
      />
    )
  }

  if (screen.type === 'purchase-history') {
    return (
      <PurchaseHistory
        onBack={() => {
          setScreen({
            type: 'purchase-entry'
          })
        }}
        onModifyPurchase={async (purchaseId) => {
          try {
            console.log('MODIFY PURCHASE:', purchaseId)

            const purchase = await window.kirana.purchase.get(purchaseId)

            if (!purchase) {
              console.error('Purchase not found:', purchaseId)
              return
            }

            console.log('PURCHASE LOADED:', purchase)

            const supplier = await window.kirana.supplier.get(purchase.supplierId)

            if (!supplier) {
              console.error('Supplier not found:', purchase.supplierId)
              return
            }

            setPurchaseSupplier(supplier)

            setScreen({
              type: 'purchase-entry',
              purchaseId: purchase.id
            })
          } catch (error) {
            console.error('Unable to modify purchase:', error)
          }
        }}
      />
    )
  }

  /*
   * =========================================================
   * PURCHASE ENTRY
   * =========================================================
   */

  if (screen.type === 'purchase-entry') {
    return (
      <PurchaseEntry
        supplier={purchaseSupplier}
        purchaseId={screen.purchaseId}
        onSupplierSelected={(supplier) => {
          setPurchaseSupplier(supplier)
        }}
        onOpenHistory={() => {
          setScreen({
            type: 'purchase-history'
          })
        }}
        onBack={() => {
          setPurchaseSupplier(null)

          setScreen({
            type: 'dashboard'
          })
        }}
      />
    )
  }

  /*
   * =========================================================
   * SETTINGS
   * =========================================================
   */

  if (screen.type === 'settings') {
    return (
      <Settings
        onBack={() => {
          setScreen({
            type: 'dashboard'
          })
        }}
      />
    )
  }
  /*
   * =========================================================
   * ITEM MASTER
   * =========================================================
   */
  return (
    <ItemMaster
      mode="manage"
      onBack={() => {
        setScreen({
          type: screen.returnTo
        })
      }}
      onAddItem={() => {
        setScreen({
          type: 'add-item',
          returnTo: screen.returnTo
        })
      }}
      onEditItem={(productId) => {
        setScreen({
          type: 'edit-item',
          productId,
          returnTo: screen.returnTo
        })
      }}
    />
  )
}

export default App
