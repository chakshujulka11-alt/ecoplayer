/** Shared domain types. Must stay free of Node.js and DOM APIs (imported by both sides). */

export interface Song {
  id: number
  title: string
  artist: string
  album: string
  genre: string | null
  year: number | null
  /** Duration in seconds. */
  duration: number
  filePath: string
  coverPath: string | null
  dateAdded: string
  playCount: number
  lastPlayed: string | null
  isFavorite: boolean
  rating: number
  fileHash: string | null
}

export interface SongInput {
  title: string
  artist: string
  album: string
  genre: string | null
  year: number | null
  duration: number
  filePath: string
  coverPath: string | null
  fileHash: string | null
}

export interface Playlist {
  id: number
  name: string
  description: string
  coverPath: string | null
  createdAt: string
  updatedAt: string
}

export interface PlaylistWithCount extends Playlist {
  songCount: number
  /** First song by position, for auto cover art. Null when empty. */
  autoCoverSongId: number | null
}

export interface PlayHistoryEntry {
  id: number
  songId: number
  playedAt: string
}

export interface DuplicateGroup {
  key: string
  songs: Song[]
}

export interface DuplicateCandidates {
  byHash: DuplicateGroup[]
  byMetadata: DuplicateGroup[]
}

export type Theme = 'dark' | 'light' | 'amoled' | 'custom'
export type FontSize = 'small' | 'medium' | 'large'
export type Density = 'compact' | 'comfortable'
export type VisualizerStyle = 'bars' | 'wave' | 'mirror'

export interface AppSettings {
  /** 0..1 */
  volume: number
  /** Volume multiplier applied through the Web Audio gain node, 1..3. */
  boost: number
  theme: Theme
  /** Accent color as #rrggbb. */
  accent: string
  fontSize: FontSize
  density: Density
  /** Background preset id ('none' disables), null when a custom image is used. */
  backgroundPreset: string | null
  /** Absolute path of a custom background image, served via media://. */
  backgroundImage: string | null
  /** Background blur in px, 0..24. */
  backgroundBlur: number
  /** Background dim overlay opacity, 0..0.9. */
  backgroundDim: number
  visualizerStyle: VisualizerStyle
  /** Visualizer sensitivity multiplier, 0.5..3. */
  visualizerSensitivity: number
}

export interface UpdateSongMetadata {
  title: string
  artist: string
  album: string
  genre: string | null
  year: number | null
}

export interface ScanSummary {
  scanned: number
  added: number
  updated: number
  skipped: number
  errors: string[]
}

/** Throttled progress updates broadcast while a large import runs. */
export interface ImportProgress {
  total: number
  processed: number
  added: number
  updated: number
  skipped: number
  current: string
  done: boolean
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** Typed bridge exposed by the preload script as `window.api`. */
export interface RendererApi {
  pickAudioFiles(): Promise<IpcResult<string[]>>
  pickFolder(): Promise<IpcResult<string | null>>
  scanPaths(paths: string[]): Promise<IpcResult<ScanSummary>>
  scanFolder(folder: string): Promise<IpcResult<ScanSummary>>
  onImportProgress(callback: (progress: ImportProgress) => void): number
  offImportProgress(subscriptionId: number): void
  onFilesDropped(callback: (paths: string[]) => void): number
  offFilesDropped(subscriptionId: number): void
  getSongs(): Promise<IpcResult<Song[]>>
  searchSongs(query: string, limit?: number): Promise<IpcResult<Song[]>>
  getRecentlyAdded(limit?: number): Promise<IpcResult<Song[]>>
  getMostPlayed(limit?: number): Promise<IpcResult<Song[]>>
  getTopSongsByPeriod(days: number, limit?: number): Promise<IpcResult<Song[]>>
  getDuplicateCandidates(): Promise<IpcResult<DuplicateCandidates>>
  removeSong(id: number): Promise<IpcResult<void>>
  updateSongMetadata(id: number, patch: UpdateSongMetadata): Promise<IpcResult<Song>>
  /** Opens an image picker, copies the photo into covers/, persists it. Null when cancelled. */
  pickSongCover(id: number): Promise<IpcResult<Song | null>>
  toggleFavorite(id: number): Promise<IpcResult<Song>>
  recordPlay(id: number): Promise<IpcResult<void>>
  listPlaylists(): Promise<IpcResult<PlaylistWithCount[]>>
  createPlaylist(name: string): Promise<IpcResult<Playlist>>
  renamePlaylist(id: number, name: string): Promise<IpcResult<void>>
  deletePlaylist(id: number): Promise<IpcResult<void>>
  addSongToPlaylist(playlistId: number, songId: number): Promise<IpcResult<void>>
  removeSongFromPlaylist(playlistId: number, songId: number): Promise<IpcResult<void>>
  reorderPlaylistSongs(playlistId: number, orderedSongIds: number[]): Promise<IpcResult<void>>
  setPlaylistCover(playlistId: number): Promise<IpcResult<void>>
  clearPlaylistCover(playlistId: number): Promise<IpcResult<void>>
  getPlaylistSongs(playlistId: number): Promise<IpcResult<Song[]>>
  getSettings(): Promise<IpcResult<AppSettings>>
  updateSettings(patch: Partial<AppSettings>): Promise<IpcResult<AppSettings>>
  setBackgroundImage(): Promise<IpcResult<AppSettings>>
  clearBackgroundImage(): Promise<IpcResult<AppSettings>>
  moveSongToTrash(id: number): Promise<IpcResult<void>>
  /** Dev only: wipe the database + covers and restart. No-op in packaged builds. */
  resetDatabase(): Promise<IpcResult<void>>
}
