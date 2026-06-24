import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { ZodType } from 'zod'
import log from 'electron-log/main'

/**
 * Validates that an IPC request originates from one of our own renderer frames
 * and not from injected/remote content. In dev the renderer is served over
 * http(s) by Vite; in production it is loaded from the bundled file. Anything
 * else is rejected.
 */
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url
  if (!url) return false

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl && url.startsWith(devUrl)) return true

  // Packaged build: renderer is loaded from a local file inside the app bundle.
  return url.startsWith('file://')
}

/**
 * Registers a typed, zod-validated `ipcMain.handle` for a channel.
 *
 * Every request crossing the trust boundary is checked twice:
 *   1. the sender frame must be one of our own renderer frames, and
 *   2. the payload must match `requestSchema` exactly.
 *
 * Handlers therefore receive already-validated, fully typed input and never
 * touch raw IPC data. Validation failures are logged and surfaced to the
 * renderer as a generic rejected promise (no internal detail leaks).
 */
export function handle<Req, Res>(
  channel: string,
  requestSchema: ZodType<Req>,
  handler: (request: Req, event: IpcMainInvokeEvent) => Promise<Res> | Res
): void {
  ipcMain.handle(channel, async (event, rawRequest: unknown) => {
    if (!isTrustedSender(event)) {
      log.warn(`[ipc] rejected "${channel}" from untrusted sender:`, event.senderFrame?.url)
      throw new Error(`Untrusted sender for "${channel}"`)
    }

    const parsed = requestSchema.safeParse(rawRequest)
    if (!parsed.success) {
      log.warn(`[ipc] invalid payload for "${channel}":`, parsed.error.issues)
      throw new Error(`Invalid IPC payload for "${channel}"`)
    }

    try {
      return await handler(parsed.data, event)
    } catch (error) {
      log.error(`[ipc] handler "${channel}" threw:`, error)
      throw error instanceof Error ? error : new Error(`Handler "${channel}" failed`)
    }
  })
}
