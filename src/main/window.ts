import { join } from 'node:path'
import { app, BrowserWindow, shell, session } from 'electron'
import log from 'electron-log/main'
import { DEV_CSP } from './csp'
import { APP_ORIGIN } from './protocol'

/** Schemes we are willing to hand off to the OS default handler. */
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:'])

/**
 * In development the renderer is served over http by Vite, so the CSP is applied
 * as a response header. In production the renderer is served by our `app://`
 * protocol, which attaches the (strict) CSP itself — so we only install the dev
 * header hook here.
 */
function installDevCsp(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [DEV_CSP]
      }
    })
  })
}

/**
 * Prevents the renderer from navigating away from the app or opening new
 * windows. External links are routed to the OS browser only after we confirm
 * the protocol is one we trust.
 */
function hardenNavigation(window: BrowserWindow, appOrigin: string): void {
  const openExternal = (rawUrl: string): void => {
    try {
      const { protocol } = new URL(rawUrl)
      if (EXTERNAL_PROTOCOLS.has(protocol)) {
        void shell.openExternal(rawUrl)
      } else {
        log.warn('[nav] blocked external open with untrusted protocol:', rawUrl)
      }
    } catch {
      log.warn('[nav] blocked malformed external url:', rawUrl)
    }
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(appOrigin)) {
      event.preventDefault()
      openExternal(url)
    }
  })

  window.webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
}

/**
 * Creates the main application window with the full hardened configuration:
 * context isolation on, node integration off, sandbox on, and a thin typed
 * preload as the only bridge.
 */
export function createMainWindow(): BrowserWindow {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const isDev = !app.isPackaged && Boolean(devUrl)

  if (isDev) installDevCsp()

  // Packaged builds get their icon from the executable (electron-builder); in
  // dev we point the window at the source PNG so the taskbar shows the mark.
  const devIcon = join(__dirname, '../../resources/icon.png')

  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: '#0b0d12',
    autoHideMenuBar: false,
    title: 'Verso',
    ...(isDev ? { icon: devIcon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      nodeIntegrationInWorker: false,
      spellcheck: false
    }
  })

  window.once('ready-to-show', () => window.show())

  if (isDev && devUrl) {
    hardenNavigation(window, devUrl)
    void window.loadURL(devUrl)
  } else {
    hardenNavigation(window, APP_ORIGIN)
    void window.loadURL(`${APP_ORIGIN}/index.html`)
  }

  return window
}
