import { registerAppHandlers } from './app'
import { registerFileHandlers } from './files'
import { registerRecoveryHandlers } from './recovery'
import { registerSecurityHandlers } from './security'
import { registerPrintHandlers } from './print'

/**
 * Registers all IPC handlers exactly once, at app startup.
 *
 * As features land, each domain adds its own `register*Handlers()` here
 * (qpdf, OCR, …). Keeping registration centralised makes the full IPC surface
 * auditable in one place.
 */
export function registerIpcHandlers(): void {
  registerAppHandlers()
  registerFileHandlers()
  registerRecoveryHandlers()
  registerSecurityHandlers()
  registerPrintHandlers()
}
