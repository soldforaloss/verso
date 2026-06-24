import { join, normalize, sep } from 'node:path'
import { readFile } from 'node:fs/promises'
import { protocol } from 'electron'
import log from 'electron-log/main'
import { PROD_CSP } from './csp'

/**
 * Custom application protocol used to serve the renderer in production.
 *
 * Serving over `app://verso/` (rather than `file://`) gives the renderer a real,
 * secure origin. That means: absolute asset paths like `/cmaps/` resolve
 * correctly, our CSP can be attached as a response header on every request, and
 * `webSecurity` stays on. See docs/decisions/0002-electron-security-model.md.
 */
export const APP_SCHEME = 'app'
export const APP_HOST = 'verso'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pfb': 'application/octet-stream',
  '.bcmap': 'application/octet-stream',
  '.map': 'application/json'
}

function contentTypeFor(pathname: string): string {
  const dot = pathname.lastIndexOf('.')
  const ext = dot >= 0 ? pathname.slice(dot).toLowerCase() : ''
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

/** Must be called *before* `app.whenReady()`. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

/**
 * Serves the built renderer (`rendererRoot`) over `app://verso/…`, attaching the
 * strict production CSP to every response. Must be called after the app is ready.
 */
export function serveRenderer(rendererRoot: string): void {
  const root = normalize(rendererRoot)

  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.hostname !== APP_HOST) {
      return new Response('Not found', { status: 404 })
    }

    let pathname = decodeURIComponent(url.pathname)
    if (pathname === '/' || pathname === '') pathname = '/index.html'

    const target = normalize(join(root, pathname))
    // Path-traversal guard: the resolved path must stay within the root.
    if (target !== root && !target.startsWith(root + sep)) {
      return new Response('Forbidden', { status: 403 })
    }

    try {
      const data = await readFile(target)
      return new Response(data, {
        headers: {
          'Content-Type': contentTypeFor(pathname),
          'Content-Security-Policy': PROD_CSP
        }
      })
    } catch (error) {
      log.warn('[protocol] could not serve', pathname, error)
      return new Response('Not found', { status: 404 })
    }
  })
}
