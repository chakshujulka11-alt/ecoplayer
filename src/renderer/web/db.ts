/**
 * IndexedDB-backed library store for the web/Android build.
 * Mirrors the desktop SQL layer (src/db/*) behavior with no Node APIs:
 * songs, playlists, ordering, play history, and settings.
 */
import {
  cacheWebObjectUrl,
  clearWebObjectUrls,
  peekWebObjectUrl,
  revokeWebObjectUrl
} from '../../shared/media'
import type {
  AppSettings,
  DuplicateCandidates,
  DuplicateGroup,
  Playlist,
  PlaylistWithCount,
  Song,
  UpdateSongMetadata
} from '../../shared/types'

const DB_NAME = 'ecoplayer'
const DB_VERSION = 1

export interface WebSongRow {
  id?: number
  title: string
  artist: string
  album: string
  genre: string | null
  year: number | null
  duration: number
  /** Stable dedupe key: content hash when available, else name+size. */
  filePath: string
  dateAdded: string
  playCount: number
  lastPlayed: string | null
  isFavorite: boolean
  rating: number
  fileHash: string | null
  audioBlob: Blob
  coverBlob: Blob | null
}

export interface WebSongInput {
  title: string
  artist: string
  album: string
  genre: string | null
  year: number | null
  duration: number
  filePath: string
  fileHash: string | null
  audioBlob: Blob
  coverBlob: Blob | null
}

interface WebPlaylistRow {
  id?: number
  name: string
  description: string
  coverPath: string | null
  createdAt: string
  updatedAt: string
}

interface WebPlaylistSongRow {
  playlistId: number
  songId: number
  position: number
}

interface WebHistoryRow {
  id?: number
  songId: number
  playedAt: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('songs')) {
        const songs = db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true })
        songs.createIndex('filePath', 'filePath', { unique: true })
        songs.createIndex('fileHash', 'fileHash')
      }
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('playlistSongs')) {
        const links = db.createObjectStore('playlistSongs', { keyPath: ['playlistId', 'songId'] })
        links.createIndex('playlistId', 'playlistId')
        links.createIndex('songId', 'songId')
      }
      if (!db.objectStoreNames.contains('history')) {
        const history = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true })
        history.createIndex('songId', 'songId')
        history.createIndex('playedAt', 'playedAt')
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the local database.'))
    request.onblocked = () => reject(new Error('The local database is locked by another window.'))
  })
  return dbPromise
}

function requestAs<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Database transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Database transaction aborted.'))
  })
}

async function getAllRows<T>(storeName: string): Promise<T[]> {
  const db = await openDb()
  const rows = await requestAs(db.transaction(storeName).objectStore(storeName).getAll())
  return rows as T[]
}

/** Object URL for a song's audio; reused for the lifetime of the row. */
const audioUrls = new Map<number, string>()

function audioUrlFor(id: number, blob: Blob): string {
  const existing = audioUrls.get(id)
  if (existing) return existing
  const url = URL.createObjectURL(blob)
  audioUrls.set(id, url)
  return url
}

function coverUrlFor(id: number, blob: Blob): string {
  const key = `cover:${id}`
  const existing = peekWebObjectUrl(key)
  if (existing) return existing
  const url = URL.createObjectURL(blob)
  cacheWebObjectUrl(key, url)
  return url
}

function releaseSongUrls(id: number): void {
  const audio = audioUrls.get(id)
  if (audio) {
    URL.revokeObjectURL(audio)
    audioUrls.delete(id)
  }
  revokeWebObjectUrl(`cover:${id}`)
}

function toSong(row: WebSongRow): Song {
  const id = row.id as number
  return {
    id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    genre: row.genre,
    year: row.year,
    duration: row.duration,
    // On web the "file path" is a playable blob URL.
    filePath: row.audioBlob ? audioUrlFor(id, row.audioBlob) : '',
    coverPath: row.coverBlob ? coverUrlFor(id, row.coverBlob) : null,
    dateAdded: row.dateAdded,
    playCount: row.playCount,
    lastPlayed: row.lastPlayed,
    isFavorite: row.isFavorite,
    rating: row.rating,
    fileHash: row.fileHash
  }
}

export async function getAllSongs(): Promise<Song[]> {
  const rows = await getAllRows<WebSongRow>('songs')
  return rows
    .filter((row) => row.id !== undefined)
    .map(toSong)
    .sort(
      (a, b) =>
        a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || a.title.localeCompare(b.title)
    )
}

export async function getSongById(id: number): Promise<Song | null> {
  const db = await openDb()
  const row = (await requestAs(db.transaction('songs').objectStore('songs').get(id))) as WebSongRow | undefined
  return row && row.id !== undefined ? toSong(row) : null
}

export async function upsertWebSong(input: WebSongInput): Promise<{ id: number; status: 'added' | 'updated' }> {
  const db = await openDb()
  const store = db.transaction('songs').objectStore('songs')
  const existing = (await requestAs(store.index('filePath').get(input.filePath))) as WebSongRow | undefined
  if (existing && existing.id !== undefined) {
    const updated: WebSongRow = {
      ...existing,
      title: input.title,
      artist: input.artist,
      album: input.album,
      genre: input.genre,
      year: input.year,
      duration: input.duration,
      fileHash: input.fileHash,
      audioBlob: input.audioBlob,
      coverBlob: input.coverBlob ?? existing.coverBlob
    }
    const put = db.transaction('songs', 'readwrite').objectStore('songs').put(updated)
    await transactionDone(put.transaction as IDBTransaction)
    if (input.audioBlob !== existing.audioBlob) {
      const stale = audioUrls.get(existing.id)
      if (stale) {
        URL.revokeObjectURL(stale)
        audioUrls.delete(existing.id)
      }
    }
    return { id: existing.id, status: 'updated' }
  }
  const now = new Date().toISOString()
  const row: WebSongRow = {
    ...input,
    dateAdded: now,
    playCount: 0,
    lastPlayed: null,
    isFavorite: false,
    rating: 0
  }
  const add = db.transaction('songs', 'readwrite').objectStore('songs').add(row)
  const id = (await transactionDone(add.transaction as IDBTransaction).then(() => add.result)) as number
  return { id, status: 'added' }
}

export async function deleteWebSong(id: number): Promise<boolean> {
  const db = await openDb()
  let existed = false
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['songs', 'history', 'playlistSongs'], 'readwrite')
    const songs = tx.objectStore('songs')
    const getReq = songs.get(id)
    getReq.onsuccess = () => {
      const row = getReq.result as WebSongRow | undefined
      if (!row) return
      existed = true
      songs.delete(id)
      const historyReq = tx.objectStore('history').index('songId').getAll(id)
      historyReq.onsuccess = () => {
        for (const entry of historyReq.result as WebHistoryRow[]) {
          if (entry.id !== undefined) tx.objectStore('history').delete(entry.id)
        }
      }
      const linksReq = tx.objectStore('playlistSongs').index('songId').getAll(id)
      linksReq.onsuccess = () => {
        for (const link of linksReq.result as WebPlaylistSongRow[]) {
          tx.objectStore('playlistSongs').delete([link.playlistId, link.songId])
        }
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Database transaction failed.'))
    tx.onabort = () => reject(tx.error ?? new Error('Database transaction aborted.'))
  })
  if (existed) releaseSongUrls(id)
  return existed
}

async function mutateSong(id: number, mutate: (row: WebSongRow) => WebSongRow): Promise<Song> {
  const db = await openDb()
  const row = (await new Promise<WebSongRow | undefined>((resolve, reject) => {
    const tx = db.transaction('songs', 'readwrite')
    const store = tx.objectStore('songs')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const current = getReq.result as WebSongRow | undefined
      if (!current) {
        reject(new Error('Song not found.'))
        tx.abort()
        return
      }
      store.put(mutate(current))
    }
    tx.oncomplete = () => resolve((getReq.result as WebSongRow | undefined) ?? undefined)
    tx.onerror = () => reject(tx.error ?? new Error('Database transaction failed.'))
    tx.onabort = () => reject(tx.error ?? new Error('Database transaction aborted.'))
  })) as WebSongRow | undefined
  if (!row) throw new Error('Song not found.')
  return toSong(row)
}

export async function updateWebSongMeta(id: number, patch: UpdateSongMetadata): Promise<Song> {
  const title = patch.title.trim()
  const artist = patch.artist.trim()
  const album = patch.album.trim()
  if (!title) throw new Error('Title must not be empty.')
  if (!artist) throw new Error('Artist must not be empty.')
  if (!album) throw new Error('Album must not be empty.')
  if (title.length > 300 || artist.length > 300 || album.length > 300) {
    throw new Error('Metadata values are too long.')
  }
  const genre = patch.genre?.trim() ? patch.genre.trim().slice(0, 120) : null
  const year = patch.year === null || patch.year === undefined ? null : patch.year
  if (year !== null && (!Number.isInteger(year) || year < 0 || year > 3000)) {
    throw new Error('Year must be empty or a valid year.')
  }
  return mutateSong(id, (row) => ({ ...row, title, artist, album, genre, year }))
}

export async function updateWebSongCover(id: number, coverBlob: Blob): Promise<Song> {
  const song = await mutateSong(id, (row) => ({ ...row, coverBlob }))
  // The old cover URL is stale; the next render creates a fresh one.
  revokeWebObjectUrl(`cover:${id}`)
  return song
}

export async function toggleWebFavorite(id: number): Promise<Song> {
  return mutateSong(id, (row) => ({ ...row, isFavorite: !row.isFavorite }))
}

export async function recordWebPlay(id: number): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['songs', 'history'], 'readwrite')
    const songs = tx.objectStore('songs')
    const getReq = songs.get(id)
    getReq.onsuccess = () => {
      const row = getReq.result as WebSongRow | undefined
      if (!row) {
        reject(new Error('Song not found.'))
        tx.abort()
        return
      }
      const now = new Date().toISOString()
      songs.put({ ...row, playCount: row.playCount + 1, lastPlayed: now })
      tx.objectStore('history').add({ songId: id, playedAt: now } satisfies WebHistoryRow)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Database transaction failed.'))
    tx.onabort = () => reject(tx.error ?? new Error('Database transaction aborted.'))
  })
}

export async function getWebHistorySince(cutoffIso: string): Promise<WebHistoryRow[]> {
  const db = await openDb()
  const rows = await requestAs(
    db.transaction('history').objectStore('history').index('playedAt').getAll(IDBKeyRange.lowerBound(cutoffIso))
  )
  return rows as WebHistoryRow[]
}

export async function listWebPlaylists(): Promise<PlaylistWithCount[]> {
  const [playlists, links] = await Promise.all([
    getAllRows<WebPlaylistRow>('playlists'),
    getAllRows<WebPlaylistSongRow>('playlistSongs')
  ])
  const byPlaylist = new Map<number, WebPlaylistSongRow[]>()
  for (const link of links) {
    const list = byPlaylist.get(link.playlistId) ?? []
    list.push(link)
    byPlaylist.set(link.playlistId, list)
  }
  return playlists
    .filter((row): row is WebPlaylistRow & { id: number } => row.id !== undefined)
    .map((row) => {
      const own = (byPlaylist.get(row.id) ?? []).sort((a, b) => a.position - b.position)
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        coverPath: row.coverPath,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        songCount: own.length,
        autoCoverSongId: own[0]?.songId ?? null
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createWebPlaylist(name: string): Promise<Playlist> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Playlist name must not be empty.')
  if (trimmed.length > 120) throw new Error('Playlist name is too long.')
  const db = await openDb()
  const now = new Date().toISOString()
  const row: WebPlaylistRow = { name: trimmed, description: '', coverPath: null, createdAt: now, updatedAt: now }
  const add = db.transaction('playlists', 'readwrite').objectStore('playlists').add(row)
  const id = (await transactionDone(add.transaction as IDBTransaction).then(() => add.result)) as number
  return { id, name: trimmed, description: '', coverPath: null, createdAt: now, updatedAt: now }
}

async function requirePlaylist(id: number): Promise<WebPlaylistRow & { id: number }> {
  const db = await openDb()
  const row = (await requestAs(db.transaction('playlists').objectStore('playlists').get(id))) as
    | (WebPlaylistRow & { id: number })
    | undefined
  if (!row) throw new Error('Playlist not found.')
  return row
}

export async function renameWebPlaylist(id: number, name: string): Promise<void> {
  const playlist = await requirePlaylist(id)
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Playlist name must not be empty.')
  if (trimmed.length > 120) throw new Error('Playlist name is too long.')
  const db = await openDb()
  const put = db
    .transaction('playlists', 'readwrite')
    .objectStore('playlists')
    .put({ ...playlist, name: trimmed, updatedAt: new Date().toISOString() })
  await transactionDone(put.transaction as IDBTransaction)
}

export async function deleteWebPlaylist(id: number): Promise<void> {
  await requirePlaylist(id)
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['playlists', 'playlistSongs'], 'readwrite')
    tx.objectStore('playlists').delete(id)
    const linksReq = tx.objectStore('playlistSongs').index('playlistId').getAll(id)
    linksReq.onsuccess = () => {
      for (const link of linksReq.result as WebPlaylistSongRow[]) {
        tx.objectStore('playlistSongs').delete([link.playlistId, link.songId])
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Database transaction failed.'))
    tx.onabort = () => reject(tx.error ?? new Error('Database transaction aborted.'))
  })
}

export async function addWebSongToPlaylist(playlistId: number, songId: number): Promise<void> {
  await requirePlaylist(playlistId)
  const song = await getSongById(songId)
  if (!song) throw new Error('Song not found.')
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('playlistSongs', 'readwrite')
    const store = tx.objectStore('playlistSongs')
    const existingReq = store.get([playlistId, songId])
    existingReq.onsuccess = () => {
      if (existingReq.result) return
      const indexReq = store.index('playlistId').getAll(playlistId)
      indexReq.onsuccess = () => {
        const links = indexReq.result as WebPlaylistSongRow[]
        const maxPos = links.reduce((max, link) => Math.max(max, link.position), -1)
        store.add({ playlistId, songId, position: maxPos + 1 })
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Database transaction failed.'))
    tx.onabort = () => reject(tx.error ?? new Error('Database transaction aborted.'))
  })
}

export async function removeWebSongFromPlaylist(playlistId: number, songId: number): Promise<void> {
  const db = await openDb()
  const del = db.transaction('playlistSongs', 'readwrite').objectStore('playlistSongs').delete([playlistId, songId])
  await transactionDone(del.transaction as IDBTransaction)
}

export async function reorderWebPlaylistSongs(playlistId: number, orderedSongIds: number[]): Promise<void> {
  await requirePlaylist(playlistId)
  const db = await openDb()
  const links = (await requestAs(
    db.transaction('playlistSongs').objectStore('playlistSongs').index('playlistId').getAll(playlistId)
  )) as WebPlaylistSongRow[]
  const currentIds = links.map((link) => link.songId)
  if (
    orderedSongIds.length !== currentIds.length ||
    new Set(orderedSongIds).size !== orderedSongIds.length ||
    !orderedSongIds.every((id) => currentIds.includes(id))
  ) {
    throw new Error('Reordered songs do not match the playlist.')
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['playlistSongs', 'playlists'], 'readwrite')
    const store = tx.objectStore('playlistSongs')
    orderedSongIds.forEach((songId, position) => {
      store.put({ playlistId, songId, position })
    })
    const playlistReq = tx.objectStore('playlists').get(playlistId)
    playlistReq.onsuccess = () => {
      const playlist = playlistReq.result as (WebPlaylistRow & { id: number }) | undefined
      if (playlist) {
        tx.objectStore('playlists').put({ ...playlist, updatedAt: new Date().toISOString() })
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Database transaction failed.'))
    tx.onabort = () => reject(tx.error ?? new Error('Database transaction aborted.'))
  })
}

export async function setWebPlaylistCover(id: number, coverPath: string | null): Promise<void> {
  const playlist = await requirePlaylist(id)
  if (coverPath !== null) {
    const lower = coverPath.toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].some((ext) => lower.endsWith(ext)) && !lower.startsWith('data:image/')) {
      throw new Error('Cover must be an image file.')
    }
  }
  const db = await openDb()
  const put = db
    .transaction('playlists', 'readwrite')
    .objectStore('playlists')
    .put({ ...playlist, coverPath, updatedAt: new Date().toISOString() })
  await transactionDone(put.transaction as IDBTransaction)
}

export async function getWebPlaylistSongs(playlistId: number): Promise<Song[]> {
  const db = await openDb()
  const links = (await requestAs(
    db.transaction('playlistSongs').objectStore('playlistSongs').index('playlistId').getAll(playlistId)
  )) as WebPlaylistSongRow[]
  links.sort((a, b) => a.position - b.position)
  const songs: Song[] = []
  for (const link of links) {
    const song = await getSongById(link.songId)
    if (song) songs.push(song)
  }
  return songs
}

export async function getWebDuplicateCandidates(): Promise<DuplicateCandidates> {
  const rows = await getAllRows<WebSongRow>('songs')
  const songs = rows.filter((row) => row.id !== undefined).map(toSong)

  const byHashMap = new Map<string, Song[]>()
  for (const song of songs) {
    if (!song.fileHash) continue
    const list = byHashMap.get(song.fileHash) ?? []
    list.push(song)
    byHashMap.set(song.fileHash, list)
  }
  const byHash: DuplicateGroup[] = []
  for (const [hash, group] of byHashMap) {
    if (group.length > 1) {
      byHash.push({ key: hash.slice(0, 12), songs: [...group].sort((a, b) => a.filePath.localeCompare(b.filePath)) })
    }
  }

  const byMetaMap = new Map<string, Song[]>()
  for (const song of songs) {
    const key = `${song.title.toLowerCase()}\u0000${song.artist.toLowerCase()}\u0000${song.album.toLowerCase()}\u0000${Math.trunc(song.duration)}`
    const list = byMetaMap.get(key) ?? []
    list.push(song)
    byMetaMap.set(key, list)
  }
  const byMetadata: DuplicateGroup[] = []
  for (const group of byMetaMap.values()) {
    if (group.length > 1) {
      byMetadata.push({
        key: `${group[0]?.title ?? 'Unknown'} — ${group[0]?.artist ?? 'Unknown'}`,
        songs: [...group].sort((a, b) => a.filePath.localeCompare(b.filePath))
      })
    }
  }
  return { byHash, byMetadata }
}

const DEFAULT_SETTINGS: AppSettings = {
  volume: 0.8,
  boost: 1,
  theme: 'dark',
  accent: '#3b82f6',
  fontSize: 'medium',
  density: 'comfortable',
  backgroundPreset: 'none',
  backgroundImage: null,
  backgroundBlur: 8,
  backgroundDim: 0.55,
  visualizerStyle: 'bars',
  visualizerSensitivity: 1
}

const THEMES: AppSettings['theme'][] = ['dark', 'light', 'amoled', 'custom']
const FONT_SIZES: AppSettings['fontSize'][] = ['small', 'medium', 'large']
const DENSITIES: AppSettings['density'][] = ['compact', 'comfortable']
const VISUALIZER_STYLES: AppSettings['visualizerStyle'][] = ['bars', 'wave', 'mirror']

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback
}

function accentOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value.length === 0 || value.length > 5_000_000) return null
  return value
}

function normalizeSettings(stored: unknown): AppSettings {
  const parsed = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<string, unknown>
  return {
    volume: clampNumber(parsed.volume, DEFAULT_SETTINGS.volume, 0, 1),
    boost: clampNumber(parsed.boost, DEFAULT_SETTINGS.boost, 1, 3),
    theme: oneOf(parsed.theme, THEMES, DEFAULT_SETTINGS.theme),
    accent: accentOr(parsed.accent, DEFAULT_SETTINGS.accent),
    fontSize: oneOf(parsed.fontSize, FONT_SIZES, DEFAULT_SETTINGS.fontSize),
    density: oneOf(parsed.density, DENSITIES, DEFAULT_SETTINGS.density),
    backgroundPreset: nullableString(parsed.backgroundPreset) ?? DEFAULT_SETTINGS.backgroundPreset,
    backgroundImage: nullableString(parsed.backgroundImage),
    backgroundBlur: clampNumber(parsed.backgroundBlur, DEFAULT_SETTINGS.backgroundBlur, 0, 24),
    backgroundDim: clampNumber(parsed.backgroundDim, DEFAULT_SETTINGS.backgroundDim, 0, 0.9),
    visualizerStyle: oneOf(parsed.visualizerStyle, VISUALIZER_STYLES, DEFAULT_SETTINGS.visualizerStyle),
    visualizerSensitivity: clampNumber(
      parsed.visualizerSensitivity,
      DEFAULT_SETTINGS.visualizerSensitivity,
      0.5,
      3
    )
  }
}

export async function readWebSettings(): Promise<AppSettings> {
  const db = await openDb()
  const row = (await requestAs(db.transaction('settings').objectStore('settings').get('settings'))) as
    | { key: string; value: unknown }
    | undefined
  return normalizeSettings(row?.value)
}

export async function writeWebSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await readWebSettings()
  const next = normalizeSettings({ ...current, ...patch })
  const db = await openDb()
  const put = db
    .transaction('settings', 'readwrite')
    .objectStore('settings')
    .put({ key: 'settings', value: next })
  await transactionDone(put.transaction as IDBTransaction)
  return next
}

export async function resetWebDatabase(): Promise<void> {
  clearWebObjectUrls()
  for (const url of audioUrls.values()) URL.revokeObjectURL(url)
  audioUrls.clear()
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Could not delete the local database.'))
    request.onblocked = () => resolve()
  })
}
