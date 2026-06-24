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
