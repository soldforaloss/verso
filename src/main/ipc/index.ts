import { registerAppHandlers } from './app'

/**
 * Registers all IPC handlers exactly once, at app startup.
 *
 * As features land, each domain adds its own `register*Handlers()` here
 * (files, dialogs, qpdf, …). Keeping registration centralised makes the full
 * IPC surface auditable in one place.
 */
export function registerIpcHandlers(): void {
  registerAppHandlers()
}
