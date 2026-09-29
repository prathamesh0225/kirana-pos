import { app, ipcMain } from 'electron'

export function registerAppIpc(): void {
  ipcMain.handle('app:getInfo', () => {
    return {
      name: 'Kirana Mart POS',
      version: app.getVersion()
    }
  })
}
