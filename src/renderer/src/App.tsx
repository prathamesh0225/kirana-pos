import { useEffect, useState } from 'react'
import Billing from './screens/billing/Billing'
import ItemMaster from './screens/products/ItemMaster'
import ProductForm from './screens/products/ProductForm'
import BillHistory from './screens/billing/BillHistory'
import type { BillingSession } from './screens/billing/billing.types'

type HistoricalBillMode = 'view' | 'modify'

type Screen =
  | {
      type: 'billing'
    }
  | {
      type: 'item-master'
    }
  | {
      type: 'add-item'
      initialBarcode?: string
    }
  | {
      type: 'edit-item'
      productId: number
    }
  | {
      type: 'bill-history'
    }
  | {
      type: 'historical-bill'
      saleId: number
      mode: HistoricalBillMode
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
    type: 'billing'
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

  /*
   * Ctrl+N switches between the two active billing slots.
   */
  function handleNewBill(): void {
    setActiveBillingIndex((currentIndex) => (currentIndex === 0 ? 1 : 0))
  }

  /*
   * Open Bill History.
   */
  function handleOpenBillHistory(): void {
    setScreen({
      type: 'bill-history'
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

  /*
   * Return from historical bill to Bill History.
   */
  function handleBackFromHistoricalBill(): void {
    setHistoricalBillingSession(null)

    setScreen({
      type: 'bill-history'
    })
  }

  const activeBillingSession = billingSessions === null ? null : billingSessions[activeBillingIndex]

  /*
   * Billing sessions are still loading.
   */
  if (screen.type === 'billing' && activeBillingSession === null) {
    return <div>Loading billing...</div>
  }

  /*
   * =========================================================
   * ACTIVE BILLING
   * =========================================================
   */
  if (screen.type === 'billing') {
    return (
      <Billing
        session={activeBillingSession!}
        onSessionChange={updateActiveBillingSession}
        mode="active"
        onNewBill={handleNewBill}
        onBillCompleted={async () => {
          const newBillNumber =
            await window.kirana.billing.allocateNextBillNumber(activeBillingIndex)

          updateActiveBillingSession(createNewBillingSession(newBillNumber))
        }}
        onBack={() => {
          // Existing navigation.
        }}
        onAddItem={() => {
          setScreen({
            type: 'add-item'
          })
        }}
        onEditItem={(productId) => {
          setScreen({
            type: 'edit-item',
            productId
          })
        }}
        onOpenBillHistory={handleOpenBillHistory}
      />
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
            type: 'billing'
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
        onPayment={() => {
          /*
           * Payment is intentionally unavailable for historical bills.
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
          /*
           * Return to the active bill.
           *
           * Active billingSessions were never lost.
           */
          setScreen({
            type: 'billing'
          })
        }}
        onCancel={() => {
          setScreen({
            type: 'billing'
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
          /*
           * Return to the active bill.
           */
          setScreen({
            type: 'billing'
          })
        }}
        onCancel={() => {
          setScreen({
            type: 'billing'
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
          type: 'billing'
        })
      }}
      onAddItem={() => {
        setScreen({
          type: 'add-item'
        })
      }}
      onEditItem={(productId) => {
        setScreen({
          type: 'edit-item',
          productId
        })
      }}
    />
  )
}

export default App
