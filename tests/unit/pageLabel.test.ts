import { describe, expect, it } from 'vitest'
import { formatPageLabel } from '@/lib/pageLabel'

describe('formatPageLabel', () => {
  it('renders a plain running number honoring the start offset', () => {
    expect(formatPageLabel('{n}', 0, 1, 8, 0)).toBe('1')
    expect(formatPageLabel('{n}', 4, 1, 8, 0)).toBe('5')
    expect(formatPageLabel('{n}', 0, 10, 8, 0)).toBe('10')
  })

  it('renders "Page N of M" with the total', () => {
    expect(formatPageLabel('Page {n} of {total}', 2, 1, 8, 0)).toBe('Page 3 of 8')
    expect(formatPageLabel('Page {n} of {total}', 0, 1, 1, 0)).toBe('Page 1 of 1')
  })

  it('zero-pads for Bates numbering with a prefix', () => {
    expect(formatPageLabel('ACME-{n}', 0, 1, 100, 6)).toBe('ACME-000001')
    expect(formatPageLabel('ACME-{n}', 41, 1, 100, 6)).toBe('ACME-000042')
  })

  it('supports a Bates prefix and suffix around the padded number', () => {
    expect(formatPageLabel('A{n}Z', 0, 1, 10, 3)).toBe('A001Z')
    expect(formatPageLabel('{n}-EXH', 0, 250, 10, 4)).toBe('0250-EXH')
  })

  it('does not pad when digits is 0, and replaces every token occurrence', () => {
    expect(formatPageLabel('{n}', 8, 1, 10, 0)).toBe('9')
    expect(formatPageLabel('{n}/{total} ({n})', 0, 1, 5, 0)).toBe('1/5 (1)')
  })

  it('keeps a number wider than the pad width intact', () => {
    expect(formatPageLabel('{n}', 0, 1_000_000, 10, 3)).toBe('1000000')
  })
})
