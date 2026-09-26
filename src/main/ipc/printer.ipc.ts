import { ipcMain } from 'electron'
import { getInstalledPrinters, printTestPage } from '../services/printer.service'
import { printReceipt, type EscPosReceipt } from '../services/escpos.service'

export function registerPrinterIpc(): void {
  ipcMain.handle('printer:list', async () => {
    return getInstalledPrinters()
  })

  ipcMain.handle('printer:test', async (_event, printerName: string) => {
    await printTestPage(printerName)
  })

  ipcMain.handle(
    'printer:printReceipt',
    async (_event, printerName: string, receipt: EscPosReceipt) => {
      await printReceipt(printerName, receipt)
    }
  )

  ipcMain.handle('printer:rawReceiptTest', async (_event, printerName: string) => {
    await printReceipt(printerName, {
      billNumber: '000001',
      saleDate: '26/09/2026',

      lines: [
        {
          productName: 'TEST ITEM',
          mrpPaise: 10000,
          quantity: 2,
          freeQuantity: 1,
          ratePaise: 9000,
          amountPaise: 18000
        },
        {
          productName: 'SECOND ITEM',
          mrpPaise: 5000,
          quantity: 1,
          freeQuantity: 0,
          ratePaise: 4500,
          amountPaise: 4500
        }
      ],

      totalMrpPaise: 25000,
      discountPaise: 2500,
      totalAmountPaise: 22500,

      paymentMethod: 'cash',
      paidPaise: 25000,
      changePaise: 2500
    })

    return {
      success: true
    }
  })
}
