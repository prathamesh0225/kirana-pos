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

  quantity: number

  extraText?: string
}

function formatRupees(paise: number): string {
  return `Rs.${(paise / 100).toFixed(2)}`
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

  /*
   * ---------------------------------------------------------
   * LABEL SIZE
   *
   * Approx:
   * 50mm x 25mm
   *
   * TE244 at 203 DPI:
   * 50mm ≈ 400 dots
   * 25mm ≈ 200 dots
   *
   * Two labels across:
   * 800 dots total.
   *
   * These values are intentionally kept here so we can
   * tune them during physical testing.
   * ---------------------------------------------------------
   */

  const labelWidth = 400
  const labelHeight = 200

  /*
   * Two labels side-by-side.
   */
  const gap = 0

  const totalWidth = labelWidth * 2 + gap

  /*
   * ---------------------------------------------------------
   * TSPL
   * ---------------------------------------------------------
   */

  const commands: string[] = []

  commands.push('SIZE 50 mm,25 mm')
  commands.push('GAP 2 mm,0 mm')
  commands.push('DIRECTION 1')
  commands.push('REFERENCE 0,0')
  commands.push('OFFSET 0 mm')
  commands.push('CLS')

  /*
   * ---------------------------------------------------------
   * LABEL 1
   * ---------------------------------------------------------
   */

  commands.push(`TEXT 12,8,"0",0,1,1,"${shopName}"`)

  commands.push(`TEXT 12,30,"0",0,1,1,"${productName}"`)

  commands.push(`TEXT 12,52,"0",0,1,1,"MRP ${mrp}  RATE ${rate}"`)

  if (extraText) {
    commands.push(`TEXT 12,74,"0",0,1,1,"${extraText}"`)
  }

  /*
   * Barcode:
   *
   * CODE128
   *
   * x = 12
   * y = 98
   * height = 65
   */
  commands.push(`BARCODE 12,98,"128",65,1,0,2,2,"${barcode}"`)

  /*
   * ---------------------------------------------------------
   * LABEL 2
   * ---------------------------------------------------------
   *
   * Same physical label repeated beside the first one.
   */

  const x = labelWidth + gap + 12

  commands.push(`TEXT ${x},8,"0",0,1,1,"${shopName}"`)

  commands.push(`TEXT ${x},30,"0",0,1,1,"${productName}"`)

  commands.push(`TEXT ${x},52,"0",0,1,1,"MRP ${mrp}  RATE ${rate}"`)

  if (extraText) {
    commands.push(`TEXT ${x},74,"0",1,1,1,"${extraText}"`)
  }

  commands.push(`BARCODE ${x},98,"128",65,1,0,2,2,"${barcode}"`)

  /*
   * PRINT quantity.
   *
   * Since one TSPL print is two labels,
   * convert requested labels into pairs.
   */
  const copies = Math.ceil(input.quantity / 2)

  commands.push(`PRINT ${copies},1`)
  commands.push('')

  return commands.join('\r\n')
}

/**
 * Sends raw TSPL to a Windows printer.
 *
 * This implementation uses PowerShell + .NET PrintServer /
 * PrintQueue APIs to send the TSPL payload to the selected
 * printer.
 */
export async function printBarcodeLabels(input: BarcodePrintInput): Promise<void> {
  if (!input.printerName.trim()) {
    throw new Error('Barcode printer is not selected.')
  }

  if (!input.barcode.trim()) {
    throw new Error('Product barcode is required.')
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('Barcode quantity must be greater than zero.')
  }

  const tspl = buildBarcodeTspl(input)

  /*
   * Encode TSPL as Base64 so PowerShell does not have to deal
   * with quoting/newline issues.
   */
  const base64 = Buffer.from(tspl, 'ascii').toString('base64')

  const script = `
$printerName = '${input.printerName.replace(/'/g, "''")}'
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

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW",
        SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool OpenPrinter(
        string pPrinterName,
        out IntPtr phPrinter,
        IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW",
        SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern int StartDocPrinter(
        IntPtr hPrinter,
        int level,
        [In] DOCINFO di);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(
        IntPtr hPrinter,
        IntPtr pBytes,
        int dwCount,
        out int dwWritten);

    public static void Send(string printerName, byte[] bytes)
    {
        IntPtr printer;

        if (!OpenPrinter(printerName, out printer, IntPtr.Zero))
            throw new Exception("Unable to open printer.");

        try
        {
            DOCINFO docInfo = new DOCINFO();
            docInfo.pDocName = "Kirana POS Barcode";
            docInfo.pDataType = "RAW";

            if (StartDocPrinter(printer, 1, docInfo) == 0)
                throw new Exception("Unable to start printer document.");

            try
            {
                if (!StartPagePrinter(printer))
                    throw new Exception("Unable to start printer page.");

                try
                {
                    IntPtr unmanagedPointer =
                        Marshal.AllocCoTaskMem(bytes.Length);

                    try
                    {
                        Marshal.Copy(
                            bytes,
                            0,
                            unmanagedPointer,
                            bytes.Length);

                        int written;

                        if (!WritePrinter(
                            printer,
                            unmanagedPointer,
                            bytes.Length,
                            out written))
                        {
                            throw new Exception(
                                "Unable to send data to printer.");
                        }

                        if (written != bytes.Length)
                            throw new Exception(
                                "Printer did not accept all TSPL data.");
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
