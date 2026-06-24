import { app } from 'electron'
import {
  AppInfoSchema,
  EmptyRequestSchema,
  PingRequestSchema,
  type AppInfo,
  type PingResponse
} from '@shared/ipc'
import { IpcChannels } from '@shared/channels'
import { handle } from './registry'

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
