import { useEffect, useState } from 'react'
import './settings.css'

type PrinterInfo = {
  name: string
  displayName: string
  description: string
}

type SettingsProps = {
  onBack: () => void
}

export function Settings({ onBack }: SettingsProps) {
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [savedPrinter, setSavedPrinter] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [appInfo, setAppInfo] = useState<{
    name: string
    version: string
  } | null>(null)

  const [databaseVersion, setDatabaseVersion] = useState<number | null>(null)

  useEffect(() => {
    async function loadSystemInfo() {
      const [info, database] = await Promise.all([
        window.kirana.app.getInfo(),
        window.kirana.database.test()
      ])

      setAppInfo(info)
      setDatabaseVersion(database.migrationVersion)
    }

    void loadSystemInfo()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      try {
        const [printerList, settings] = await Promise.all([
          window.kirana.printer.list(),
          window.kirana.settings.getPrinter()
        ])

        if (cancelled) return

        setPrinters(printerList)
        setSavedPrinter(settings.printerName)
        setSelectedPrinter(settings.printerName ?? '')
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Failed to load printer settings')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onBack()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onBack])

  async function handleSave() {
    setIsSaving(true)
    setMessage('')

    try {
      const result = await window.kirana.settings.setPrinter(selectedPrinter || null)

      setSavedPrinter(result.printerName)
      setMessage('Printer setting saved')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save printer setting')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTestPrint() {
    if (!selectedPrinter) {
      setMessage('Select a printer first')
      return
    }

    setMessage('Sending test print...')

    try {
      await window.kirana.printer.test(selectedPrinter)
      setMessage('Test print sent successfully')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Test print failed')
    }
  }

  async function handleBackup() {
    setMessage('Creating database backup...')

    try {
      const result = await window.kirana.database.backup()

      if (result.canceled) {
        setMessage('Backup cancelled')
        return
      }

      setMessage(`Backup created successfully: ${result.filePath}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Database backup failed')
    }
  }

  const selectedPrinterExists = printers.some((printer) => printer.name === selectedPrinter)

  if (isLoading) {
    return (
      <div className="settings-screen">
        <div className="settings-title">SETTINGS</div>
        <div className="settings-loading">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="settings-screen">
      <div className="settings-title">SETTINGS</div>

      <div className="settings-panel">
        <div className="settings-section-title">APP INFO</div>

        <section className="settings-system-info">
          <div className="settings-row">
            <span>Application</span>
            <strong>{appInfo?.name ?? 'Kirana Mart POS'}</strong>
          </div>

          <div className="settings-row">
            <span>Application Version</span>
            <strong>{appInfo?.version ?? '—'}</strong>
          </div>

          <div className="settings-row">
            <span>Database Version</span>
            <strong>{databaseVersion ?? '—'}</strong>
          </div>
        </section>
        <div className="settings-section-title">PRINTER</div>
        <div className="settings-row">
          <label htmlFor="thermal-printer">Thermal Printer</label>

          <select
            id="thermal-printer"
            value={selectedPrinter}
            onChange={(event) => {
              setSelectedPrinter(event.target.value)
              setMessage('')
            }}
          >
            <option value="">-- Select Printer --</option>

            {printers.map((printer) => (
              <option key={printer.name} value={printer.name}>
                {printer.displayName || printer.name}
              </option>
            ))}
          </select>
        </div>

        {selectedPrinter && !selectedPrinterExists && (
          <div className="settings-warning">Selected printer is not currently available.</div>
        )}

        <div className="settings-current">
          Current saved printer: <strong>{savedPrinter ?? 'Not configured'}</strong>
        </div>

        <div className="settings-actions">
          <button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? 'SAVING...' : 'SAVE'}
          </button>

          <button type="button" onClick={() => void handleTestPrint()} disabled={!selectedPrinter}>
            TEST PRINT
          </button>
        </div>

        <div className="settings-section-title">DATABASE</div>

        <div className="settings-row">
          <label>Database Backup</label>

          <button type="button" onClick={() => void handleBackup()}>
            BACKUP DATABASE
          </button>
        </div>

        {message && <div className="settings-message">{message}</div>}
      </div>

      <div className="settings-footer">
        <span>Esc Back</span>
      </div>
    </div>
  )
}
