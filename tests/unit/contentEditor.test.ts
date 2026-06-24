import { describe, it, expect } from 'vitest'
import { OverlayContentEditor } from '@/lib/contentEditor'
import type { PdfPage } from '@/lib/pdf'

function pageWithRun(): PdfPage {
  return {
    getTextContent: async () => ({
      items: [{ str: 'Hello', width: 50, transform: [12, 0, 0, 12, 72, 700] }]
    })
  } as unknown as PdfPage
}

describe('OverlayContentEditor', () => {
  const editor = new OverlayContentEditor()
  const sampleBackground = (): string => '#ffffff'

  it('covers and replaces the text run under the point', async () => {
    const result = await editor.editTextRun({
      page: pageWithRun(),
      pageKey: 'p',
      point: { x: 80, y: 702 },
      sampleBackground
    })
    expect(result).not.toBeNull()
    expect(result).toHaveLength(2)
    expect(result?.[0]?.type).toBe('rect') // the cover
    const text = result?.[1]
    expect(text?.type).toBe('text')
    expect(text && text.type === 'text' && text.text).toBe('Hello')
  })

  it('returns null when no run is under the point', async () => {
    const result = await editor.editTextRun({
      page: pageWithRun(),
      pageKey: 'p',
      point: { x: 500, y: 500 },
      sampleBackground
    })
    expect(result).toBeNull()
  })
})
