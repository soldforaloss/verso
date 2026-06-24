#!/usr/bin/env node
// Generates Verso's app icon — resources/icon.png (256×256) and
// resources/icon.ico — from code, with no image-library dependency. The mark
// is a rounded-square indigo tile with a white "V". Rendered at 4× and
// downsampled for anti-aliasing; PNG is encoded via Node's zlib.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'resources')
const SIZE = 256
const SS = 4 // supersample factor
const BIG = SIZE * SS

const TOP = [0x63, 0x66, 0xf1] // indigo-500
const BOTTOM = [0x43, 0x38, 0xca] // indigo-700
const WHITE = [0xff, 0xff, 0xff]

const lerp = (a, b, t) => a + (b - a) * t

function roundedRectAlpha(x, y, size, radius) {
  // Signed-distance to a rounded square; ~1 inside, 0 outside (sharp here, AA
  // comes from supersampling).
  const cx = size / 2
  const cy = size / 2
  const dx = Math.abs(x - cx) - (size / 2 - radius)
  const dy = Math.abs(y - cy) - (size / 2 - radius)
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  const inside = Math.min(Math.max(dx, dy), 0)
  return outside + inside <= radius ? 1 : 0
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function sample(x, y) {
  // Returns [r,g,b,a] at a point in the BIG canvas.
  const margin = BIG * 0.04
  const tileSize = BIG - margin * 2
  const inTile = roundedRectAlpha(x - margin, y - margin, tileSize, tileSize * 0.22)
  if (!inTile) return [0, 0, 0, 0]

  const t = y / BIG
  const bg = [lerp(TOP[0], BOTTOM[0], t), lerp(TOP[1], BOTTOM[1], t), lerp(TOP[2], BOTTOM[2], t)]

  // The "V": two strokes converging at bottom-centre.
  const ax = BIG * 0.3
  const ay = BIG * 0.3
  const bx = BIG * 0.7
  const vx = BIG * 0.5
  const vy = BIG * 0.72
  const thickness = BIG * 0.14
  const d = Math.min(
    distToSegment(x, y, ax, ay, vx, vy),
    distToSegment(x, y, bx, ay, vx, vy)
  )
  if (d <= thickness / 2) return [...WHITE, 255]
  return [bg[0], bg[1], bg[2], 255]
}

function renderPng() {
  const pixels = Buffer.alloc(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const [sr, sg, sb, sa] = sample(x * SS + sx + 0.5, y * SS + sy + 0.5)
          r += sr
          g += sg
          b += sb
          a += sa
        }
      }
      const n = SS * SS
      const i = (y * SIZE + x) * 4
      pixels[i] = Math.round(r / n)
      pixels[i + 1] = Math.round(g / n)
      pixels[i + 2] = Math.round(b / n)
      pixels[i + 3] = Math.round(a / n)
    }
  }
  return encodePng(SIZE, SIZE, pixels)
}

// ---- PNG encoding -----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  // 10–12 default to 0 (compression, filter, interlace)

  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y += 1) {
    raw[y * (1 + width * 4)] = 0 // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw, { level: 9 })

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---- ICO wrapping (single 256px PNG entry) ----------------------------------

function encodeIco(png) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // image count

  const entry = Buffer.alloc(16)
  entry[0] = 0 // width 256 (0 = 256)
  entry[1] = 0 // height 256
  entry[2] = 0 // palette
  entry[3] = 0 // reserved
  entry.writeUInt16LE(1, 4) // colour planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(6 + 16, 12) // offset to image data

  return Buffer.concat([header, entry, png])
}

mkdirSync(OUT, { recursive: true })
const png = renderPng()
writeFileSync(join(OUT, 'icon.png'), png)
writeFileSync(join(OUT, 'icon.ico'), encodeIco(png))
console.log(`[generate-icon] Wrote resources/icon.png and icon.ico (${png.length} B PNG).`)
