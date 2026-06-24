import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import log from 'electron-log/main'
import { createMainWindow } from './window'
import { installApplicationMenu } from './menu'
import { registerIpcHandlers } from './ipc'
import { registerAppScheme, serveRenderer } from './protocol'
import { readPdf } from './files'
import { IpcChannels } from '@shared/channels'

// Route all main-process logging to a rotating file plus the console. No data
// ever leaves the machine.
log.initialize()
log.transports.file.level = 'info'
log.transports.console.level = app.isPackaged ? 'warn' : 'debug'
log.info(`Verso ${app.getVersion()} starting (electron ${process.versions.electron})`)

app.setAppUserModelId('com.versoeditor.app')

// The custom app:// scheme must be registered as privileged before app ready.
registerAppScheme()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null
  let rendererReady = false
  const pendingFiles: string[] = []

  /** Picks a `.pdf` path out of a process argv (file association / CLI). */
  function pdfPathFromArgv(argv: string[]): string | null {
    for (const arg of argv.slice(1)) {
      if (arg && !arg.startsWith('-') && arg.toLowerCase().endsWith('.pdf')) return arg
    }
    return null
  }

  async function sendFileToRenderer(path: string): Promise<void> {
    try {
      const document = await readPdf(path)
      mainWindow?.webContents.send(IpcChannels.openFileEvent, document)
    } catch (error) {
      log.warn('[open] could not open file from OS:', path, error)
    }
  }

  /** Opens a file now if the renderer is ready, otherwise queues it. */
  function requestOpenFile(path: string): void {
    if (rendererReady && mainWindow) {
      void sendFileToRenderer(path)
    } else {
      pendingFiles.push(path)
    }
  }

  // macOS: files opened via Finder / dock arrive here (may fire before ready).
  app.on('open-file', (event, path) => {
    event.preventDefault()
    requestOpenFile(path)
  })

  // A second launch (e.g. double-clicking another PDF) focuses us and opens it.
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    const path = pdfPathFromArgv(argv)
    if (path) requestOpenFile(path)
  })

  // Defense in depth: forbid creating any extra web contents (popups, webviews).
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })

  app.whenReady().then(() => {
    serveRenderer(join(__dirname, '../renderer'))
    registerIpcHandlers()

    mainWindow = createMainWindow()
    installApplicationMenu(mainWindow)

    // Once the renderer has loaded (and registered its onOpenFile listener),
    // flush any files requested before it was ready.
    mainWindow.webContents.on('did-finish-load', () => {
      rendererReady = true
      const queued = pendingFiles.splice(0)
      // Small delay so the renderer's effect-registered listener is attached.
      setTimeout(() => queued.forEach((path) => void sendFileToRenderer(path)), 100)
    })

    // A file passed on the very first launch (double-click / `verso file.pdf`).
    const initial = pdfPathFromArgv(process.argv)
    if (initial) requestOpenFile(initial)

    app.on('activate', () => {
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
