import { BrowserWindow } from 'electron'
import { buildReceiptHtml, type ReceiptData } from './receipt.service'

export type PrinterInfo = {
  name: string
  displayName: string
  description: string
  status: number
  isDefault: boolean
}

export async function getInstalledPrinters(): Promise<PrinterInfo[]> {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true
    }
  })

  try {
    const printers = await window.webContents.getPrintersAsync()

    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName,
      description: printer.description,
      status: printer.status,
      isDefault: printer.isDefault
    }))
  } finally {
    window.destroy()
  }
}

export async function printTestPage(printerName: string): Promise<void> {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true
    }
  })

  try {
    await window.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8" />
            <style>
              @page {
                size: 80mm auto;
                margin: 0;
              }

              html,
              body {
                margin: 0;
                padding: 0;
                width: 80mm;
                font-family: monospace;
                font-size: 12px;
              }

              .receipt {
                width: 72mm;
                margin: 0 auto;
                padding: 4mm 0;
              }

              .center {
                text-align: center;
              }

              .line {
                border-top: 1px dashed #000;
                margin: 8px 0;
              }
            </style>
          </head>

          <body>
            <div class="receipt">
              <div class="center">
                <strong>KIRANA POS</strong>
              </div>

              <div class="line"></div>

              <div>RUGTEK RP326 TEST</div>
              <div>Printer: 80mm Series Printer</div>

              <div class="line"></div>

              <div class="center">
                TEST PRINT SUCCESSFUL
              </div>

              <div class="line"></div>

              <div class="center">
                Thank You
              </div>
            </div>
          </body>
          </html>
        `)
    )

    await new Promise<void>((resolve, reject) => {
      window.webContents.print(
        {
          silent: true,
          deviceName: printerName,
          printBackground: false,
          margins: {
            marginType: 'none'
          }
        },
        (success, failureReason) => {
          if (success) {
            resolve()
          } else {
            reject(new Error(failureReason || 'Printer failed to print'))
          }
        }
      )
    })
  } finally {
    window.destroy()
  }
}

export async function printReceipt(printerName: string, receipt: ReceiptData): Promise<void> {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true
    }
  })

  try {
    const html = buildReceiptHtml(receipt)

    await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))

    await new Promise<void>((resolve, reject) => {
      window.webContents.print(
        {
          silent: true,
          deviceName: printerName,
          printBackground: false,
          margins: {
            marginType: 'none'
          }
        },
        (success, failureReason) => {
          if (success) {
            resolve()
            return
          }

          reject(new Error(failureReason || 'Failed to print receipt'))
        }
      )
    })
  } finally {
    window.destroy()
  }
}
