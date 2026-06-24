import type {
  AppInfo,
  OpenedDocument,
  PartialPreferences,
  Preferences,
  PingRequest,
  PingResponse,
  ReadFileRequest,
  RecentFile
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

  /**
   * Subscribes to "open this file" requests originating outside the UI (file
   * association, CLI arg, second instance). Returns an unsubscribe function.
   */
  onOpenFile(callback: (document: OpenedDocument) => void): () => void

  /**
   * Resolves the absolute path of a dropped/native `File` via Electron's
   * `webUtils` (synchronous). The renderer then calls `readFile` with it.
   */
  getPathForFile(file: File): string
}
