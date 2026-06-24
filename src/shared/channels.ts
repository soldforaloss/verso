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
  getAppInfo: 'app:get-info',

  /** Shows the native open dialog and returns the chosen document (or null). */
  openFileDialog: 'dialog:open-file',
  /** Reads a PDF from an absolute path (drag-drop, CLI, file association). */
  readFile: 'file:read',

  /** Lists recently opened files (most-recent first). */
  getRecentFiles: 'recent:list',
  /** Clears the recent-files list. */
  clearRecentFiles: 'recent:clear',

  /** Reads persisted UI preferences from disk. */
  getPreferences: 'prefs:get',
  /** Merges and persists UI preferences; returns the full updated set. */
  setPreferences: 'prefs:set',

  /** Shows the native Save dialog; returns the chosen path (or null). */
  showSaveDialog: 'dialog:save',
  /** Shows a folder picker; returns the chosen directory (or null). */
  selectDirectory: 'dialog:open-dir',
  /** Writes bytes to an absolute path (atomic). */
  writeFile: 'file:write',
  /** Writes bytes to `<dir>/<name>` (atomic); returns the full path. */
  writeFileInDir: 'file:write-in-dir',

  /**
   * Event (main → renderer): a file was opened outside the UI — via the OS file
   * association, a CLI argument, a second instance, or macOS `open-file`.
   */
  openFileEvent: 'app:open-file-event'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
