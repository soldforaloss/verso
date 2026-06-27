import type {
  AppInfo,
  OpenedDocument,
  PartialPreferences,
  Preferences,
  PingRequest,
  PingResponse,
  PrintPdfRequest,
  ReadFileRequest,
  RecentFile,
  RecoveryEntry,
  RecoveryIdRequest,
  RecoverySaveRequest,
  SaveDialogRequest,
  SecurityStatus,
  TransformPdfRequest,
  WriteFileRequest,
  WriteInDirRequest
} from './ipc'

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

  /** Shows the native open dialog; resolves to the document or null if cancelled. */
  openFileDialog(): Promise<OpenedDocument | null>
  /** Reads a PDF from an absolute path on disk. */
  readFile(request: ReadFileRequest): Promise<OpenedDocument>

  /** Recently opened files, most-recent first. */
  getRecentFiles(): Promise<RecentFile[]>
  /** Empties the recent-files list. */
  clearRecentFiles(): Promise<void>

  /** Reads persisted UI preferences. */
  getPreferences(): Promise<Preferences>
  /** Merges a partial update into preferences and returns the full set. */
  setPreferences(update: PartialPreferences): Promise<Preferences>

  /** Shows the native Save dialog; resolves to a path or null if cancelled. */
  showSaveDialog(request: SaveDialogRequest): Promise<string | null>
  /** Shows a folder picker; resolves to a directory path or null. */
  selectDirectory(): Promise<string | null>
  /** Writes bytes to an absolute path (atomic). */
  writeFile(request: WriteFileRequest): Promise<void>
  /** Writes bytes to `<dir>/<name>` (atomic); resolves to the full path. */
  writeFileInDir(request: WriteInDirRequest): Promise<string>

  /** Reports qpdf sidecar availability and version. */
  /** Autosaves a recovery snapshot of a dirty document. */
  saveRecovery(request: RecoverySaveRequest): Promise<void>
  /** Lists recoverable documents from a previous (possibly crashed) session. */
  listRecovery(): Promise<RecoveryEntry[]>
  /** Reads a recovery snapshot's PDF bytes. */
  readRecovery(request: RecoveryIdRequest): Promise<Uint8Array>
  /** Discards a recovery snapshot. */
  discardRecovery(request: RecoveryIdRequest): Promise<void>

  getSecurityStatus(): Promise<SecurityStatus>
  /** Runs a qpdf transform (encrypt/decrypt/repair/linearize); resolves to bytes. */
  transformPdf(request: TransformPdfRequest): Promise<Uint8Array<ArrayBuffer>>

  /** Prints the given PDF bytes via the OS print dialog. */
  printPdf(request: PrintPdfRequest): Promise<void>

  /**
   * Subscribes to "open this file" requests originating outside the UI (file
   * association, CLI arg, second instance). Returns an unsubscribe function.
   */
  onOpenFile(callback: (document: OpenedDocument) => void): () => void

  /**
   * Subscribes to window-close requests. The renderer must respond by calling
   * `allowClose` (after any unsaved-changes prompt). Returns an unsubscribe fn.
   */
  onRequestClose(callback: () => void): () => void

  /** Confirms the window may close (after the renderer has cleared unsaved work). */
  allowClose(): Promise<void>

  /**
   * Resolves the absolute path of a dropped/native `File` via Electron's
   * `webUtils` (synchronous). The renderer then calls `readFile` with it.
   */
  getPathForFile(file: File): string
}
