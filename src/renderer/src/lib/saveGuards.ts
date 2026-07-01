import { saveDocument } from '@/lib/save'
import { redactedPageNumbers } from '@/lib/redaction'
import { useUiStore } from '@/store/uiStore'
import type { DocumentTab } from '@/store/documentStore'

/**
 * True when the tab carries redaction MARKS that have not been applied
 * (rasterized). Any authoritative disk-write of such a document — save, sign,
 * encrypt, extract, split — would leave the "redacted" text merely covered by
 * opaque boxes and fully recoverable, so every write path must gate on this.
 */
export function hasUnappliedRedactions(tab: DocumentTab): boolean {
  return redactedPageNumbers(tab).length > 0
}

/**
 * Message shown when a write is refused because redaction marks are unapplied.
 * `action` names the operation ("signing", "encryption", …).
 */
export function unappliedRedactionMessage(action: string): string {
  return `Apply your redaction marks before ${action}. Until they're applied, the hidden text is only covered by opaque boxes and stays fully recoverable in the output file.`
}

/**
 * Guards a non-save write path (extract, split, …): if the document has
 * unapplied redaction marks, opens the shared block dialog and returns true
 * (the caller must abort). Returns false when it is safe to proceed.
 */
export function blockWriteIfUnappliedRedactions(tab: DocumentTab): boolean {
  if (hasUnappliedRedactions(tab)) {
    useUiStore.getState().setRedactionBlock({ tabId: tab.id })
    return true
  }
  return false
}

/**
 * Saves a document, but first guards against the classic redaction-failure leak:
 * if the tab still carries UNAPPLIED redaction marks, writing now would produce a
 * file whose "redacted" text is merely covered by opaque boxes and remains fully
 * recoverable. In that case we defer to a confirmation dialog (the user can apply
 * the redactions first, save anyway, or cancel). Otherwise it saves immediately.
 *
 * Returns true only when the file was written synchronously here; a deferred save
 * resolves to false (its outcome is decided later by the dialog).
 */
export async function requestSaveDocument(tab: DocumentTab, saveAs = false): Promise<boolean> {
  if (redactedPageNumbers(tab).length > 0) {
    useUiStore.getState().setRedactionSavePrompt({ tabId: tab.id, saveAs })
    return false
  }
  return saveDocument(tab, saveAs)
}
