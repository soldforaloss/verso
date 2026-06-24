# 0002. Electron process & security model

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

A PDF viewer opens untrusted files from the internet. A compromise in the
renderer must not become a compromise of the user's machine. Electron makes this
achievable only if the security model is correct and never weakened for
convenience.

## Decision

Run with the full hardening, treated as **non-negotiable invariants**:

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  `webSecurity: true`, `allowRunningInsecureContent: false`.
- The **preload** is the only bridge. It exposes a minimal, typed `window.api`
  via `contextBridge` and never leaks `ipcRenderer`, `require`, or Node.
- **All IPC payloads are validated with zod** at the boundary, and the **sender
  frame origin** is checked, before any handler runs.
- A **strict CSP** is applied as a response header (strict in prod;
  Vite/HMR-relaxed only in dev).
- Navigation away from our origin is blocked; new windows/`<webview>` are
  denied; external links go through `shell.openExternal` for trusted protocols
  only, after explicit user action.

### Two implementation details that fall out of `sandbox: true`

1. **The preload must be a single CommonJS file with no external runtime deps.**
   A sandboxed preload has no real Node `require`, so it cannot pull in
   `node_modules` at runtime. We therefore (a) keep the package CommonJS-output
   (no `"type": "module"`) so electron-vite emits `out/preload/index.js` as CJS,
   and (b) **do not apply `externalizeDepsPlugin` to the preload** so anything it
   imports is bundled in. In practice the preload imports only `electron` plus
   zero-dependency local source, so it stays tiny.
2. **PDF bytes will reach the renderer via a custom privileged protocol**
   (`protocol.handle`), not by streaming `ArrayBuffer`s over IPC and not by
   relaxing `webSecurity`. This is also the planned transport for the renderer
   document itself, which guarantees our CSP header is always applied (see the
   ⚠️ note in `docs/architecture.md`). Implemented in M1.

## Consequences

- The renderer is genuinely untrusted: no Node, no fs, no OS reach except the
  enumerated `window.api` methods.
- Adding a capability is deliberately explicit, requiring four coordinated
  edits: a channel name, a zod schema, a main-process handler, and an `api`
  method. This friction is the point — the IPC surface stays small and audited.
- The invariants are enforced by an e2e test that asserts the three flags and
  the absence of `require` in the renderer, so a regression fails CI.

## Alternatives considered

- **`sandbox: false` to simplify preload imports** — rejected; it removes the
  OS-level sandbox protecting against renderer exploits. Not worth the
  convenience.
- **Exposing `ipcRenderer.invoke` generically** — rejected; it widens the attack
  surface to every channel and skips payload validation discipline.
