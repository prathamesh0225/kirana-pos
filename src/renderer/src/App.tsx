import { useState } from 'react'
import ItemMaster from './screens/products/ItemMaster'
import ProductForm from './screens/products/ProductForm'

type Screen =
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

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>({
    type: 'item-master'
  })

  if (screen.type === 'add-item') {
    return (
      <ProductForm
        initialBarcode={screen.initialBarcode}
        onSaved={() => {
          setScreen({
            type: 'item-master'
          })
        }}
        onCancel={() => {
          setScreen({
            type: 'item-master'
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
          setScreen({
            type: 'item-master'
          })
        }}
        onCancel={() => {
          setScreen({
            type: 'item-master'
          })
        }}
      />
    )
  }

  return (
    <ItemMaster
      onBack={() => {
        // Billing/main menu navigation will be connected later.
        // For now Item Master is the root screen.
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
