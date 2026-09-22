import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (db) {
    return db
  }

  const dataDir = path.join(app.getPath('userData'), 'data')

  fs.mkdirSync(dataDir, {
    recursive: true
  })

  const dbPath = path.join(dataDir, 'kirana.db')

  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
