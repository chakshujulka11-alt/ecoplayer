import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Library, ListMusic, Music, Play, Shuffle } from 'lucide-react'
import { toMediaCoverUrl } from '../../shared/media'
import { callApi } from '@/lib/api'
import { hexToHslTriplet } from '@/lib/appearance'
import { selectCurrentSong, usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { Visualizer } from '@/components/Visualizer'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback'
import { CardsSkeleton } from '@/components/skeletons'
import { Button } from '@/components/ui/button'
import type { Song } from '../../shared/types'
import { cn } from '@/lib/utils'

type TopCount = 1 | 5 | 10 | 25
type TopPeriod = 'all' | 'month' | 'week'

const TOP_COUNTS: { value: TopCount; label: string }[] = [
  { value: 1, label: 'Top 1' },
  { value: 5, label: 'Top 5' },
  { value: 10, label: 'Top 10' },
  { value: 25, label: 'Top 25' }
]

const TOP_PERIODS: { value: TopPeriod; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' }
]

function periodDays(period: TopPeriod): number | null {
  if (period === 'week') return 7
  if (period === 'month') return 30
  return null
}

function HomeArt({ songId }: { songId: number }): React.JSX.Element {
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

function SongCards({
  songs,
  onPlayAt,
  onShuffle
}: {
  songs: Song[]
  onPlayAt: (index: number) => void
  onShuffle: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onShuffle}>
          <Shuffle /> Shuffle play
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {songs.map((song, index) => (
          <button
            key={song.id}
            type="button"
            onClick={() => onPlayAt(index)}
            className="density-card flex flex-col gap-2 rounded border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
          >
            <span className="relative block overflow-hidden rounded bg-secondary">
              <HomeArt songId={song.id} />
              <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded bg-background text-xs font-bold tabular-nums">
                {index + 1}
              </span>
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{song.title}</span>
              <span className="truncate text-xs text-muted-foreground">{song.artist}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{song.playCount} plays</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function Home(): React.JSX.Element {
  const songs = usePlayerStore((s) => s.songs)
  const playlists = usePlayerStore((s) => s.playlists)
  const playQueue = usePlayerStore((s) => s.playQueue)
  const playRandom = usePlayerStore((s) => s.playRandom)
  const currentSong = usePlayerStore(selectCurrentSong)
  const accent = useUiStore((s) => s.accent)
  const [recent, setRecent] = useState<Song[] | null>(null)
  const [mostPlayed, setMostPlayed] = useState<Song[] | null>(null)
  const [topSongs, setTopSongs] = useState<Song[] | null>(null)
  const [topCount, setTopCount] = useState<TopCount>(5)
  const [topPeriod, setTopPeriod] = useState<TopPeriod>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [freshRecent, freshMost] = await Promise.all([
          callApi((api) => api.getRecentlyAdded(10)),
          callApi((api) => api.getMostPlayed(10))
        ])
        if (!cancelled) {
          setRecent(freshRecent)
          setMostPlayed(freshMost)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load home.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setTopSongs(null)
    void (async () => {
      try {
        const days = periodDays(topPeriod)
        const top =
          days === null
            ? await callApi((api) => api.getMostPlayed(topCount))
            : await callApi((api) => api.getTopSongsByPeriod(days, topCount))
        if (!cancelled) setTopSongs(top)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load top songs.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [topCount, topPeriod])

  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />
  if (recent === null || mostPlayed === null) {
    return (
      <div className="flex h-full flex-col p-6">
        <h1 className="mb-4 text-2xl font-bold">Home</h1>
        <CardsSkeleton cards={10} />
      </div>
    )
  }

  const totalMinutes = Math.round(songs.reduce((sum, song) => sum + song.duration, 0) / 60)
  const artistCount = new Set(songs.map((song) => song.artist)).size
  const topIds = (topSongs ?? []).map((song) => song.id)

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">Home</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {songs.length} songs · {artistCount} artists · {totalMinutes} minutes
        </p>
      </div>

      {currentSong && (
        <section className="flex items-center gap-4 rounded border border-border bg-card p-4" aria-label="Now playing">
          <span className="block w-14 shrink-0 overflow-hidden rounded bg-secondary">
            <HomeArt songId={currentSong.id} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Now playing</span>
            <span className="truncate text-sm font-semibold">
              {currentSong.title} — {currentSong.artist}
            </span>
          </span>
          <span className="block h-20 min-w-0 flex-1">
            <Visualizer accentHsl={hexToHslTriplet(accent)} className="h-full w-full" />
          </span>
        </section>
      )}

      {recent.length === 0 && mostPlayed.length === 0 ? (
        <EmptyState
          title="Your library is empty"
          hint="Use “Add files”, “Add folder”, or drag audio files anywhere into the window to import local music."
        />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Top Songs</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex overflow-hidden rounded border border-input" role="group" aria-label="Top count">
                {TOP_COUNTS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTopCount(option.value)}
                    aria-pressed={topCount === option.value}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium transition-colors',
                      topCount === option.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </span>
              <span className="flex overflow-hidden rounded border border-input" role="group" aria-label="Top period">
                {TOP_PERIODS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTopPeriod(option.value)}
                    aria-pressed={topPeriod === option.value}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium transition-colors',
                      topPeriod === option.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </span>
            </div>
            {topSongs === null ? (
              <LoadingState message="Loading top songs…" />
            ) : topSongs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {topPeriod === 'all' ? 'No plays yet.' : 'No plays in this period yet.'}
              </p>
            ) : (
              <SongCards
                songs={topSongs}
                onPlayAt={(index) => playQueue(topIds, index)}
                onShuffle={() => playRandom(topIds)}
              />
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Most Played</h2>
            {mostPlayed.length === 0 ? (
              <p className="text-sm text-muted-foreground">Play something to build your chart.</p>
            ) : (
              <SongCards
                songs={mostPlayed}
                onPlayAt={(index) => playQueue(mostPlayed.map((s) => s.id), index)}
                onShuffle={() => playRandom(mostPlayed.map((s) => s.id))}
              />
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Recently Added</h2>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing new lately.</p>
            ) : (
              <SongCards
                songs={recent}
                onPlayAt={(index) => playQueue(recent.map((s) => s.id), index)}
                onShuffle={() => playRandom(recent.map((s) => s.id))}
              />
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Browse</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                to="/library"
                className="density-card flex items-center gap-3 rounded border border-border bg-card p-4 transition-colors hover:bg-accent"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground">
                  <Library />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">Music Library</span>
                  <span className="text-xs text-muted-foreground">Search, filter, and manage every song</span>
                </span>
              </Link>
              {playlists.slice(0, 3).map((playlist) => (
                <Link
                  key={playlist.id}
                  to={`/playlists/${playlist.id}`}
                  className="density-card flex items-center gap-3 rounded border border-border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground">
                    <ListMusic />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{playlist.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {playlist.songCount} song{playlist.songCount === 1 ? '' : 's'}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
            {songs.length > 0 && (
              <div>
                <Button variant="default" size="sm" onClick={() => playRandom(songs.map((s) => s.id))}>
                  <Play /> Play random
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
