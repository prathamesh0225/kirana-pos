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

function createNewBillingSession(): BillingSession {
  return {
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
   * The active bill lives at App level.
   *
   * Billing can therefore be temporarily unmounted while
   * Item Master / Product Form is open without losing the bill.
   */
  const [billingSession, setBillingSession] = useState<BillingSession>(createNewBillingSession())

  if (screen.type === 'billing') {
    return (
      <Billing
        session={billingSession}
        onSessionChange={setBillingSession}
        onBack={() => {
          // Main menu will be connected later.
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
          // Return to the active bill.
          setScreen({
            type: 'billing'
          })
        }}
        onCancel={() => {
          // Return to the active bill.
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
          // Return to the active bill.
          setScreen({
            type: 'billing'
          })
        }}
        onCancel={() => {
          // Return to the active bill.
          setScreen({
            type: 'billing'
          })
        }}
      />
    )
  }

  return (
    <ItemMaster
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
