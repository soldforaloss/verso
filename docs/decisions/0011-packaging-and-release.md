# 0011. Packaging, icons & release

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

M9 takes Verso from "runs from source" to "installable, updatable product":
an app identity (icon), a release pipeline, auto-update, and the last UX
polish (shortcuts, error boundary). All of it has to respect the privacy and
security posture established earlier — no surprise network calls, no AGPL code.

## Decision

- **Code-generated icons, no image dependency.** `scripts/generate-icon.mjs`
  renders the mark at 4× and downsamples for anti-aliasing, then encodes a PNG
  with Node's built-in `zlib` and wraps it in an ICO. This keeps the icon
  reproducible and reviewable in the repo (the generated `icon.png`/`icon.ico`
  are small and committed) without pulling in `sharp`/`png-to-ico`. The same
  mark is reused as an inline SVG in the UI.

- **Opt-in auto-update is the only network call.** electron-updater checks the
  GitHub release feed, but **only in packaged builds** and the downloaded
  update installs on the user's command. In development the updater is a no-op,
  so working on the app produces zero network traffic — consistent with "no
  telemetry, no analytics."

- **Tag-triggered release pipeline.** Pushing a `v*` tag runs a Windows job that
  fetches the qpdf sidecar, regenerates icons, builds, and publishes the NSIS
  installer, portable exe, and `latest.yml` (the auto-update feed) to a GitHub
  Release via electron-builder. CI (per-push) and Release (per-tag) are kept as
  separate workflows so ordinary pushes never publish.

- **Resilience polish.** A top-level React error boundary turns any render
  crash into a recoverable screen (message + retry/reload) instead of a blank
  window, and a `?` cheat-sheet makes the keyboard model discoverable.

## Consequences

- The project ships real, signedless-but-installable Windows artifacts and can
  cut a release from a tag with no manual packaging steps.
- Icon edits happen in code (the generator), not a binary asset pipeline.
- Release builds depend on network access to fetch qpdf; that is a build-time
  dependency, not an app runtime one.
- Code signing is not configured — installers are unsigned for now (a future
  enhancement once a certificate is available).

## Alternatives considered

- **Committing a hand-made icon binary** — opaque and hard to tweak; the
  generator keeps the design in version-controlled code.
- **Publishing from the main CI workflow** — risks accidental releases on every
  push; a dedicated tag-triggered workflow is safer and clearer.
