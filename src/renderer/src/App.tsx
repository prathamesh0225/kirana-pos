import { useState } from 'react'
import Billing from './screens/billing/Billing'
import ItemMaster from './screens/products/ItemMaster'
import ProductForm from './screens/products/ProductForm'
import type { BillingSession } from './screens/billing/billing.types'

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
   * Exactly two billing sessions.
   *
   * Both bills stay alive in App state, so switching between
   * them does not lose any entered items, customer details, etc.
   */
  const [billingSessions, setBillingSessions] = useState<[BillingSession, BillingSession]>([
    createNewBillingSession('A000001'),
    createNewBillingSession('A000002')
  ])

  /*
   * 0 = Bill A000001
   * 1 = Bill A000002
   */
  const [activeBillingIndex, setActiveBillingIndex] = useState<0 | 1>(0)

  const activeBillingSession = billingSessions[activeBillingIndex]

  /*
   * Update only the currently active bill.
   */
  function updateActiveBillingSession(
    update: BillingSession | ((current: BillingSession) => BillingSession)
  ): void {
    setBillingSessions((currentSessions) => {
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
   * Ctrl+N simply switches between the two bills.
   *
   * Bill A000001 -> Bill A000002
   * Bill A000002 -> Bill A000001
   */
  function handleNewBill(): void {
    setActiveBillingIndex((currentIndex) => (currentIndex === 0 ? 1 : 0))
  }

  if (screen.type === 'billing') {
    return (
      <Billing
        session={activeBillingSession}
        onSessionChange={updateActiveBillingSession}
        onNewBill={handleNewBill}
        onBack={() => {
          // existing navigation
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

  if (screen.type === 'add-item') {
    return (
      <ProductForm
        initialBarcode={screen.initialBarcode}
        onSaved={() => {
          /*
           * Return to the currently active bill.
           * The bill itself was never lost because it lives
           * in App-level billingSessions state.
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

  if (screen.type === 'edit-item') {
    return (
      <ProductForm
        productId={screen.productId}
        onSaved={() => {
          /*
           * Return to the currently active bill.
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
