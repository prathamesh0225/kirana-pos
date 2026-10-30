import { app, dialog, ipcMain } from 'electron'
import path from 'node:path'

import { backupDatabase, getDatabase, getDatabaseBackupDirectory } from '../database'
import { restoreDatabaseFromBackup } from '../database/restore'

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
      return { canceled: true }
    }

    await backupDatabase(result.filePath)

    return {
      canceled: false,
      filePath: result.filePath
    }
  })

  ipcMain.handle('database:restore', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Kirana Database Backup',
      properties: ['openFile'],
      filters: [
        {
          name: 'SQLite Database Backup',
          extensions: ['db']
        }
      ]
    })

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }

    const restoreResult = await restoreDatabaseFromBackup(result.filePaths[0])

    // Allow the IPC response to reach the renderer before restarting.
    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 700)

    return {
      canceled: false,
      safetyBackupPath: restoreResult.safetyBackupPath,
      migrationVersion: restoreResult.migrationVersion
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
