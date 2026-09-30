import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

const RECEIPT_WIDTH = 48

export type EscPosReceiptLine = {
  productName: string
  mrpPaise: number
  quantity: number
  freeQuantity: number
  ratePaise: number
  amountPaise: number
}

export type EscPosReceipt = {
  billNumber: string
  saleDate: string

  customerName?: string
  customerMobile?: string

  lines: EscPosReceiptLine[]

  totalMrpPaise: number
  discountPaise: number
  totalAmountPaise: number

  paymentMethod?: 'cash' | 'upi' | 'mixed'
  paidPaise?: number
  changePaise?: number
}

function padRight(value: string, width: number): string {
  if (value.length >= width) {
    return value.slice(0, width)
  }

  return value + ' '.repeat(width - value.length)
}

function padLeft(value: string, width: number): string {
  if (value.length >= width) {
    return value.slice(-width)
  }

  return ' '.repeat(width - value.length) + value
}

function centerText(value: string): string {
  if (value.length >= RECEIPT_WIDTH) {
    return value.slice(0, RECEIPT_WIDTH)
  }

  const left = Math.floor((RECEIPT_WIDTH - value.length) / 2)

  return ' '.repeat(left) + value
}

function formatRupees(paise: number): string {
  return (paise / 100).toFixed(2)
}

function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : String(quantity).replace(/\.?0+$/, '')
}

function formatQty(quantity: number, freeQuantity: number): string {
  const charged = formatQuantity(quantity)

  if (freeQuantity <= 0) {
    return charged
  }

  return `${charged}+${formatQuantity(freeQuantity)}F`
}

function truncateItemName(name: string, maxLength: number): string {
  return name.length > maxLength ? name.slice(0, maxLength) : name
}

function makeItemLine(line: EscPosReceiptLine): string {
  /*
   * 48-character layout:
   *
   * ITEM       18
   * MRP         7
   * QTY         7
   * RATE        7
   * AMT         9
   *
   * Total = 48
   */

  const itemWidth = 21
  const mrpWidth = 6
  const qtyWidth = 7
  const rateWidth = 7
  const amountWidth = 7

  const item = truncateItemName(line.productName, itemWidth)

  const mrp = formatRupees(line.mrpPaise)

  const qty = formatQty(line.quantity, line.freeQuantity)

  const rate = formatRupees(line.ratePaise)

  const amount = formatRupees(line.amountPaise)

  return (
    padRight(item, itemWidth) +
    padLeft(mrp, mrpWidth) +
    padLeft(qty, qtyWidth) +
    padLeft(rate, rateWidth) +
    padLeft(amount, amountWidth)
  )
}

function makeCompactTotalLine(label: string, amountPaise: number): string {
  const amount = formatRupees(amountPaise)

  // Keep amount close to label.
  const labelWidth = 14

  return padRight(label, labelWidth) + amount
}

function mergeReceiptLines(lines: EscPosReceiptLine[]): EscPosReceiptLine[] {
  const merged = new Map<string, EscPosReceiptLine>()

  for (const line of lines) {
    /*
     * Use product name + MRP + rate as the identity of
     * a printable item.
     *
     * Same product with different rates should remain
     * as separate lines.
     */
    const key = [line.productName, line.mrpPaise, line.ratePaise].join('|')

    const existing = merged.get(key)

    if (!existing) {
      merged.set(key, {
        ...line
      })

      continue
    }

    merged.set(key, {
      ...existing,
      quantity: existing.quantity + line.quantity,
      freeQuantity: existing.freeQuantity + line.freeQuantity,
      amountPaise: existing.amountPaise + line.amountPaise
    })
  }

  return Array.from(merged.values())
}

function buildReceiptText(receipt: EscPosReceipt): string {
  const lines: string[] = []

  // ------------------------------------------------
  // HEADER
  // ------------------------------------------------

  lines.push(centerText('GURUMAULI SUPER SHOPEE'))

  lines.push(centerText('T.K.V Chowk, Patur'))

  lines.push(centerText('7745887735'))

  lines.push('')

  // ------------------------------------------------
  // BILL INFORMATION
  // ------------------------------------------------

  const billInfo = `Bill No: ${receipt.billNumber}`

  const dateInfo = receipt.saleDate

  const billInfoSpaces = Math.max(1, RECEIPT_WIDTH - billInfo.length - dateInfo.length)

  lines.push(billInfo + ' '.repeat(billInfoSpaces) + dateInfo)

  if (receipt.customerName) {
    lines.push(`Customer: ${receipt.customerName}`)
  }

  if (receipt.customerMobile) {
    lines.push(`Mobile: ${receipt.customerMobile}`)
  }

  lines.push('')

  // ------------------------------------------------
  // ITEMS
  // ------------------------------------------------

  lines.push(
    padRight('ITEM', 18) +
      padLeft('MRP', 7) +
      padLeft('QTY', 7) +
      padLeft('RATE', 7) +
      padLeft('AMT', 9)
  )

  lines.push('-'.repeat(RECEIPT_WIDTH))

  const printableLines = mergeReceiptLines(receipt.lines)

  for (const line of printableLines) {
    lines.push(makeItemLine(line))
  }

  lines.push('-'.repeat(RECEIPT_WIDTH))

  // ------------------------------------------------
  // TOTALS
  // ------------------------------------------------

  lines.push(makeCompactTotalLine('TOTAL MRP', receipt.totalMrpPaise))

  lines.push(makeCompactTotalLine('DISCOUNT', receipt.discountPaise))

  lines.push('================================')

  lines.push(makeCompactTotalLine('TOTAL AMT', receipt.totalAmountPaise))

  lines.push('================================')

  // ------------------------------------------------
  // PAYMENT
  // ------------------------------------------------

  if (receipt.paymentMethod) {
    lines.push('')

    lines.push(`PAYMENT: ${receipt.paymentMethod.toUpperCase()}`)
  }

  if (receipt.paidPaise !== undefined) {
    lines.push(makeCompactTotalLine('PAID', receipt.paidPaise))
  }

  if (receipt.changePaise !== undefined) {
    lines.push(makeCompactTotalLine('CHANGE', receipt.changePaise))
  }

  // ------------------------------------------------
  // FOOTER
  // ------------------------------------------------

  lines.push('')

  lines.push(centerText('THANK YOU'))

  lines.push(centerText('VISIT AGAIN'))

  return lines.join('\n')
}

function buildEscPosReceipt(receipt: EscPosReceipt): Buffer {
  const bytes: number[] = []

  const push = (...values: number[]) => {
    bytes.push(...values)
  }

  const text = (value: string) => {
    bytes.push(...Buffer.from(value, 'ascii'))
  }

  // Initialize printer
  // push(0x1b, 0x40)

  // Font A
  push(0x1b, 0x4d, 0x00)

  // Bold ON
  push(0x1b, 0x45, 0x01)

  // Left alignment
  push(0x1b, 0x61, 0x00)

  text(buildReceiptText(receipt))

  // Feed
  push(0x0a)
  push(0x0a)
  push(0x0a)

  push(0x1b, 0x64, 0x03)

  // Cut
  push(0x1d, 0x56, 0x00)

  return Buffer.from(bytes)
}

// ============================================================
// PERSISTENT ESC/POS WINDOWS PRINTER WORKER
// ============================================================
//
// IMPORTANT:
//
// Old implementation:
//
//   Every receipt
//      -> start powershell.exe
//      -> Add-Type
//      -> compile C# P/Invoke
//      -> print
//      -> close powershell.exe
//
// New implementation:
//
//   Kirana starts
//      -> start powershell.exe
//      -> Add-Type ONCE
//      -> worker stays alive
//
//   Each receipt
//      -> send JSON + base64 ESC/POS data
//      -> WritePrinter
//
// This removes the PowerShell/Add-Type startup cost from
// every receipt.
//

let printerWorker: ChildProcessWithoutNullStreams | null = null

let printerWorkerReady: Promise<void> | null = null

let printerQueue: Promise<void> = Promise.resolve()

const printerWorkerScript = `
$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class KiranaRawPrinter
{
    [StructLayout(
        LayoutKind.Sequential,
        CharSet = CharSet.Unicode
    )]
    public class DOCINFO
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;

        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;

        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDataType;
    }

    [DllImport(
        "winspool.drv",
        CharSet = CharSet.Unicode,
        SetLastError = true
    )]
    public static extern bool OpenPrinter(
        string pPrinterName,
        out IntPtr phPrinter,
        IntPtr pDefault
    );

    [DllImport(
        "winspool.drv",
        CharSet = CharSet.Unicode,
        SetLastError = true
    )]
    public static extern bool ClosePrinter(
        IntPtr hPrinter
    );

    [DllImport(
        "winspool.drv",
        CharSet = CharSet.Unicode,
        SetLastError = true
    )]
    public static extern int StartDocPrinter(
        IntPtr hPrinter,
        int level,
        [In] DOCINFO di
    );

    [DllImport(
        "winspool.drv",
        CharSet = CharSet.Unicode,
        SetLastError = true
    )]
    public static extern bool EndDocPrinter(
        IntPtr hPrinter
    );

    [DllImport(
        "winspool.drv",
        CharSet = CharSet.Unicode,
        SetLastError = true
    )]
    public static extern bool StartPagePrinter(
        IntPtr hPrinter
    );

    [DllImport(
        "winspool.drv",
        CharSet = CharSet.Unicode,
        SetLastError = true
    )]
    public static extern bool EndPagePrinter(
        IntPtr hPrinter
    );

    [DllImport(
        "winspool.drv",
        CharSet = CharSet.Unicode,
        SetLastError = true
    )]
    public static extern bool WritePrinter(
        IntPtr hPrinter,
        IntPtr pBytes,
        int dwCount,
        out int dwWritten
    );

    public static void Print(
        string printerName,
        byte[] data
    )
    {
        IntPtr handle = IntPtr.Zero;

        if (!OpenPrinter(
            printerName,
            out handle,
            IntPtr.Zero
        ))
        {
            int errorCode =
                Marshal.GetLastWin32Error();

            throw new Exception(
                "Could not open printer: " +
                printerName +
                ". Windows error code: " +
                errorCode
            );
        }

        try
        {
            DOCINFO doc = new DOCINFO
            {
                pDocName = "Kirana Receipt",
                pDataType = "RAW"
            };

            int docResult =
                StartDocPrinter(
                    handle,
                    1,
                    doc
                );

            if (docResult == 0)
            {
                int errorCode =
                    Marshal.GetLastWin32Error();

                throw new Exception(
                    "StartDocPrinter failed. " +
                    "Windows error code: " +
                    errorCode
                );
            }

            try
            {
                if (!StartPagePrinter(handle))
                {
                    int errorCode =
                        Marshal.GetLastWin32Error();

                    throw new Exception(
                        "StartPagePrinter failed. " +
                        "Windows error code: " +
                        errorCode
                    );
                }

                try
                {
                    IntPtr ptr =
                        Marshal.AllocHGlobal(
                            data.Length
                        );

                    try
                    {
                        Marshal.Copy(
                            data,
                            0,
                            ptr,
                            data.Length
                        );

                        int written = 0;

                        bool writeResult =
                            WritePrinter(
                                handle,
                                ptr,
                                data.Length,
                                out written
                            );

                        if (!writeResult)
                        {
                            int errorCode =
                                Marshal.GetLastWin32Error();

                            throw new Exception(
                                "WritePrinter failed. " +
                                "Windows error code: " +
                                errorCode
                            );
                        }

                        if (written != data.Length)
                        {
                            throw new Exception(
                                "Only " +
                                written +
                                " of " +
                                data.Length +
                                " bytes were written."
                            );
                        }
                    }
                    finally
                    {
                        Marshal.FreeHGlobal(ptr);
                    }
                }
                finally
                {
                    EndPagePrinter(handle);
                }
            }
            finally
            {
                EndDocPrinter(handle);
            }
        }
        finally
        {
            ClosePrinter(handle);
        }
    }
}
"@

Write-Output "READY"
[Console]::Out.Flush()

while ($true) {
    $line = [Console]::ReadLine()

    if ($null -eq $line) {
        break
    }

    if ($line -eq "QUIT") {
        break
    }

    try {
        $request = $line | ConvertFrom-Json

        $printerName = [string]$request.printerName

        $data = [Convert]::FromBase64String(
            [string]$request.data
        )

        [KiranaRawPrinter]::Print(
            $printerName,
            $data
        )

        Write-Output '{"status":"ok"}'
    }
    catch {
        $errorMessage =
            $_.Exception.Message.Replace(
                [Environment]::NewLine,
                ' '
            )

        $response = @{
            status = "error"
            message = $errorMessage
        } | ConvertTo-Json -Compress

        Write-Output $response
    }

    [Console]::Out.Flush()
}
`

function startPrinterWorker(): Promise<void> {
  if (printerWorker && !printerWorker.killed && printerWorkerReady) {
    return printerWorkerReady
  }

  printerWorker = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      printerWorkerScript
    ],
    {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    }
  )

  const worker = printerWorker

  printerWorkerReady = new Promise<void>((resolve, reject) => {
    let output = ''
    let settled = false

    const cleanup = () => {
      worker.stdout.removeListener('data', onData)

      worker.removeListener('error', onError)

      worker.removeListener('exit', onExit)
    }

    const fail = (error: Error) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()

      if (printerWorker === worker) {
        printerWorker = null
        printerWorkerReady = null
      }

      reject(error)
    }

    const onData = (chunk: Buffer) => {
      output += chunk.toString()

      if (output.includes('READY')) {
        if (settled) {
          return
        }

        settled = true
        cleanup()
        resolve()
      }
    }

    const onError = (error: Error) => {
      fail(error)
    }

    const onExit = (code: number | null) => {
      if (settled) {
        return
      }

      fail(new Error(`Printer worker stopped during startup (code ${code ?? 'unknown'}).`))
    }

    worker.stdout.on('data', onData)
    worker.once('error', onError)
    worker.once('exit', onExit)
  })

  return printerWorkerReady
}

function sendRawToPrinterNow(printerName: string, data: Buffer): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const worker = printerWorker

    if (!worker || !worker.stdin) {
      reject(new Error('Printer worker is not available.'))

      return
    }

    let output = ''

    const cleanup = () => {
      worker.stdout.removeListener('data', onData)

      worker.removeListener('error', onError)

      worker.removeListener('exit', onExit)
    }

    const finishError = (error: Error) => {
      cleanup()
      reject(error)
    }

    const onData = (chunk: Buffer) => {
      output += chunk.toString()

      const lines = output.split(/\r?\n/)

      // Keep only the incomplete final line.
      output = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) {
          continue
        }

        let response: {
          status?: string
          message?: string
        }

        try {
          response = JSON.parse(line)
        } catch {
          continue
        }

        if (response.status === 'ok') {
          cleanup()
          resolve()
          return
        }

        if (response.status === 'error') {
          finishError(new Error(response.message ?? 'Unknown printer error.'))

          return
        }
      }
    }

    const onError = (error: Error) => {
      finishError(error)
    }

    const onExit = (code: number | null) => {
      finishError(new Error(`Printer worker stopped unexpectedly (code ${code ?? 'unknown'}).`))
    }

    worker.stdout.on('data', onData)
    worker.once('error', onError)
    worker.once('exit', onExit)

    try {
      const request = JSON.stringify({
        printerName,
        data: data.toString('base64')
      })

      worker.stdin.write(request + '\n')
    } catch (error) {
      finishError(
        error instanceof Error ? error : new Error('Unable to send data to printer worker.')
      )
    }
  })
}

async function sendRawToPrinter(printerName: string, data: Buffer): Promise<void> {
  /*
   * Make sure the worker exists before adding the
   * print operation to the queue.
   */
  await startPrinterWorker()

  /*
   * Serialize all raw printer operations.
   *
   * This is important because the worker uses stdout
   * for its response. Two simultaneous requests must
   * never compete for the same response.
   */
  const operation = printerQueue.then(async () => {
    await startPrinterWorker()

    return sendRawToPrinterNow(printerName, data)
  })

  /*
   * The queue itself must continue after a failed
   * print, otherwise one printer error would block
   * every future receipt.
   */
  printerQueue = operation.catch(() => undefined)

  return operation
}

/**
 * Stop the persistent PowerShell printer worker.
 *
 * Call this during application shutdown.
 */
export function stopPrinterWorker(): void {
  const worker = printerWorker

  printerWorker = null
  printerWorkerReady = null

  if (!worker || worker.killed) {
    return
  }

  try {
    if (worker.stdin) {
      worker.stdin.write('QUIT\n')
      worker.stdin.end()
    }
  } catch {
    // Worker may already be stopping.
  }
}

export async function printReceipt(printerName: string, receipt: EscPosReceipt): Promise<void> {
  const data = buildEscPosReceipt(receipt)

  await sendRawToPrinter(printerName, data)
}
