import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { ImportProgressEvent, IpcChannels } from '../shared/ipc-channels'
import type {
  AppSettings,
  DuplicateCandidates,
  ImportProgress,
  IpcResult,
  Playlist,
  PlaylistWithCount,
  RendererApi,
  ScanSummary,
  Song,
  UpdateSongMetadata
} from '../shared/types'

/** Every bridge call is guarded so the renderer always gets an IpcResult, never a rejection. */
async function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> {
  try {
    const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T> | null
    if (result !== null && typeof result === 'object' && 'ok' in result) return result
    return { ok: false, error: 'Unexpected response from the main process.' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown IPC error.' }
  }
}

let nextSubscriptionId = 1
const progressSubscriptions = new Map<number, (progress: ImportProgress) => void>()
const dropSubscriptions = new Map<number, (paths: string[]) => void>()
let dropListenersAttached = false

function isImportProgress(value: unknown): value is ImportProgress {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.total === 'number' &&
    typeof record.processed === 'number' &&
    typeof record.done === 'boolean'
  )
}

function onProgressEvent(_event: unknown, progress: unknown): void {
  if (!isImportProgress(progress)) return
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
    const files = event.dataTransfer?.files
    if (!files || files.length === 0 || dropSubscriptions.size === 0) return
    const paths: string[] = []
    for (const file of Array.from(files)) {
      try {
        const filePath = webUtils.getPathForFile(file)
        if (filePath) paths.push(filePath)
      } catch {
        // Skip entries whose paths cannot be resolved.
      }
    }
    if (paths.length === 0) return
    for (const callback of dropSubscriptions.values()) {
      try {
        callback(paths)
      } catch {
        // A renderer callback must never break the bridge.
      }
    }
  })
}

const api: RendererApi = {
  pickAudioFiles: () => invoke<string[]>(IpcChannels.pickAudioFiles),
  pickFolder: () => invoke<string | null>(IpcChannels.pickFolder),
  scanPaths: (paths: string[]) => invoke<ScanSummary>(IpcChannels.scanPaths, paths),
  scanFolder: (folder: string) => invoke<ScanSummary>(IpcChannels.scanFolder, folder),
  onImportProgress: (callback: (progress: ImportProgress) => void) => {
    const id = nextSubscriptionId
    nextSubscriptionId += 1
    progressSubscriptions.set(id, callback)
    if (progressSubscriptions.size === 1) {
      ipcRenderer.on(ImportProgressEvent, onProgressEvent)
    }
    return id
  },
  offImportProgress: (subscriptionId: number) => {
    progressSubscriptions.delete(subscriptionId)
    if (progressSubscriptions.size === 0) {
      ipcRenderer.removeListener(ImportProgressEvent, onProgressEvent)
    }
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
  getSongs: () => invoke<Song[]>(IpcChannels.getSongs),
  searchSongs: (query: string, limit?: number) => invoke<Song[]>(IpcChannels.searchSongs, query, limit),
  getRecentlyAdded: (limit?: number) => invoke<Song[]>(IpcChannels.getRecentlyAdded, limit),
  getMostPlayed: (limit?: number) => invoke<Song[]>(IpcChannels.getMostPlayed, limit),
  getTopSongsByPeriod: (days: number, limit?: number) =>
    invoke<Song[]>(IpcChannels.getTopSongsByPeriod, days, limit),
  getDuplicateCandidates: () => invoke<DuplicateCandidates>(IpcChannels.getDuplicateCandidates),
  removeSong: (id: number) => invoke<void>(IpcChannels.removeSong, id),
  pickSongCover: (id: number) => invoke<Song | null>(IpcChannels.pickSongCover, id),
  updateSongMetadata: (id: number, patch: UpdateSongMetadata) =>
    invoke<Song>(IpcChannels.updateSongMetadata, id, patch),
  toggleFavorite: (id: number) => invoke<Song>(IpcChannels.toggleFavorite, id),
  recordPlay: (id: number) => invoke<void>(IpcChannels.recordPlay, id),
  listPlaylists: () => invoke<PlaylistWithCount[]>(IpcChannels.listPlaylists),
  createPlaylist: (name: string) => invoke<Playlist>(IpcChannels.createPlaylist, name),
  renamePlaylist: (id: number, name: string) => invoke<void>(IpcChannels.renamePlaylist, id, name),
  deletePlaylist: (id: number) => invoke<void>(IpcChannels.deletePlaylist, id),
  addSongToPlaylist: (playlistId: number, songId: number) =>
    invoke<void>(IpcChannels.addSongToPlaylist, playlistId, songId),
  removeSongFromPlaylist: (playlistId: number, songId: number) =>
    invoke<void>(IpcChannels.removeSongFromPlaylist, playlistId, songId),
  reorderPlaylistSongs: (playlistId: number, orderedSongIds: number[]) =>
    invoke<void>(IpcChannels.reorderPlaylistSongs, playlistId, orderedSongIds),
  setPlaylistCover: (playlistId: number) => invoke<void>(IpcChannels.setPlaylistCover, playlistId),
  clearPlaylistCover: (playlistId: number) => invoke<void>(IpcChannels.clearPlaylistCover, playlistId),
  getPlaylistSongs: (playlistId: number) => invoke<Song[]>(IpcChannels.getPlaylistSongs, playlistId),
  getSettings: () => invoke<AppSettings>(IpcChannels.getSettings),
  updateSettings: (patch: Partial<AppSettings>) => invoke<AppSettings>(IpcChannels.updateSettings, patch),
  setBackgroundImage: () => invoke<AppSettings>(IpcChannels.setBackgroundImage),
  clearBackgroundImage: () => invoke<AppSettings>(IpcChannels.clearBackgroundImage),
  moveSongToTrash: (id: number) => invoke<void>(IpcChannels.moveSongToTrash, id),
  resetDatabase: () => invoke<void>(IpcChannels.resetDatabase)
}

contextBridge.exposeInMainWorld('api', api)
