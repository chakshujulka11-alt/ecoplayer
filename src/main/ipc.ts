/** All IPC handlers. Every handler returns IpcResult and never throws across the bridge. */
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { AUDIO_EXTENSIONS, collectAudioFiles, parseSong } from '../audio/scanner'
import { closeDatabase, databaseFilePath, getDatabase } from '../db/connection'
import { recordPlay } from '../db/history'
import {
  addSongToPlaylist,
  createPlaylist,
  deletePlaylistById,
  getPlaylistSongs,
  listPlaylists,
  removeSongFromPlaylist,
  renamePlaylist,
  reorderPlaylistSongs,
  setPlaylistCover
} from '../db/playlists'
import { readSettings, writeSettings } from '../db/settings'
import {
  deleteSongById,
  getAllSongs,
  getDuplicateCandidates,
  getMostPlayed,
  getRecentlyAdded,
  getSongById,
  getTopSongsByPeriod,
  searchSongs,
  toggleFavorite,
  updateSongCover,
  updateSongMetadata,
  upsertSong
} from '../db/songs'
import { ImportProgressEvent, IpcChannels } from '../shared/ipc-channels'
import type {
  AppSettings,
  DuplicateCandidates,
  IpcResult,
  ImportProgress,
  Playlist,
  PlaylistWithCount,
  ScanSummary,
  Song,
  UpdateSongMetadata
} from '../shared/types'

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function fail(error: unknown): IpcResult<never> {
  return { ok: false, error: error instanceof Error ? error.message : 'Unknown error.' }
}

function asInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`Invalid ${name}.`)
  return value
}

function asString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid ${name}.`)
  return value
}

function asStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
    throw new Error(`Invalid ${name}.`)
  }
  return value
}

function asIntegerArray(value: unknown, name: string): number[] {
  if (
    !Array.isArray(value) ||
    !value.every((item): item is number => typeof item === 'number' && Number.isInteger(item))
  ) {
    throw new Error(`Invalid ${name}.`)
  }
  return value
}

function coversDir(): string {
  const dir = path.join(app.getPath('userData'), 'covers')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Scan entries, upserting into the DB and broadcasting throttled progress. */
async function scanEntries(entries: string[], getWindow: () => BrowserWindow | null): Promise<ScanSummary> {
  const summary: ScanSummary = { scanned: 0, added: 0, updated: 0, skipped: 0, errors: [] }
  let files: string[]
  try {
    files = collectAudioFiles(entries)
  } catch (err) {
    summary.errors.push(err instanceof Error ? err.message : 'Could not read selection.')
    return summary
  }

  const emit = (current: string, done: boolean): void => {
    const win = getWindow()
    if (!win || win.isDestroyed()) return
    const progress: ImportProgress = {
      total: files.length,
      processed: summary.scanned,
      added: summary.added,
      updated: summary.updated,
      skipped: summary.skipped,
      current,
      done
    }
    win.webContents.send(ImportProgressEvent, progress)
  }

  const dir = coversDir()
  const db = getDatabase()
  let lastEmit = 0
  for (const file of files) {
    summary.scanned += 1
    try {
      const input = await parseSong(file, dir)
      const { status } = upsertSong(db, input)
      if (status === 'added') summary.added += 1
      else summary.updated += 1
    } catch (err) {
      summary.skipped += 1
      summary.errors.push(`${file}: ${err instanceof Error ? err.message : 'Unreadable file.'}`)
    }
    const now = Date.now()
    if (now - lastEmit > 150 || summary.scanned === files.length) {
      lastEmit = now
      emit(file, false)
    }
  }
  emit('', true)
  return summary
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IpcChannels.pickAudioFiles, async (): Promise<IpcResult<string[]>> => {
    try {
      const win = getWindow()
      if (!win) return fail('Main window is not available.')
      const result = await dialog.showOpenDialog(win, {
        title: 'Import audio files',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Audio', extensions: [...AUDIO_EXTENSIONS] }]
      })
      return ok(result.canceled ? [] : result.filePaths)
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.pickFolder, async (): Promise<IpcResult<string | null>> => {
    try {
      const win = getWindow()
      if (!win) return fail('Main window is not available.')
      const result = await dialog.showOpenDialog(win, {
        title: 'Import music folder',
        properties: ['openDirectory']
      })
      return ok(result.canceled ? null : (result.filePaths[0] ?? null))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.scanPaths, async (_event, paths: unknown): Promise<IpcResult<ScanSummary>> => {
    try {
      return ok(await scanEntries(asStringArray(paths, 'paths'), getWindow))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.scanFolder, async (_event, folder: unknown): Promise<IpcResult<ScanSummary>> => {
    try {
      const dir = asString(folder, 'folder')
      const stat = await fs.promises.stat(dir).catch(() => null)
      if (!stat || !stat.isDirectory()) return fail('Selected folder no longer exists.')
      return ok(await scanEntries([dir], getWindow))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.getSongs, async (): Promise<IpcResult<Song[]>> => {
    try {
      return ok(getAllSongs())
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.searchSongs, async (_event, query: unknown, limit: unknown): Promise<IpcResult<Song[]>> => {
    try {
      const safeLimit = typeof limit === 'number' ? limit : undefined
      return ok(searchSongs(asString(query, 'query'), safeLimit))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.getRecentlyAdded, async (_event, limit: unknown): Promise<IpcResult<Song[]>> => {
    try {
      return ok(getRecentlyAdded(typeof limit === 'number' ? limit : undefined))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.getMostPlayed, async (_event, limit: unknown): Promise<IpcResult<Song[]>> => {
    try {
      return ok(getMostPlayed(typeof limit === 'number' ? limit : undefined))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(
    IpcChannels.getTopSongsByPeriod,
    async (_event, days: unknown, limit: unknown): Promise<IpcResult<Song[]>> => {
      try {
        return ok(getTopSongsByPeriod(asInteger(days, 'days'), typeof limit === 'number' ? limit : undefined))
      } catch (err) {
        return fail(err)
      }
    }
  )

  ipcMain.handle(IpcChannels.getDuplicateCandidates, async (): Promise<IpcResult<DuplicateCandidates>> => {
    try {
      return ok(getDuplicateCandidates())
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.removeSong, async (_event, id: unknown): Promise<IpcResult<void>> => {
    try {
      const songId = asInteger(id, 'song id')
      const song = getSongById(songId)
      if (song?.coverPath) {
        await fs.promises.rm(song.coverPath, { force: true }).catch(() => undefined)
      }
      if (!deleteSongById(songId)) return fail('Song not found.')
      return ok(undefined)
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(
    IpcChannels.updateSongMetadata,
    async (_event, id: unknown, patch: unknown): Promise<IpcResult<Song>> => {
      try {
        if (typeof patch !== 'object' || patch === null) return fail('Invalid metadata.')
        const { title, artist, album, genre, year } = patch as Partial<UpdateSongMetadata>
        if (typeof title !== 'string' || typeof artist !== 'string' || typeof album !== 'string') {
          return fail('Title, artist and album are required.')
        }
        const safeGenre = genre === null || genre === undefined ? null : String(genre)
        const safeYear = year === null || year === undefined ? null : year
        return ok(updateSongMetadata(asInteger(id, 'song id'), { title, artist, album, genre: safeGenre, year: safeYear }))
      } catch (err) {
        return fail(err)
      }
    }
  )

  ipcMain.handle(
    IpcChannels.pickSongCover,
    async (_event, id: unknown): Promise<IpcResult<Song | null>> => {
      try {
        const songId = asInteger(id, 'song id')
        const song = getSongById(songId)
        if (!song) return fail('Song not found.')
        const win = getWindow()
        if (!win) return fail('Main window is not available.')
        const picked = await dialog.showOpenDialog(win, {
          title: 'Choose cover image',
          properties: ['openFile'],
          filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
        })
        if (picked.canceled || picked.filePaths.length === 0) return ok(null)
        const source = picked.filePaths[0] as string
        const ext = path.extname(source).toLowerCase()
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          return fail('Cover must be a JPG, PNG, or WebP image.')
        }
        const stat = await fs.promises.stat(source).catch(() => null)
        if (!stat || !stat.isFile()) return fail('Selected image no longer exists.')
        const dir = coversDir()
        const dest = path.join(dir, `song-${songId}-${Date.now()}${ext}`)
        await fs.promises.copyFile(source, dest)
        // The previous cover file is unique to this song file (content-hash
        // name or a prior custom pick), so it can be removed safely.
        if (song.coverPath && song.coverPath !== dest) {
          await fs.promises.rm(song.coverPath, { force: true }).catch(() => undefined)
        }
        return ok(updateSongCover(songId, dest))
      } catch (err) {
        return fail(err)
      }
    }
  )

  ipcMain.handle(IpcChannels.toggleFavorite, async (_event, id: unknown): Promise<IpcResult<Song>> => {
    try {
      return ok(toggleFavorite(asInteger(id, 'song id')))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.recordPlay, async (_event, id: unknown): Promise<IpcResult<void>> => {
    try {
      recordPlay(asInteger(id, 'song id'))
      return ok(undefined)
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.listPlaylists, async (): Promise<IpcResult<PlaylistWithCount[]>> => {
    try {
      return ok(listPlaylists())
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.createPlaylist, async (_event, name: unknown): Promise<IpcResult<Playlist>> => {
    try {
      return ok(createPlaylist(asString(name, 'playlist name')))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.renamePlaylist, async (_event, id: unknown, name: unknown): Promise<IpcResult<void>> => {
    try {
      renamePlaylist(asInteger(id, 'playlist id'), asString(name, 'playlist name'))
      return ok(undefined)
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.deletePlaylist, async (_event, id: unknown): Promise<IpcResult<void>> => {
    try {
      deletePlaylistById(asInteger(id, 'playlist id'))
      return ok(undefined)
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(
    IpcChannels.addSongToPlaylist,
    async (_event, playlistId: unknown, songId: unknown): Promise<IpcResult<void>> => {
      try {
        addSongToPlaylist(asInteger(playlistId, 'playlist id'), asInteger(songId, 'song id'))
        return ok(undefined)
      } catch (err) {
        return fail(err)
      }
    }
  )

  ipcMain.handle(
    IpcChannels.removeSongFromPlaylist,
    async (_event, playlistId: unknown, songId: unknown): Promise<IpcResult<void>> => {
      try {
        removeSongFromPlaylist(asInteger(playlistId, 'playlist id'), asInteger(songId, 'song id'))
        return ok(undefined)
      } catch (err) {
        return fail(err)
      }
    }
  )

  ipcMain.handle(
    IpcChannels.getPlaylistSongs,
    async (_event, playlistId: unknown): Promise<IpcResult<Song[]>> => {
      try {
        return ok(getPlaylistSongs(asInteger(playlistId, 'playlist id')))
      } catch (err) {
        return fail(err)
      }
    }
  )

  ipcMain.handle(
    IpcChannels.reorderPlaylistSongs,
    async (_event, playlistId: unknown, orderedSongIds: unknown): Promise<IpcResult<void>> => {
      try {
        const ids = asIntegerArray(orderedSongIds, 'songs')
        reorderPlaylistSongs(asInteger(playlistId, 'playlist id'), ids)
        return ok(undefined)
      } catch (err) {
        return fail(err)
      }
    }
  )

  ipcMain.handle(IpcChannels.setPlaylistCover, async (_event, playlistId: unknown): Promise<IpcResult<void>> => {
    try {
      const id = asInteger(playlistId, 'playlist id')
      const win = getWindow()
      if (!win) return fail('Main window is not available.')
      const picked = await dialog.showOpenDialog(win, {
        title: 'Choose playlist cover',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }]
      })
      if (picked.canceled || picked.filePaths.length === 0) return ok(undefined)
      const source = picked.filePaths[0] as string
      const ext = path.extname(source).toLowerCase() || '.jpg'
      const dest = path.join(coversDir(), `playlist-${id}${ext}`)
      await fs.promises.copyFile(source, dest)
      setPlaylistCover(id, dest)
      return ok(undefined)
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.clearPlaylistCover, async (_event, playlistId: unknown): Promise<IpcResult<void>> => {
    try {
      const id = asInteger(playlistId, 'playlist id')
      const playlists = listPlaylists()
      const previous = playlists.find((playlist) => playlist.id === id)?.coverPath
      setPlaylistCover(id, null)
      if (previous) {
        await fs.promises.rm(previous, { force: true }).catch(() => undefined)
      }
      return ok(undefined)
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.getSettings, async (): Promise<IpcResult<AppSettings>> => {
    try {
      getDatabase()
      return ok(readSettings())
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.updateSettings, async (_event, patch: unknown): Promise<IpcResult<AppSettings>> => {
    try {
      if (typeof patch !== 'object' || patch === null) return fail('Invalid settings.')
      // writeSettings validates and clamps every field itself.
      getDatabase()
      return ok(writeSettings(patch as Partial<AppSettings>))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.setBackgroundImage, async (): Promise<IpcResult<AppSettings>> => {
    try {
      const win = getWindow()
      if (!win) return fail('Main window is not available.')
      const picked = await dialog.showOpenDialog(win, {
        title: 'Choose background image',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }]
      })
      if (picked.canceled || picked.filePaths.length === 0) return ok(readSettings())
      const source = picked.filePaths[0] as string
      const ext = path.extname(source).toLowerCase() || '.jpg'
      const dir = coversDir()
      const previous = readSettings().backgroundImage
      const dest = path.join(dir, `background${ext}`)
      await fs.promises.copyFile(source, dest)
      if (previous && previous !== dest) {
        await fs.promises.rm(previous, { force: true }).catch(() => undefined)
      }
      getDatabase()
      return ok(writeSettings({ backgroundImage: dest, backgroundPreset: null }))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.clearBackgroundImage, async (): Promise<IpcResult<AppSettings>> => {
    try {
      const previous = readSettings().backgroundImage
      if (previous) {
        await fs.promises.rm(previous, { force: true }).catch(() => undefined)
      }
      getDatabase()
      return ok(writeSettings({ backgroundImage: null, backgroundPreset: 'none' }))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.resetDatabase, async (): Promise<IpcResult<void>> => {
    // Dev only: packaged builds refuse so user libraries are never wiped.
    if (app.isPackaged) return fail('Database reset is only available in development builds.')
    try {
      closeDatabase()
      const dbFile = databaseFilePath()
      for (const suffix of ['', '-wal', '-shm', '-journal']) {
        await fs.promises.rm(`${dbFile}${suffix}`, { force: true }).catch(() => undefined)
      }
      await fs.promises.rm(coversDir(), { recursive: true, force: true }).catch(() => undefined)
      // Relaunch after the response is delivered.
      setImmediate(() => {
        app.relaunch()
        app.exit(0)
      })
      return ok(undefined)
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IpcChannels.moveSongToTrash, async (_event, id: unknown): Promise<IpcResult<void>> => {
    try {
      const songId = asInteger(id, 'song id')
      const song = getSongById(songId)
      if (!song) return fail('Song not found.')
      if (fs.existsSync(song.filePath)) {
        try {
          await shell.trashItem(song.filePath)
        } catch {
          return fail('Could not move the file to the trash.')
        }
      }
      if (song.coverPath) {
        await fs.promises.rm(song.coverPath, { force: true }).catch(() => undefined)
      }
      deleteSongById(songId)
      return ok(undefined)
    } catch (err) {
      return fail(err)
    }
  })
}
