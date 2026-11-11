import { useCallback } from 'react'
import { callApi } from '../lib/api'
import { usePlayerStore } from '../stores/player'
import type { Song, UpdateSongMetadata } from '../../shared/types'

/** Shared song mutations: IPC + store sync. Views add their own confirms/status. */
export function useSongActions(): {
  toggleFavorite: (song: Song) => Promise<void>
  saveMetadata: (song: Song, patch: UpdateSongMetadata) => Promise<string | null>
  pickCover: (song: Song) => Promise<Song | null>
  removeFromLibrary: (ids: number[]) => Promise<void>
  moveFilesToTrash: (ids: number[]) => Promise<void>
  addToPlaylist: (playlistId: number, ids: number[]) => Promise<void>
} {
  const updateSong = usePlayerStore((s) => s.updateSong)
  const removeSong = usePlayerStore((s) => s.removeSong)

  const toggleFavorite = useCallback(
    async (song: Song) => {
      const updated = await callApi((api) => api.toggleFavorite(song.id))
      updateSong(updated)
    },
    [updateSong]
  )

  const saveMetadata = useCallback(
    async (song: Song, patch: UpdateSongMetadata): Promise<string | null> => {
      try {
        const updated = await callApi((api) => api.updateSongMetadata(song.id, patch))
        updateSong(updated)
        return null
      } catch (err) {
        return err instanceof Error ? err.message : 'Could not save metadata.'
      }
    },
    [updateSong]
  )

  const pickCover = useCallback(
    async (song: Song): Promise<Song | null> => {
      const updated = await callApi((api) => api.pickSongCover(song.id))
      if (updated) updateSong(updated)
      return updated
    },
    [updateSong]
  )

  const removeFromLibrary = useCallback(
    async (ids: number[]) => {
      for (const id of ids) {
        await callApi((api) => api.removeSong(id))
        removeSong(id)
      }
    },
    [removeSong]
  )

  const moveFilesToTrash = useCallback(
    async (ids: number[]) => {
      for (const id of ids) {
        await callApi((api) => api.moveSongToTrash(id))
        removeSong(id)
      }
    },
    [removeSong]
  )

  const addToPlaylist = useCallback(async (playlistId: number, ids: number[]) => {
    for (const id of ids) {
      await callApi((api) => api.addSongToPlaylist(playlistId, id))
    }
  }, [])

  return { toggleFavorite, saveMetadata, pickCover, removeFromLibrary, moveFilesToTrash, addToPlaylist }
}
