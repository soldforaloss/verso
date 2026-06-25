import type { SignatureImage } from '@/lib/signature'

/** Preset rubber-stamp labels and their ink colours. */
export interface StampPreset {
  label: string
  color: string
}

export const STAMP_PRESETS: StampPreset[] = [
  { label: 'APPROVED', color: '#16a34a' },
  { label: 'REJECTED', color: '#dc2626' },
  { label: 'DRAFT', color: '#dc2626' },
  { label: 'CONFIDENTIAL', color: '#dc2626' },
  { label: 'REVIEWED', color: '#2563eb' },
  { label: 'FINAL', color: '#16a34a' }
]

/**
 * Renders a rubber stamp (bold uppercase text in a rounded box) to a PNG. Uses
 * a system sans-serif so it needs no font loading. Returns the image plus size.
 */
export function renderStamp(text: string, color: string): SignatureImage | null {
  const value = text.trim().toUpperCase()
  if (!value) return null
  const fontSize = 48
  const font = `bold ${fontSize}px sans-serif`

  const measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) return null
  measureCtx.font = font
  const textWidth = measureCtx.measureText(value).width

  const padX = 28
  const padY = 14
  const border = 4
  const width = Math.ceil(textWidth + padX * 2 + border * 2)
  const height = Math.ceil(fontSize + padY * 2 + border * 2)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const radius = 10
  const x = border / 2
  const y = border / 2
  const w = width - border
  const h = height - border
  ctx.strokeStyle = color
  ctx.lineWidth = border
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
  ctx.stroke()

  ctx.fillStyle = color
  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(value, width / 2, height / 2 + 2)

  return { dataUrl: canvas.toDataURL('image/png'), width, height }
}
