/**
 * Content-Security-Policy strings for the renderer.
 *
 * Production is strict: scripts only from our own origin, with `wasm-unsafe-eval`
 * (required by Chromium to compile WebAssembly such as the OCR engine) but never
 * plain `unsafe-eval`. Inline styles are allowed because Radix primitives set
 * positional `style=""` attributes — this does not widen the script surface.
 *
 * Development additionally allows the Vite dev server, its HMR websocket, and
 * the eval/inline that React Fast Refresh relies on. The dev relaxations never
 * ship: production is served from the `app://` protocol with the strict policy.
 */
export const PROD_CSP = [
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

export const DEV_CSP = [
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
