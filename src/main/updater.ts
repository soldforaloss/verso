import { app, dialog, type BrowserWindow } from 'electron'
import log from 'electron-log/main'
import pkg from 'electron-updater'

// electron-updater ships CommonJS; pull autoUpdater off the default export.
const { autoUpdater } = pkg

/**
 * Auto-update via electron-updater (GitHub releases — see electron-builder.yml).
 *
 * This is the **only** network call Verso ever makes, it happens only in
 * packaged builds, and downloaded updates are applied on the user's command.
 * In development update checks are disabled entirely, so no telemetry or
 * network traffic occurs while hacking on the app.
 */
let configured = false
let targetWindow: BrowserWindow | null = null
let announceUpToDate = false

function configure(): void {
  if (configured) return
  configured = true
  autoUpdater.logger = log
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (error) => {
    log.warn('[updater] error:', error instanceof Error ? error.message : error)
  })

  autoUpdater.on('update-not-available', () => {
    if (!announceUpToDate || !targetWindow) return
    announceUpToDate = false
    void dialog.showMessageBox(targetWindow, {
      type: 'info',
      title: 'No updates',
      message: 'Verso is up to date.',
      buttons: ['OK'],
      noLink: true
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    if (!targetWindow) return
    void dialog
      .showMessageBox(targetWindow, {
        type: 'info',
        title: 'Update ready',
        message: `Verso ${info.version} has been downloaded.`,
        detail: 'Restart Verso to finish installing it.',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      })
  })
}

/** Silent check on startup (packaged only). */
export function initAutoUpdater(window: BrowserWindow): void {
  targetWindow = window
  if (!app.isPackaged) return
  configure()
  void autoUpdater.checkForUpdates().catch((error) => {
    log.warn('[updater] startup check failed:', error instanceof Error ? error.message : error)
  })
}

/** User-triggered check (from the Help menu); reports the result either way. */
export function checkForUpdatesInteractive(window: BrowserWindow): void {
  targetWindow = window
  if (!app.isPackaged) {
    void dialog.showMessageBox(window, {
      type: 'info',
      title: 'Updates',
      message: 'Update checks are disabled in development builds.',
      buttons: ['OK'],
      noLink: true
    })
    return
  }
  configure()
  announceUpToDate = true
  void autoUpdater.checkForUpdates().catch((error) => {
    log.warn('[updater] manual check failed:', error instanceof Error ? error.message : error)
  })
}
