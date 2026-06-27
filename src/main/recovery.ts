import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { app } from 'electron'
import log from 'electron-log/main'
import { RecoveryEntrySchema, type RecoveryEntry, type RecoverySaveRequest } from '@shared/ipc'

/**
 * Crash recovery: a dirty document is periodically snapshotted to `recovery/`
 * under userData (a `.pdf` plus a `.json` sidecar of metadata). On a clean save
 * or close the snapshot is discarded, so anything left behind on next launch is
 * unsaved work from a crash/forced exit and is offered for restore.
 */

/** Hard ceiling, matching the open-file guard, against runaway/hostile blobs. */
const MAX_RECOVERY_BYTES = 512 * 1024 * 1024

function recoveryDir(): string {
  return join(app.getPath('userData'), 'recovery')
}

/** Restricts an id to a filesystem-safe token (ids are UUIDs in practice). */
function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128)
}

async function fileExists(path: string): Promise<boolean> {
  return stat(path).then(
    (info) => info.isFile(),
    () => false
  )
}

async function writeAtomic(target: string, data: Uint8Array | string): Promise<void> {
  const tmp = `${target}.${randomUUID()}.tmp`
  await writeFile(tmp, data)
  await rename(tmp, target)
}

export async function saveRecovery(request: RecoverySaveRequest): Promise<void> {
  const id = safeId(request.id)
  if (!id || request.bytes.byteLength > MAX_RECOVERY_BYTES) return
  const dir = recoveryDir()
  await mkdir(dir, { recursive: true })
  await writeAtomic(join(dir, `${id}.pdf`), request.bytes)
  const meta: RecoveryEntry = { id, name: request.name, path: request.path, savedAt: Date.now() }
  await writeAtomic(join(dir, `${id}.json`), JSON.stringify(meta))
}

export async function listRecovery(): Promise<RecoveryEntry[]> {
  const dir = recoveryDir()
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return []
  }
  // Sweep any leftover temp files from a crash mid-write (they accumulate forever
  // otherwise — the random suffix means they're never overwritten).
  for (const file of files) {
    if (file.endsWith('.tmp')) await rm(join(dir, file), { force: true }).catch(() => {})
  }

  const entries: RecoveryEntry[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const meta = RecoveryEntrySchema.parse(JSON.parse(await readFile(join(dir, file), 'utf8')))
      // Re-sanitize the id read back from disk before touching the filesystem.
      const id = safeId(meta.id)
      if (id && (await fileExists(join(dir, `${id}.pdf`)))) {
        entries.push({ ...meta, id })
      }
    } catch {
      // Ignore a malformed or half-written entry.
    }
  }
  return entries.sort((a, b) => b.savedAt - a.savedAt)
}

export async function readRecovery(id: string): Promise<Uint8Array> {
  const safe = safeId(id)
  if (!safe) throw new Error('Invalid recovery id.')
  const path = join(recoveryDir(), `${safe}.pdf`)
  const info = await stat(path)
  if (info.size > MAX_RECOVERY_BYTES) throw new Error('Recovery snapshot is too large.')
  return readFile(path)
}

export async function discardRecovery(id: string): Promise<void> {
  const safe = safeId(id)
  if (!safe) return
  const dir = recoveryDir()
  await rm(join(dir, `${safe}.pdf`), { force: true }).catch(() => {})
  await rm(join(dir, `${safe}.json`), { force: true }).catch((error) =>
    log.warn('[recovery] could not discard', safe, error)
  )
}
