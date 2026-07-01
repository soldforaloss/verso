import { buildDocumentPdf } from '@/lib/save'
import { useDocumentStore, type DocumentTab } from '@/store/documentStore'
import type { PdfPermissions } from '@shared/ipc'

function stripPdfExt(name: string): string {
  return name.replace(/\.pdf$/i, '')
}

/** Prompts for a path and writes the transformed bytes; false if cancelled. */
async function saveTransformed(
  tab: DocumentTab,
  bytes: Uint8Array<ArrayBuffer>,
  suffix: string
): Promise<boolean> {
  const path = await window.api.showSaveDialog({
    defaultName: `${stripPdfExt(tab.name)}-${suffix}.pdf`
  })
  if (!path) return false
  await window.api.writeFile({ path, bytes })
  return true
}

/** Encrypts the current document (256-bit AES) and saves a protected copy. */
export async function encryptDocument(
  tab: DocumentTab,
  userPassword: string,
  ownerPassword: string,
  permissions: PdfPermissions
): Promise<boolean> {
  const bytes = await buildDocumentPdf(tab)
  const result = await window.api.transformPdf({
    operation: 'encrypt',
    bytes,
    userPassword,
    ownerPassword,
    permissions
  })
  return saveTransformed(tab, result, 'protected')
}

/** Removes encryption from the current document and saves a decrypted copy. */
export async function decryptDocument(tab: DocumentTab, password: string): Promise<boolean> {
  const bytes = await buildDocumentPdf(tab)
  const result = await window.api.transformPdf({ operation: 'decrypt', bytes, password })
  return saveTransformed(tab, result, 'decrypted')
}

/** Linearizes (web-optimizes) the current document and saves a copy. */
export async function linearizeDocument(tab: DocumentTab): Promise<boolean> {
  const bytes = await buildDocumentPdf(tab)
  const result = await window.api.transformPdf({ operation: 'linearize', bytes })
  return saveTransformed(tab, result, 'web')
}

/** Repairs/normalizes the current document and saves a copy. */
export async function repairDocument(tab: DocumentTab): Promise<boolean> {
  const bytes = await buildDocumentPdf(tab)
  const result = await window.api.transformPdf({ operation: 'repair', bytes })
  return saveTransformed(tab, result, 'repaired')
}

/** The outcome of a size-reduction pass: byte counts, the optimized bytes, and
 * the source revision the snapshot was taken at (so a stale save can be caught). */
export interface OptimizeResult {
  before: number
  after: number
  bytes: Uint8Array<ArrayBuffer>
  revision: number
}

/** The live source revision for a tab (bumps on every in-place edit / OCR). */
export function currentSourceRevision(tabId: string): number {
  return useDocumentStore.getState().getTab(tabId)?.sourceRevision ?? 0
}

/**
 * Runs qpdf's structural size-reduction over the current document and reports
 * the before/after byte counts (without saving — the caller decides whether the
 * reduction is worth keeping). The result is tagged with the source revision it
 * was computed from so a later save can detect if the document changed underneath.
 */
export async function optimizeDocument(tab: DocumentTab): Promise<OptimizeResult> {
  const revision = currentSourceRevision(tab.id)
  const bytes = await buildDocumentPdf(tab)
  const result = await window.api.transformPdf({ operation: 'optimize', bytes })
  return { before: bytes.byteLength, after: result.byteLength, bytes: result, revision }
}

/** Writes already-optimized bytes to a user-chosen path (false if cancelled). */
export async function saveOptimized(
  tab: DocumentTab,
  bytes: Uint8Array<ArrayBuffer>
): Promise<boolean> {
  return saveTransformed(tab, bytes, 'optimized')
}
