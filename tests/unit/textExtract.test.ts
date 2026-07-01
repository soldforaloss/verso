import { describe, expect, it } from 'vitest'
import { itemsToText, joinPageTexts, textFileName } from '../../src/renderer/src/lib/textExtract'
import type { TextContentItem } from '../../src/renderer/src/lib/pdf'

const it_ = (str: string, hasEOL = false): TextContentItem =>
  ({ str, hasEOL }) as unknown as TextContentItem

describe('itemsToText', () => {
  it('joins item strings and breaks lines on hasEOL', () => {
    const text = itemsToText([it_('Hello '), it_('World', true), it_('Second line', true)])
    expect(text).toBe('Hello World\nSecond line')
  })

  it('skips marked-content items (no str)', () => {
    const items = [
      { type: 'beginMarkedContent' } as unknown as TextContentItem,
      it_('Visible', true)
    ]
    expect(itemsToText(items)).toBe('Visible')
  })

  it('trims trailing whitespace and collapses runs of blank lines', () => {
    const text = itemsToText([
      it_('Title   ', true),
      it_('', true),
      it_('', true),
      it_('', true),
      it_('Body', true)
    ])
    expect(text).toBe('Title\n\nBody')
  })
})

describe('joinPageTexts', () => {
  it('separates non-empty pages with a blank line and drops empty pages', () => {
    expect(joinPageTexts(['Page one', '', 'Page two'])).toBe('Page one\n\nPage two')
    expect(joinPageTexts(['', ''])).toBe('')
  })
})

describe('textFileName', () => {
  it('swaps a .pdf extension for .txt (case-insensitive)', () => {
    expect(textFileName('report.pdf')).toBe('report.txt')
    expect(textFileName('SCAN.PDF')).toBe('SCAN.txt')
    expect(textFileName('no-extension')).toBe('no-extension.txt')
  })
})
