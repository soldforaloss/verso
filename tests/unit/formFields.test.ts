import { describe, it, expect } from 'vitest'
import {
  defaultFieldOptions,
  isChoiceField,
  newFieldName,
  newFieldId,
  parseFieldOptions,
  toWinAnsi
} from '@/lib/formFields'

describe('formFields', () => {
  it('names fields by type with a unique suffix', () => {
    expect(newFieldName('text')).toMatch(/^Text_[0-9a-f]{8}$/)
    expect(newFieldName('checkbox')).toMatch(/^Checkbox_[0-9a-f]{8}$/)
    expect(newFieldName('dropdown')).toMatch(/^Dropdown_[0-9a-f]{8}$/)
    expect(newFieldName('optionlist')).toMatch(/^List_[0-9a-f]{8}$/)
  })

  it('generates distinct names and ids', () => {
    const names = new Set([
      newFieldName('text'),
      newFieldName('text'),
      newFieldName('text'),
      newFieldName('checkbox')
    ])
    expect(names.size).toBe(4)
    expect(newFieldId()).not.toBe(newFieldId())
  })
})

describe('isChoiceField', () => {
  it('is true only for dropdown and option list', () => {
    expect(isChoiceField('dropdown')).toBe(true)
    expect(isChoiceField('optionlist')).toBe(true)
    expect(isChoiceField('text')).toBe(false)
    expect(isChoiceField('checkbox')).toBe(false)
  })
})

describe('defaultFieldOptions', () => {
  it('returns a fresh, non-empty array each call', () => {
    const a = defaultFieldOptions()
    const b = defaultFieldOptions()
    expect(a.length).toBeGreaterThan(0)
    expect(a).not.toBe(b) // not a shared mutable reference
  })
})

describe('parseFieldOptions', () => {
  it('splits on commas and newlines, trimming whitespace', () => {
    expect(parseFieldOptions('a, b ,  c')).toEqual(['a', 'b', 'c'])
    expect(parseFieldOptions('one\ntwo\nthree')).toEqual(['one', 'two', 'three'])
    expect(parseFieldOptions('x , y\nz')).toEqual(['x', 'y', 'z'])
  })

  it('drops empty entries and de-duplicates (first wins)', () => {
    expect(parseFieldOptions('a,,b,')).toEqual(['a', 'b'])
    expect(parseFieldOptions('red, blue, red, green')).toEqual(['red', 'blue', 'green'])
    expect(parseFieldOptions('   ')).toEqual([])
    expect(parseFieldOptions('')).toEqual([])
  })

  it('strips characters the PDF StandardFont cannot encode', () => {
    // CJK / Cyrillic / emoji are dropped; an option that is only such characters
    // disappears entirely rather than becoming an empty option.
    expect(parseFieldOptions('café, 日本語, naïve')).toEqual(['café', 'naïve'])
    expect(parseFieldOptions('USA, 😀, Canada')).toEqual(['USA', 'Canada'])
    expect(parseFieldOptions('Привет, hello')).toEqual(['hello'])
  })
})

describe('toWinAnsi', () => {
  it('keeps WinAnsi-encodable characters, drops the rest', () => {
    expect(toWinAnsi('Hello, World!')).toBe('Hello, World!')
    expect(toWinAnsi('café — €5 ™')).toBe('café — €5 ™') // smart dash, euro, tm are WinAnsi
    expect(toWinAnsi('日本語')).toBe('')
    expect(toWinAnsi('a日b本c')).toBe('abc')
    expect(toWinAnsi('emoji😀here')).toBe('emojihere')
  })
})
