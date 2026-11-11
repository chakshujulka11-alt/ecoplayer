/**
 * Custom `media://` protocol serving local audio files and cover images
 * to the sandboxed renderer. Supports HTTP Range requests so seeking works.
 */
import { protocol } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { getDatabase } from '../db/connection'
import { MEDIA_AUDIO_HOST, MEDIA_COVER_HOST, MEDIA_SCHEME } from '../shared/media'

// Must run before app.ready(). Module top-level executes on import from main.
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
  }
])

const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg; codecs=opus',
  wav: 'audio/wav',
  aac: 'audio/aac',
  wma: 'audio/x-ms-wma',
  aiff: 'audio/aiff',
  aif: 'audio/aiff',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Max-Age': '86400'
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { ...CORS_HEADERS } })
}

function parseRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null
  let start = match[1] === '' ? Number.NaN : Number(match[1])
  let end = match[2] === '' ? Number.NaN : Number(match[2])
  if (Number.isNaN(start) && Number.isNaN(end)) return null
  if (Number.isNaN(start)) {
    start = size - end
    end = size - 1
  }
  if (Number.isNaN(end)) end = size - 1
  if (start < 0 || end < start || start >= size) return null
  return { start, end: Math.min(end, size - 1) }
}

async function serveFile(
  request: Request,
  filePath: string,
  fallbackMime: string,
  cacheControl?: string
): Promise<Response> {
  let stat: fs.Stats
  try {
    stat = await fs.promises.stat(filePath)
  } catch {
    return notFound()
  }
  if (!stat.isFile()) return notFound()
  const size = stat.size
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const mime = MIME_BY_EXT[ext] ?? fallbackMime

  const extraHeaders: Record<string, string> = cacheControl ? { 'Cache-Control': cacheControl } : {}
  const rangeHeader = request.headers.get('range')
  if (!rangeHeader) {
    try {
      const body = Readable.toWeb(fs.createReadStream(filePath)) as unknown as BodyInit
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(size),
          'Accept-Ranges': 'bytes',
          ...CORS_HEADERS,
          ...extraHeaders
        }
      })
    } catch {
      return new Response('Read error', { status: 500, headers: { ...CORS_HEADERS } })
    }
  }

  const range = parseRange(rangeHeader, size)
  if (!range) {
    return new Response('Range not satisfiable', {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}`, ...CORS_HEADERS }
    })
  }
  try {
    const body = Readable.toWeb(fs.createReadStream(filePath, { start: range.start, end: range.end })) as unknown as BodyInit
    return new Response(body, {
      status: 206,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(range.end - range.start + 1),
        'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
        'Accept-Ranges': 'bytes',
        ...CORS_HEADERS
      }
    })
  } catch {
    return new Response('Read error', { status: 500, headers: { ...CORS_HEADERS } })
  }
}

async function serveAudio(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (url.host !== MEDIA_AUDIO_HOST) return notFound()
  const filePath = decodeURIComponent(url.pathname.slice(1))
  return serveFile(request, filePath, 'application/octet-stream')
}

async function serveCover(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (url.host !== MEDIA_COVER_HOST) return notFound()
  const id = Number(url.pathname.slice(1))
  if (!Number.isInteger(id) || id <= 0) {
    return new Response('Bad request', { status: 400, headers: { ...CORS_HEADERS } })
  }
  const row = getDatabase().prepare('SELECT cover_path FROM songs WHERE id = ?').get(id) as
    | { cover_path: string | null }
    | undefined
  if (!row?.cover_path) return notFound()
  // Never cache covers: replacing art reuses the same media://cover/<id> URL.
  return serveFile(request, row.cover_path, 'image/jpeg', 'no-store')
}

export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { ...CORS_HEADERS } })
      }
      const url = new URL(request.url)
      if (url.host === MEDIA_AUDIO_HOST) return await serveAudio(request)
      if (url.host === MEDIA_COVER_HOST) return await serveCover(request)
      return notFound()
    } catch {
      return new Response('Bad request', { status: 400, headers: { ...CORS_HEADERS } })
    }
  })
}
