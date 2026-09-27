import { getDatabase } from '../database'

export type PrinterSettings = {
  printerName: string | null
}

export function getPrinterSettings(): PrinterSettings {
  const db = getDatabase()

  const row = db
    .prepare(
      `
      SELECT printer_name
      FROM printer_settings
      WHERE id = 1
    `
    )
    .get() as { printer_name: string | null } | undefined

  return {
    printerName: row?.printer_name ?? null
  }
}

export function setPrinterName(printerName: string | null): PrinterSettings {
  const db = getDatabase()

  db.prepare(
    `
    UPDATE printer_settings
    SET printer_name = ?
    WHERE id = 1
  `
  ).run(printerName)

  return getPrinterSettings()
}
