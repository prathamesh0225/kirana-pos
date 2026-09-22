import { registerAppIpc } from './app.ipc'
import { registerDatabaseIpc } from './database.ipc'
import { registerProductIpc } from './products.ipc'

export function registerIpcHandlers(): void {
  registerAppIpc()
  registerDatabaseIpc()
  registerProductIpc()
}
