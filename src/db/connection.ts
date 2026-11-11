/**
 * SQLite connection + schema migration (main process only).
 * Database lives in the app userData directory: <userData>/data/library.db
 * Created automatically on first launch; upgrades legacy installs in place.
 */
import Database from 'better-sqlite3'
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const SCHEMA_VERSION = 1

let instance: Database.Database | null = null

function tableExists(db: Database.Database, name: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name) as
    | { name: string }
    | undefined
  return row !== undefined
}

function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT NOT NULL,
      genre TEXT,
      year INTEGER,
      duration REAL NOT NULL DEFAULT 0,
      file_path TEXT NOT NULL UNIQUE,
      cover_path TEXT,
      date_added TEXT NOT NULL,
      play_count INTEGER NOT NULL DEFAULT 0,
      last_played TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL DEFAULT 0,
      file_hash TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
    CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album);
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
    CREATE INDEX IF NOT EXISTS idx_songs_hash ON songs(file_hash);
    CREATE INDEX IF NOT EXISTS idx_songs_added ON songs(date_added);
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cover_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS playlist_songs (
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (playlist_id, song_id)
    );
    CREATE TABLE IF NOT EXISTS play_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      played_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_history_song ON play_history(song_id);
    CREATE INDEX IF NOT EXISTS idx_history_played ON play_history(played_at);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

/**
 * Upgrade installs that used the pre-release schema
 * (tracks / playlists without description / playlist_tracks).
 */
function upgradeLegacySchema(db: Database.Database): void {
  db.pragma('foreign_keys = OFF')
  try {
    db.exec('BEGIN')
    if (tableExists(db, 'tracks') && !tableExists(db, 'songs')) {
      db.exec(`
        CREATE TABLE songs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          album TEXT NOT NULL,
          genre TEXT,
          year INTEGER,
          duration REAL NOT NULL DEFAULT 0,
          file_path TEXT NOT NULL UNIQUE,
          cover_path TEXT,
          date_added TEXT NOT NULL,
          play_count INTEGER NOT NULL DEFAULT 0,
          last_played TEXT,
          is_favorite INTEGER NOT NULL DEFAULT 0,
          rating INTEGER NOT NULL DEFAULT 0,
          file_hash TEXT
        );
        INSERT INTO songs (id, title, artist, album, genre, year, duration, file_path,
          cover_path, date_added, play_count, last_played, is_favorite, rating, file_hash)
        SELECT id, title, artist, album, genre, year, duration, file_path, cover_path,
          created_at, 0, NULL, 0, 0, NULL FROM tracks;
      `);
    }
    if (tableExists(db, 'playlist_tracks')) {
      createSchema(db)
      db.exec(`
        INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position)
        SELECT playlist_id, track_id, position FROM playlist_tracks;
      `);
    } else {
      createSchema(db)
    }
    if (tableExists(db, 'playlists') && !tableExists(db, 'playlists_new')) {
      // Old playlists table lacks description/cover_path columns.
      const columns = db.prepare(`PRAGMA table_info(playlists)`).all() as { name: string }[]
      const names = new Set(columns.map((c) => c.name))
      if (!names.has('description')) {
        db.exec(`
          CREATE TABLE playlists_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            cover_path TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          INSERT INTO playlists_new (id, name, description, cover_path, created_at, updated_at)
          SELECT id, name, '', NULL, created_at, updated_at FROM playlists;
          DROP TABLE playlists;
          ALTER TABLE playlists_new RENAME TO playlists;
        `);
      }
    }
    if (tableExists(db, 'tracks')) db.exec('DROP TABLE tracks;');
    if (tableExists(db, 'playlist_tracks')) db.exec('DROP TABLE playlist_tracks;');
    db.exec('COMMIT')
  } catch (err) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // Nothing left to roll back.
    }
    throw err
  } finally {
    db.pragma('foreign_keys = ON')
  }
}

function migrate(db: Database.Database): void {
  const version = db.pragma('user_version', { simple: true }) as number
  if (version < SCHEMA_VERSION) {
    upgradeLegacySchema(db)
    db.pragma(`user_version = ${SCHEMA_VERSION}`)
  }
}

export function getDatabase(): Database.Database {
  if (instance) return instance
  const dir = path.join(app.getPath('userData'), 'data')
  fs.mkdirSync(dir, { recursive: true })
  const db = new Database(path.join(dir, 'library.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  instance = db
  return db
}

/** Close the connection so the database file can be deleted (dev reset). */
export function closeDatabase(): void {
  if (instance) {
    try {
      instance.close()
    } catch {
      // Already closed.
    }
    instance = null
  }
}

/** Absolute path of the library database file. */
export function databaseFilePath(): string {
  return path.join(app.getPath('userData'), 'data', 'library.db')
}
