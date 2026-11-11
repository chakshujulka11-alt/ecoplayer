import { useEffect, useRef, useState } from 'react'
import type { PlaylistWithCount, Song } from '../../shared/types'

export interface ContextMenuState {
  x: number
  y: number
  songIds: number[]
}

interface SongContextMenuProps {
  menu: ContextMenuState
  songs: Song[]
  playlists: PlaylistWithCount[]
  onClose: () => void
  onPlay: () => void
  onPlayNext: () => void
  onAddToQueue: () => void
  onAddToPlaylist: (playlistId: number) => void
  onEdit: () => void
  onDelete: () => void
  onTrash: () => void
}

export function SongContextMenu({
  menu,
  songs,
  playlists,
  onClose,
  onPlay,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  onEdit,
  onDelete,
  onTrash
}: SongContextMenuProps): React.JSX.Element {
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const targets = songs.filter((song) => menu.songIds.includes(song.id))
  const label = targets.length > 1 ? `${targets.length} songs` : (targets[0]?.title ?? 'Song')

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const shiftX = Math.min(0, window.innerWidth - rect.right - 8)
    const shiftY = Math.min(0, window.innerHeight - rect.bottom - 8)
    if (shiftX !== 0 || shiftY !== 0) {
      node.style.left = `${menu.x + shiftX}px`
      node.style.top = `${menu.y + shiftY}px`
    }
  }, [menu.x, menu.y, playlistOpen])

  function itemClass(danger = false): string {
    return `flex w-full items-center rounded px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
      danger ? 'text-destructive hover:text-destructive' : ''
    }`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10" onClick={onClose}>
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
        className="fixed z-50 w-56 rounded border border-border bg-popover p-1"
        style={{ left: menu.x, top: menu.y }}
      >
        <p className="truncate px-3 py-1.5 text-xs font-medium text-muted-foreground">{label}</p>
        <button type="button" role="menuitem" className={itemClass()} onClick={() => { onClose(); onPlay() }}>
          Play
        </button>
        <button type="button" role="menuitem" className={itemClass()} onClick={() => { onClose(); onPlayNext() }}>
          Play next
        </button>
        <button type="button" role="menuitem" className={itemClass()} onClick={() => { onClose(); onAddToQueue() }}>
          Add to queue
        </button>
        <button
          type="button"
          role="menuitem"
          aria-expanded={playlistOpen}
          className={itemClass()}
          onClick={() => setPlaylistOpen((open) => !open)}
        >
          Add to playlist…
        </button>
        {playlistOpen && (
          <div className="max-h-40 overflow-y-auto border-t border-border py-1">
            {playlists.length === 0 && <p className="px-3 py-1.5 text-xs text-muted-foreground">No playlists yet.</p>}
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                role="menuitem"
                className={itemClass()}
                onClick={() => { onClose(); onAddToPlaylist(playlist.id) }}
              >
                <span className="truncate">{playlist.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="my-1 border-t border-border" />
        <button
          type="button"
          role="menuitem"
          className={itemClass()}
          disabled={targets.length !== 1}
          onClick={() => { onClose(); onEdit() }}
        >
          Edit metadata…
        </button>
        <button type="button" role="menuitem" className={itemClass()} onClick={() => { onClose(); onDelete() }}>
          Delete from library
        </button>
        <button type="button" role="menuitem" className={itemClass(true)} onClick={() => { onClose(); onTrash() }}>
          Move {targets.length > 1 ? 'files' : 'file'} to trash
        </button>
      </div>
    </div>
  )
}
