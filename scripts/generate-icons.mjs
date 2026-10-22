import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const SIZE = 512
const ICO_SIZE = 256

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function roundedRectCoverage(x, y, size, radius) {
  const inset = 0.5
  const left = inset
  const top = inset
  const right = size - inset
  const bottom = size - inset
  const cx = Math.min(Math.max(x, left + radius), right - radius)
  const cy = Math.min(Math.max(y, top + radius), bottom - radius)
  const dx = x - cx
  const dy = y - cy
  const distance = Math.sqrt(dx * dx + dy * dy)
  if (distance <= radius) {
    const inside = x >= left && x <= right && y >= top && y <= bottom
    return inside ? 1 : 0
  }
  return Math.max(0, 1 - (distance - radius))
}

function renderPng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const radius = size * 0.225
  const circleRadius = size * 0.17
  const center = size / 2

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
    for (let x = 0; x < size; x += 1) {
      const offset = rowStart + 1 + x * 4
      const ny = y / size

      const r = Math.round(239 - 100 * ny)
      const g = Math.round(68 - 20 * ny)
      const b = Math.round(68 - 20 * ny)
      const a = Math.round(roundedRectCoverage(x, y, size, radius) * 255)

      let rr = r
      let gg = g
      let bb = b
      let alpha = a

      const distance = Math.hypot(x - center, y - center)
      if (distance <= circleRadius) {
        rr = 255
        gg = 255
        bb = 255
      } else if (distance <= circleRadius + size * 0.012) {
        const blend = Math.min(1, (circleRadius + size * 0.012 - distance) / (size * 0.012))
        rr = Math.round(rr + (255 - rr) * blend)
        gg = Math.round(gg + (255 - gg) * blend)
        bb = Math.round(bb + (255 - bb) * blend)
      }

      raw[offset] = rr
      raw[offset + 1] = gg
      raw[offset + 2] = bb
      raw[offset + 3] = alpha
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function buildIco(pngBuffer) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)

  const entry = Buffer.alloc(16)
  entry[0] = 0
  entry[1] = 0
  entry[2] = 0
  entry[3] = 0
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(pngBuffer.length, 8)
  entry.writeUInt32LE(22, 12)

  return Buffer.concat([header, entry, pngBuffer])
}

mkdirSync('build', { recursive: true })
writeFileSync('build/icon.png', renderPng(SIZE))
writeFileSync('build/icon.ico', buildIco(renderPng(ICO_SIZE)))
console.log('Iconos generados: build/icon.png y build/icon.ico')
