/**
 * IPC channel names — the single source of truth shared by main, preload, and
 * renderer.
 *
 * This module has **no runtime dependencies** (no zod, no electron) so that the
 * sandboxed preload can import it without bundling anything heavy into the
 * isolated world. zod request/response *schemas* live in `./ipc.ts`, which is
 * imported only by the main process.
 */
export const IpcChannels = {
  /** Liveness probe used to verify the typed contextBridge path end to end. */
  ping: 'app:ping',
  /** Returns process/version information for the About panel and footer. */
  getAppInfo: 'app:get-info'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
