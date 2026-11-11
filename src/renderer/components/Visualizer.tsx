import { useEffect, useRef } from 'react'
import { engine } from '@/audio/engine'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'

/**
 * Canvas visualizer driven by the engine's AnalyserNode.
 * Runs a single rAF loop only while audio is playing; unmounts cleanly.
 */
export function Visualizer({ accentHsl, className }: { accentHsl: string; className?: string }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const rafRef = useRef(0)
  const runningRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isPlaying) return
    const analyser = engine.getAnalyser()
    if (!analyser) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = (): void => {
      const parent = canvas.parentElement
      if (!parent) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.floor(parent.clientWidth * dpr))
      const height = Math.max(1, Math.floor(parent.clientHeight * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
    };
    resize()
    const observer = new ResizeObserver(resize)
    if (canvas.parentElement) observer.observe(canvas.parentElement)

    const bins = analyser.frequencyBinCount
    const freq = new Uint8Array(bins)
    const wave = new Uint8Array(analyser.fftSize)
    runningRef.current = true

    const frame = (): void => {
      if (!runningRef.current) return
      rafRef.current = requestAnimationFrame(frame)
      const { visualizerStyle, visualizerSensitivity } = useUiStore.getState()
      const width = canvas.width
      const height = canvas.height
      if (width <= 1 || height <= 1) return
      ctx.clearRect(0, 0, width, height)
      const base = `hsl(${accentHsl})`

      if (visualizerStyle === 'wave') {
        analyser.getByteTimeDomainData(wave)
        ctx.strokeStyle = base
        ctx.lineWidth = Math.max(2, height / 48)
        ctx.beginPath()
        const step = width / (wave.length - 1)
        for (let i = 0; i < wave.length; i++) {
          const sample = wave[i] ?? 128
          const y = height / 2 + ((sample - 128) / 128) * (height / 2 - 2) * visualizerSensitivity
          if (i === 0) ctx.moveTo(0, y)
          else ctx.lineTo(i * step, y)
        }
        ctx.stroke()
        return
      }

      analyser.getByteFrequencyData(freq)
      const bars = 64
      const step = Math.max(1, Math.floor(bins / bars))
      const gap = Math.max(1, Math.floor(width / bars / 6))
      const barWidth = width / bars - gap
      for (let i = 0; i < bars; i++) {
        let sum = 0
        let count = 0
        for (let j = i * step; j < Math.min(bins, (i + 1) * step); j++) {
          sum += freq[j] ?? 0
          count += 1
        }
        const magnitude = count === 0 ? 0 : Math.min(1, (sum / count / 255) * visualizerSensitivity)
        const barHeight = Math.max(2, magnitude * (visualizerStyle === 'mirror' ? height / 2 - 2 : height - 4))
        ctx.fillStyle = base
        ctx.globalAlpha = 0.35 + magnitude * 0.65
        if (visualizerStyle === 'mirror') {
          const center = height / 2
          ctx.fillRect(i * (barWidth + gap), center - barHeight, barWidth, barHeight)
          ctx.fillRect(i * (barWidth + gap), center, barWidth, barHeight)
        } else {
          ctx.fillRect(i * (barWidth + gap), height - barHeight, barWidth, barHeight)
        }
      }
      ctx.globalAlpha = 1
    };
    rafRef.current = requestAnimationFrame(frame)

    return () => {
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
      observer.disconnect()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [isPlaying, accentHsl])

  return <canvas ref={canvasRef} className={className ?? 'h-full w-full'} aria-label="Audio visualizer" />
}
