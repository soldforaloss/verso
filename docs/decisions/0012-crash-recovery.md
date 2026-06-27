# 0012. Autosave & crash recovery

- **Status:** Accepted
- **Date:** 2026-06-27

## Context

Unsaved edits live only in the renderer's in-memory model. A crash, power loss,
or forced exit loses them. The M9 close guard prevents an _accidental_ quit, but
not an unexpected one.

## Decision

- **Autosave snapshots.** A renderer watcher subscribes to the document store and,
  after a **6 s editing pause**, builds the full PDF (`buildDocumentPdf`, the same
  bytes a real save would write) for each dirty document and sends it to the main
  process, which writes it under `userData/recovery/<id>.pdf` (+ a `<id>.json`
  metadata sidecar). The debounce means active typing never triggers a rebuild;
  only a pause does.
- **Self-cleaning.** The snapshot is discarded as soon as the document is **saved**
  (becomes clean) or **closed**, and on an explicit "Discard & quit". So anything
  left in `recovery/` on the next launch is, by construction, unsaved work from a
  session that did **not** end cleanly.
- **Restore on launch.** On startup the renderer lists pending snapshots and, if
  any, offers a dialog to reopen each (as a new, dirty document carrying its
  edits) or discard it.
- **Security.** The four IPC channels are zod-validated like the rest; the id is
  sanitised to a filesystem-safe token (`safeId`) so the untrusted renderer
  cannot read/write/delete outside `recovery/`. `name`/`path` are metadata only,
  never used to build a filesystem path.

## Consequences

- Unsaved work survives a crash with at most ~6 s of edits lost.
- The cost is a full document rebuild per editing pause; acceptable because it is
  debounced and off the active-typing path. Very large documents rebuild more
  slowly on each pause (a future journal/incremental design could improve this).
- A snapshot is the **built** PDF, so restore is just "open this PDF" — no
  fragile reconstruction of in-memory state.

## Alternatives considered

- **Periodic (interval) autosave** — would rebuild during active editing. Rejected
  in favour of an idle debounce.
- **Serialising the edit model + source bytes** — lighter per write, but the
  sources can be large and restore must rebuild the whole in-memory state.
  Rejected for the simpler "snapshot the output" approach.
