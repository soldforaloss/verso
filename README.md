<div align="center">

# Verso

**A fast, private, open-source PDF viewer & editor for the desktop.**

Read beautifully. Mark up, reorganize, fill, OCR, and edit — all on your
machine, with no account, no telemetry, and no cloud.

[![CI](https://github.com/versoeditor/verso/actions/workflows/ci.yml/badge.svg)](https://github.com/versoeditor/verso/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-success.svg)](./LICENSE)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6.svg)](#install)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F.svg)](https://www.electronjs.org/)

[versoeditor.com](https://versoeditor.com)

</div>

> _Screenshots and a demo GIF land with the viewer (M1)._

## Why Verso?

PDF tools are either expensive subscriptions or web apps that upload your
documents to someone else's server. Verso is neither:

- **Private by design.** Everything happens locally. No telemetry, no analytics,
  no network calls — the only optional connection is a user-controlled update
  check. Works fully offline.
- **Fast & calm.** A desktop-native feel, not a web page in a window. Page
  virtualization keeps large documents smooth; the UI stays out of your way.
- **Genuinely free & open.** MIT-licensed, with a clean, permissively-licensed
  dependency stack (no AGPL contamination).
- **Keyboard-friendly & accessible.** Everything reachable by keyboard; built on
  accessible Radix primitives with light/dark and reading themes.

## Features

Verso is built milestone by milestone. Status reflects what's on `main`.

| Area       | Capability                                                              | Status |
| ---------- | ----------------------------------------------------------------------- | ------ |
| Foundation | Hardened Electron shell, typed/validated IPC, CI, installers            | ✅ M0  |
| Viewer     | PDF.js rendering, text selection, zoom/pan, layouts, themes, tabs       | ⏳ M1  |
| Navigation | Thumbnails, outline/bookmarks, full-text search                         | ⏳ M2  |
| Pages      | Reorder, rotate, delete, insert, extract, merge, split + undo/redo      | ⏳ M3  |
| Annotation | Highlight, ink, shapes, text/callouts, notes, stamps, signatures        | ⏳ M4  |
| Forms      | Fill & save AcroForms (text, check, radio, dropdown, list)              | ⏳ M5  |
| Editing    | Add/edit text, images, shapes; cover-&-replace existing text (Tier 1–2) | ⏳ M6  |
| OCR        | Make scanned PDFs searchable (tesseract.js, offline)                    | ⏳ M7  |
| Security   | Passwords/permissions, repair, linearize, **true redaction**, export    | ⏳ M8  |
| Polish     | Shortcuts, auto-update, icon, release pipeline                          | ⏳ M9  |

See [`ROADMAP.md`](./ROADMAP.md) for the full plan, including stretch goals
(true content-stream editing, macOS/Linux, form creation, PDF compare).

## Install

> Release downloads will appear here once M1 ships. For now, build from source.

### Build from source

```bash
# Requires Node.js >= 20.19 (22 LTS recommended) and Git.
git clone https://github.com/versoeditor/verso.git
cd verso
npm install

npm run dev        # launch in development with HMR
npm run build      # typecheck + production build into out/
npm run build:win  # produce the Windows installer + portable exe in release/
```

## Tech stack

Electron · electron-vite · React 19 + TypeScript (strict) · Vite 7 · Tailwind
CSS v4 + Radix/shadcn-style primitives · Zustand + Immer · zod · PDF.js
(rendering) · pdf-lib (mutation) · tesseract.js (OCR) · qpdf sidecar (security) ·
Vitest + React Testing Library + Playwright · electron-builder + electron-updater.

Exact versions and the rationale behind them live in
[`docs/decisions/`](./docs/decisions).

## Architecture & security

Verso runs the renderer as fully untrusted: `contextIsolation` + `sandbox` on,
`nodeIntegration` off, a strict CSP, and a single minimal, **zod-validated**
`contextBridge` API. The full process diagram and the security checklist are in
[`docs/architecture.md`](./docs/architecture.md).

## Contributing

Contributions are welcome! Start with [`CONTRIBUTING.md`](./CONTRIBUTING.md) for
dev setup, conventions (Conventional Commits), and how to add an ADR. Please also
read the [Code of Conduct](./CODE_OF_CONDUCT.md). To report a security issue, see
[`SECURITY.md`](./SECURITY.md).

## License

[MIT](./LICENSE) © Verso contributors. Third-party licenses are tracked in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
