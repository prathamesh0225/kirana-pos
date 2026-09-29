import { dialog, ipcMain } from 'electron'
import { backupDatabase, getDatabase } from '../database'

export function registerDatabaseIpc(): void {
  ipcMain.handle('database:test', () => {
    const db = getDatabase()

    const result = db
      .prepare(
        `
        SELECT MAX(version) AS version
        FROM migrations
        `
      )
      .get() as { version: number | null }

    return {
      ok: true,
      migrationVersion: result.version ?? 0
    }
  })

  ipcMain.handle('database:backup', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Backup Database',
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
        canceled: true
      }
    }

    await backupDatabase(result.filePath)

    return {
      canceled: false,
      filePath: result.filePath
    }
  })
}
