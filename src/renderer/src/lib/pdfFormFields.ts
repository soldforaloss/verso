import type { PDFForm, PDFPage } from 'pdf-lib'
import { newFieldName, toWinAnsi, type NewFormField } from '@/lib/formFields'

/**
 * Creates the authored form fields on a pdf-lib page. Coordinates are PDF page
 * space (bottom-left origin), matching what `screenToPage` produced. Helvetica
 * is auto-embedded by `addToPage`, and `PDFDocument.save()` regenerates
 * appearances because the form was obtained via `getForm()`. A field that can't
 * be created (e.g. a duplicate name) is skipped rather than aborting the save.
 */
export function addNewFormFields(form: PDFForm, page: PDFPage, fields: NewFormField[]): void {
  for (const field of fields) {
    const options = {
      x: field.rect.x,
      y: field.rect.y,
      width: Math.max(1, field.rect.width),
      height: Math.max(1, field.rect.height),
      borderWidth: 1
    }
    // Choice options are rendered into the field appearance with Helvetica, whose
    // WinAnsi encoder throws on un-encodable characters during save() — strip them
    // here too (not just at the editor boundary) so legacy/recovered fields can't
    // abort the whole save. Empty results are dropped.
    const choiceOptions = (field.options ?? []).map(toWinAnsi).filter(Boolean)
    const create = (name: string): void => {
      if (field.type === 'checkbox') {
        form.createCheckBox(name).addToPage(page, options)
      } else if (field.type === 'dropdown') {
        const dropdown = form.createDropdown(name)
        if (choiceOptions.length) dropdown.addOptions(choiceOptions)
        dropdown.addToPage(page, options)
      } else if (field.type === 'optionlist') {
        const list = form.createOptionList(name)
        if (choiceOptions.length) list.addOptions(choiceOptions)
        list.addToPage(page, options)
      } else {
        form.createTextField(name).addToPage(page, options)
      }
    }
    try {
      create(field.name)
    } catch {
      // Most likely a name collision with an existing field — retry once with a
      // fresh unique name so the field isn't silently lost.
      try {
        create(newFieldName(field.type))
      } catch (error) {
        console.warn('[forms] could not create field', field.name, error)
      }
    }
  }
}
