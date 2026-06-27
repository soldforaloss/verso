import type { Rect } from '@/lib/annotations'

/**
 * A clickable link authored on a page, written as a real, persistent `/Link`
 * annotation on save (NOT flattened). `rect` is in PDF page space (bottom-left
 * origin), as produced by `screenToPage`.
 *
 * A link is one of two kinds:
 *  - **external** (`page` unset): a `/URI` action to `url` (sanitized at save).
 *  - **internal** (`page` set): a `/GoTo` action to that 1-based page in the
 *    saved document; `url` is `''`.
 */
export interface PageLink {
  id: string
  rect: Rect
  url: string
  /** 1-based target page for an internal (GoTo) link; unset for a URL link. */
  page?: number
}

export function newLinkId(): string {
  return crypto.randomUUID()
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const MAX_URL_LENGTH = 2048

/** True if the string contains an ASCII control character (0x00–0x1F or 0x7F). */
function hasControlChar(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * Validates and normalizes a user-entered hyperlink URL, returning the
 * normalized URL or `null` if it is empty, too long, malformed, contains
 * control characters, or uses a scheme outside the allow-list.
 *
 * SECURITY: this is the single gate that keeps a dangerous URI action
 * (`javascript:`, `data:`, `file:`, `vbscript:`, `blob:`, `about:`, …) out of
 * the saved PDF — only `http`/`https`/`mailto`/`tel` are permitted. A
 * scheme-less host-like string (e.g. `example.com`) is upgraded to `https://`
 * so the common case just works.
 */
export function sanitizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > MAX_URL_LENGTH || hasControlChar(trimmed)) return null
  // Upgrade a scheme-less string to https:// so plain hosts/paths work.
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
  const candidate = hasScheme ? trimmed : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return null
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null
  // Reject a bare opaque scheme with no body (e.g. "tel:", "mailto:") — it would
  // be a clickable-but-inert hotspot. http/https always get a "/" pathname.
  if (
    (parsed.protocol === 'tel:' || parsed.protocol === 'mailto:') &&
    parsed.pathname === '' &&
    parsed.search === ''
  ) {
    return null
  }
  return parsed.href
}
