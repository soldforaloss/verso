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

  /** Autosaves a recovery snapshot of a dirty document to userData. */
  recoverySave: 'recovery:save',
  /** Lists recoverable documents left by a previous (possibly crashed) session. */
  recoveryList: 'recovery:list',
  /** Reads a recovery snapshot's PDF bytes. */
  recoveryRead: 'recovery:read',
  /** Deletes a recovery snapshot (after restore, save, or close). */
  recoveryDiscard: 'recovery:discard',

  /** Reports whether the bundled qpdf sidecar is available (+ its version). */
  getSecurityStatus: 'security:status',
  /** Runs a qpdf transform (encrypt/decrypt/repair/linearize); returns bytes. */
  transformPdf: 'security:transform',

  /** Prints a PDF (given bytes) via a hidden window and the OS print dialog. */
  printPdf: 'print:pdf',

  /** Tier-3 PDFium: returns the text object under a click (or null). */
  pdfiumLocateText: 'pdfium:locate-text',
  /** Tier-3 PDFium: true content-stream edit of the text under a click. */
  pdfiumEditText: 'pdfium:edit-text',

  /** Cryptographically signs a PDF with a certificate chosen in a native dialog. */
  signPdf: 'pdf:sign',

  /**
   * Event (main → renderer): a file was opened outside the UI — via the OS file
   * association, a CLI argument, a second instance, or macOS `open-file`.
   */
  openFileEvent: 'app:open-file-event',

  /**
   * Event (main → renderer): the window is trying to close. The renderer decides
   * whether to allow it (`allowClose`) or to prompt about unsaved work first.
   */
  requestCloseEvent: 'app:request-close',
  /** Renderer → main: confirms the window may close (after any unsaved prompt). */
  allowClose: 'app:allow-close'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
