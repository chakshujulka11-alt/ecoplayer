/** IPC channel names shared by main and preload. Renderer never touches these directly. */
export const IpcChannels = {
  pickAudioFiles: 'dialog:pick-audio-files',
  pickFolder: 'dialog:pick-folder',
  scanPaths: 'library:scan-paths',
  scanFolder: 'library:scan-folder',
  getSongs: 'songs:list',
  searchSongs: 'songs:search',
  getRecentlyAdded: 'songs:recently-added',
  getMostPlayed: 'songs:most-played',
  getTopSongsByPeriod: 'songs:top-by-period',
  getDuplicateCandidates: 'songs:duplicate-candidates',
  removeSong: 'songs:remove',
  updateSongMetadata: 'songs:update-metadata',
  pickSongCover: 'song:pickCover',
  toggleFavorite: 'songs:toggle-favorite',
  recordPlay: 'history:record-play',
  listPlaylists: 'playlists:list',
  createPlaylist: 'playlists:create',
  renamePlaylist: 'playlists:rename',
  deletePlaylist: 'playlists:delete',
  addSongToPlaylist: 'playlist:add-song',
  removeSongFromPlaylist: 'playlist:remove-song',
  reorderPlaylistSongs: 'playlist:reorder-songs',
  setPlaylistCover: 'playlists:set-cover',
  clearPlaylistCover: 'playlists:clear-cover',
  getPlaylistSongs: 'playlist:get-songs',
  getSettings: 'settings:get',
  updateSettings: 'settings:set',
  setBackgroundImage: 'settings:set-background-image',
  clearBackgroundImage: 'settings:clear-background-image',
  moveSongToTrash: 'file:move-to-trash',
  resetDatabase: 'dev:reset-database'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

/** Main-to-renderer event pushed while imports run. */
export const ImportProgressEvent = 'import:progress'
