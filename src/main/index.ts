import { app, BrowserWindow } from 'electron'
import log from 'electron-log/main'
import { createMainWindow } from './window'
import { installApplicationMenu } from './menu'
import { registerIpcHandlers } from './ipc'

// Route all main-process logging (and renderer logs forwarded via the bridge)
// to a rotating file plus the console. No data ever leaves the machine.
log.initialize()
log.transports.file.level = 'info'
log.transports.console.level = app.isPackaged ? 'warn' : 'debug'
log.info(`Verso ${app.getVersion()} starting (electron ${process.versions.electron})`)

// Reverse-DNS id from the owned domain; drives Windows taskbar grouping & toasts.
app.setAppUserModelId('com.versoeditor.app')

// Only one Verso instance: a second launch focuses the existing window and
// (later) opens the file passed on its command line.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // Defense in depth: forbid creating any extra web contents (popups, webviews)
  // regardless of what a renderer attempts.
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })

  app.whenReady().then(() => {
    registerIpcHandlers()
    mainWindow = createMainWindow()
    installApplicationMenu(mainWindow)

    app.on('activate', () => {
      // macOS: re-create a window when the dock icon is clicked and none exist.
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
        installApplicationMenu(mainWindow)
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  process.on('uncaughtException', (error) => {
    log.error('[main] uncaught exception:', error)
  })
}
