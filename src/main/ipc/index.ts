import { registerAppIpc } from './app.ipc'
import { registerDatabaseIpc } from './database.ipc'
import { registerProductIpc } from './products.ipc'
import { registerBillingIpc } from './billing.ipc'

export function registerIpcHandlers(): void {
  registerAppIpc()
  registerDatabaseIpc()
  registerProductIpc()
  registerBillingIpc()
}
