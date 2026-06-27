import { describe, it, expect } from 'vitest'
import { PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup } from 'pdf-lib'
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

describe('addNewFormFields radio groups', () => {
  it('creates a radio group with one button per export value', async () => {
    const reloaded = await buildWith([
      { id: '1', type: 'radio', name: 'choice', rect: RECT, options: ['Yes', 'No', 'Maybe'] }
    ])
    const group = reloaded.getForm().getRadioGroup('choice')
    expect(group).toBeInstanceOf(PDFRadioGroup)
    expect(group.getOptions()).toEqual(['Yes', 'No', 'Maybe'])
  })

  it('keeps non-WinAnsi radio export values (they are not rendered) and de-dupes', async () => {
    const reloaded = await buildWith([
      { id: '1', type: 'radio', name: 'jp', rect: RECT, options: ['日本語', 'USA', 'USA'] }
    ])
    expect(reloaded.getForm().getRadioGroup('jp').getOptions()).toEqual(['日本語', 'USA'])
  })

  it('seeds one button when a radio group has no usable options', async () => {
    const reloaded = await buildWith([
      { id: '1', type: 'radio', name: 'empty', rect: RECT, options: [] }
    ])
    expect(reloaded.getForm().getRadioGroup('empty').getOptions()).toHaveLength(1)
  })
})

describe('addNewFormFields field properties', () => {
  it('applies required and default value across field types', async () => {
    const reloaded = await buildWith([
      { id: '1', type: 'text', name: 'fullname', rect: RECT, required: true, defaultValue: 'Jane' },
      { id: '2', type: 'checkbox', name: 'agree', rect: RECT, defaultChecked: true },
      {
        id: '3',
        type: 'dropdown',
        name: 'country',
        rect: RECT,
        options: ['USA', 'Canada'],
        defaultValue: 'Canada',
        required: true
      },
      {
        id: '4',
        type: 'radio',
        name: 'sub',
        rect: RECT,
        options: ['Yes', 'No'],
        defaultValue: 'No'
      }
    ])
    const form = reloaded.getForm()
    const text = form.getTextField('fullname')
    expect(text.getText()).toBe('Jane')
    expect(text.isRequired()).toBe(true)
    expect(form.getCheckBox('agree').isChecked()).toBe(true)
    const dropdown = form.getDropdown('country')
    expect(dropdown.getSelected()).toEqual(['Canada'])
    expect(dropdown.isRequired()).toBe(true)
    expect(form.getRadioGroup('sub').getSelected()).toBe('No')
  })

  it('ignores a default value that is not one of the options', async () => {
    const reloaded = await buildWith([
      { id: '1', type: 'dropdown', name: 'd', rect: RECT, options: ['A', 'B'], defaultValue: 'Z' }
    ])
    expect(reloaded.getForm().getDropdown('d').getSelected()).toEqual([])
  })

  it('strips un-encodable characters from a text default (no save abort)', async () => {
    const reloaded = await buildWith([
      { id: '1', type: 'text', name: 't', rect: RECT, defaultValue: 'OK 日本語 done' }
    ])
    expect(reloaded.getForm().getTextField('t').getText()).toBe('OK  done')
  })
})
