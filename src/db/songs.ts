/** Typed song repository (main process only). No SQL outside this layer. */
import type Database from 'better-sqlite3'
import { getDatabase } from './connection'
import type { DuplicateCandidates, DuplicateGroup, Song, SongInput, UpdateSongMetadata } from '../shared/types'

interface SongRow {
  id: number
  title: string
  artist: string
  album: string
  genre: string | null
  year: number | null
  duration: number
  file_path: string
  cover_path: string | null
  date_added: string
  play_count: number
  last_played: string | null
  is_favorite: number
  rating: number
  file_hash: string | null
}

export function mapSong(row: SongRow): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    genre: row.genre,
    year: row.year,
    duration: row.duration,
    filePath: row.file_path,
    coverPath: row.cover_path,
    dateAdded: row.date_added,
    playCount: row.play_count,
    lastPlayed: row.last_played,
    isFavorite: row.is_favorite === 1,
    rating: row.rating,
    fileHash: row.file_hash
  }
}

function clampLimit(limit: number | undefined, fallback: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return fallback
  return Math.min(500, Math.max(1, Math.floor(limit)))
}

/** Insert or refresh by file path. Re-imports never create duplicate rows. */
export function upsertSong(db: Database.Database, input: SongInput): { id: number; status: 'added' | 'updated' } {
  const existing = db.prepare('SELECT id, date_added FROM songs WHERE file_path = ?').get(input.filePath) as
    | { id: number; date_added: string }
    | undefined
  const now = new Date().toISOString()
  if (existing) {
    db.prepare(
      `UPDATE songs SET title = ?, artist = ?, album = ?, genre = ?, year = ?,
        duration = ?, cover_path = ?, file_hash = ? WHERE id = ?`
    ).run(
      input.title,
      input.artist,
      input.album,
      input.genre,
      input.year,
      input.duration,
      input.coverPath,
      input.fileHash,
      existing.id
    )
    return { id: existing.id, status: 'updated' }
  }
  const info = db.prepare(
    `INSERT INTO songs (title, artist, album, genre, year, duration, file_path,
      cover_path, date_added, play_count, last_played, is_favorite, rating, file_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0, 0, ?)`
  ).run(
    input.title,
    input.artist,
    input.album,
    input.genre,
    input.year,
    input.duration,
    input.filePath,
    input.coverPath,
    now,
    input.fileHash
  )
  return { id: Number(info.lastInsertRowid), status: 'added' }
}

export function getAllSongs(): Song[] {
  const rows = getDatabase().prepare('SELECT * FROM songs ORDER BY artist, album, title').all() as SongRow[]
  return rows.map(mapSong)
}

export function getSongById(id: number): Song | null {
  const row = getDatabase().prepare('SELECT * FROM songs WHERE id = ?').get(id) as SongRow | undefined
  return row ? mapSong(row) : null
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export function searchSongs(query: string, limit?: number): Song[] {
  const trimmed = query.trim()
  if (!trimmed) return getAllSongs()
  const pattern = `%${escapeLike(trimmed)}%`
  const rows = getDatabase()
    .prepare(
      `SELECT * FROM songs WHERE title LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\'
       OR album LIKE ? ESCAPE '\\' OR genre LIKE ? ESCAPE '\\'
       ORDER BY play_count DESC, title LIMIT ?`
    )
    .all(pattern, pattern, pattern, pattern, clampLimit(limit, 100)) as SongRow[]
  return rows.map(mapSong)
}

export function getRecentlyAdded(limit?: number): Song[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM songs ORDER BY date_added DESC, id DESC LIMIT ?')
    .all(clampLimit(limit, 50)) as SongRow[]
  return rows.map(mapSong)
}

export function getMostPlayed(limit?: number): Song[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM songs ORDER BY play_count DESC, last_played DESC, title LIMIT ?')
    .all(clampLimit(limit, 50)) as SongRow[]
  return rows.map(mapSong)
}

export function getTopSongsByPeriod(days: number, limit?: number): Song[] {
  const safeDays =
    typeof days !== 'number' || !Number.isFinite(days) ? 30 : Math.min(3650, Math.max(1, Math.floor(days)))
  const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString()
  const rows = getDatabase()
    .prepare(
      `SELECT s.*, COUNT(h.id) AS plays FROM songs s
       JOIN play_history h ON h.song_id = s.id
       WHERE h.played_at >= ? GROUP BY s.id
       ORDER BY plays DESC, s.play_count DESC LIMIT ?`
    )
    .all(cutoff, clampLimit(limit, 50)) as (SongRow & { plays: number })[]
  return rows.map(mapSong)
}

export function getDuplicateCandidates(): DuplicateCandidates {
  const db = getDatabase()
  const byHash: DuplicateGroup[] = []
  const hashRows = db
    .prepare(
      `SELECT file_hash FROM songs WHERE file_hash IS NOT NULL
       GROUP BY file_hash HAVING COUNT(*) > 1`
    )
    .all() as { file_hash: string }[]
  for (const row of hashRows) {
    const songs = db.prepare('SELECT * FROM songs WHERE file_hash = ? ORDER BY file_path').all(row.file_hash) as SongRow[]
    byHash.push({ key: row.file_hash.slice(0, 12), songs: songs.map(mapSong) })
  }

  const byMetadata: DuplicateGroup[] = []
  const metaRows = db
    .prepare(
      `SELECT lower(title) AS t, lower(artist) AS a, lower(album) AS al, CAST(duration AS INTEGER) AS d
       FROM songs GROUP BY t, a, al, d HAVING COUNT(*) > 1`
    )
    .all() as { t: string; a: string; al: string; d: number }[]
  for (const row of metaRows) {
    const songs = db
      .prepare(
        `SELECT * FROM songs WHERE lower(title) = ? AND lower(artist) = ?
         AND lower(album) = ? AND CAST(duration AS INTEGER) = ? ORDER BY file_path`
      )
      .all(row.t, row.a, row.al, row.d) as SongRow[]
    byMetadata.push({ key: `${songs[0]?.title ?? 'Unknown'} — ${songs[0]?.artist ?? 'Unknown'}`, songs: songs.map(mapSong) })
  }
  return { byHash, byMetadata }
}

export function deleteSongById(id: number): boolean {
  const info = getDatabase().prepare('DELETE FROM songs WHERE id = ?').run(id)
  return Number(info.changes) > 0
}

export function updateSongMetadata(id: number, patch: UpdateSongMetadata): Song {
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
  const db = getDatabase()
  const existing = db.prepare('SELECT id FROM songs WHERE id = ?').get(id) as { id: number } | undefined
  if (!existing) throw new Error('Song not found.')
  db.prepare('UPDATE songs SET title = ?, artist = ?, album = ?, genre = ?, year = ? WHERE id = ?').run(
    title,
    artist,
    album,
    genre,
    year,
    id
  )
  const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(id) as SongRow
  return mapSong(row)
}

export function updateSongCover(id: number, coverPath: string | null): Song {
  const db = getDatabase()
  const existing = db.prepare('SELECT id FROM songs WHERE id = ?').get(id) as { id: number } | undefined
  if (!existing) throw new Error('Song not found.')
  db.prepare('UPDATE songs SET cover_path = ? WHERE id = ?').run(coverPath, id)
  const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(id) as SongRow
  return mapSong(row)
}

export function toggleFavorite(id: number): Song {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(id) as SongRow | undefined
  if (!row) throw new Error('Song not found.')
  const next = row.is_favorite === 1 ? 0 : 1
  db.prepare('UPDATE songs SET is_favorite = ? WHERE id = ?').run(next, id)
  return mapSong({ ...row, is_favorite: next })
}
