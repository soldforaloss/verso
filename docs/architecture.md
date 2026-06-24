# Verso — Architecture & Security Model

Verso is an Electron application built with a strict separation between the
privileged **main** process and the untrusted **renderer**. The renderer treats
itself as hostile: it has no Node, no filesystem, and no ability to reach the OS
except through one tiny, typed, validated bridge.

## Process model

```
┌──────────────────────────────────────────────────────────────────────────┐
│  MAIN PROCESS  (Node + OS)                                                 │
│  • window & lifecycle        src/main/index.ts, window.ts                  │
│  • native application menu   src/main/menu.ts                              │
│  • file dialogs & disk I/O   (M1+)  src/main/files.ts                      │
│  • qpdf sidecar (spawn)      (M8)   src/main/qpdf.ts                        │
│  • auto-update               (M9)   src/main/updater.ts                    │
│  • IPC handlers (zod-validated)     src/main/ipc/*                          │
└───────────────▲───────────────────────────────────┬───────────────────────┘
                │ ipcMain.handle (validated)         │ result
                │                                    ▼
┌───────────────┴────────────────────────────────────────────────────────────┐
│  PRELOAD  (contextBridge — the ONLY seam)          src/preload/index.ts      │
│  • exposes `window.api` = { ping, getAppInfo, … }                            │
│  • no Node, no fs, no raw ipcRenderer leaked                                 │
│  • dependency-free (only `electron`) so it bundles into the sandbox          │
└───────────────▲──────────────────────────────────────────────────────────────┘
                │ window.api.*  (typed Promise calls)
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  RENDERER  (React 19 — untrusted)                  src/renderer/**             │
│  • UI, state (Zustand)                                                         │
│  • PDF.js rendering + text/annotation layers   (M1+)                           │
│  ├─ PDF.js worker          (off-main-thread parse/render)                      │
│  └─ OCR worker (tesseract) (M7, off-main-thread)                               │
└──────────────────────────────────────────────────────────────────────────────┘

Shared contract (types + zod schemas):  src/shared/{channels,ipc,api}.ts
```

### Why these boundaries

- **Main owns the OS.** Only the main process touches `fs`, spawns processes
  (the qpdf sidecar), shows native dialogs, and manages windows.
- **Preload is the only bridge.** It exposes a frozen, minimal `window.api`
  through `contextBridge`. It never exposes `ipcRenderer`, `require`, or Node
  builtins. Each method forwards to exactly one named IPC channel.
- **Renderer is untrusted.** It cannot reach Node or disk. Heavy work (PDF
  parsing, OCR) runs in dedicated workers so the UI thread never blocks.
- **One typed contract.** `src/shared` holds the channel names, the zod request/
  response schemas, and the `VersoApi` interface. Main validates against the
  schemas; renderer derives its types from them. The wire format cannot drift.

## IPC: validated at the boundary

Every channel is registered through `handle()` in
[`src/main/ipc/registry.ts`](../src/main/ipc/registry.ts), which:

1. rejects any request whose **sender frame** is not one of our own renderer
   frames (dev server origin or the packaged `file://`), and
2. validates the payload against the channel's **zod schema**, rejecting
   anything that does not match exactly.

Handlers therefore only ever see fully-typed, already-validated input. Failures
are logged via `electron-log` and surfaced to the renderer as a generic rejected
promise (no internal detail leaks).

## Content-Security-Policy

The CSP is applied as a response header via `session…onHeadersReceived`
([`src/main/window.ts`](../src/main/window.ts)). Production is strict —
`script-src 'self' 'wasm-unsafe-eval'` (the wasm allowance is required by
Chromium to compile WebAssembly such as the OCR engine; plain `unsafe-eval` is
never permitted). Development additionally allows the Vite dev server, its HMR
websocket, and the eval/inline that React Fast Refresh needs; those relaxations
never ship.

> ⚠️ Verify (tracked for M1): confirm the header-based CSP is enforced for the
> top-level `file://` document in the packaged build. If not, the renderer will
> be served over a custom privileged `app://` protocol (which also becomes the
> transport for PDF bytes) so headers always apply. See ADR-0002.

## Security checklist (§4 hard requirements)

| Requirement                                                                              | Status | Where                                       |
| ---------------------------------------------------------------------------------------- | ------ | ------------------------------------------- |
| `contextIsolation: true`                                                                 | ✅     | `src/main/window.ts` (asserted in e2e)      |
| `nodeIntegration: false`                                                                 | ✅     | `src/main/window.ts` (asserted in e2e)      |
| `sandbox: true`                                                                          | ✅     | `src/main/window.ts` (asserted in e2e)      |
| `webSecurity` left on, `allowRunningInsecureContent: false`                              | ✅     | `src/main/window.ts`                        |
| No `eval`, no `remote` module, no `webSecurity: false`                                   | ✅     | repo-wide                                   |
| Strict CSP (no remote code; no inline/eval in prod)                                      | ✅     | `src/main/window.ts`                        |
| Preload exposes a minimal, typed API only                                                | ✅     | `src/preload/index.ts`, `src/shared/api.ts` |
| No raw `ipcRenderer` / Node / `fs` leaked to renderer                                    | ✅     | `src/preload/index.ts`                      |
| Every IPC payload validated with zod; unexpected shapes rejected                         | ✅     | `src/main/ipc/registry.ts`                  |
| IPC sender-frame origin validated                                                        | ✅     | `src/main/ipc/registry.ts`                  |
| Navigation to external origins disabled                                                  | ✅     | `src/main/window.ts` (`will-navigate`)      |
| New windows / popups denied; `<webview>` blocked                                         | ✅     | `src/main/{window,index}.ts`                |
| External links opened via `shell.openExternal` after user action, trusted protocols only | ✅     | `src/main/{window,menu}.ts`                 |
| Single-instance lock                                                                     | ✅     | `src/main/index.ts`                         |
| No telemetry / analytics / non-update network calls                                      | ✅     | repo-wide                                   |

These invariants are guarded by the Playwright e2e test
([`tests/e2e/smoke.spec.ts`](../tests/e2e/smoke.spec.ts)), which asserts the
three flags at runtime and confirms the renderer has no `require` and only
`window.api`.

## Build & packaging

- **electron-vite** builds `main`/`preload` as single CommonJS files (keeping
  the sandboxed preload loadable) and the renderer as a standard Vite bundle.
- **electron-builder** packages an NSIS installer + a portable exe, registers an
  opt-in `.pdf` association, and (on tagged releases) publishes to GitHub
  Releases with an auto-update feed (`latest.yml`).

See [`docs/decisions/`](./decisions) for the rationale behind each load-bearing
choice, and [`docs/research/stack-tech-notes.md`](./research/stack-tech-notes.md)
for the version-confirmed research backing them.
