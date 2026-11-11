/** Typed playlist repository (main process only). */
import { getDatabase } from './connection'
import { mapSong } from './songs'
import type { Playlist, PlaylistWithCount, Song } from '../shared/types'

interface PlaylistRow {
  id: number
  name: string
  description: string
  cover_path: string | null
  created_at: string
  updated_at: string
}

function mapPlaylist(row: PlaylistRow, songCount: number, autoCoverSongId: number | null): PlaylistWithCount {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    coverPath: row.cover_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    songCount,
    autoCoverSongId
  }
}

export function listPlaylists(): PlaylistWithCount[] {
  const rows = getDatabase()
    .prepare(
      `SELECT p.*, COUNT(ps.song_id) AS song_count,
        (SELECT ps2.song_id FROM playlist_songs ps2
         WHERE ps2.playlist_id = p.id ORDER BY ps2.position LIMIT 1) AS auto_cover_song
       FROM playlists p
       LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
       GROUP BY p.id ORDER BY p.name`
    )
    .all() as (PlaylistRow & { song_count: number; auto_cover_song: number | null })[]
  return rows.map((row) => mapPlaylist(row, row.song_count, row.auto_cover_song))
}

export function createPlaylist(name: string): Playlist {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Playlist name must not be empty.')
  if (trimmed.length > 120) throw new Error('Playlist name is too long.')
  const now = new Date().toISOString()
  const info = getDatabase()
    .prepare('INSERT INTO playlists (name, description, cover_path, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)')
    .run(trimmed, '', now, now)
  const id = Number(info.lastInsertRowid)
  return { id, name: trimmed, description: '', coverPath: null, createdAt: now, updatedAt: now }
}

export function renamePlaylist(id: number, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Playlist name must not be empty.')
  if (trimmed.length > 120) throw new Error('Playlist name is too long.')
  const info = getDatabase()
    .prepare('UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?')
    .run(trimmed, new Date().toISOString(), id)
  if (Number(info.changes) === 0) throw new Error('Playlist not found.')
}

export function deletePlaylistById(id: number): void {
  const info = getDatabase().prepare('DELETE FROM playlists WHERE id = ?').run(id)
  if (Number(info.changes) === 0) throw new Error('Playlist not found.')
}

export function addSongToPlaylist(playlistId: number, songId: number): void {
  const db = getDatabase()
  const playlist = db.prepare('SELECT id FROM playlists WHERE id = ?').get(playlistId) as { id: number } | undefined
  if (!playlist) throw new Error('Playlist not found.')
  const song = db.prepare('SELECT id FROM songs WHERE id = ?').get(songId) as { id: number } | undefined
  if (!song) throw new Error('Song not found.')
  const maxPos = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS max_pos FROM playlist_songs WHERE playlist_id = ?')
    .get(playlistId) as { max_pos: number }
  db.prepare('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)').run(
    playlistId,
    songId,
    maxPos.max_pos + 1
  )
}

export function removeSongFromPlaylist(playlistId: number, songId: number): void {
  getDatabase().prepare('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?').run(playlistId, songId)
}

/** Persist a drag-reordered song list. Members must match exactly (order only). */
export function reorderPlaylistSongs(playlistId: number, orderedSongIds: number[]): void {
  const db = getDatabase()
  const playlist = db.prepare('SELECT id FROM playlists WHERE id = ?').get(playlistId) as { id: number } | undefined
  if (!playlist) throw new Error('Playlist not found.')
  const current = db
    .prepare('SELECT song_id FROM playlist_songs WHERE playlist_id = ?')
    .all(playlistId) as { song_id: number }[]
  const currentIds = current.map((row) => row.song_id)
  if (
    orderedSongIds.length !== currentIds.length ||
    new Set(orderedSongIds).size !== orderedSongIds.length ||
    !orderedSongIds.every((id) => currentIds.includes(id))
  ) {
    throw new Error('Reordered songs do not match the playlist.')
  }
  const update = db.prepare('UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?')
  const run = db.transaction((ids: number[]) => {
    ids.forEach((songId, position) => {
      update.run(position, playlistId, songId)
    })
    db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), playlistId)
  })
  run(orderedSongIds)
}

export function setPlaylistCover(playlistId: number, coverPath: string | null): void {
  const db = getDatabase()
  const playlist = db.prepare('SELECT id FROM playlists WHERE id = ?').get(playlistId) as { id: number } | undefined
  if (!playlist) throw new Error('Playlist not found.')
  if (coverPath !== null) {
    const lower = coverPath.toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].some((ext) => lower.endsWith(ext))) {
      throw new Error('Cover must be an image file.')
    }
  }
  db.prepare('UPDATE playlists SET cover_path = ?, updated_at = ? WHERE id = ?').run(
    coverPath,
    new Date().toISOString(),
    playlistId
  )
}

export function getPlaylistSongs(playlistId: number): Song[] {
  const rows = getDatabase()
    .prepare(
      `SELECT s.* FROM songs s
       JOIN playlist_songs ps ON ps.song_id = s.id
       WHERE ps.playlist_id = ? ORDER BY ps.position, s.title`
    )
    .all(playlistId) as Parameters<typeof mapSong>[0][]
  return rows.map(mapSong)
}
