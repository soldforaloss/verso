import { z } from 'zod'

/**
 * zod schemas for every IPC channel's request and response payloads.
 *
 * These are the contract enforced at the trust boundary: the main process
 * validates each incoming request against the request schema and rejects
 * anything that does not match (see `src/main/ipc/registry.ts`). Renderer and
 * preload code derive their static types from the same schemas, so the wire
 * format can never drift between processes.
 *
 * Imported only by the main process and (as types) the renderer — never by the
 * preload, which stays dependency-free.
 */

export const PingRequestSchema = z.object({
  message: z.string().min(1).max(1_000)
})
export type PingRequest = z.infer<typeof PingRequestSchema>

export const PingResponseSchema = z.object({
  reply: z.string(),
  receivedAt: z.number().int().nonnegative()
})
export type PingResponse = z.infer<typeof PingResponseSchema>

/** No-argument request marker. zod parses `undefined` against this. */
export const EmptyRequestSchema = z.void()

export const AppInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  platform: z.string(),
  arch: z.string(),
  electron: z.string(),
  chrome: z.string(),
  node: z.string()
})
export type AppInfo = z.infer<typeof AppInfoSchema>

// --- Documents -------------------------------------------------------------

/** A PDF loaded into memory and handed to the renderer. */
export const OpenedDocumentSchema = z.object({
  /** Stable per-open identifier (used as the tab/document key). */
  id: z.string(),
  /** Display name (file name without directory). */
  name: z.string(),
  /** Absolute path on disk, or null for documents with no backing file. */
  path: z.string().nullable(),
  /** Raw PDF bytes. */
  bytes: z.instanceof(Uint8Array)
})
export type OpenedDocument = z.infer<typeof OpenedDocumentSchema>

export const ReadFileRequestSchema = z.object({
  path: z.string().min(1).max(4_096)
})
export type ReadFileRequest = z.infer<typeof ReadFileRequestSchema>

// --- Recent files ----------------------------------------------------------

export const RecentFileSchema = z.object({
  path: z.string(),
  name: z.string(),
  lastOpenedAt: z.number().int().nonnegative()
})
export type RecentFile = z.infer<typeof RecentFileSchema>

// --- Preferences -----------------------------------------------------------

export const ThemeModeSchema = z.enum(['light', 'dark', 'system'])
export type ThemeMode = z.infer<typeof ThemeModeSchema>

export const LayoutModeSchema = z.enum(['continuous', 'single', 'two-up'])
export type LayoutMode = z.infer<typeof LayoutModeSchema>

export const ReadingModeSchema = z.enum(['normal', 'sepia', 'night'])
export type ReadingMode = z.infer<typeof ReadingModeSchema>

/** Persisted UI preferences. Every field has a default. */
export const PreferencesSchema = z.object({
  theme: ThemeModeSchema.default('system'),
  layout: LayoutModeSchema.default('continuous'),
  readingMode: ReadingModeSchema.default('normal'),
  sidebarOpen: z.boolean().default(true)
})
export type Preferences = z.infer<typeof PreferencesSchema>

/** A partial update accepted by `setPreferences`. */
export const PartialPreferencesSchema = PreferencesSchema.partial()
export type PartialPreferences = z.infer<typeof PartialPreferencesSchema>
