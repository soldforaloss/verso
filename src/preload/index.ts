import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '@shared/channels'
import type { VersoApi } from '@shared/api'

/**
 * The preload bridge — the single, minimal seam between the untrusted renderer
 * and the privileged main process.
 *
 * It exposes exactly the methods declared by `VersoApi`, each forwarding to a
 * named, zod-validated IPC channel. It never exposes `ipcRenderer`, Node
 * builtins, or `fs`. It carries no third-party runtime dependencies so it
 * bundles cleanly into the sandboxed isolated world.
 */
const api: VersoApi = {
  ping: (request) => ipcRenderer.invoke(IpcChannels.ping, request),
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.getAppInfo)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('[preload] failed to expose api over the context bridge:', error)
  }
} else {
  // contextIsolation is enforced on; reaching here means a misconfiguration.
  throw new Error('Verso requires contextIsolation to be enabled.')
}
