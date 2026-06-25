import {
  degrees,
  rgb,
  StandardFonts,
  type Color,
  type PDFDocument,
  type PDFFont,
  type PDFPage
} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { Annotation, Point, TextFontFamily } from '@/lib/annotations'
import { bundledFontByKey, bundledFontFile } from '@/lib/fonts'

/** Maps a text annotation's face to the closest standard-14 font. */
export function standardFontFor(
  family: TextFontFamily,
  bold: boolean,
  italic: boolean
): StandardFonts {
  if (family === 'serif') {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic
    if (bold) return StandardFonts.TimesRomanBold
    if (italic) return StandardFonts.TimesRomanItalic
    return StandardFonts.TimesRoman
  }
  if (family === 'monospace') {
    if (bold && italic) return StandardFonts.CourierBoldOblique
    if (bold) return StandardFonts.CourierBold
    if (italic) return StandardFonts.CourierOblique
    return StandardFonts.Courier
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique
  if (bold) return StandardFonts.HelveticaBold
  if (italic) return StandardFonts.HelveticaOblique
  return StandardFonts.Helvetica
}

// Fonts are cached per document so repeated text runs reuse one embedded font
// (and one subset). Keyed by standard-font name or bundled-font asset URL.
const docFonts = new WeakMap<PDFDocument, Map<string, Promise<PDFFont>>>()
const fontkitDocs = new WeakSet<PDFDocument>()
const fontFileBytes = new Map<string, Promise<ArrayBuffer>>()

function docFontMap(doc: PDFDocument): Map<string, Promise<PDFFont>> {
  let map = docFonts.get(doc)
  if (!map) {
    map = new Map()
    docFonts.set(doc, map)
  }
  return map
}

function resolveStandardFont(
  doc: PDFDocument,
  family: TextFontFamily,
  bold: boolean,
  italic: boolean
): Promise<PDFFont> {
  const name = standardFontFor(family, bold, italic)
  const map = docFontMap(doc)
  let pending = map.get(name)
  if (!pending) {
    pending = doc.embedFont(name)
    map.set(name, pending)
  }
  return pending
}

async function embedBundledFont(doc: PDFDocument, url: string): Promise<PDFFont> {
  if (!fontkitDocs.has(doc)) {
    doc.registerFontkit(fontkit)
    fontkitDocs.add(doc)
  }
  let bytes = fontFileBytes.get(url)
  if (!bytes) {
    bytes = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Failed to load font ${url}`)
      return response.arrayBuffer()
    })
    fontFileBytes.set(url, bytes)
  }
  // Copy per embed: the bytes cache is shared across documents.
  return doc.embedFont((await bytes).slice(0), { subset: true })
}

/**
 * Resolves the font for a text annotation: a bundled, metric-compatible TTF if
 * one was matched (embedded with fontkit so glyph widths are exact), otherwise
 * the closest standard-14 font. Falls back to the standard font if the bundled
 * asset can't be embedded.
 */
function resolveAnnotationFont(
  doc: PDFDocument,
  annotation: Extract<Annotation, { type: 'text' }>
): Promise<PDFFont> {
  const bold = annotation.bold ?? false
  const italic = annotation.italic ?? false
  const bundled = bundledFontByKey(annotation.fontKey)
  if (bundled) {
    const url = bundledFontFile(bundled, bold, italic)
    const map = docFontMap(doc)
    let pending = map.get(url)
    if (!pending) {
      pending = embedBundledFont(doc, url).catch(() =>
        resolveStandardFont(doc, bundled.generic, bold, italic)
      )
      map.set(url, pending)
    }
    return pending
  }
  return resolveStandardFont(doc, annotation.fontFamily ?? 'sans-serif', bold, italic)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function hexToRgb(hex: string): Color {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.replace(/(.)/g, '$1$1') : value
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  return rgb(Number.isFinite(r) ? r : 0, Number.isFinite(g) ? g : 0, Number.isFinite(b) ? b : 0)
}

/**
 * Draws an annotation into a PDF page's content stream (page space, bottom-left
 * origin — the same space annotations are stored in). Called during save to
 * flatten annotations so they persist and render identically everywhere.
 */
export async function drawAnnotation(
  doc: PDFDocument,
  page: PDFPage,
  annotation: Annotation
): Promise<void> {
  const color = hexToRgb(annotation.color)

  switch (annotation.type) {
    case 'ink': {
      for (const stroke of annotation.strokes) {
        for (let i = 1; i < stroke.length; i += 1) {
          page.drawLine({
            start: stroke[i - 1]!,
            end: stroke[i]!,
            thickness: annotation.strokeWidth,
            color,
            opacity: annotation.opacity,
            lineCap: 1
          })
        }
      }
      break
    }
    case 'rect': {
      const { x, y, width, height } = annotation.rect
      page.drawRectangle({
        x,
        y,
        width,
        height,
        borderColor: color,
        borderWidth: annotation.strokeWidth,
        borderOpacity: annotation.opacity,
        ...(annotation.filled ? { color, opacity: annotation.opacity } : {})
      })
      break
    }
    case 'ellipse': {
      const { x, y, width, height } = annotation.rect
      page.drawEllipse({
        x: x + width / 2,
        y: y + height / 2,
        xScale: width / 2,
        yScale: height / 2,
        borderColor: color,
        borderWidth: annotation.strokeWidth,
        borderOpacity: annotation.opacity,
        ...(annotation.filled ? { color, opacity: annotation.opacity } : {})
      })
      break
    }
    case 'line': {
      page.drawLine({
        start: annotation.a,
        end: annotation.b,
        thickness: annotation.strokeWidth,
        color,
        opacity: annotation.opacity,
        lineCap: 1
      })
      if (annotation.arrow) {
        for (const head of arrowHeads(annotation.a, annotation.b)) {
          page.drawLine({
            start: annotation.b,
            end: head,
            thickness: annotation.strokeWidth,
            color,
            lineCap: 1
          })
        }
      }
      break
    }
    case 'text': {
      const { x, y, height } = annotation.rect
      const textFont = await resolveAnnotationFont(doc, annotation)
      const size = annotation.fontSize
      const baselineY = y + height - size
      const spacing = annotation.letterSpacing ?? 0

      if (spacing !== 0) {
        // pdf-lib's drawText has no character-spacing option, so apply tracking
        // by drawing glyph-by-glyph and advancing by each glyph's width.
        const lineHeight = size * 1.2
        let cursorX = x
        let cursorY = baselineY
        for (const ch of annotation.text) {
          if (ch === '\n') {
            cursorX = x
            cursorY -= lineHeight
            continue
          }
          try {
            page.drawText(ch, { x: cursorX, y: cursorY, size, font: textFont, color })
            cursorX += textFont.widthOfTextAtSize(ch, size) + spacing
          } catch {
            // Glyph the standard font can't encode — leave a gap and continue.
            cursorX += size * 0.5 + spacing
          }
        }
      } else {
        try {
          page.drawText(annotation.text, {
            x,
            y: baselineY,
            size,
            font: textFont,
            color,
            lineHeight: size * 1.2,
            maxWidth: annotation.rect.width
          })
        } catch {
          /* contains glyphs the standard font can't encode — skip rather than fail the save */
        }
      }
      break
    }
    case 'note': {
      // A small filled marker (the comment text lives in the app's panel).
      page.drawRectangle({
        x: annotation.point.x,
        y: annotation.point.y - 12,
        width: 12,
        height: 12,
        color,
        opacity: 0.9
      })
      break
    }
    case 'image': {
      const [meta = '', data = ''] = annotation.dataUrl.split(',')
      const bytes = base64ToBytes(data)
      const image = meta.includes('image/png')
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes)
      page.drawImage(image, {
        x: annotation.rect.x,
        y: annotation.rect.y,
        width: annotation.rect.width,
        height: annotation.rect.height
      })
      break
    }
    case 'redaction': {
      // Always solid, fully opaque black — never honors the palette color. The
      // box obscures the content visually; lib/redaction.ts then rasterizes the
      // page so nothing remains beneath it in the content stream.
      const { x, y, width, height } = annotation.rect
      page.drawRectangle({ x, y, width, height, color: rgb(0, 0, 0), opacity: 1 })
      break
    }
    case 'markup': {
      for (const quad of annotation.quads) {
        if (annotation.markup === 'highlight') {
          page.drawRectangle({
            x: quad.x,
            y: quad.y,
            width: quad.width,
            height: quad.height,
            color,
            opacity: annotation.opacity
          })
        } else {
          const y = annotation.markup === 'strike' ? quad.y + quad.height / 2 : quad.y + 1
          page.drawLine({
            start: { x: quad.x, y },
            end: { x: quad.x + quad.width, y },
            thickness: 1.5,
            color
          })
        }
      }
      break
    }
  }
}

function arrowHeads(from: Point, to: Point, size = 10): [Point, Point] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const spread = Math.PI / 7
  return [
    { x: to.x - size * Math.cos(angle - spread), y: to.y - size * Math.sin(angle - spread) },
    { x: to.x - size * Math.cos(angle + spread), y: to.y - size * Math.sin(angle + spread) }
  ]
}

export { degrees }
