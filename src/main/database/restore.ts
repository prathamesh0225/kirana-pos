import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

import {
  backupDatabase,
  closeDatabase,
  getDatabase,
  getDatabaseBackupDirectory,
  getDatabasePath
} from './index'
import { runMigrations, LATEST_MIGRATION_VERSION } from './migrations'

type RestoreResult = {
  safetyBackupPath: string
  migrationVersion: number
}

function createTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function validateBackup(filePath: string): number {
  const backup = new Database(filePath, {
    readonly: true,
    fileMustExist: true
  })

  try {
    const integrity = backup.pragma('quick_check') as Array<{
      quick_check: string
    }>

    if (integrity.length !== 1 || integrity[0].quick_check !== 'ok') {
      throw new Error('Backup database failed the integrity check.')
    }

    const migrationTable = backup
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'migrations'`
      )
      .get()

    if (!migrationTable) {
      throw new Error('This file is not a valid Kirana database backup.')
    }

    const requiredTables = ['products', 'categories', 'migrations']

    for (const table of requiredTables) {
      const exists = backup
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name = ?`
        )
        .get(table)

      if (!exists) {
        throw new Error(`Backup is missing the required ${table} table.`)
      }
    }

    const result = backup.prepare('SELECT MAX(version) AS version FROM migrations').get() as {
      version: number | null
    }

    const version = result.version ?? 0

    if (version <= 0 || version > LATEST_MIGRATION_VERSION) {
      throw new Error('This backup version is not supported by this application.')
    }

    const foreignKeyErrors = backup.pragma('foreign_key_check') as unknown[]

    if (foreignKeyErrors.length > 0) {
      throw new Error('Backup contains invalid database relationships.')
    }

    return version
  } finally {
    backup.close()
  }
}

export async function restoreDatabaseFromBackup(sourcePath: string): Promise<RestoreResult> {
  const databasePath = getDatabasePath()

  if (path.resolve(sourcePath) === path.resolve(databasePath)) {
    throw new Error('Cannot restore the currently active database file.')
  }

  if (!fs.existsSync(sourcePath)) {
    throw new Error('Selected backup file does not exist.')
  }

  const timestamp = createTimestamp()
  const dataDirectory = path.dirname(databasePath)

  const stagedPath = path.join(dataDirectory, `kirana-restore-${timestamp}.tmp`)

  const rollbackPath = path.join(dataDirectory, `kirana-before-restore-${timestamp}.tmp`)

  const safetyBackupPath = path.join(getDatabaseBackupDirectory(), `before-restore-${timestamp}.db`)

  let originalDatabaseMoved = false

  try {
    // Copy the selected backup to a temporary file first.
    fs.copyFileSync(sourcePath, stagedPath)

    // Validate the staged copy before touching the active database.
    validateBackup(stagedPath)

    const currentDatabase = getDatabase()

    // Flush pending WAL changes before closing the active database.
    currentDatabase.pragma('wal_checkpoint(TRUNCATE)')

    // Create an independent safety backup of the current database.
    await backupDatabase(safetyBackupPath)

    closeDatabase()

    // Remove stale SQLite sidecar files after closing the connection.
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${databasePath}${suffix}`

      if (fs.existsSync(sidecar)) {
        fs.rmSync(sidecar)
      }
    }

    // Move the current database aside before installing the backup.
    fs.renameSync(databasePath, rollbackPath)
    originalDatabaseMoved = true

    fs.renameSync(stagedPath, databasePath)

    // Reopen the restored database and apply newer migrations if needed.
    const restoredDatabase = getDatabase()

    await runMigrations()

    const integrity = restoredDatabase.pragma('quick_check') as Array<{
      quick_check: string
    }>

    if (integrity.length !== 1 || integrity[0].quick_check !== 'ok') {
      throw new Error('Restored database failed the final integrity check.')
    }

    const versionResult = restoredDatabase
      .prepare('SELECT MAX(version) AS version FROM migrations')
      .get() as { version: number | null }

    // The separate safety backup is retained in the backups directory.
    fs.rmSync(rollbackPath, { force: true })

    return {
      safetyBackupPath,
      migrationVersion: versionResult.version ?? 0
    }
  } catch (error) {
    // Close any connection opened against the replacement database.
    closeDatabase()

    // If replacement or migration failed, put the original database back.
    if (originalDatabaseMoved && fs.existsSync(rollbackPath)) {
      if (fs.existsSync(databasePath)) {
        fs.rmSync(databasePath, { force: true })
      }

      fs.renameSync(rollbackPath, databasePath)
    }

    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${databasePath}${suffix}`

      if (fs.existsSync(sidecar)) {
        fs.rmSync(sidecar, { force: true })
      }
    }

    // Reopen the original database connection.
    getDatabase()

    throw error
  } finally {
    if (fs.existsSync(stagedPath)) {
      fs.rmSync(stagedPath, { force: true })
    }
  }
}
