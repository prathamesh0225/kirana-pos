import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

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

  for (const line of receipt.lines) {
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
  push(0x1b, 0x40)

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

async function sendRawToPrinter(printerName: string, data: Buffer): Promise<void> {
  const base64 = data.toString('base64')

  const escapedPrinterName = printerName.replace(/'/g, "''")

  const script = `
$printerName = '${escapedPrinterName}'
$base64 = '${base64}'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
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
}
"@

$handle = [IntPtr]::Zero

if (-not [RawPrinter]::OpenPrinter(
    $printerName,
    [ref]$handle,
    [IntPtr]::Zero
)) {
    $errorCode =
        [Runtime.InteropServices.Marshal]::GetLastWin32Error()

    throw "Could not open printer: $printerName. Windows error code: $errorCode"
}

try {
    $doc = New-Object RawPrinter+DOCINFO

    $doc.pDocName = "Kirana Receipt"
    $doc.pDataType = "RAW"

    $docResult = [RawPrinter]::StartDocPrinter(
        $handle,
        1,
        $doc
    )

    if ($docResult -eq 0) {
        $errorCode =
            [Runtime.InteropServices.Marshal]::GetLastWin32Error()

        throw "StartDocPrinter failed. Windows error code: $errorCode"
    }

    try {
        if (-not [RawPrinter]::StartPagePrinter($handle)) {
            $errorCode =
                [Runtime.InteropServices.Marshal]::GetLastWin32Error()

            throw "StartPagePrinter failed. Windows error code: $errorCode"
        }

        try {
            $data =
                [Convert]::FromBase64String($base64)

            $ptr =
                [Runtime.InteropServices.Marshal]::AllocHGlobal(
                    $data.Length
                )

            try {
                [Runtime.InteropServices.Marshal]::Copy(
                    $data,
                    0,
                    $ptr,
                    $data.Length
                )

                $written = 0

                $writeResult =
                    [RawPrinter]::WritePrinter(
                        $handle,
                        $ptr,
                        $data.Length,
                        [ref]$written
                    )

                if (-not $writeResult) {
                    $errorCode =
                        [Runtime.InteropServices.Marshal]::GetLastWin32Error()

                    throw "WritePrinter failed. Windows error code: $errorCode"
                }

                if ($written -ne $data.Length) {
                    throw "Only $written of $($data.Length) bytes were written"
                }
            }
            finally {
                [Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
            }
        }
        finally {
            [RawPrinter]::EndPagePrinter($handle)
        }
    }
    finally {
        [RawPrinter]::EndDocPrinter($handle)
    }
}
finally {
    [RawPrinter]::ClosePrinter($handle)
}
`

  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    {
      windowsHide: true
    }
  )
}

export async function printReceipt(printerName: string, receipt: EscPosReceipt): Promise<void> {
  const data = buildEscPosReceipt(receipt)

  await sendRawToPrinter(printerName, data)
}
