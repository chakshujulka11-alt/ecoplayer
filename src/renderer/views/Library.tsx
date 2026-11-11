import { useMemo, useState } from 'react'
import { LayoutGrid, Play, Search, Shuffle, Table2, X } from 'lucide-react'
import { useSongActions } from '@/hooks/useSongActions'
import { usePlayerStore } from '@/stores/player'
import { SongContextMenu, type ContextMenuState } from '@/components/SongContextMenu'
import { SongGrid } from '@/components/SongGrid'
import { SongTable } from '@/components/SongTable'
import { ConfirmDialog, EditMetadataDialog } from '@/components/dialogs'
import { EmptyState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import type { Song, UpdateSongMetadata } from '../../shared/types'
import { cn } from '@/lib/utils'

type SortKey = 'title' | 'artist' | 'album' | 'dateAdded' | 'playCount'
type ViewMode = 'table' | 'grid'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'dateAdded', label: 'Date added' },
  { value: 'playCount', label: 'Play count' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'artist', label: 'Artist A–Z' },
  { value: 'album', label: 'Album A–Z' }
]

function compareSongs(sort: SortKey): (a: Song, b: Song) => number {
  switch (sort) {
    case 'title':
      return (a, b) => a.title.localeCompare(b.title)
    case 'artist':
      return (a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title)
    case 'album':
      return (a, b) => a.album.localeCompare(b.album) || a.title.localeCompare(b.title)
    case 'playCount':
      return (a, b) => b.playCount - a.playCount || a.title.localeCompare(b.title)
    case 'dateAdded':
      return (a, b) => b.dateAdded.localeCompare(a.dateAdded) || b.id - a.id
  }
}

interface LibraryProps {
  onStatus: (message: string | null) => void
}

export function Library({ onStatus }: LibraryProps): React.JSX.Element {
  const songs = usePlayerStore((s) => s.songs)
  const playlists = usePlayerStore((s) => s.playlists)
  const currentSongId = usePlayerStore((s) => s.currentSongId)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const playQueue = usePlayerStore((s) => s.playQueue)
  const playRandom = usePlayerStore((s) => s.playRandom)
  const queueNext = usePlayerStore((s) => s.queueNext)
  const queueLast = usePlayerStore((s) => s.queueLast)
  const { toggleFavorite, saveMetadata, pickCover, removeFromLibrary, moveFilesToTrash, addToPlaylist } =
    useSongActions()

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('dateAdded')
  const [genre, setGenre] = useState('all')
  const [artist, setArtist] = useState('all')
  const [album, setAlbum] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    window.localStorage.getItem('library-view') === 'grid' ? 'grid' : 'table'
  )
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [editing, setEditing] = useState<Song | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [playlistPick, setPlaylistPick] = useState('')

  const genres = useMemo(() => [...new Set(songs.map((s) => s.genre).filter((g): g is string => g !== null))].sort(), [songs])
  const artists = useMemo(() => [...new Set(songs.map((s) => s.artist))].sort(), [songs])
  const albums = useMemo(() => [...new Set(songs.map((s) => s.album))].sort(), [songs])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return songs
      .filter((song) => {
        if (q && !(song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q) || song.album.toLowerCase().includes(q))) {
          return false
        }
        if (genre !== 'all' && song.genre !== genre) return false
        if (artist !== 'all' && song.artist !== artist) return false
        if (album !== 'all' && song.album !== album) return false
        return true
      })
      .sort(compareSongs(sort))
  }, [songs, query, genre, artist, album, sort])

  const visibleIds = useMemo(() => visible.map((song) => song.id), [visible])
  const selectedIds = useMemo(() => visibleIds.filter((id) => selected.has(id)), [visibleIds, selected])

  function toggleSelect(id: number): void {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll(): void {
    setSelected((previous) => {
      const allVisible = visibleIds.every((id) => previous.has(id))
      if (allVisible) {
        const next = new Set(previous)
        for (const id of visibleIds) next.delete(id)
        return next
      }
      return new Set([...previous, ...visibleIds])
    })
  }

  function openMenu(song: Song, x: number, y: number): void {
    // Target all selected songs when right-clicking one of them, otherwise just
    // the clicked song. Never clobber an existing multi-selection.
    const targets = selected.has(song.id) && selected.size > 0 ? [...selected] : [song.id]
    setMenu({ x, y, songIds: targets })
  }

  async function runGuarded(action: () => Promise<void>, success: string | null): Promise<void> {
    try {
      await action()
      if (success) onStatus(success)
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Action failed.')
    }
  }

  function askConfirm(title: string, message: string, action: () => Promise<void>): void {
    setConfirm({ title, message, action })
  }

  async function confirmAction(): Promise<void> {
    if (!confirm) return
    setConfirmBusy(true)
    try {
      await confirm.action()
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Action failed.')
    } finally {
      setConfirmBusy(false)
      setConfirm(null)
    }
  }

  async function saveEdit(patch: UpdateSongMetadata): Promise<string | null> {
    if (!editing) return 'No song selected.'
    const failure = await saveMetadata(editing, patch)
    if (!failure) onStatus(`Updated “${patch.title}”.`)
    return failure
  }

  async function replaceEditingCover(): Promise<string | null> {
    if (!editing) return 'No song selected.'
    try {
      const updated = await pickCover(editing)
      if (!updated) return null
      setEditing(updated)
      onStatus(`Cover updated for “${updated.title}”.`)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : 'Could not replace cover.'
    }
  }

  function setMode(mode: ViewMode): void {
    setViewMode(mode)
    window.localStorage.setItem('library-view', mode)
  }

  const filtering = query.trim() !== '' || genre !== 'all' || artist !== 'all' || album !== 'all'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-6 pb-2 pt-4">
        <h1 className="mr-auto text-xl font-semibold">Library</h1>
        <span className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, artist, album"
            aria-label="Search library"
            className="h-8 w-56 rounded border border-input bg-background pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </span>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          aria-label="Sort library"
          className="h-8 rounded border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={genre}
          onChange={(event) => setGenre(event.target.value)}
          aria-label="Filter by genre"
          className="h-8 max-w-36 rounded border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All genres</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={artist}
          onChange={(event) => setArtist(event.target.value)}
          aria-label="Filter by artist"
          className="h-8 max-w-36 rounded border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All artists</option>
          {artists.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={album}
          onChange={(event) => setAlbum(event.target.value)}
          aria-label="Filter by album"
          className="h-8 max-w-36 rounded border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All albums</option>
          {albums.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <span className="flex overflow-hidden rounded border border-input">
          <button
            type="button"
            onClick={() => setMode('table')}
            aria-label="Table view"
            title="Table view"
            className={cn('p-1.5', viewMode === 'table' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}
          >
            <Table2 />
          </button>
          <button
            type="button"
            onClick={() => setMode('grid')}
            aria-label="Grid view"
            title="Grid view"
            className={cn('p-1.5', viewMode === 'grid' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}
          >
            <LayoutGrid />
          </button>
        </span>
      </div>

      {selectedIds.length > 0 && (
        <div className="mx-6 mb-2 flex shrink-0 flex-wrap items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.length} selected</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => playQueue(visibleIds, Math.max(0, visibleIds.indexOf(selectedIds[0] as number)))}
          >
            <Play /> Play
          </Button>
          <Button size="sm" variant="secondary" onClick={() => playRandom(selectedIds)}>
            <Shuffle /> Shuffle
          </Button>
          <select
            value={playlistPick}
            onChange={(event) => setPlaylistPick(event.target.value)}
            aria-label="Choose playlist"
            className="h-8 rounded border border-input bg-background px-2 text-sm outline-none"
          >
            <option value="">Add to playlist…</option>
            {playlists.map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            disabled={!playlistPick}
            onClick={() =>
              void runGuarded(async () => {
                await addToPlaylist(Number(playlistPick), selectedIds)
                setPlaylistPick('')
              }, `Added ${selectedIds.length} songs to playlist.`)
            }
          >
            Add
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              askConfirm(
                'Delete from library',
                `Remove ${selectedIds.length} songs from the library? Files stay on disk.`,
                async () => {
                  await removeFromLibrary(selectedIds)
                  setSelected(new Set())
                  onStatus(`Removed ${selectedIds.length} songs from the library.`)
                }
              )
            }
          >
            Remove
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {visible.length === 0 ? (
          <EmptyState
            title={songs.length === 0 ? 'Your library is empty' : 'No songs match'}
            hint={
              songs.length === 0
                ? 'Use “Add files”, “Add folder”, or drag audio files anywhere into the window.'
                : 'Try a different search, sort, or filter combination.'
            }
          />
        ) : viewMode === 'table' ? (
          <SongTable
            songs={visible}
            selected={selected}
            showSelection
            currentSongId={currentSongId}
            isPlaying={isPlaying}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onPlayAt={(index) => playQueue(visibleIds, index)}
            onToggleFavorite={(song) => void runGuarded(() => toggleFavorite(song), null)}
            onTrash={(song) =>
              askConfirm(
                'Move file to trash',
                `Move “${song.title}” to the trash? The file will leave your disk.`,
                async () => {
                  await moveFilesToTrash([song.id])
                  onStatus(`Moved “${song.title}” to the trash.`)
                }
              )
            }
            onRowContextMenu={openMenu}
          />
        ) : (
          <SongGrid
            songs={visible}
            selected={selected}
            currentSongId={currentSongId}
            isPlaying={isPlaying}
            onToggleSelect={toggleSelect}
            onPlayAt={(index) => playQueue(visibleIds, index)}
            onCardContextMenu={openMenu}
          />
        )}
      </div>

      {menu && (
        <SongContextMenu
          menu={menu}
          songs={visible}
          playlists={playlists}
          onClose={() => setMenu(null)}
          onPlay={() => {
            const first = menu.songIds[0]
            if (first !== undefined) playQueue(visibleIds, Math.max(0, visibleIds.indexOf(first)))
          }}
          onPlayNext={() => queueNext(menu.songIds)}
          onAddToQueue={() => queueLast(menu.songIds)}
          onAddToPlaylist={(playlistId) =>
            void runGuarded(
              () => addToPlaylist(playlistId, menu.songIds),
              `Added ${menu.songIds.length} songs to playlist.`
            )
          }
          onEdit={() => {
            const target = visible.find((song) => song.id === menu.songIds[0])
            if (target) setEditing(target)
          }}
          onDelete={() =>
            askConfirm(
              'Delete from library',
              `Remove ${menu.songIds.length} songs from the library? Files stay on disk.`,
              async () => {
                await removeFromLibrary(menu.songIds)
                setSelected(new Set())
                onStatus(`Removed ${menu.songIds.length} songs from the library.`)
              }
            )
          }
          onTrash={() =>
            askConfirm(
              'Move files to trash',
              `Move ${menu.songIds.length} files to the trash? They will leave your disk.`,
              async () => {
                await moveFilesToTrash(menu.songIds)
                setSelected(new Set())
                onStatus(`Moved ${menu.songIds.length} files to the trash.`)
              }
            )
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
          busy={confirmBusy}
          onConfirm={() => void confirmAction()}
          onCancel={() => setConfirm(null)}
        />
      )}
      <p className="shrink-0 px-6 py-1 text-xs text-muted-foreground">
        {visible.length} song{visible.length === 1 ? '' : 's'}
        {filtering && ` (filtered from ${songs.length})`}
      </p>
    </div>
  )
}
