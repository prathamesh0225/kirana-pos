import { dialog, ipcMain } from 'electron'
import { backupDatabase, getDatabase, getDatabaseBackupDirectory } from '../database'
import path from 'node:path'
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

  ipcMain.handle('database:backupOnExit', async () => {
    const backupDirectory = getDatabaseBackupDirectory()

    const now = new Date()

    const timestamp =
      `${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, '0')}-` +
      `${String(now.getDate()).padStart(2, '0')}_` +
      `${String(now.getHours()).padStart(2, '0')}` +
      `${String(now.getMinutes()).padStart(2, '0')}` +
      `${String(now.getSeconds()).padStart(2, '0')}`

    const backupPath = path.join(backupDirectory, `kirana-backup-${timestamp}.db`)

    await backupDatabase(backupPath)

    return {
      ok: true,
      filePath: backupPath
    }
  })
}
