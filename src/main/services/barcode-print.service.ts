// barcode-print.service.ts

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type BarcodePrintInput = {
  printerName: string
  barcode: string
  shopName: string
  productName: string
  mrpPaise: number
  sellingPricePaise: number

  /*
   * quantity = NUMBER OF ROWS.
   * Each row contains TWO barcodes side-by-side.
   */
  quantity: number
  extraText?: string
}

function formatRupees(paise: number): string {
  const rupees = paise / 100
  return rupees.toFixed(1)
}

function escapeTsplText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '').replace(/\n/g, ' ')
}

function buildBarcodeTspl(input: BarcodePrintInput): string {
  const shopName = escapeTsplText(input.shopName.trim())
  const productName = escapeTsplText(input.productName.trim())
  const barcode = escapeTsplText(input.barcode.trim())
  const extraText = escapeTsplText(input.extraText?.trim() ?? '')

  const mrp = escapeTsplText(formatRupees(input.mrpPaise))
  const rate = escapeTsplText(formatRupees(input.sellingPricePaise))

  const labelWidth = 400
  const labelHeight = 200

  const leftMargin = 20
  const rightLabelX = 450

  const commands: string[] = []

  commands.push('SIZE 104 mm,25 mm')
  commands.push('GAP 2 mm,2 mm')
  commands.push('DIRECTION 1')
  commands.push('REFERENCE 0,0')
  commands.push('OFFSET 0 mm')
  commands.push('CLS')

  const rows = input.quantity

  for (let row = 0; row < rows; row++) {
    const yOffset = row * labelHeight

    /*
     * =======================================================
     * DYNAMIC POSITIONING & BALANCED SPACING
     * =======================================================
     */
    const topMargin = 10
    const shopY = topMargin + yOffset

    let productY: number
    let priceY: number
    let extraY = 0
    let barcodeY: number
    let productFont: string

    if (extraText) {
      // Compact layout when extra text is present
      productFont = '2'
      productY = topMargin + 30 + yOffset
      priceY = topMargin + 56 + yOffset
      extraY = topMargin + 82 + yOffset
      barcodeY = topMargin + 110 + yOffset
    } else {
      // Expanded gaps and larger product font ("3") when extra text is absent
      productFont = '3'
      productY = topMargin + 38 + yOffset
      priceY = topMargin + 72 + yOffset
      barcodeY = topMargin + 106 + yOffset
    }

    /*
     * =======================================================
     * LEFT LABEL
     * =======================================================
     */
    commands.push(`TEXT ${leftMargin},${shopY},"3",0,1,1,"${shopName}"`)
    commands.push(`TEXT ${leftMargin},${productY},"${productFont}",0,1,1,"${productName}"`)
    commands.push(`TEXT ${leftMargin},${priceY},"2",0,1,1,"MRP:${mrp} R:${rate}"`)

    if (extraText) {
      commands.push(`TEXT ${leftMargin},${extraY},"1",0,1,1,"${extraText}"`)
    }

    commands.push(`BARCODE ${leftMargin},${barcodeY},"128",35,1,0,2,2,"${barcode}"`)

    /*
     * =======================================================
     * RIGHT LABEL
     * =======================================================
     */
    commands.push(`TEXT ${rightLabelX},${shopY},"3",0,1,1,"${shopName}"`)
    commands.push(`TEXT ${rightLabelX},${productY},"${productFont}",0,1,1,"${productName}"`)
    commands.push(`TEXT ${rightLabelX},${priceY},"2",0,1,1,"MRP:${mrp} R:${rate}"`)

    if (extraText) {
      commands.push(`TEXT ${rightLabelX},${extraY},"1",0,1,1,"${extraText}"`)
    }

    commands.push(`BARCODE ${rightLabelX},${barcodeY},"128",35,1,0,2,2,"${barcode}"`)
  }

  commands.push(`PRINT ${input.quantity},1`)
  commands.push('')

  return commands.join('\r\n')
}

export async function printBarcodeLabels(input: BarcodePrintInput): Promise<void> {
  if (!input.printerName.trim()) {
    throw new Error('Barcode printer is not selected.')
  }

  if (!input.barcode.trim()) {
    throw new Error('Product barcode is required.')
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('Barcode rows must be greater than zero.')
  }

  const tspl = buildBarcodeTspl(input)
  const base64 = Buffer.from(tspl, 'ascii').toString('base64')
  const printerName = input.printerName.replace(/'/g, "''")

  const script = `
$printerName = '${printerName}'
$data = [Convert]::FromBase64String('${base64}')

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

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFO di);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static void Send(string printerName, byte[] bytes)
    {
        IntPtr printer;
        if (!OpenPrinter(printerName, out printer, IntPtr.Zero))
        {
            throw new Exception("Unable to open printer.");
        }

        try
        {
            DOCINFO docInfo = new DOCINFO();
            docInfo.pDocName = "Kirana POS Barcode";
            docInfo.pDataType = "RAW";

            if (StartDocPrinter(printer, 1, docInfo) == 0)
            {
                throw new Exception("Unable to start printer document.");
            }

            try
            {
                if (!StartPagePrinter(printer))
                {
                    throw new Exception("Unable to start printer page.");
                }

                try
                {
                    IntPtr unmanagedPointer = Marshal.AllocCoTaskMem(bytes.Length);
                    try
                    {
                        Marshal.Copy(bytes, 0, unmanagedPointer, bytes.Length);
                        int written;
                        if (!WritePrinter(printer, unmanagedPointer, bytes.Length, out written))
                        {
                            throw new Exception("Unable to send data to printer.");
                        }
                        if (written != bytes.Length)
                        {
                            throw new Exception("Printer did not accept all TSPL data.");
                        }
                    }
                    finally
                    {
                        Marshal.FreeCoTaskMem(unmanagedPointer);
                    }
                }
                finally
                {
                    EndPagePrinter(printer);
                }
            }
            finally
            {
                EndDocPrinter(printer);
            }
        }
        finally
        {
            ClosePrinter(printer);
        }
    }
}
"@

[RawPrinter]::Send($printerName, $data)
`

  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    {
      windowsHide: true,
      maxBuffer: 1024 * 1024
    }
  )
}
