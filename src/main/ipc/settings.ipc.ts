import { ipcMain } from 'electron'
import { getPrinterSettings, setPrinterName } from '../repositories/settings.repository'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:getPrinter', () => {
    return getPrinterSettings()
  })

  ipcMain.handle('settings:setPrinter', (_event, printerName: string | null) => {
    if (printerName !== null && typeof printerName !== 'string') {
      throw new Error('Invalid printer name')
    }

    return setPrinterName(printerName)
  })
}
