# 0001. Technology stack

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

Verso is a desktop PDF viewer/editor that must render PDFs beautifully, mutate
their structure, fill forms, OCR scans, and apply real document security — all
**offline**, with **no telemetry**, shipped under a clean **MIT** license. Every
runtime dependency therefore has to be MIT-compatible (no copyleft contamination
of the distributable).

## Decision

| Concern                                | Choice                                                                  | Rationale                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Shell                                  | **Electron**                                                            | Mature desktop runtime; web UI with native OS access.                          |
| Scaffold                               | **electron-vite**                                                       | Clean main/preload/renderer split, fast Vite HMR.                              |
| UI                                     | **React + TypeScript (strict)**                                         | Component model + type safety.                                                 |
| Styling                                | **Tailwind CSS v4 + hand-owned shadcn/Radix primitives + lucide-react** | Accessible primitives, themeable, desktop-appropriate.                         |
| State                                  | **Zustand + Immer**                                                     | Lightweight stores; ergonomic immutable updates for the history engine.        |
| View rendering                         | **PDF.js (`pdfjs-dist`)** — Apache-2.0                                  | Gold standard for rendering, text selection, search.                           |
| Structural mutation + additive content | **`pdf-lib`** — MIT                                                     | Merge/split/reorder/rotate pages, draw text/images/shapes, fill/flatten forms. |
| OCR                                    | **`tesseract.js`** — Apache-2.0                                         | Make scanned PDFs searchable; runs in a worker.                                |
| Encryption / repair / linearize        | **`qpdf` sidecar** — Apache-2.0                                         | `pdf-lib` cannot do strong encryption; qpdf does it correctly.                 |
| True content-stream editing (stretch)  | **PDFium** native addon — BSD-3-Clause                                  | Glyph-level edits; permissive license. Deferred (Tier 3).                      |
| Test                                   | **Vitest + React Testing Library + Playwright**                         | Unit, component, and Electron e2e.                                             |

### Licensing guardrail

**MuPDF / `mupdf.js` is forbidden.** It is AGPL/commercial and would virally
force the whole project to AGPL. Where true content-stream editing is needed, we
use **PDFium** (BSD) instead. `THIRD_PARTY_NOTICES.md` tracks every dependency
and its license.

## Consequences

- The whole pipeline is permissively licensed; the MIT distributable is clean.
- We accept a split responsibility model: **PDF.js renders, pdf-lib mutates,
  qpdf secures, tesseract OCRs**. Features must translate coordinates between
  PDF.js (top-left origin) and pdf-lib (bottom-left origin) — centralised in
  `src/renderer/src/lib`.
- `pdf-lib` is effectively in maintenance mode. If we hit blocking gaps
  (e.g. incremental save), the maintained `@cantoo/pdf-lib` fork is a drop-in
  candidate — to be decided via a future ADR if needed.

## Alternatives considered

- **MuPDF** — best-in-class rendering+editing, but AGPL. Rejected outright.
- **Ghostscript** for redaction/raster — AGPL for the open build. Rejected.
- **A single library for everything** — none exists under a permissive license
  that covers render + mutate + encrypt + OCR. The split stack is unavoidable.
