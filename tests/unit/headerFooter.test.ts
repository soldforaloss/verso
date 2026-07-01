import { describe, expect, it } from 'vitest'
import {
  expandHeaderFooter,
  HEADER_FOOTER_SLOTS,
  type HeaderFooterContext
} from '../../src/renderer/src/lib/headerFooter'

const ctx: HeaderFooterContext = {
  page: 3,
  pages: 12,
  date: 'Jun 30, 2026',
  filename: 'report.pdf'
}

describe('expandHeaderFooter', () => {
  it('substitutes every token', () => {
    expect(expandHeaderFooter('Page {page} of {pages}', ctx)).toBe('Page 3 of 12')
    expect(expandHeaderFooter('{date} — {filename}', ctx)).toBe('Jun 30, 2026 — report.pdf')
  })

  it('replaces repeated tokens and leaves plain text alone', () => {
    expect(expandHeaderFooter('{page}/{pages} · {page}', ctx)).toBe('3/12 · 3')
    expect(expandHeaderFooter('Confidential', ctx)).toBe('Confidential')
  })

  it('leaves unknown tokens untouched', () => {
    expect(expandHeaderFooter('{author} {page}', ctx)).toBe('{author} 3')
  })

  it('does not re-expand tokens that come from injected values (no data injection)', () => {
    // A filename that itself contains a brace token must stay literal.
    const tricky: HeaderFooterContext = { ...ctx, filename: 'draft-{page}.pdf' }
    expect(expandHeaderFooter('{filename} p{page}', tricky)).toBe('draft-{page}.pdf p3')
  })

  it('exposes the six Adobe-style slots mapped to band + alignment', () => {
    expect(HEADER_FOOTER_SLOTS.map((s) => s.slot)).toEqual([
      'headerLeft',
      'headerCenter',
      'headerRight',
      'footerLeft',
      'footerCenter',
      'footerRight'
    ])
    expect(HEADER_FOOTER_SLOTS.filter((s) => s.band === 'header')).toHaveLength(3)
    expect(HEADER_FOOTER_SLOTS.filter((s) => s.align === 'center')).toHaveLength(2)
  })
})
