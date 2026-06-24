# 0004. Viewer rendering & document transport

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

The core viewer (M1) must render PDFs with PDF.js, stay smooth on documents up
to ~1,000 pages, keep text selectable, work fully offline, and get PDF bytes
from disk (main process) into the untrusted renderer without weakening the
security model.

## Decision

**Renderer transport — custom `app://` protocol (production).** The built
renderer is served from `app://verso/` via `protocol.handle`, not `file://`.
A real origin means (a) the strict CSP is attached as a response header on every
asset, (b) absolute asset URLs (`/cmaps/`, `/standard_fonts/`, the worker)
resolve correctly, and (c) `webSecurity` stays on. Dev continues to use the Vite
http server. cMaps and the standard-14 fonts are bundled with
`vite-plugin-static-copy` so rendering is fully offline.

**Document bytes — validated IPC `Uint8Array`.** The main process reads a PDF
and returns its bytes to the renderer over a zod-validated IPC channel; the
renderer copies them (PDF.js may detach the buffer) and calls `getDocument`.

We deliberately chose IPC over a `verso-doc://` byte-serving protocol for v1:
it is simpler, sandbox-safe, requires no per-document registry or range-request
handling, and a one-time structured-clone copy of a typical PDF is well within
the performance target. Streaming very large files over a custom protocol
remains a future optimization.

**Rendering — lazy, virtualized canvases.** Every page has a lightweight,
correctly-sized placeholder in normal document flow. An `IntersectionObserver`
(with a prefetch margin) paints a page's canvas + text layer only when it nears
the viewport and releases them (and calls `page.cleanup()`) when it scrolls far
away. This bounds memory for huge documents while keeping scrolling smooth.
`PageView` is memoized and the current-page subscription is isolated so routine
scrolling never re-renders the whole page list.

## Consequences

- The renderer never touches `file://`, Node, or `fs`; bytes arrive only through
  the audited IPC surface.
- Memory stays bounded regardless of page count; only near-viewport pages hold
  canvases.
- PDF.js proxies and byte arrays are kept out of the Zustand/Immer state (they
  cannot be frozen) — proxies live in a module cache, bytes in plain store state.

## Alternatives considered

- **`file://` renderer** — simplest, but absolute asset paths don't resolve and
  header CSP enforcement on the top-level document is unreliable. Rejected.
- **Byte-serving custom protocol for PDFs** — better for streaming huge files,
  but more moving parts than v1 needs. Deferred as an optimization.
- **Rendering all pages eagerly** — trivial but blows up memory/time on large
  documents. Rejected in favor of virtualization.
