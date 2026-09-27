/**
 * Generates build/icon.ico from scratch: an accent-coloured rounded square with
 * a white check mark, drawn on a pixel grid and encoded as PNG-in-ICO.
 *
 * The app is fully offline, so the icon cannot be downloaded and no image
 * library is installed. Encoding a PNG by hand is ~40 lines of zlib plus CRC,
 * which is cheaper than adding a dependency that only runs at author time.
 *
 * Run with: node scripts/make-icon.mjs
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(ROOT, 'build', 'icon.ico')
const TOKENS = resolve(ROOT, 'src', 'renderer', 'styles', 'tokens.css')

/**
 * Reads the brand colour out of tokens.css so the icon can never drift from the
 * design system. The token file stays the single source of visual truth.
 */
/** @param {string} name */
function token(name) {
  const css = readFileSync(TOKENS, 'utf8')
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`))
  if (!match) throw new Error(`token ${name} not found in tokens.css`)
  const hex = match[1]
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex
  return [
    Number.parseInt(full.slice(1, 3), 16),
    Number.parseInt(full.slice(3, 5), 16),
    Number.parseInt(full.slice(5, 7), 16),
  ]
}

const ACCENT = token('--color-brand-accent')
const WHITE = [255, 255, 255]
const SIZES = [16, 24, 32, 48, 64, 128, 256]

/**
 * Distance from point (px, py) to the segment (ax, ay)-(bx, by).
 * @param {number} px @param {number} py @param {number} ax
 * @param {number} ay @param {number} bx @param {number} by
 */
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

/**
 * Samples the mark at 4x4 supersampling so the small sizes stay legible.
 * Returns RGBA bytes for one size.
 * @param {number} size
 */
function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const samples = 4
  const corner = size * 0.22
  const stroke = size * 0.11
  const inset = size * 0.5

  // Check mark control points, in 0..1 icon space.
  const [ax, ay] = [0.3, 0.52]
  const [bx, by] = [0.44, 0.66]
  const [cx, cy] = [0.72, 0.36]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0
      let mark = 0

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) / samples
          const py = y + (sy + 0.5) / samples

          // Rounded square: distance to the inset box minus the corner radius.
          const dx = Math.max(Math.abs(px - inset) - (inset - corner), 0)
          const dy = Math.max(Math.abs(py - inset) - (inset - corner), 0)
          if (Math.hypot(dx, dy) <= corner) cover++

          const d = Math.min(
            segmentDistance(px, py, ax * size, ay * size, bx * size, by * size),
            segmentDistance(px, py, bx * size, by * size, cx * size, cy * size),
          )
          if (d <= stroke / 2) mark++
        }
      }

      const total = samples * samples
      const alpha = Math.round((cover / total) * 255)
      // Blend the mark over the plate, then the plate over transparency.
      const mix = cover === 0 ? 0 : mark / cover
      const offset = (y * size + x) * 4
      for (let channel = 0; channel < 3; channel++) {
        pixels[offset + channel] = Math.round(WHITE[channel] * mix + ACCENT[channel] * (1 - mix))
      }
      pixels[offset + 3] = alpha
    }
  }

  return pixels
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

/** @param {Buffer} buffer */
function crc32(buffer) {
  let c = -1
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

/**
 * @param {string} type
 * @param {Buffer} data
 */
function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/**
 * @param {Buffer} pixels
 * @param {number} size
 */
function encodePng(pixels, size) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  // 10..12 stay zero: deflate, adaptive filtering, no interlace.

  // One filter byte (0 = None) in front of every scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const images = SIZES.map((size) => encodePng(renderIcon(size), size))

// ICONDIR, one ICONDIRENTRY per image, then the PNG payloads back to back.
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(images.length, 4)

const directory = Buffer.alloc(16 * images.length)
let offset = header.length + directory.length
images.forEach((png, index) => {
  const at = index * 16
  directory[at] = SIZES[index] >= 256 ? 0 : SIZES[index]
  directory[at + 1] = SIZES[index] >= 256 ? 0 : SIZES[index]
  directory[at + 2] = 0 // palette size
  directory[at + 3] = 0 // reserved
  directory.writeUInt16LE(1, at + 4) // colour planes
  directory.writeUInt16LE(32, at + 6) // bits per pixel
  directory.writeUInt32LE(png.length, at + 8)
  directory.writeUInt32LE(offset, at + 12)
  offset += png.length
})

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, Buffer.concat([header, directory, ...images]))
console.log(`wrote ${OUTPUT} (${SIZES.length} sizes)`)
