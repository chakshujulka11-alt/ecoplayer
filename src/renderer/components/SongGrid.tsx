import { useState } from 'react'
import { CheckSquare, Music, Square } from 'lucide-react'
import { toMediaCoverUrl } from '../../shared/media'
import type { Song } from '../../shared/types'
import { formatDuration } from './SongTable'
import { cn } from '@/lib/utils'

interface SongGridProps {
  songs: Song[]
  selected: Set<number>
  currentSongId: number | null
  isPlaying: boolean
  onToggleSelect: (id: number) => void
  onPlayAt: (index: number) => void
  onCardContextMenu: (song: Song, x: number, y: number) => void
}

export function SongGrid({
  songs,
  selected,
  currentSongId,
  isPlaying,
  onToggleSelect,
  onPlayAt,
  onCardContextMenu
}: SongGridProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {songs.map((song, index) => {
        const active = song.id === currentSongId
        const checked = selected.has(song.id)
        return (
          <div
            key={song.id}
            onDoubleClick={() => onPlayAt(index)}
            onContextMenu={(event) => {
              event.preventDefault()
              onCardContextMenu(song, event.clientX, event.clientY)
            }}
            className={cn(
              'density-card group relative flex cursor-default flex-col gap-2 rounded border border-border bg-card p-3 transition-colors hover:bg-accent',
              active && 'border-primary',
              checked && 'border-primary bg-primary/5'
            )}
          >
            <button
              type="button"
              onClick={() => onToggleSelect(song.id)}
              aria-label={checked ? `Deselect ${song.title}` : `Select ${song.title}`}
              className={cn(
                'absolute left-2 top-2 z-10 rounded bg-background p-1 text-muted-foreground transition-opacity hover:text-foreground',
                checked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              {checked ? <CheckSquare /> : <Square />}
            </button>
            <button
              type="button"
              onClick={() => onPlayAt(index)}
              aria-label={`Play ${song.title}`}
              className="relative block w-full overflow-hidden rounded bg-secondary"
            >
              <GridArt songId={song.id} />
              {active && isPlaying && (
                <span className="absolute bottom-2 right-2 rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Playing
                </span>
              )}
            </button>
            <span className="flex min-w-0 flex-col">
              <span className={cn('truncate text-sm font-medium', active && 'text-primary')}>{song.title}</span>
              <span className="truncate text-xs text-muted-foreground">{song.artist}</span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Music />
                {formatDuration(song.duration)}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

function GridArt({ songId }: { songId: number }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="flex aspect-square w-full items-center justify-center text-muted-foreground">
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
      className="aspect-square w-full bg-secondary object-cover"
    />
  )
}
