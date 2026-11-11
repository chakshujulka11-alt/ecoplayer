/**
 * Single reusable audio engine (renderer only, no Node.js APIs).
 *
 * One persistent HTMLAudioElement feeds a fixed Web Audio graph:
 * source -> gain (volume * boost) -> compressor/limiter -> analyser -> destination.
 * The media element and its MediaElementSource are created once, so switching
 * songs never rebuilds the graph (no glitches, no leaks).
 */

export interface EngineEvents {
  onTime: (currentTime: number, duration: number) => void
  onEnded: () => void
  onError: (message: string) => void
}

/** Called once per loaded song when 5s or 50% has played (for play history). */
export type PlayThresholdCallback = (songId: number) => void

export interface AudioSnapshot {
  hasSrc: boolean
  currentSrc: string
  paused: boolean
  ended: boolean
  readyState: number
  networkState: number
  elementVolume: number
  elementMuted: boolean
  graphBuilt: boolean
  contextState: string
  contextSampleRate: number
  gainValue: number
  targetGain: number
  analyserBins: number
  analyserPeak: number
  lastAnalyserPeak: number
  compressorThreshold: number
  compressorRatio: number
  songId: number | null
}

const HISTORY_SECONDS = 5
const HISTORY_FRACTION = 0.5

function log(...args: unknown[]): void {
  console.debug('[audio]', ...args)
}

function logError(...args: unknown[]): void {
  console.error('[audio]', ...args)
}

class AudioEngine {
  private audio: HTMLAudioElement
  private ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private analyserNode: AnalyserNode | null = null
  private compressorNode: DynamicsCompressorNode | null = null
  private graphBuilt = false
  private songId: number | null = null
  private songTitle = ''
  private thresholdReported = false
  private listeners = new Set<EngineEvents>()
  private volume = 0.8
  private boost = 1
  private lastAnalyserPeak = 0
  onPlayThreshold: PlayThresholdCallback | null = null

  constructor() {
    this.audio = new Audio()
    this.audio.preload = 'auto'
    // CORS mode is REQUIRED for MediaElementSource: without it, a cross-origin
    // resource (media:// vs file://) decodes and plays but the graph receives
    // only silence. Must be set before src. The main process answers media://
    // with Access-Control-Allow-Origin: * so the check passes.
    this.audio.crossOrigin = 'anonymous'
    log('element created; volume=%s muted=%s crossOrigin=%s', this.audio.volume, this.audio.muted, this.audio.crossOrigin)
    this.audio.addEventListener('canplay', () => {
      log('canplay: readyState=%d src=%s', this.audio.readyState, this.audio.currentSrc)
    })
    this.audio.addEventListener('playing', () => {
      log('playing: t=%s volume=%s muted=%s', this.audio.currentTime.toFixed(2), this.audio.volume, this.audio.muted)
    })
    this.audio.addEventListener('timeupdate', () => this.handleTime())
    this.audio.addEventListener('loadedmetadata', () => this.emitTime())
    this.audio.addEventListener('ended', () => {
      for (const listener of this.listeners) listener.onEnded()
    })
    this.audio.addEventListener('error', () => {
      if (!this.audio.currentSrc) return
      const mediaError = this.audio.error
      logError('element error: code=%s src=%s', mediaError?.code ?? 'unknown', this.audio.currentSrc)
      const message = this.songTitle
        ? `Could not play “${this.songTitle}”. The file may be missing.`
        : 'Could not play this file. It may be missing.'
      for (const listener of this.listeners) listener.onError(message)
    })
  }

  subscribe(listener: EngineEvents): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private ensureGraph(): void {
    if (this.graphBuilt || typeof window.AudioContext === 'undefined') return
    log('building graph: AudioContext -> MediaElementSource -> Gain -> Compressor -> Analyser -> destination')
    const ctx = new window.AudioContext()
    const source = ctx.createMediaElementSource(this.audio)
    const gain = ctx.createGain()
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.knee.value = 12
    compressor.ratio.value = 8
    compressor.attack.value = 0.003
    compressor.release.value = 0.2
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    source.connect(gain)
    gain.connect(compressor)
    compressor.connect(analyser)
    analyser.connect(ctx.destination)
    gain.gain.value = this.volume * this.boost
    this.ctx = ctx
    this.gain = gain
    this.analyserNode = analyser
    this.compressorNode = compressor
    this.graphBuilt = true
    log(
      'graph built: state=%s sampleRate=%d gain=%s (target %s)',
      ctx.state,
      ctx.sampleRate,
      gain.gain.value,
      this.volume * this.boost
    )
  }

  /** Read-only diagnostics for the debug handle and tests. */
  getSnapshot(): AudioSnapshot {
    let peak = 0
    if (this.analyserNode) {
      const bins = new Uint8Array(this.analyserNode.frequencyBinCount)
      this.analyserNode.getByteFrequencyData(bins)
      for (const value of bins) {
        if (value > peak) peak = value
      }
      this.lastAnalyserPeak = peak
    }
    return {
      hasSrc: this.audio.currentSrc !== '',
      currentSrc: this.audio.currentSrc,
      paused: this.audio.paused,
      ended: this.audio.ended,
      readyState: this.audio.readyState,
      networkState: this.audio.networkState,
      elementVolume: this.audio.volume,
      elementMuted: this.audio.muted,
      graphBuilt: this.graphBuilt,
      contextState: this.ctx ? this.ctx.state : 'none',
      contextSampleRate: this.ctx ? this.ctx.sampleRate : 0,
      gainValue: this.gain ? this.gain.gain.value : 0,
      targetGain: this.volume * this.boost,
      analyserBins: this.analyserNode ? this.analyserNode.frequencyBinCount : 0,
      analyserPeak: peak,
      lastAnalyserPeak: this.lastAnalyserPeak,
      compressorThreshold: this.compressorNode ? this.compressorNode.threshold.value : 0,
      compressorRatio: this.compressorNode ? this.compressorNode.ratio.value : 0,
      songId: this.songId
    }
  }

  /** Remix-ready analyser for the visualizer. Null until first playback. */
  getAnalyser(): AnalyserNode | null {
    return this.analyserNode
  }

  /**
   * Diagnostic test tone: oscillator straight to destination, bypassing the
   * media graph. If this is audible, the context/output works and the fault
   * is upstream (element, protocol, or graph wiring).
   */
  async playTestTone(): Promise<void> {
    this.ensureGraph()
    if (!this.ctx) throw new Error('Web Audio is unavailable.')
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => undefined)
    }
    const oscillator = this.ctx.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = 440
    oscillator.connect(this.ctx.destination)
    oscillator.start()
    log('test tone started; context state=%s', this.ctx.state)
    window.setTimeout(() => {
      try {
        oscillator.stop()
      } catch {
        // Already stopped.
      }
      oscillator.disconnect()
    }, 1500)
  }

  /** `url` is a playable source: media:// on desktop, blob:/data: on web/Android. */
  loadSong(url: string, songId: number, title: string, durationHint: number): void {
    this.songId = songId
    this.songTitle = title
    this.thresholdReported = false
    log('load song id=%d title=%s url=%s', songId, title, url)
    this.audio.dataset.songId = String(songId)
    this.audio.src = url
    this.audio.load()
    for (const listener of this.listeners) {
      listener.onTime(0, Number.isFinite(durationHint) ? durationHint : 0)
    }
  }

  unload(): void {
    this.songId = null
    this.songTitle = ''
    this.thresholdReported = false
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
  }

  async play(): Promise<void> {
    this.ensureGraph()
    log(
      'play() called; context=%s gain=%s elementVolume=%s elementMuted=%s',
      this.ctx ? this.ctx.state : 'none',
      this.gain ? this.gain.gain.value : 0,
      this.audio.volume,
      this.audio.muted
    )
    if (this.ctx && this.ctx.state === 'suspended') {
      log('resuming suspended AudioContext (user gesture)')
      await this.ctx.resume().catch(() => undefined)
      log('context state after resume: %s', this.ctx.state)
    }
    await this.audio.play()
  }

  pause(): void {
    this.audio.pause()
  }

  seekTo(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) return
    this.audio.currentTime = seconds
    this.emitTime()
  }

  setLevels(volume: number, boost: number): void {
    this.volume = volume
    this.boost = boost
    if (this.gain) {
      this.gain.gain.value = volume * boost
      log('levels: volume=%s boost=%s gain=%s', volume, boost, this.gain.gain.value)
    }
  }

  get currentTime(): number {
    return this.audio.currentTime
  }

  private emitTime(): void {
    const duration = this.audio.duration
    for (const listener of this.listeners) {
      listener.onTime(this.audio.currentTime, Number.isFinite(duration) ? duration : 0)
    }
  }

  private handleTime(): void {
    this.emitTime()
    if (this.analyserNode) {
      const bins = new Uint8Array(this.analyserNode.frequencyBinCount)
      this.analyserNode.getByteFrequencyData(bins)
      let peak = 0
      for (const value of bins) {
        if (value > peak) peak = value
      }
      this.lastAnalyserPeak = peak
    }
    if (this.songId === null || this.thresholdReported) return
    const current = this.audio.currentTime
    const duration = this.audio.duration
    if (!Number.isFinite(duration) || duration <= 0) return
    if (current >= HISTORY_SECONDS || current / duration >= HISTORY_FRACTION) {
      this.thresholdReported = true
      this.onPlayThreshold?.(this.songId)
    }
  }
}

export const engine = new AudioEngine()

/** Read-only debug handle for DevTools/CDP: window.__audio.snapshot(). */
declare global {
  interface Window {
    __audio?: {
      snapshot: () => AudioSnapshot
      testTone: () => Promise<void>
    }
  }
}

window.__audio = {
  snapshot: () => engine.getSnapshot(),
  testTone: () => engine.playTestTone()
}
