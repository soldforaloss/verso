import { app, BrowserWindow } from 'electron'
import {
  AppInfoSchema,
  EmptyRequestSchema,
  PingRequestSchema,
  type AppInfo,
  type PingResponse
} from '@shared/ipc'
import { IpcChannels } from '@shared/channels'
import { handle } from './registry'
import { markCloseConfirmed } from '../closeGuard'

/**
 * Registers the core application IPC handlers (M0).
 *
 * `ping` exists to prove the full typed, validated contextBridge ⇄ IPC path
 * works end to end; `getAppInfo` feeds the About panel and status bar.
 */
export function registerAppHandlers(): void {
  handle(IpcChannels.ping, PingRequestSchema, (request): PingResponse => {
    return {
      reply: `pong: ${request.message}`,
      receivedAt: Date.now()
    }
  })

  // The renderer calls this once it has cleared any unsaved-changes prompt; we
  // mark the window confirmed and close it (the close handler then allows it).
  handle(IpcChannels.allowClose, EmptyRequestSchema, (_request, event): null => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      markCloseConfirmed(window.id)
      window.close()
    }
    return null
  })

  handle(IpcChannels.getAppInfo, EmptyRequestSchema, (): AppInfo => {
    // Parse through the schema so the response is guaranteed contract-shaped.
    return AppInfoSchema.parse({
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    })
  })
}
