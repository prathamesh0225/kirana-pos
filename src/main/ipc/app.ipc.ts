import { ipcMain } from 'electron'

export function registerAppIpc(): void {
  ipcMain.handle('app:ping', () => {
    return {
      success: true,
      message: 'Electron main process is working'
    }
  })
}
