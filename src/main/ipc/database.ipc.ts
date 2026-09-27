import { dialog, ipcMain } from 'electron'
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

  ipcMain.handle('database:backup', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Backup Kirana Database',
      defaultPath: 'kirana-backup.db',
      filters: [
        {
          name: 'SQLite Database',
          extensions: ['db']
        }
      ]
    })

    if (result.canceled || !result.filePath) {
      return {
        success: false,
        cancelled: true
      }
    }

    const db = getDatabase()

    await db.backup(result.filePath)

    return {
      success: true,
      cancelled: false,
      path: result.filePath
    }
  })
}
