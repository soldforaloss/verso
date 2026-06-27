import { describe, it, expect } from 'vitest'
import {
  defaultFieldOptions,
  fieldHasOptions,
  newFieldName,
  newFieldId,
  parseFieldOptions,
  radioButtonRects,
  toWinAnsi
} from '@/lib/formFields'

describe('formFields', () => {
  it('names fields by type with a unique suffix', () => {
    expect(newFieldName('text')).toMatch(/^Text_[0-9a-f]{8}$/)
    expect(newFieldName('checkbox')).toMatch(/^Checkbox_[0-9a-f]{8}$/)
    expect(newFieldName('dropdown')).toMatch(/^Dropdown_[0-9a-f]{8}$/)
    expect(newFieldName('optionlist')).toMatch(/^List_[0-9a-f]{8}$/)
    expect(newFieldName('radio')).toMatch(/^Radio_[0-9a-f]{8}$/)
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

describe('fieldHasOptions', () => {
  it('is true for dropdown, option list, and radio', () => {
    expect(fieldHasOptions('dropdown')).toBe(true)
    expect(fieldHasOptions('optionlist')).toBe(true)
    expect(fieldHasOptions('radio')).toBe(true)
    expect(fieldHasOptions('text')).toBe(false)
    expect(fieldHasOptions('checkbox')).toBe(false)
  })
})

describe('radioButtonRects', () => {
  const bounding = { x: 100, y: 200, width: 30, height: 90 }

  /** Asserts every button square stays inside the bounding box and doesn't overlap. */
  function expectInsideAndNonOverlapping(
    rects: ReturnType<typeof radioButtonRects>,
    box: typeof bounding
  ): void {
    for (const r of rects) {
      expect(r.width).toBe(r.height)
      expect(r.width).toBeGreaterThanOrEqual(0)
      expect(r.x).toBeGreaterThanOrEqual(box.x)
      expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width + 1e-9)
      expect(r.y).toBeGreaterThanOrEqual(box.y - 1e-9)
      expect(r.y + r.height).toBeLessThanOrEqual(box.y + box.height + 1e-9)
    }
    // Adjacent rows (sorted top→down already) must not overlap vertically.
    for (let i = 1; i < rects.length; i += 1) {
      expect(rects[i]!.y + rects[i]!.height).toBeLessThanOrEqual(rects[i - 1]!.y + 1e-9)
    }
  }

  it('places one square button per option, first on top, inside the box', () => {
    const rects = radioButtonRects(bounding, 3)
    expect(rects).toHaveLength(3)
    for (const r of rects) expect(r.x).toBe(100)
    expect(rects[0]!.y).toBeGreaterThan(rects[1]!.y)
    expect(rects[1]!.y).toBeGreaterThan(rects[2]!.y)
    expectInsideAndNonOverlapping(rects, bounding)
  })

  it('keeps buttons inside the box for short, narrow, and degenerate drags', () => {
    // Regression: a fixed minimum side used to overflow the box and overlap.
    const short = { x: 0, y: 0, width: 100, height: 12 }
    expectInsideAndNonOverlapping(radioButtonRects(short, 4), short)
    const narrow = { x: 10, y: 10, width: 2, height: 60 }
    expectInsideAndNonOverlapping(radioButtonRects(narrow, 3), narrow)
    const many = { x: 0, y: 0, width: 100, height: 40 }
    expectInsideAndNonOverlapping(radioButtonRects(many, 50), many)
  })

  it('clamps the option count to at least one button', () => {
    expect(radioButtonRects(bounding, 0)).toHaveLength(1)
    expect(radioButtonRects(bounding, -3)).toHaveLength(1)
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

  it('keeps full Unicode when WinAnsi sanitizing is disabled (radio export values)', () => {
    // Radio buttons render a dot, not the export value, so the value is not
    // limited to WinAnsi — pass sanitizeWinAnsi=false.
    expect(parseFieldOptions('日本語, USA', false)).toEqual(['日本語', 'USA'])
    expect(parseFieldOptions('Да, Нет', false)).toEqual(['Да', 'Нет'])
    // Still trims and de-duplicates.
    expect(parseFieldOptions(' a , a , b ', false)).toEqual(['a', 'b'])
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
