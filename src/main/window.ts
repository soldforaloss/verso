import { join } from 'node:path'
import { app, BrowserWindow, shell, session } from 'electron'
import log from 'electron-log/main'

/** Schemes we are willing to hand off to the OS default handler. */
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:'])

/**
 * Builds the Content-Security-Policy header.
 *
 * Production is strict: scripts may only come from our own bundle. We allow
 * `wasm-unsafe-eval` (required by Chromium to compile WebAssembly, e.g. the
 * OCR engine) but never plain `unsafe-eval`. Inline styles are permitted
 * because Radix primitives set positional `style=""` attributes; this does not
 * widen the script surface.
 *
 * Development additionally allows the Vite dev server, its HMR websocket, and
 * the eval/inline that React Fast Refresh relies on. The dev relaxations never
 * ship to users.
 */
function buildCsp(isDev: boolean): string {
  if (isDev) {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      "connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:*",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'none'",
      "frame-ancestors 'none'"
    ].join('; ')
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ].join('; ')
}

/** Applies the CSP to every response served to the renderer. */
function installCsp(isDev: boolean): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [buildCsp(isDev)]
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
    // Allow in-app navigation only within our own origin (dev HMR reloads).
    if (!url.startsWith(appOrigin)) {
      event.preventDefault()
      openExternal(url)
    }
  })

  // Never allow <webview> embedding.
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
  const isDev = !app.isPackaged && Boolean(process.env['ELECTRON_RENDERER_URL'])

  installCsp(isDev)

  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 640,
    minHeight: 480,
    show: false,
    backgroundColor: '#0b0d12',
    autoHideMenuBar: false,
    title: 'Verso',
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

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    hardenNavigation(window, devUrl)
    void window.loadURL(devUrl)
  } else {
    hardenNavigation(window, 'file://')
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}
