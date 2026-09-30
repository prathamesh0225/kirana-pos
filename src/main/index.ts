import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { join } from 'node:path'

import { runMigrations } from './database/migrations'
import { registerAppIpc } from './ipc/app.ipc'
import { registerDatabaseIpc } from './ipc/database.ipc'
import { registerProductIpc } from './ipc/products.ipc'
import { registerBillingIpc } from './ipc/billing.ipc'
import { registerPrinterIpc } from './ipc/printer.ipc'
import { registerSettingsIpc } from './ipc/settings.ipc'
import { stopPrinterWorker } from './services/escpos.service'
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    fullscreen: true,
    autoHideMenuBar: true,

    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.kirana.pos')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    await runMigrations()

    registerAppIpc()
    registerDatabaseIpc()
    registerProductIpc()
    registerBillingIpc()
    registerPrinterIpc()
    registerSettingsIpc()

    createWindow()
  } catch (error) {
    console.error('Failed to initialize database:', error)
    stopPrinterWorker()
    app.quit()
  }
})

app.on('window-all-closed', () => {
  stopPrinterWorker()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
