import { describe, it, expect } from 'vitest'
import { OverlayContentEditor } from '@/lib/contentEditor'
import type { PdfPage } from '@/lib/pdf'

function pageWithRun(): PdfPage {
  return {
    getTextContent: async () => ({
      items: [{ str: 'Hello', width: 50, transform: [12, 0, 0, 12, 72, 700], fontName: 'f1' }],
      styles: { f1: { fontFamily: 'serif' } }
    }),
    commonObjs: {
      has: (id: string) => id === 'f1',
      get: () => ({ name: 'Times-BoldItalic' })
    }
  } as unknown as PdfPage
}

describe('OverlayContentEditor', () => {
  const editor = new OverlayContentEditor()
  const sampleBackground = (): string => '#ffffff'
  const sampleInkColor = (): string => '#1a3fc4'
  // The run is 50 wide; pretend the substitute font lays it out at 40 wide.
  const measureTextWidth = (): number => 40

  it('covers and replaces the run, preserving its color and inferred face', async () => {
    const result = await editor.editTextRun({
      page: pageWithRun(),
      pageKey: 'p',
      point: { x: 80, y: 702 },
      sampleBackground,
      sampleInkColor,
      measureTextWidth
    })
    expect(result).not.toBeNull()
    expect(result).toHaveLength(2)
    expect(result?.[0]?.type).toBe('rect') // the cover, background-colored
    expect(result?.[0]?.color).toBe('#ffffff')

    const text = result?.[1]
    expect(text?.type).toBe('text')
    if (text?.type !== 'text') throw new Error('expected text annotation')
    expect(text.text).toBe('Hello')
    // Color comes from the sampled ink, not a hardcoded black.
    expect(text.color).toBe('#1a3fc4')
    // Face inferred from the font name (Times-BoldItalic → serif/bold/italic).
    expect(text.fontFamily).toBe('serif')
    expect(text.bold).toBe(true)
    expect(text.italic).toBe(true)
    // Font size derives from the run's transform scale.
    expect(text.fontSize).toBe(12)
    // Letter spacing closes the gap between the original width (50) and the
    // substitute font's natural width (40): (50-40)/(5-1) = 2.5.
    expect(text.letterSpacing).toBeCloseTo(2.5, 5)
  })

  it('returns null when no run is under the point', async () => {
    const result = await editor.editTextRun({
      page: pageWithRun(),
      pageKey: 'p',
      point: { x: 500, y: 500 },
      sampleBackground,
      sampleInkColor,
      measureTextWidth
    })
    expect(result).toBeNull()
  })
})
