/** Play-history repository (main process only). */
import { getDatabase } from './connection'
import type { PlayHistoryEntry } from '../shared/types'

interface HistoryRow {
  id: number
  song_id: number
  played_at: string
}

function mapEntry(row: HistoryRow): PlayHistoryEntry {
  return { id: row.id, songId: row.song_id, playedAt: row.played_at }
}

/** Log a play and bump the song counters atomically. */
export function recordPlay(songId: number): void {
  const db = getDatabase()
  const song = db.prepare('SELECT id FROM songs WHERE id = ?').get(songId) as { id: number } | undefined
  if (!song) throw new Error('Song not found.')
  const now = new Date().toISOString()
  const insert = db.prepare('INSERT INTO play_history (song_id, played_at) VALUES (?, ?)')
  const bump = db.prepare('UPDATE songs SET play_count = play_count + 1, last_played = ? WHERE id = ?')
  const run = db.transaction(() => {
    insert.run(songId, now)
    bump.run(now, songId)
  })
  run()
}

export function getHistory(limit?: number): PlayHistoryEntry[] {
  const safeLimit =
    typeof limit !== 'number' || !Number.isFinite(limit) ? 100 : Math.min(1000, Math.max(1, Math.floor(limit)))
  const rows = getDatabase()
    .prepare('SELECT * FROM play_history ORDER BY played_at DESC, id DESC LIMIT ?')
    .all(safeLimit) as HistoryRow[]
  return rows.map(mapEntry)
}
