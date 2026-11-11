/**
 * Local audio discovery + metadata parsing (main process only).
 * Only reads files the user explicitly picks. No network access.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { parseFile } from 'music-metadata'
import type { SongInput } from '../shared/types'

export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'flac', 'wav', 'ogg', 'aac'] as const

export function isAudioFile(filePath: string): boolean {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  return (AUDIO_EXTENSIONS as readonly string[]).includes(ext)
}

/** Expand user-picked files/folders into audio file paths (recursive for folders). */
export function collectAudioFiles(entries: string[]): string[] {
  const out: string[] = []
  const visit = (entry: string, isTopLevel: boolean): void => {
    let stat: fs.Stats
    try {
      stat = fs.statSync(entry)
    } catch {
      if (isTopLevel) throw new Error(`Path not found: ${entry}`)
      return
    }
    if (stat.isFile()) {
      if (isAudioFile(entry)) out.push(entry)
      return
    }
    if (!stat.isDirectory()) return
    let children: fs.Dirent[]
    try {
      children = fs.readdirSync(entry, { withFileTypes: true })
    } catch {
      if (isTopLevel) throw new Error(`Cannot read folder: ${entry}`)
      return
    }
    for (const child of children) {
      if (!child.isFile() && !child.isDirectory()) continue
      visit(path.join(entry, child.name), false)
    }
  }
  for (const entry of entries) visit(entry, true)
  return out
}

function coverFileName(filePath: string, format: string): string {
  const hash = createHash('sha1').update(filePath).digest('hex')
  const subtype = format.split('/')[1]?.toLowerCase() ?? 'jpg'
  const ext = subtype === 'jpeg' ? 'jpg' : subtype.replace(/[^a-z0-9]/g, '') || 'jpg'
  return `${hash}.${ext}`
}

/** Stream a SHA-256 hash of the file for the duplicate finder. */
export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', reject)
    hash.on('error', reject)
    hash.on('finish', () => {
      try {
        resolve(hash.digest('hex'))
      } catch (err) {
        reject(err)
      }
    })
    stream.pipe(hash)
  })
}

/** Clean "Artist - Title" style fallbacks out of a bare filename. */
export function fallbackFromFilename(filePath: string): { title: string; artist: string } {
  const base = path.basename(filePath, path.extname(filePath)).trim()
  const separator = base.includes(' - ') ? ' - ' : base.includes('-') ? '-' : null
  if (separator) {
    const [first, ...rest] = base.split(separator)
    const artist = first.trim()
    const title = rest.join(separator).trim()
    if (artist && title) return { title, artist }
  }
  return { title: base || 'Unknown Title', artist: 'Unknown Artist' }
}

/**
 * Parse one audio file into a DB-ready record, caching embedded cover art
 * under coversDir and hashing the file for duplicate detection.
 * Throws when the file cannot be parsed.
 */
export async function parseSong(filePath: string, coversDir: string): Promise<SongInput> {
  let metadata
  try {
    metadata = await parseFile(filePath, { duration: true })
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Unsupported or corrupt audio file.')
  }
  const { common, format } = metadata
  const fallback = fallbackFromFilename(filePath)

  let coverPath: string | null = null
  const pictures = common.picture ?? []
  if (pictures.length > 0) {
    const picture = pictures[0]
    const fileName = coverFileName(filePath, picture.format)
    fs.mkdirSync(coversDir, { recursive: true })
    const dest = path.join(coversDir, fileName)
    if (!fs.existsSync(dest)) {
      fs.writeFileSync(dest, picture.data)
    }
    coverPath = dest
  }

  let fileHash: string | null = null
  try {
    fileHash = await hashFile(filePath)
  } catch {
    fileHash = null
  }

  return {
    title: common.title ?? fallback.title,
    artist: common.artist ?? fallback.artist,
    album: common.album ?? 'Unknown Album',
    genre: common.genre?.[0] ?? null,
    year: common.year ?? null,
    duration: typeof format.duration === 'number' && Number.isFinite(format.duration) ? format.duration : 0,
    filePath,
    coverPath,
    fileHash
  }
}
