/**
 * `window.api` implementation for the web/Android build (no Electron preload).
 * Same IpcResult contract as the desktop bridge; storage/files are web APIs.
 */
import { parseBuffer } from 'music-metadata'
import { enableWebMediaMode } from '../../shared/media'
import type {
  AppSettings,
  DuplicateCandidates,
  ImportProgress,
  IpcResult,
  Playlist,
  PlaylistWithCount,
  RendererApi,
  ScanSummary,
  UpdateSongMetadata
} from '../../shared/types'
import {
  addWebSongToPlaylist,
  createWebPlaylist,
  deleteWebPlaylist,
  deleteWebSong,
  getAllSongs,
  getSongById,
  getWebDuplicateCandidates,
  getWebHistorySince,
  getWebPlaylistSongs,
  listWebPlaylists,
  readWebSettings,
  recordWebPlay,
  removeWebSongFromPlaylist,
  renameWebPlaylist,
  reorderWebPlaylistSongs,
  resetWebDatabase,
  setWebPlaylistCover,
  toggleWebFavorite,
  updateWebSongCover,
  updateWebSongMeta,
  upsertWebSong,
  writeWebSettings,
  type WebSongInput
} from './db'

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function fail(error: unknown): IpcResult<never> {
  return { ok: false, error: error instanceof Error ? error.message : 'Unknown error.' }
}

async function bridge<T>(run: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return ok(await run())
  } catch (err) {
    return fail(err)
  }
}

/* ------------------------------------------------------------------ */
/* Picked-file registry                                                */
/* ------------------------------------------------------------------ */

const fileGroups = new Map<string, File[]>()
let groupCounter = 0

function registerFiles(files: File[]): string {
  groupCounter += 1
  const key = `web-files-${groupCounter}`
  fileGroups.set(key, files)
  return key
}

function filesForKeys(keys: string[]): File[] {
  const files: File[] = []
  for (const key of keys) {
    const group = fileGroups.get(key)
    if (!group) throw new Error('Import selection expired. Pick the files again.')
    files.push(...group)
  }
  return files
}

function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    if (multiple) input.multiple = true
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? [])
      input.remove()
      resolve(files)
    })
    input.addEventListener('cancel', () => {
      input.remove()
      resolve([])
    })
    document.body.appendChild(input)
    input.click()
  })
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image.'))
    reader.readAsDataURL(file)
  })
}

/* ------------------------------------------------------------------ */
/* Progress + drop subscriptions                                       */
/* ------------------------------------------------------------------ */

let nextSubscriptionId = 1
const progressSubscriptions = new Map<number, (progress: ImportProgress) => void>()
const dropSubscriptions = new Map<number, (paths: string[]) => void>()
let dropListenersAttached = false

function emitProgress(summary: ScanSummary, current: string, done: boolean, total: number): void {
  const progress: ImportProgress = {
    total,
    processed: summary.scanned,
    added: summary.added,
    updated: summary.updated,
    skipped: summary.skipped,
    current,
    done
  }
  for (const callback of progressSubscriptions.values()) {
    try {
      callback(progress)
    } catch {
      // A renderer callback must never break the bridge.
    }
  }
}

function attachDropListeners(): void {
  if (dropListenersAttached) return
  dropListenersAttached = true
  window.addEventListener('dragover', (event) => {
    event.preventDefault()
  })
  window.addEventListener('drop', (event) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.size > 0)
    if (files.length === 0 || dropSubscriptions.size === 0) return
    const key = registerFiles(files)
    for (const callback of dropSubscriptions.values()) {
      try {
        callback([key])
      } catch {
        // A renderer callback must never break the bridge.
      }
    }
  })
}

/* ------------------------------------------------------------------ */
/* Audio parsing (browser: parseBuffer over an in-memory copy)         */
/* ------------------------------------------------------------------ */

function fallbackFromFilename(fileName: string): { title: string; artist: string } {
  const base = fileName.replace(/\.[^.]+$/, '').trim()
  const separator = base.includes(' - ') ? ' - ' : base.includes('-') ? '-' : null
  if (separator) {
    const [first, ...rest] = base.split(separator)
    const artist = first.trim()
    const title = rest.join(separator).trim()
    if (artist && title) return { title, artist }
  }
  return { title: base || 'Unknown Title', artist: 'Unknown Artist' }
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return hex
}

async function parseWebFile(file: File): Promise<WebSongInput> {
  const buffer = await file.arrayBuffer()
  let fileHash: string | null = null
  try {
    fileHash = toHex(await crypto.subtle.digest('SHA-256', buffer))
  } catch {
    fileHash = null
  }
  let parsed
  try {
    parsed = await parseBuffer(new Uint8Array(buffer), undefined, { duration: true })
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Unsupported or corrupt audio file.')
  }
  const common = parsed.common
  const fallback = fallbackFromFilename(file.name)
  const picture = common.picture?.[0]
  const coverBlob = picture ? new Blob([new Uint8Array(picture.data)], { type: picture.format || 'image/jpeg' }) : null
  return {
    title: common.title ?? fallback.title,
    artist: common.artist ?? fallback.artist,
    album: common.album ?? 'Unknown Album',
    genre: common.genre?.[0] ?? null,
    year: common.year ?? null,
    duration:
      typeof parsed.format.duration === 'number' && Number.isFinite(parsed.format.duration)
        ? parsed.format.duration
        : 0,
    filePath: fileHash ?? `${file.name}::${file.size}`,
    fileHash,
    audioBlob: file,
    coverBlob
  }
}

async function scanFiles(files: File[]): Promise<ScanSummary> {
  const summary: ScanSummary = { scanned: 0, added: 0, updated: 0, skipped: 0, errors: [] }
  let lastEmit = 0
  for (const file of files) {
    summary.scanned += 1
    try {
      const input = await parseWebFile(file)
      const { status } = await upsertWebSong(input)
      if (status === 'added') summary.added += 1
      else summary.updated += 1
    } catch (err) {
      summary.skipped += 1
      summary.errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Unreadable file.'}`)
    }
    const now = Date.now()
    if (now - lastEmit > 150 || summary.scanned === files.length) {
      lastEmit = now
      emitProgress(summary, file.name, false, files.length)
    }
  }
  emitProgress(summary, '', true, files.length)
  return summary
}

/* ------------------------------------------------------------------ */
/* The bridge                                                          */
/* ------------------------------------------------------------------ */

const webApi: RendererApi = {
  pickAudioFiles: () =>
    bridge(async () => {
      const files = await pickFiles('audio/*', true)
      if (files.length === 0) return []
      return [registerFiles(files)]
    }),
  pickFolder: () =>
    bridge(async () => {
      // Folder handles do not exist on the web; multi-file pick is the equivalent.
      const files = await pickFiles('audio/*', true)
      if (files.length === 0) return null
      return registerFiles(files)
    }),
  scanPaths: (paths: string[]) => bridge(() => scanFiles(filesForKeys(paths))),
  scanFolder: (folder: string) => bridge(() => scanFiles(filesForKeys([folder]))),
  onImportProgress: (callback: (progress: ImportProgress) => void) => {
    const id = nextSubscriptionId
    nextSubscriptionId += 1
    progressSubscriptions.set(id, callback)
    return id
  },
  offImportProgress: (subscriptionId: number) => {
    progressSubscriptions.delete(subscriptionId)
  },
  onFilesDropped: (callback: (paths: string[]) => void) => {
    attachDropListeners()
    const id = nextSubscriptionId
    nextSubscriptionId += 1
    dropSubscriptions.set(id, callback)
    return id
  },
  offFilesDropped: (subscriptionId: number) => {
    dropSubscriptions.delete(subscriptionId)
  },
  getSongs: () => bridge(() => getAllSongs()),
  searchSongs: (query: string, limit?: number) =>
    bridge(async () => {
      const trimmed = query.trim().toLowerCase()
      const songs = await getAllSongs()
      if (!trimmed) return songs
      const matches = songs.filter(
        (song) =>
          song.title.toLowerCase().includes(trimmed) ||
          song.artist.toLowerCase().includes(trimmed) ||
          song.album.toLowerCase().includes(trimmed) ||
          (song.genre ?? '').toLowerCase().includes(trimmed)
      )
      const safeLimit =
        typeof limit === 'number' && Number.isFinite(limit) ? Math.min(500, Math.max(1, Math.floor(limit))) : 100
      return matches
        .sort((a, b) => b.playCount - a.playCount || a.title.localeCompare(b.title))
        .slice(0, safeLimit)
    }),
  getRecentlyAdded: (limit?: number) =>
    bridge(async () => {
      const songs = await getAllSongs()
      const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.min(500, Math.max(1, Math.floor(limit))) : 50
      return songs
        .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded) || b.id - a.id)
        .slice(0, safeLimit)
    }),
  getMostPlayed: (limit?: number) =>
    bridge(async () => {
      const songs = await getAllSongs()
      const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.min(500, Math.max(1, Math.floor(limit))) : 50
      return songs
        .sort(
          (a, b) =>
            b.playCount - a.playCount ||
            (b.lastPlayed ?? '').localeCompare(a.lastPlayed ?? '') ||
            a.title.localeCompare(b.title)
        )
        .slice(0, safeLimit)
    }),
  getTopSongsByPeriod: (days: number, limit?: number) =>
    bridge(async () => {
      const safeDays =
        typeof days === 'number' && Number.isFinite(days) ? Math.min(3650, Math.max(1, Math.floor(days))) : 30
      const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString()
      const history = await getWebHistorySince(cutoff)
      const plays = new Map<number, number>()
      for (const entry of history) {
        plays.set(entry.songId, (plays.get(entry.songId) ?? 0) + 1)
      }
      const songs = await getAllSongs()
      const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.min(500, Math.max(1, Math.floor(limit))) : 50
      return songs
        .filter((song) => plays.has(song.id))
        .sort(
          (a, b) =>
            (plays.get(b.id) ?? 0) - (plays.get(a.id) ?? 0) ||
            b.playCount - a.playCount ||
            a.title.localeCompare(b.title)
        )
        .slice(0, safeLimit)
    }),
  getDuplicateCandidates: () => bridge(async (): Promise<DuplicateCandidates> => getWebDuplicateCandidates()),
  removeSong: (id: number) =>
    bridge(async () => {
      if (!(await deleteWebSong(id))) throw new Error('Song not found.')
    }),
  pickSongCover: (id: number) =>
    bridge(async () => {
      const song = await getSongById(id)
      if (!song) throw new Error('Song not found.')
      const files = await pickFiles('image/jpeg,image/png,image/webp', false)
      if (files.length === 0) return null
      const file = files[0]
      if (!file) return null
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'image/jpeg' })
      return updateWebSongCover(id, blob)
    }),
  updateSongMetadata: (id: number, patch: UpdateSongMetadata) => bridge(() => updateWebSongMeta(id, patch)),
  toggleFavorite: (id: number) => bridge(() => toggleWebFavorite(id)),
  recordPlay: (id: number) => bridge(() => recordWebPlay(id)),
  listPlaylists: () => bridge(async (): Promise<PlaylistWithCount[]> => listWebPlaylists()),
  createPlaylist: (name: string) => bridge(async (): Promise<Playlist> => createWebPlaylist(name)),
  renamePlaylist: (id: number, name: string) => bridge(() => renameWebPlaylist(id, name)),
  deletePlaylist: (id: number) => bridge(() => deleteWebPlaylist(id)),
  addSongToPlaylist: (playlistId: number, songId: number) => bridge(() => addWebSongToPlaylist(playlistId, songId)),
  removeSongFromPlaylist: (playlistId: number, songId: number) =>
    bridge(() => removeWebSongFromPlaylist(playlistId, songId)),
  reorderPlaylistSongs: (playlistId: number, orderedSongIds: number[]) =>
    bridge(() => reorderWebPlaylistSongs(playlistId, orderedSongIds)),
  setPlaylistCover: (playlistId: number) =>
    bridge(async () => {
      const files = await pickFiles('image/jpeg,image/png,image/webp,image/gif,image/bmp', false)
      if (files.length === 0) return
      const file = files[0]
      if (!file) return
      await setWebPlaylistCover(playlistId, await fileToDataUrl(file))
    }),
  clearPlaylistCover: (playlistId: number) => bridge(() => setWebPlaylistCover(playlistId, null)),
  getPlaylistSongs: (playlistId: number) => bridge(() => getWebPlaylistSongs(playlistId)),
  getSettings: () => bridge(async (): Promise<AppSettings> => readWebSettings()),
  updateSettings: (patch: Partial<AppSettings>) => bridge(async () => writeWebSettings(patch)),
  setBackgroundImage: () =>
    bridge(async () => {
      const files = await pickFiles('image/jpeg,image/png,image/webp,image/gif,image/bmp', false)
      if (files.length === 0) return readWebSettings()
      const file = files[0]
      if (!file) return readWebSettings()
      return writeWebSettings({ backgroundImage: await fileToDataUrl(file), backgroundPreset: null })
    }),
  clearBackgroundImage: () =>
    bridge(async () => writeWebSettings({ backgroundImage: null, backgroundPreset: 'none' })),
  moveSongToTrash: (id: number) =>
    bridge(async () => {
      // Android/web has no OS trash: removing deletes the library entry only.
      if (!(await deleteWebSong(id))) throw new Error('Song not found.')
    }),
  resetDatabase: () =>
    bridge(async () => {
      await resetWebDatabase()
      window.location.reload()
    })
}

export function installWebApi(): void {
  enableWebMediaMode()
  ;(window as unknown as { api: RendererApi }).api = webApi
  attachDropListeners()
}
