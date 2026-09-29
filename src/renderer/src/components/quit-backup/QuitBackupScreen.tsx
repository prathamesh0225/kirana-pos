import './quit-backup.css'

type QuitBackupScreenProps = {
  status: 'backing-up' | 'success' | 'error'
  errorMessage?: string
}

export function QuitBackupScreen({
  status,
  errorMessage
}: QuitBackupScreenProps): React.JSX.Element {
  return (
    <div className="quit-backup-screen">
      <div className="quit-backup-panel">
        <div className="quit-backup-title">CLOSING KIRANA</div>

        {status === 'backing-up' && (
          <>
            <div className="quit-backup-message">Creating database backup...</div>

            <div className="quit-backup-progress">
              <div className="quit-backup-progress-bar" />
            </div>

            <div className="quit-backup-note">Please wait. Do not close the application.</div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="quit-backup-message">Backup completed successfully.</div>

            <div className="quit-backup-note">Closing application...</div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="quit-backup-message quit-backup-error">Database backup failed.</div>

            <div className="quit-backup-error-detail">
              {errorMessage ?? 'An unknown error occurred.'}
            </div>

            <div className="quit-backup-note">Kirana has not been closed.</div>
          </>
        )}
      </div>
    </div>
  )
}
