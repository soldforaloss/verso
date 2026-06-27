import { describe, it, expect } from 'vitest'
import { PDFDocument, PDFDropdown, PDFOptionList } from 'pdf-lib'
import { addNewFormFields } from '@/lib/pdfFormFields'
import type { NewFormField } from '@/lib/formFields'

const RECT = { x: 50, y: 200, width: 200, height: 60 }

async function buildWith(fields: NewFormField[]): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 400])
  addNewFormFields(doc.getForm(), page, fields)
  // getForm() makes save() run a global appearance pass — the path where an
  // un-encodable option used to throw and abort the whole save.
  const bytes = await doc.save()
  return PDFDocument.load(bytes)
}

describe('addNewFormFields choice fields', () => {
  it('creates a dropdown and option list with their options', async () => {
    const reloaded = await buildWith([
      { id: '1', type: 'dropdown', name: 'country', rect: RECT, options: ['USA', 'Canada'] },
      { id: '2', type: 'optionlist', name: 'colors', rect: RECT, options: ['Red', 'Green'] }
    ])
    const form = reloaded.getForm()
    expect(form.getDropdown('country').getOptions()).toEqual(['USA', 'Canada'])
    expect(form.getOptionList('colors').getOptions()).toEqual(['Red', 'Green'])
  })

  it('does not abort the save when an option has a non-WinAnsi character', async () => {
    // Regression: an option list renders every option into its appearance with
    // Helvetica; a CJK/emoji code point made save() throw, losing the whole file.
    const reloaded = await buildWith([
      { id: '1', type: 'optionlist', name: 'mixed', rect: RECT, options: ['日本語', 'USA', '😀'] }
    ])
    const list = reloaded.getForm().getOptionList('mixed')
    expect(list).toBeInstanceOf(PDFOptionList)
    // Un-encodable options are stripped to nothing and dropped, leaving 'USA'.
    expect(list.getOptions()).toEqual(['USA'])
  })

  it('creates the choice field even if every option is un-encodable', async () => {
    const reloaded = await buildWith([
      { id: '1', type: 'dropdown', name: 'allbad', rect: RECT, options: ['日本語', '😀'] }
    ])
    const dropdown = reloaded.getForm().getDropdown('allbad')
    expect(dropdown).toBeInstanceOf(PDFDropdown)
    expect(dropdown.getOptions()).toEqual([])
  })
})
