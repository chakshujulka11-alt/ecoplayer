/**
 /** Generates build/icon.png (256x256) and build/icon.ico from scratch.
  * Pure Node.js, no image dependencies: minimal PNG writer + ICO container.
  * Design: Eco Player — flat zinc minimal. Dark rounded square (2px radius),
  * green disc, white play triangle. Sharp corners, solid colors, no gradients.
  */
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const SIZE = 256

function crc32Table() {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
}
const CRC_TABLE = crc32Table()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(rgba) {
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0
    Buffer.from(rgba.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function paint() {
  const px = new Uint8ClampedArray(SIZE * SIZE * 4)
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
    const i = (y * SIZE + x) * 4
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
    px[i + 3] = a
  }
  const cx = SIZE / 2
  const cy = SIZE / 2
  // Dark rounded-square background (#18181b).
  const radius = 56
  const half = SIZE / 2
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = Math.max(Math.abs(x - cx) - (half - radius), 0)
      const dy = Math.max(Math.abs(y - cy) - (half - radius), 0)
      if (dx * dx + dy * dy <= radius * radius) set(x, y, 24, 24, 27)
    }
  }
  // Green disc (#22c55e — the eco accent).
  const discR = 74
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= discR * discR) {
        const shade = 1 - (Math.sqrt(dx * dx + dy * dy) / discR) * 0.18
        set(x, y, Math.round(34 * shade), Math.round(197 * shade), Math.round(94 * shade))
      }
    }
  }
  // White play triangle.
  const ax = cx - 26
  const bx = cx + 34
  const top = cy - 34
  const bottom = cy + 34
  for (let y = Math.floor(top); y <= Math.ceil(bottom); y++) {
    const t = (y - top) / (bottom - top)
    const left = ax
    const right = ax + (bx - ax) * (1 - Math.abs(t - 0.5) * 2)
    for (let x = Math.floor(left); x <= Math.ceil(right); x++) set(x, y, 255, 255, 255)
  }
  return px
}

function main() {
  const dir = path.resolve(__dirname, '..', 'build')
  fs.mkdirSync(dir, { recursive: true })
  const png = encodePng(paint())
  fs.writeFileSync(path.join(dir, 'icon.png'), png)
  // ICO with a single PNG-compressed 256x256 entry (Vista+ compatible).
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry[0] = 0 // 256px
  entry[1] = 0
  entry[2] = 0
  entry[3] = 0
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(6 + 16, 12)
  fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([header, entry, png]))
  console.log(`icon written: ${png.length} byte PNG, build/icon.ico ready`)
}

main()
