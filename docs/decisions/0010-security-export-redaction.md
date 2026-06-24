# 0010. Security, export & redaction (qpdf sidecar, rasterized redaction)

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

M8 adds capabilities pdf-lib cannot provide on its own: real encryption and
permissions, structural repair, linearization, image export, true redaction,
metadata editing, and printing — all offline and within the hardened security
model (untrusted renderer, zod-validated IPC, no shell, no remote content).

## Decision

- **qpdf sidecar for security.** Encryption (256-bit AES), password removal,
  repair, and linearization run through the **qpdf** CLI (Apache-2.0), not in
  the renderer. qpdf is bundled into `resources/bin` (downloaded by
  `scripts/fetch-qpdf.mjs`, not committed) and shipped via electron-builder
  `extraResources`. The main process resolves it from the app resources, the
  `QPDF_PATH` env var, or `PATH`.
  - **The renderer never supplies arguments.** A single zod-validated
    `transformPdf` channel accepts an _operation_ plus typed options; the main
    process builds the entire argv (`src/main/qpdfArgs.ts`, unit-tested) and
    runs qpdf with `spawn` (no shell) on temp files. A hostile renderer cannot
    escalate this into arbitrary command execution.
  - **Graceful degradation.** `getSecurityStatus` reports availability; the UI
    explains how to obtain the sidecar when it is missing, and the feature is
    simply unavailable rather than broken. CI fetches qpdf best-effort, so the
    e2e exercises the real encrypt/decrypt round-trip when present.

- **True redaction by rasterization.** A redaction mark flattens to an opaque
  black box; applying it re-renders each affected page to an image and
  re-embeds it as an image-only page, so text and hidden data beneath the box
  are **destroyed, not merely covered**. Unmarked pages are copied losslessly
  and keep their selectable text. The operation is irreversible (it replaces
  the in-memory document and clears history) and gated behind an explicit
  warning — the honest trade-off being that redacted pages lose their text
  layer. A whiteout/black-box annotation alone is _not_ redaction and is never
  presented as such.

- **Export & metadata stay in the renderer.** Image export renders the
  _materialized_ document with PDF.js (so annotations and filled fields are
  baked in) and writes PNG/JPEG via the existing file IPC. Metadata edits are
  applied with pdf-lib on save; loads now use `updateMetadata: false` so an
  ordinary save no longer rewrites the original Producer/ModDate.

- **Printing via an offscreen window.** The materialized PDF is loaded into a
  sandboxed, Node-free offscreen window using Chromium's built-in PDF viewer
  (`plugins: true`, scoped to that throwaway window) and sent to the OS print
  dialog. It only ever loads a file we just wrote — never remote content.

## Consequences

- A real, offline security story (encryption/permissions/repair/linearize) and
  genuinely safe redaction, without taking on AGPL code (qpdf is Apache-2.0).
- The sidecar is a runtime dependency: packaging and CI must fetch it, and
  macOS relies on a PATH install (`brew install qpdf`) since qpdf ships no mac
  binary.
- Rasterized redaction and full-page image export increase file size on the
  affected pages; this is the cost of the security/fidelity guarantee.

## Alternatives considered

- **Encrypt/permission in pure JS** — pdf-lib does not implement encryption;
  bolting on a JS crypto layer would be fragile and unaudited. Rejected.
- **Content-stream surgery for redaction** — removing only the glyphs under the
  box would preserve surrounding text but is exactly the brittle, error-prone
  path that leaks data when it gets edge cases wrong. Deferred to a future
  PDFium-based tier; rasterization is the safe default.
- **Printing the renderer DOM** — the viewer is canvas + text-layer, not a
  paginated print document; printing a freshly rendered PDF is faithful.
