import { useDocumentStore } from '@/store/documentStore'

/**
 * Shared "open a document" actions used by the toolbar, empty state, menu, and
 * OS open-with handler. They call the privileged bridge to read bytes, then
 * hand them to the document store.
 */

export async function openViaDialog(): Promise<void> {
  const document = await window.api.openFileDialog()
  if (document) await useDocumentStore.getState().openDocument(document)
}

export async function openPath(path: string): Promise<void> {
  const document = await window.api.readFile({ path })
  await useDocumentStore.getState().openDocument(document)
}
