import { useState } from 'react'
import { GripVertical, Heart, Music, Trash2 } from 'lucide-react'
import { toMediaCoverUrl } from '../../shared/media'
import type { Song } from '../../shared/types'
import { cn } from '@/lib/utils'

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '--:--'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

interface SongTableProps {
  songs: Song[]
  selected: Set<number>
  showSelection: boolean
  currentSongId: number | null
  isPlaying: boolean
  onToggleSelect: (id: number) => void
  onToggleSelectAll: () => void
  onPlayAt: (index: number) => void
  onToggleFavorite: (song: Song) => void
  onTrash: (song: Song) => void
  onRowContextMenu: (song: Song, x: number, y: number) => void
  draggableRows?: boolean
  onReorder?: (fromIndex: number, toIndex: number) => void
}

export function SongTable({
  songs,
  selected,
  showSelection,
  currentSongId,
  isPlaying,
  onToggleSelect,
  onToggleSelectAll,
  onPlayAt,
  onToggleFavorite,
  onTrash,
  onRowContextMenu,
  draggableRows = false,
  onReorder
}: SongTableProps): React.JSX.Element {
  const allSelected = songs.length > 0 && songs.every((song) => selected.has(song.id))
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-[1] bg-background">
        <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
          {showSelection && (
            <th className="w-10 px-2 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                aria-label="Select all songs"
                className="h-4 w-4 accent-primary"
              />
            </th>
          )}
          <th className="px-4 py-2 font-medium">Title</th>
          <th className="px-4 py-2 font-medium">Artist</th>
          <th className="hidden px-4 py-2 font-medium lg:table-cell">Album</th>
          <th className="hidden w-28 px-4 py-2 font-medium xl:table-cell">Genre</th>
          <th className="w-20 px-4 py-2 text-right font-medium">Time</th>
          <th className="w-24 px-4 py-2" aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {songs.map((song, index) => {
          const active = song.id === currentSongId
          const checked = selected.has(song.id)
          return (
            <tr
                key={song.id}
                draggable={draggableRows}
                onDragStart={(event) => {
                  if (!draggableRows) return
                  event.dataTransfer.setData('text/plain', String(index))
                  event.dataTransfer.effectAllowed = 'move'
                  setDragFrom(index)
                }}
                onDragEnd={() => setDragFrom(null)}
                onDragOver={(event) => {
                  if (draggableRows) event.preventDefault()
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragFrom(null)
                  if (!draggableRows || !onReorder) return
                  const from = Number(event.dataTransfer.getData('text/plain'))
                  if (Number.isInteger(from) && from !== index) onReorder(from, index)
                }}
                onDoubleClick={() => onPlayAt(index)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  onRowContextMenu(song, event.clientX, event.clientY)
                }}
                className={cn(
                  'group cursor-default border-b border-border/50 transition-colors hover:bg-accent',
                  active && 'bg-accent',
                  checked && 'bg-primary/5',
                  draggableRows && 'cursor-move',
                  dragFrom === index && 'opacity-50'
                )}
              >
              {showSelection && (
                <td className="px-2 py-2" onDoubleClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleSelect(song.id)}
                    aria-label={`Select ${song.title}`}
                    className="h-4 w-4 accent-primary"
                  />
                </td>
              )}
              <td className="px-4 py-2">
                  <span className="flex items-center gap-3">
                    {draggableRows && (
                      <GripVertical aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <SongArt songId={song.id} />
                  <span className="flex min-w-0 flex-col">
                    <span className={cn('truncate font-medium', active && 'text-primary')}>
                      {song.title}
                      {active && isPlaying ? ' — playing' : ''}
                    </span>
                    <span className="truncate text-xs text-muted-foreground lg:hidden">{song.album}</span>
                  </span>
                </span>
              </td>
              <td className="max-w-44 truncate px-4 py-2 text-muted-foreground">{song.artist}</td>
              <td className="hidden max-w-52 truncate px-4 py-2 text-muted-foreground lg:table-cell">{song.album}</td>
              <td className="hidden max-w-32 truncate px-4 py-2 text-muted-foreground xl:table-cell">
                {song.genre ?? '—'}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                {formatDuration(song.duration)}
              </td>
              <td className="px-4 py-2 text-right">
                <span className="inline-flex items-center">
                  <button
                    type="button"
                    title={song.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    onClick={() => onToggleFavorite(song)}
                    className={cn(
                      'rounded p-1.5 transition-opacity hover:bg-accent hover:text-primary',
                      song.isFavorite ? 'text-primary opacity-100' : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <Heart fill={song.isFavorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    title="Move file to trash"
                    onClick={() => onTrash(song)}
                    className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 />
                  </button>
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function SongArt({ songId }: { songId: number }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground">
        <Music />
      </span>
    )
  }
  return (
    <img
      src={toMediaCoverUrl(songId)}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded bg-secondary object-cover"
    />
  )
}
