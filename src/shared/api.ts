import type { AppInfo, PingRequest, PingResponse } from './ipc'

/**
 * The complete, typed surface exposed to the renderer as `window.api`.
 *
 * This is the *only* capability the untrusted renderer has into the main
 * process. It is deliberately minimal: each method maps to a single
 * zod-validated IPC channel. Adding a capability means adding a channel,
 * a schema, a main-process handler, and a method here — in lockstep.
 *
 * Uses `import type` exclusively so this module carries no runtime code and is
 * safe to reference from the dependency-free preload.
 */
export interface VersoApi {
  /** Round-trips a message through the main process. Proves the IPC bridge. */
  ping(request: PingRequest): Promise<PingResponse>
  /** Process and version information for the About panel / status bar. */
  getAppInfo(): Promise<AppInfo>
}
