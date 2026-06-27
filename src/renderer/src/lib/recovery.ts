import { useDocumentStore } from '@/store/documentStore'
import { buildDocumentPdf } from '@/lib/save'
import type { RecoveryEntry } from '@shared/ipc'

/** Autosave only after this long without an edit, so active typing never janks. */
const AUTOSAVE_IDLE_MS = 6_000

const timers = new Map<string, ReturnType<typeof setTimeout>>()
const dirtyKnown = new Map<string, boolean>()
let suppressed = false

/**
 * Stops all autosave: cancels pending timers and makes any in-flight snapshot
 * bail before writing. Used by "Discard & quit" so a late snapshot can't
 * resurrect a just-discarded recovery file.
 */
export function suppressAutosave(): void {
  suppressed = true
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
}

function cancelPending(tabId: string): void {
  const timer = timers.get(tabId)
  if (timer) {
    clearTimeout(timer)
    timers.delete(tabId)
  }
}

async function snapshot(tabId: string): Promise<void> {
  timers.delete(tabId)
  if (suppressed) return
  const tab = useDocumentStore.getState().getTab(tabId)
  if (!tab || !tab.dirty || tab.status !== 'ready') return
  try {
    const bytes = await buildDocumentPdf(tab)
    // Re-check after the (slow) build: a save, close, or discard-quit may have
    // landed meanwhile, in which case writing now would resurrect the snapshot.
    const live = useDocumentStore.getState().getTab(tabId)
    if (suppressed || !live || !live.dirty || live.status !== 'ready') return
    await window.api.saveRecovery({ id: live.id, name: live.name, path: live.path, bytes })
  } catch (error) {
    console.warn('[recovery] autosave failed', error)
  }
}

function scheduleSnapshot(tabId: string): void {
  cancelPending(tabId)
  timers.set(
    tabId,
    setTimeout(() => void snapshot(tabId), AUTOSAVE_IDLE_MS)
  )
}

/**
 * Watches the document store and autosaves a recovery snapshot of each dirty
 * document after an editing pause; discards the snapshot once the document is
 * saved (clean) or closed. Returns an unsubscribe function that also cancels any
 * pending timers. Snapshots that survive to the next launch are unsaved work
 * from a session that did not close cleanly.
 */
export function startRecoveryWatcher(): () => void {
  const unsubscribe = useDocumentStore.subscribe((state) => {
    const present = new Set<string>()
    for (const tab of state.tabs) {
      present.add(tab.id)
      const wasDirty = dirtyKnown.get(tab.id) ?? false
      if (tab.dirty) {
        dirtyKnown.set(tab.id, true)
        scheduleSnapshot(tab.id)
      } else {
        if (wasDirty) {
          cancelPending(tab.id)
          void window.api.discardRecovery({ id: tab.id })
        }
        dirtyKnown.set(tab.id, false)
      }
    }
    // Closed tabs: cancel and discard any snapshot.
    for (const id of [...dirtyKnown.keys()]) {
      if (present.has(id)) continue
      cancelPending(id)
      if (dirtyKnown.get(id)) void window.api.discardRecovery({ id })
      dirtyKnown.delete(id)
    }
  })

  return () => {
    unsubscribe()
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    dirtyKnown.clear()
  }
}

/**
 * Opens a recovered snapshot as a new, **unsaved** document (path: null) and
 * discards the snapshot. Opening without a path avoids colliding with an
 * already-open original (which would silently drop the recovered bytes) and
 * forces Save As, so the rebuilt/flattened recovery content never silently
 * overwrites the user's original file.
 */
export async function restoreRecovery(entry: RecoveryEntry): Promise<void> {
  const raw = await window.api.readRecovery({ id: entry.id })
  // Copy into an ArrayBuffer-backed array (the document API rejects ArrayBufferLike).
  const bytes = new Uint8Array(raw.length)
  bytes.set(raw)
  const id = crypto.randomUUID()
  await useDocumentStore.getState().openDocument({ id, name: entry.name, path: null, bytes })
  const restored = useDocumentStore.getState().getTab(id)
  if (!restored || restored.status === 'error') return // load failed; keep the snapshot
  // It's recovered, unsaved work — mark dirty so the guard + autosave protect it.
  useDocumentStore.getState().markDirty(id)
  await window.api.discardRecovery({ id: entry.id })
}

/** Discards a recovery snapshot the user chose not to restore. */
export async function dismissRecovery(entry: RecoveryEntry): Promise<void> {
  await window.api.discardRecovery({ id: entry.id })
}
