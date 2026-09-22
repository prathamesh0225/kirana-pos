import { ipcMain } from 'electron'
import { getDatabase } from '../database'

export function registerDatabaseIpc(): void {
  ipcMain.handle('database:test', () => {
    const db = getDatabase()

    const row = db
      .prepare(
        `
        SELECT MAX(version) AS version
        FROM migrations
      `
      )
      .get() as
      | {
          version: number | null
        }
      | undefined

    return {
      success: true,
      version: row?.version ?? 0
    }
  })
}
