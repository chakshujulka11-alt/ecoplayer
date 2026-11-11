import { create } from 'zustand'
import { engine } from '../audio/engine'
import { callApi } from '../lib/api'
import { toMediaAudioUrl } from '../../shared/media'
import type { PlaylistWithCount, Song } from '../../shared/types'

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = copy[i]
    const b = copy[j]
    if (a === undefined || b === undefined) continue
    copy[i] = b
    copy[j] = a
  }
  return copy
}

interface PlayerState {
  songs: Song[]
  playlists: PlaylistWithCount[]
  /** Queue of song ids with the cursor pointing at the current song. */
  queue: number[]
  cursor: number
  currentSongId: number | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  boost: number
  shuffle: boolean
  loopCurrent: boolean
  error: string | null
  // Library data
  setSongs: (songs: Song[]) => void
  setPlaylists: (playlists: PlaylistWithCount[]) => void
  updateSong: (song: Song) => void
  removeSong: (id: number) => void
  // Transport
  playQueue: (ids: number[], startIndex: number) => void
  queueNext: (ids: number[]) => void
  queueLast: (ids: number[]) => void
  play: () => void
  pause: () => void
  toggle: () => void
  next: () => void
  previous: () => void
  seek: (seconds: number) => void
  playRandom: (ids: number[]) => void
  toggleShuffle: () => void
  toggleLoopCurrent: () => void
  // Levels / position (driven by the engine)
  muted: boolean
  setVolume: (volume: number) => void
  setBoost: (boost: number) => void
  toggleMute: () => void
  setPosition: (currentTime: number, duration: number) => void
  setPlaying: (playing: boolean) => void
  setError: (error: string | null) => void
  // Sleep timer (session only, minutes until auto-pause)
  sleepMinutes: number | null
  sleepEndsAt: number | null
  setSleepTimer: (minutes: number | null) => void
}

let sleepTimeout: ReturnType<typeof setTimeout> | null = null

function clearSleepTimeout(): void {
  if (sleepTimeout !== null) {
    clearTimeout(sleepTimeout)
    sleepTimeout = null
  }
}

function songById(songs: Song[], id: number | null): Song | null {
  if (id === null) return null
  return songs.find((song) => song.id === id) ?? null
}

function loadCursor(get: () => PlayerState, set: (partial: Partial<PlayerState>) => void): void {
  const state = get()
  const id = state.queue[state.cursor] ?? null
  const song = songById(state.songs, id)
  if (!song) {
    set({ isPlaying: false, error: 'That song is no longer in the library.' })
    return
  }
  engine.loadSong(toMediaAudioUrl(song.filePath), song.id, song.title, song.duration)
  set({ currentSongId: song.id, currentTime: 0, duration: song.duration, error: null })
  void engine
    .play()
    .then(() => set({ isPlaying: true }))
    .catch(() => set({ isPlaying: false, error: `Could not play “${song.title}”.` }))
}

export const usePlayerStore = create<PlayerState>()((set, get) => ({
  songs: [],
  playlists: [],
  queue: [],
  cursor: -1,
  currentSongId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  boost: 1,
  muted: false,
  shuffle: false,
  loopCurrent: false,
  error: null,

  setSongs: (songs) => set({ songs }),
  setPlaylists: (playlists) => set({ playlists }),
  updateSong: (song) =>
    set((state) => ({ songs: state.songs.map((s) => (s.id === song.id ? song : s)) })),
  removeSong: (id) => {
    const { currentSongId, cursor, queue } = get()
    const removedIndex = queue.indexOf(id)
    if (currentSongId === id) {
      engine.pause()
      engine.unload()
    }
    const nextCursor =
      currentSongId === id ? -1 : cursor - (removedIndex !== -1 && removedIndex < cursor ? 1 : 0)
    set((state) => ({
      songs: state.songs.filter((s) => s.id !== id),
      queue: state.queue.filter((q) => q !== id),
      cursor: nextCursor,
      currentSongId: state.currentSongId === id ? null : state.currentSongId,
      isPlaying: state.currentSongId === id ? false : state.isPlaying,
      currentTime: state.currentSongId === id ? 0 : state.currentTime
    }))
  },

  playQueue: (ids, startIndex) => {
    if (ids.length === 0) return
    const { shuffle } = get()
    const startId = ids[Math.min(Math.max(startIndex, 0), ids.length - 1)]
    if (startId === undefined) return
    let queue: number[]
    let cursor: number
    if (shuffle) {
      const rest = shuffled(ids.filter((id) => id !== startId))
      queue = [startId, ...rest]
      cursor = 0
    } else {
      queue = [...ids]
      cursor = ids.indexOf(startId)
    }
    set({ queue, cursor })
    loadCursor(get, set)
  },

  play: () => {
    const { currentSongId, queue, cursor } = get()
    if (currentSongId === null) {
      if (queue.length === 0 || cursor < 0) return
      loadCursor(get, set)
      return
    }
    void engine
      .play()
      .then(() => set({ isPlaying: true, error: null }))
      .catch(() => set({ isPlaying: false }))
  },

  pause: () => {
    engine.pause()
    set({ isPlaying: false })
  },

  toggle: () => {
    if (get().isPlaying) get().pause()
    else get().play()
  },

  next: () => {
    const { queue, cursor, loopCurrent } = get()
    if (queue.length === 0) return
    if (cursor + 1 < queue.length) {
      set({ cursor: cursor + 1 })
      loadCursor(get, set)
    } else if (!loopCurrent) {
      engine.pause()
      set({ isPlaying: false })
    }
  },

  previous: () => {
    const { cursor } = get()
    if (engine.currentTime > 3) {
      engine.seekTo(0)
      set({ currentTime: 0 })
      return
    }
    if (cursor > 0) {
      set({ cursor: cursor - 1 })
      loadCursor(get, set)
    } else {
      engine.seekTo(0)
      set({ currentTime: 0 })
    }
  },

  seek: (seconds) => {
    engine.seekTo(seconds)
    set({ currentTime: seconds })
  },

  queueNext: (ids) => {
    if (ids.length === 0) return
    const { queue, cursor } = get()
    if (queue.length === 0 || cursor < 0) {
      get().playQueue(ids, 0)
      return
    }
    set({ queue: [...queue.slice(0, cursor + 1), ...ids, ...queue.slice(cursor + 1)] })
  },

  queueLast: (ids) => {
    if (ids.length === 0) return
    const { queue, cursor } = get()
    if (queue.length === 0 || cursor < 0) {
      get().playQueue(ids, 0)
      return
    }
    set({ queue: [...queue, ...ids] })
  },

  playRandom: (ids) => {
    if (ids.length === 0) return
    if (get().shuffle) {
      const queue = shuffled(ids)
      set({ queue, cursor: 0 })
    } else {
      set({ queue: [...ids], cursor: Math.floor(Math.random() * ids.length) })
    }
    loadCursor(get, set)
  },

  toggleShuffle: () => {
    const { shuffle, queue, cursor } = get()
    const next = !shuffle
    if (next && queue.length > 0 && cursor >= 0) {
      // Keep the current song first, shuffle everything after it.
      const current = queue[cursor]
      const rest = shuffled(queue.filter((_, index) => index !== cursor))
      set({ queue: current !== undefined ? [current, ...rest] : rest, cursor: 0 })
    }
    set({ shuffle: next })
  },

  toggleLoopCurrent: () => set((state) => ({ loopCurrent: !state.loopCurrent })),

  setVolume: (volume) => {
    const state = get()
    // Moving the slider always unmutes.
    engine.setLevels(volume, state.boost)
    set({ volume, muted: false })
  },
  setBoost: (boost) => {
    const state = get()
    engine.setLevels(state.muted ? 0 : state.volume, boost)
    set({ boost })
  },
  toggleMute: () => {
    const state = get()
    const muted = !state.muted
    engine.setLevels(muted ? 0 : state.volume, state.boost)
    set({ muted })
  },
  setPosition: (currentTime, duration) => set({ currentTime, duration }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setError: (error) => set({ error }),

  sleepMinutes: null,
  sleepEndsAt: null,
  setSleepTimer: (minutes) => {
    clearSleepTimeout()
    if (minutes === null) {
      set({ sleepMinutes: null, sleepEndsAt: null })
      return
    }
    const clamped = Math.min(480, Math.max(1, Math.round(minutes)))
    const endsAt = Date.now() + clamped * 60 * 1000
    sleepTimeout = setTimeout(() => {
      sleepTimeout = null
      const state = get()
      state.pause()
      set({ sleepMinutes: null, sleepEndsAt: null })
    }, clamped * 60 * 1000)
    set({ sleepMinutes: clamped, sleepEndsAt: endsAt })
  }
}))

export function selectCurrentSong(state: PlayerState): Song | null {
  return songById(state.songs, state.currentSongId)
}

// One-way wiring: engine events drive store state (never the reverse).
engine.subscribe({
  onTime: (currentTime, duration) => {
    const { currentTime: previous, setPosition } = usePlayerStore.getState()
    if (Math.abs(currentTime - previous) > 0.2 || duration !== usePlayerStore.getState().duration) {
      setPosition(currentTime, duration)
    }
  },
  onEnded: () => {
    const state = usePlayerStore.getState()
    if (state.loopCurrent && state.currentSongId !== null) {
      engine.seekTo(0)
      void engine.play().catch(() => state.setPlaying(false))
      return
    }
    state.next()
  },
  onError: (message) => {
    const state = usePlayerStore.getState()
    state.setPlaying(false)
    state.setError(message)
  }
})

engine.onPlayThreshold = (songId) => {
  void callApi((api) => api.recordPlay(songId)).catch(() => undefined)
}
