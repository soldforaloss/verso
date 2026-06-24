import { buildDocumentPdf } from '@/lib/save'
import type { DocumentTab } from '@/store/documentStore'
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
