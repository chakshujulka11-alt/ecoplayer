import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Dices,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Timer,
  Volume2,
  Zap
} from 'lucide-react'
import { toMediaCoverUrl } from '../../shared/media'
import { selectCurrentSong, usePlayerStore } from '@/stores/player'
import { Button } from './ui/button'
import { ConfirmDialog } from './dialogs'
import { formatDuration } from './SongTable'
import { cn } from '@/lib/utils'

const BOOST_WARNING_KEY = 'boost-warning-seen'
const DEFAULT_BOOST_LEVEL = 2

interface PlayerBarProps {
  onPlaybackError: (message: string) => void
  onVolumeChange: (volume: number) => void
  onBoostChange: (boost: number) => void
}

function BarArt({ songId }: { songId: number }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground">
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
      className="h-12 w-12 shrink-0 rounded bg-secondary object-cover"
    />
  )
}

export function PlayerBar({ onPlaybackError, onVolumeChange, onBoostChange }: PlayerBarProps): React.JSX.Element {
  const songs = usePlayerStore((s) => s.songs)
  const song = usePlayerStore(selectCurrentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const volume = usePlayerStore((s) => s.volume)
  const boost = usePlayerStore((s) => s.boost)
  const shuffle = usePlayerStore((s) => s.shuffle)
  const loopCurrent = usePlayerStore((s) => s.loopCurrent)
  const queue = usePlayerStore((s) => s.queue)
  const cursor = usePlayerStore((s) => s.cursor)
  const error = usePlayerStore((s) => s.error)
  const toggle = usePlayerStore((s) => s.toggle)
  const next = usePlayerStore((s) => s.next)
  const previous = usePlayerStore((s) => s.previous)
  const seek = usePlayerStore((s) => s.seek)
  const playRandom = usePlayerStore((s) => s.playRandom)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)
  const toggleLoopCurrent = usePlayerStore((s) => s.toggleLoopCurrent)
  const sleepMinutes = usePlayerStore((s) => s.sleepMinutes)
  const sleepEndsAt = usePlayerStore((s) => s.sleepEndsAt)
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer)
  const [boostWarningOpen, setBoostWarningOpen] = useState(false)
  const [timerOpen, setTimerOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const lastBoost = useRef(DEFAULT_BOOST_LEVEL)
  const pendingBoost = useRef(DEFAULT_BOOST_LEVEL)

  useEffect(() => {
    if (error) onPlaybackError(error)
  }, [error, onPlaybackError])

  useEffect(() => {
    if (sleepEndsAt === null) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [sleepEndsAt])

  const queueLabel = queue.length > 0 ? `${cursor + 1}/${queue.length}` : ''
  const boosting = boost > 1.001
  const sleepRemainingMs = sleepEndsAt === null ? 0 : Math.max(0, sleepEndsAt - now)
  const sleepLabel =
    sleepEndsAt === null
      ? ''
      : `${Math.floor(sleepRemainingMs / 60000)}:${String(Math.floor((sleepRemainingMs % 60000) / 1000)).padStart(2, '0')}`

  function enableBoost(level: number): void {
    if (window.localStorage.getItem(BOOST_WARNING_KEY) !== '1') {
      pendingBoost.current = level
      setBoostWarningOpen(true)
      return
    }
    onBoostChange(level)
  }

  function toggleBoost(): void {
    if (boosting) {
      lastBoost.current = boost
      onBoostChange(1)
    } else {
      enableBoost(lastBoost.current)
    }
  }

  function confirmBoostWarning(): void {
    window.localStorage.setItem(BOOST_WARNING_KEY, '1')
    setBoostWarningOpen(false)
    onBoostChange(pendingBoost.current)
  }

  return (
    <footer className="flex h-[76px] shrink-0 items-center gap-3 border-t border-border bg-card px-4">
      <span className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleShuffle}
          aria-label="Toggle shuffle"
          aria-pressed={shuffle}
          title={shuffle ? 'Shuffle on' : 'Shuffle off'}
        >
          <Shuffle className={cn(shuffle && 'text-primary')} />
        </Button>
        <Button variant="ghost" size="icon" onClick={previous} disabled={!song} aria-label="Previous" title="Previous">
          <SkipBack />
        </Button>
        <Button variant="default" size="icon" onClick={toggle} disabled={!song} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <Pause /> : <Play />}
        </Button>
        <Button variant="ghost" size="icon" onClick={next} disabled={!song} aria-label="Next" title="Next">
          <SkipForward />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLoopCurrent}
          aria-label="Loop current song"
          aria-pressed={loopCurrent}
          title={loopCurrent ? 'Looping current song' : 'Loop off'}
        >
          {loopCurrent ? <Repeat1 className="text-primary" /> : <Repeat />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => playRandom(songs.map((s) => s.id))}
          disabled={songs.length === 0}
          aria-label="Play random"
          title="Play random from library"
        >
          <Dices />
        </Button>
      </span>

      <span className="flex min-w-0 flex-1 items-center gap-3">
        {song ? <BarArt songId={song.id} /> : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground">
            <Music />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-sm font-medium leading-5" title={song ? `${song.title} — ${song.artist}` : undefined}>
              {song ? `${song.title} — ${song.artist}` : 'Nothing playing'}
            </span>
            {queueLabel && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{queueLabel}</span>}
          </span>
          <span className="flex items-center gap-2">
            <span className="w-11 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {formatDuration(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.01)}
              step={0.1}
              value={Math.min(currentTime, duration)}
              onChange={(event) => seek(Number(event.target.value))}
              disabled={!song}
              aria-label="Seek"
              className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded bg-secondary accent-primary disabled:cursor-default disabled:opacity-50"
            />
            <span className="w-11 shrink-0 text-xs tabular-nums text-muted-foreground">{formatDuration(duration)}</span>
          </span>
        </span>
      </span>

      <span className="relative hidden shrink-0 items-center gap-2 md:flex">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTimerOpen((open) => !open)}
          aria-label="Sleep timer"
          aria-pressed={sleepEndsAt !== null}
          title={sleepEndsAt !== null ? `Sleep in ${sleepLabel}` : 'Sleep timer off'}
        >
          <Timer className={cn(sleepEndsAt !== null && 'text-primary')} />
        </Button>
        {sleepEndsAt !== null && (
          <span className="text-xs tabular-nums text-muted-foreground" title="Time until auto-pause">
            {sleepLabel}
          </span>
        )}
        {timerOpen && (
          <>
            <button
              type="button"
              aria-label="Close sleep timer menu"
              className="fixed inset-0 z-40 cursor-default bg-transparent"
              onClick={() => setTimerOpen(false)}
            />
            <span
              role="menu"
              aria-label="Sleep timer"
              onKeyDown={(event) => {
                if (event.key === 'Escape') setTimerOpen(false)
              }}
              className="absolute bottom-11 right-0 z-50 flex w-44 flex-col rounded border border-border bg-popover p-1"
            >
              <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Stop playing in…</span>
              {[
                { label: 'Off', value: null },
                { label: '5 minutes', value: 5 },
                { label: '15 minutes', value: 15 },
                { label: '30 minutes', value: 30 },
                { label: '60 minutes', value: 60 }
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  role="menuitemradio"
                  aria-checked={
                    (option.value === null && sleepMinutes === null) || option.value === sleepMinutes
                  }
                  onClick={() => {
                    setSleepTimer(option.value)
                    setTimerOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center rounded px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                    ((option.value === null && sleepMinutes === null) || option.value === sleepMinutes) &&
                      'text-primary'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </span>
          </>
        )}
      </span>
      <span className="hidden shrink-0 items-center gap-2 md:flex" title="Volume">
        <Volume2 />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          aria-label="Volume"
          className="h-1 w-24 cursor-pointer appearance-none rounded bg-secondary accent-primary"
        />
      </span>
      <span className="hidden shrink-0 items-center gap-2 lg:flex">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleBoost}
          aria-label={boosting ? 'Disable volume boost' : 'Enable volume boost'}
          aria-pressed={boosting}
          title={boosting ? `Boost on (${Math.round(boost * 100)}%) — click to reset to 100%` : 'Boost volume beyond 100%'}
        >
          <Zap className={cn(boosting && 'text-primary')} fill={boosting ? 'currentColor' : 'none'} />
        </Button>
        <label
          className="flex items-center gap-2 text-xs text-muted-foreground"
          title="Volume boost (Web Audio gain with limiter)"
        >
          Boost
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={boost}
            onChange={(event) => {
              const level = Number(event.target.value)
              if (level > 1.001) {
                lastBoost.current = level
                enableBoost(level)
              } else {
                onBoostChange(1)
              }
            }}
            aria-label="Volume boost"
            className="h-1 w-20 cursor-pointer appearance-none rounded bg-secondary accent-primary"
          />
          <span className={cn('flex w-24 items-center gap-1 tabular-nums', boosting && 'font-medium text-primary')}>
            {boosting && (
              <AlertTriangle aria-label="Boost above 100 percent uses the limiter to prevent clipping" />
            )}
            {Math.round(boost * 100)}%
          </span>
        </label>
      </span>
      {boostWarningOpen && (
        <ConfirmDialog
          title="Loud volume warning"
          message="Boosting beyond 100% can distort the sound and may damage your hearing at high volumes. A limiter is always engaged to prevent harsh clipping. Turn boost on?"
          confirmLabel="Turn on boost"
          onConfirm={confirmBoostWarning}
          onCancel={() => setBoostWarningOpen(false)}
        />
      )}
    </footer>
  )
}
