import { useDocumentStore } from '@/store/documentStore'
import { useHistoryStore } from '@/store/historyStore'
import type { NewFormField } from '@/lib/formFields'

function pageFields(docId: string, pageKey: string): NewFormField[] {
  return useDocumentStore.getState().getTab(docId)?.formFields[pageKey] ?? []
}

/** Routes a form-field-list change for one page through the undo/redo engine. */
function commit(docId: string, pageKey: string, label: string, next: NewFormField[]): void {
  const before = pageFields(docId, pageKey)
  useHistoryStore.getState().execute(docId, {
    label,
    redo: () => useDocumentStore.getState().setPageFormFields(docId, pageKey, next),
    undo: () => useDocumentStore.getState().setPageFormFields(docId, pageKey, before)
  })
}

export function addFormField(docId: string, pageKey: string, field: NewFormField): void {
  commit(docId, pageKey, `Add ${field.type} field`, [...pageFields(docId, pageKey), field])
}

export function removeFormField(docId: string, pageKey: string, id: string): void {
  commit(
    docId,
    pageKey,
    'Delete field',
    pageFields(docId, pageKey).filter((field) => field.id !== id)
  )
}

/** A patch of the editable properties of an authored field. */
export type FormFieldPatch = Partial<
  Pick<NewFormField, 'name' | 'options' | 'required' | 'defaultValue' | 'defaultChecked'>
>

/** Patches an authored field's editable properties as a single undo step. */
export function updateFormField(
  docId: string,
  pageKey: string,
  id: string,
  patch: FormFieldPatch
): void {
  commit(
    docId,
    pageKey,
    'Edit field',
    pageFields(docId, pageKey).map((field) => (field.id === id ? { ...field, ...patch } : field))
  )
}
