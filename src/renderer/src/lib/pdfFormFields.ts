import type { PDFForm, PDFPage } from 'pdf-lib'
import {
  cleanFieldOptions,
  newFieldName,
  radioButtonRects,
  toWinAnsi,
  type NewFormField
} from '@/lib/formFields'

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
    // Dropdown/list option text is rendered into the field appearance with
    // Helvetica, whose WinAnsi encoder throws on un-encodable characters during
    // save() — strip them here too (not just at the editor boundary) so
    // legacy/recovered fields can't abort the whole save. Radio export values
    // aren't rendered, so they keep full Unicode (sanitizeWinAnsi=false).
    const choiceOptions = cleanFieldOptions(field.options ?? [])
    const radioOptions = cleanFieldOptions(field.options ?? [], false)
    const create = (name: string): void => {
      if (field.type === 'checkbox') {
        const checkbox = form.createCheckBox(name)
        if (field.defaultChecked) checkbox.check()
        if (field.required) checkbox.enableRequired()
        checkbox.addToPage(page, options)
      } else if (field.type === 'dropdown') {
        const dropdown = form.createDropdown(name)
        if (choiceOptions.length) dropdown.addOptions(choiceOptions)
        // Default selection is rendered, so it must be a (WinAnsi-clean) option.
        if (field.defaultValue && choiceOptions.includes(field.defaultValue)) {
          dropdown.select(field.defaultValue)
        }
        if (field.required) dropdown.enableRequired()
        dropdown.addToPage(page, options)
      } else if (field.type === 'optionlist') {
        const list = form.createOptionList(name)
        if (choiceOptions.length) list.addOptions(choiceOptions)
        if (field.defaultValue && choiceOptions.includes(field.defaultValue)) {
          list.select([field.defaultValue])
        }
        if (field.required) list.enableRequired()
        list.addToPage(page, options)
      } else if (field.type === 'radio') {
        const group = form.createRadioGroup(name)
        // One button per export value, laid out within the field's rect. A radio
        // group with no usable options would have no widgets, so seed a single
        // default button rather than create an empty (invisible) group.
        const values = radioOptions.length ? radioOptions : ['Option 1']
        const rects = radioButtonRects(field.rect, values.length)
        values.forEach((value, index) => {
          const r = rects[index]!
          group.addOptionToPage(value, page, {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            borderWidth: 1
          })
        })
        if (field.defaultValue && values.includes(field.defaultValue)) {
          group.select(field.defaultValue)
        }
        if (field.required) group.enableRequired()
      } else {
        const textField = form.createTextField(name)
        // The default text is rendered with Helvetica → strip un-encodable chars.
        if (field.defaultValue) textField.setText(toWinAnsi(field.defaultValue))
        if (field.required) textField.enableRequired()
        textField.addToPage(page, options)
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
