import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ImagePlus, ListMusic, Pencil, Play, RotateCcw, Shuffle, Trash2 } from 'lucide-react'
import { toMediaAudioUrl, toMediaCoverUrl } from '../../shared/media'
import { callApi } from '@/lib/api'
import { useSongActions } from '@/hooks/useSongActions'
import { usePlayerStore } from '@/stores/player'
import { SongContextMenu, type ContextMenuState } from '@/components/SongContextMenu'
import { SongTable } from '@/components/SongTable'
import { ConfirmDialog, EditMetadataDialog } from '@/components/dialogs'
import { EmptyState, ErrorState } from '@/components/feedback'
import { TableSkeleton } from '@/components/skeletons'
import { Button } from '@/components/ui/button'
import type { PlaylistWithCount, Song, UpdateSongMetadata } from '../../shared/types'

function coverSrc(playlist: PlaylistWithCount, firstSongId: number | null): string | null {
  if (playlist.coverPath) return toMediaAudioUrl(playlist.coverPath)
  if (firstSongId !== null) return toMediaCoverUrl(firstSongId)
  return null
}

function PlaylistArt({
  playlist,
  firstSongId,
  size,
  onClick
}: {
  playlist: PlaylistWithCount
  firstSongId: number | null
  size: 'md' | 'lg'
  onClick?: () => void
}): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const src = coverSrc(playlist, firstSongId)
  const box = size === 'lg' ? 'h-24 w-24' : 'h-11 w-11'
  const hasCustom = !!playlist.coverPath
  const clickable = !!onClick
  if (!src || failed) {
    return (
      <span
        className={`flex ${box} shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground ${clickable ? 'cursor-pointer hover:bg-accent' : ''}`}
        onClick={onClick}
      >
        <ListMusic />
      </span>
    )
  }
  return (
    <div
      className={`relative shrink-0 ${box} rounded bg-secondary overflow-hidden ${clickable ? 'cursor-pointer group' : ''}`}
      onClick={onClick}
    >
      <img
        key={src}
        src={src}
        alt=""
        draggable={false}
        onError={() => setFailed(true)}
        className={`${box} shrink-0 rounded bg-secondary object-cover ${clickable ? 'group-hover:opacity-100 transition-opacity' : ''}`}
      />
      {clickable && (
        <div
      className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
    >
          <ImagePlus className="h-5 w-5 text-white" />
        </div>
      )}
      {hasCustom && (
        size === 'lg' ? (
          <span className="absolute bottom-1 right-1 rounded bg-primary/95 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-primary-foreground">
            Custom
          </span>
        ) : (
          <span className="absolute bottom-1 right-1 h-2 w-2 rounded bg-primary ring-1 ring-background" />
        )
      )}
    </div>
  )
}

export function Playlists(): React.JSX.Element {
  const playlists = usePlayerStore((s) => s.playlists)

  if (playlists.length === 0) {
    return (
      <div className="flex h-full flex-col p-6">
        <h1 className="text-xl font-semibold">Playlists</h1>
        <EmptyState title="No playlists yet" hint="Create one from the sidebar to organize your music." />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-6">
      <h1 className="mb-4 text-xl font-semibold">Playlists</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {playlists.map((playlist) => (
          <Link
            key={playlist.id}
            to={`/playlists/${playlist.id}`}
            className="density-card flex items-center gap-3 rounded border border-border bg-card p-4 transition-colors hover:bg-accent"
          >
            <PlaylistArt playlist={playlist} firstSongId={playlist.autoCoverSongId} size="md" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{playlist.name}</span>
              <span className="text-xs text-muted-foreground">
                {playlist.songCount} song{playlist.songCount === 1 ? '' : 's'}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

interface PlaylistDetailProps {
  onStatus: (message: string | null) => void
  onChanged: () => Promise<void>
}

export function PlaylistDetail({ onStatus, onChanged }: PlaylistDetailProps): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const playlistId = Number(id)
  const playlists = usePlayerStore((s) => s.playlists)
  const currentSongId = usePlayerStore((s) => s.currentSongId)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const playQueue = usePlayerStore((s) => s.playQueue)
  const playRandom = usePlayerStore((s) => s.playRandom)
  const queueNext = usePlayerStore((s) => s.queueNext)
  const queueLast = usePlayerStore((s) => s.queueLast)
  const { toggleFavorite, saveMetadata, pickCover, removeFromLibrary, moveFilesToTrash, addToPlaylist } =
    useSongActions()

  const [songs, setSongs] = useState<Song[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [editing, setEditing] = useState<Song | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [confirm, setConfirm] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null)

  const playlist = playlists.find((p) => p.id === playlistId)

  useEffect(() => {
    if (!Number.isInteger(playlistId) || playlistId <= 0) {
      setError('Playlist not found.')
      return
    }
    let cancelled = false
    setSongs(null)
    setError(null)
    void callApi((api) => api.getPlaylistSongs(playlistId))
      .then((loaded) => {
        if (!cancelled) setSongs(loaded)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load playlist.')
      })
    return () => {
      cancelled = true
    }
  }, [playlistId])

  if (error) return <ErrorState message={error} />
  if (songs === null) {
    return (
      <div className="flex h-full flex-col p-6">
        <h1 className="mb-4 text-xl font-semibold">Playlist</h1>
        <TableSkeleton rows={8} />
      </div>
    )
  }

  const ids = songs.map((song) => song.id)

  function openMenu(song: Song, x: number, y: number): void {
    // Target all selected songs when right-clicking one of them, otherwise just
    // the clicked song. Never clobber an existing multi-selection.
    const targets = selected.has(song.id) && selected.size > 0 ? [...selected] : [song.id]
    setMenu({ x, y, songIds: targets })
  }

  async function persistOrder(next: Song[]): Promise<void> {
    const orderedIds = next.map((song) => song.id)
    try {
      await callApi((api) => api.reorderPlaylistSongs(playlistId, orderedIds))
      await onChanged()
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Could not save the new order.')
      try {
        setSongs(await callApi((api) => api.getPlaylistSongs(playlistId)))
      } catch {
        // Keep the optimistic order if the reload also fails.
      }
    }
  }

  function handleReorder(fromIndex: number, toIndex: number): void {
    const current = songs
    if (!current) return
    const next = [...current]
    const [moved] = next.splice(fromIndex, 1)
    if (moved === undefined) return
    next.splice(toIndex, 0, moved)
    setSongs(next)
    void persistOrder(next)
  }

  async function removeSelectedFromPlaylist(): Promise<void> {
    const targets = [...selected]
    const current = songs
    if (!current) return
    for (const songId of targets) {
      await callApi((api) => api.removeSongFromPlaylist(playlistId, songId))
    }
    setSongs(current.filter((song) => !selected.has(song.id)))
    setSelected(new Set())
    await onChanged()
    onStatus(`Removed ${targets.length} songs from the playlist. Songs stay in your library.`)
  }

  async function saveEdit(patch: UpdateSongMetadata): Promise<string | null> {
    const current = songs
    if (!editing || !current) return 'No song selected.'
    const failure = await saveMetadata(editing, patch)
    if (failure) return failure
    setSongs(current.map((song) => (song.id === editing.id ? { ...song, ...patch } : song)))
    return null
  }

  async function replaceEditingCover(): Promise<string | null> {
    const current = songs
    if (!editing || !current) return 'No song selected.'
    try {
      const updated = await pickCover(editing)
      if (!updated) return null
      setEditing(updated)
      setSongs(current.map((song) => (song.id === updated.id ? updated : song)))
      onStatus(`Cover updated for “${updated.title}”.`)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : 'Could not replace cover.'
    }
  }

  async function saveRename(): Promise<void> {
    const name = draftName.trim()
    setRenaming(false)
    if (!name || (playlist && name === playlist.name)) return
    try {
      await callApi((api) => api.renamePlaylist(playlistId, name))
      await onChanged()
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Could not rename playlist.')
    }
  }

  async function changeCover(): Promise<void> {
    try {
      await callApi((api) => api.setPlaylistCover(playlistId))
      await onChanged()
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Could not set playlist cover.')
    }
  }

  async function resetCover(): Promise<void> {
    try {
      await callApi((api) => api.clearPlaylistCover(playlistId))
      await onChanged()
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Could not reset playlist cover.')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-4 px-6 pb-2 pt-4">
        {playlist && (
          <PlaylistArt
            playlist={playlist}
            firstSongId={songs[0]?.id ?? null}
            size="lg"
            onClick={() => void changeCover()}
          />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          {renaming ? (
            <input
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => void saveRename()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void saveRename()
                if (event.key === 'Escape') setRenaming(false)
              }}
              aria-label="Playlist name"
              className="h-9 max-w-xs rounded border border-input bg-background px-3 text-xl font-semibold outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <h1 className="truncate text-xl font-semibold">{playlist?.name ?? 'Playlist'}</h1>
          )}
          <span className="text-xs text-muted-foreground">
            {songs.length} song{songs.length === 1 ? '' : 's'} · drag rows to reorder
          </span>
          <span className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" variant="secondary" onClick={() => playQueue(ids, 0)} disabled={songs.length === 0}>
              <Play /> Play all
            </Button>
            <Button size="sm" variant="secondary" onClick={() => playRandom(ids)} disabled={songs.length === 0}>
              <Shuffle /> Shuffle
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraftName(playlist?.name ?? '')
                setRenaming(true)
              }}
            >
              <Pencil /> Rename
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void changeCover()}>
              <ImagePlus /> Cover
            </Button>
            {playlist?.coverPath && (
              <Button size="sm" variant="ghost" onClick={() => void resetCover()}>
                <RotateCcw /> Auto cover
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setConfirm({
                  title: 'Delete playlist',
                  message: `Delete “${playlist?.name ?? 'this playlist'}”? Songs stay in your library.`,
                  action: async () => {
                    await callApi((api) => api.deletePlaylist(playlistId))
                    await onChanged()
                    void navigate('/playlists')
                  }
                })
              }
            >
              <Trash2 /> Delete
            </Button>
          </span>
        </span>
      </div>

      {selected.size > 0 && (
        <div className="mx-6 mb-2 flex shrink-0 items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void (async () => {
                try {
                  await removeSelectedFromPlaylist()
                } catch (err) {
                  onStatus(err instanceof Error ? err.message : 'Could not update playlist.')
                }
              })()
            }
          >
            Remove from playlist
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {songs.length === 0 ? (
          <EmptyState title="This playlist is empty" hint="Right-click songs in the library and choose “Add to playlist”." />
        ) : (
          <SongTable
            songs={songs}
            selected={selected}
            showSelection
            currentSongId={currentSongId}
            isPlaying={isPlaying}
            onToggleSelect={(songId) =>
              setSelected((previous) => {
                const next = new Set(previous)
                if (next.has(songId)) next.delete(songId)
                else next.add(songId)
                return next
              })
            }
            onToggleSelectAll={() =>
              setSelected((previous) => (previous.size === songs.length ? new Set() : new Set(ids)))
            }
            onPlayAt={(index) => playQueue(ids, index)}
            onToggleFavorite={(song) =>
              void toggleFavorite(song)
                .then(() => callApi((api) => api.getPlaylistSongs(playlistId)))
                .then(setSongs)
                .catch((err: unknown) => onStatus(err instanceof Error ? err.message : 'Action failed.'))
            }
            onTrash={(song) =>
              setConfirm({
                title: 'Move file to trash',
                message: `Move “${song.title}” to the trash? The file will leave your disk.`,
                action: async () => {
                  await moveFilesToTrash([song.id])
                  setSongs(songs.filter((s) => s.id !== song.id))
                  onStatus(`Moved “${song.title}” to the trash.`)
                }
              })
            }
            onRowContextMenu={openMenu}
            draggableRows
            onReorder={handleReorder}
          />
        )}
      </div>

      {menu && (
        <SongContextMenu
          menu={menu}
          songs={songs}
          playlists={playlists}
          onClose={() => setMenu(null)}
          onPlay={() => {
            const first = menu.songIds[0]
            if (first !== undefined) playQueue(ids, Math.max(0, ids.indexOf(first)))
          }}
          onPlayNext={() => queueNext(menu.songIds)}
          onAddToQueue={() => queueLast(menu.songIds)}
          onAddToPlaylist={(pid) =>
            void addToPlaylist(pid, menu.songIds)
              .then(() => onStatus(`Added ${menu.songIds.length} songs to playlist.`))
              .catch((err: unknown) => onStatus(err instanceof Error ? err.message : 'Action failed.'))
          }
          onEdit={() => {
            const target = songs.find((song) => song.id === menu.songIds[0])
            if (target) setEditing(target)
          }}
          onDelete={() =>
            setConfirm({
              title: 'Delete from library',
              message: `Remove ${menu.songIds.length} songs from the library? Files stay on disk.`,
              action: async () => {
                await removeFromLibrary(menu.songIds)
                setSongs(songs.filter((s) => !menu.songIds.includes(s.id)))
                setSelected(new Set())
              }
            })
          }
          onTrash={() =>
            setConfirm({
              title: 'Move files to trash',
              message: `Move ${menu.songIds.length} files to the trash? They will leave your disk.`,
              action: async () => {
                await moveFilesToTrash(menu.songIds)
                setSongs(songs.filter((s) => !menu.songIds.includes(s.id)))
                setSelected(new Set())
              }
            })
          }
        />
      )}
      {editing && (
        <EditMetadataDialog
          song={editing}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
          onPickCover={replaceEditingCover}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel="Confirm"
          onConfirm={() =>
            void confirm
              .action()
              .catch((err: unknown) => onStatus(err instanceof Error ? err.message : 'Action failed.'))
              .finally(() => setConfirm(null))
          }
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
