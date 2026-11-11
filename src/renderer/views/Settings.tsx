import { useState } from 'react'
import { AlertTriangle, Check, ImagePlus, X } from 'lucide-react'
import { ACCENT_PRESETS, BACKGROUND_PRESETS, presetCss } from '@/lib/appearance'
import { callApi } from '@/lib/api'
import { useSongActions } from '@/hooks/useSongActions'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/dialogs'
import { ErrorState, LoadingState } from '@/components/feedback'
import type { Density, DuplicateCandidates, FontSize, Theme, VisualizerStyle } from '../../shared/types'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: { value: Theme; label: string; hint: string; swatch: string }[] = [
  { value: 'dark', label: 'Dark', hint: 'Default zinc theme', swatch: 'bg-zinc-900' },
  { value: 'light', label: 'Light', hint: 'Bright theme', swatch: 'bg-zinc-100' },
  { value: 'amoled', label: 'AMOLED', hint: 'Pure black', swatch: 'bg-black' },
  { value: 'custom', label: 'Custom', hint: 'Your accent color', swatch: 'bg-blue-500' }
]

const FONT_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
]

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' }
]

const VIZ_OPTIONS: { value: VisualizerStyle; label: string }[] = [
  { value: 'bars', label: 'Bars' },
  { value: 'wave', label: 'Wave' },
  { value: 'mirror', label: 'Mirror' }
]

interface SettingsProps {
  onStatus: (message: string | null) => void
}


export function Settings({ onStatus }: SettingsProps): React.JSX.Element {
  const songs = usePlayerStore((s) => s.songs)
  const ui = useUiStore()
  const { removeFromLibrary } = useSongActions()
  const [duplicates, setDuplicates] = useState<DuplicateCandidates | null>(null)
  const [duplicatesError, setDuplicatesError] = useState<string | null>(null)
  const [loadingDuplicates, setLoadingDuplicates] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const totalSeconds = songs.reduce((sum, song) => sum + song.duration, 0)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.round((totalSeconds % 3600) / 60)
  const favoriteCount = songs.filter((song) => song.isFavorite).length
  const artistCount = new Set(songs.map((s) => s.artist)).size
  const stats: { label: string; value: string }[] = [
    { label: 'Songs', value: String(songs.length) },
    { label: 'Favorites', value: String(favoriteCount) },
    { label: 'Artists', value: String(artistCount) },
    { label: 'Playtime', value: `${hours}h ${minutes}m` }
  ]

  async function loadDuplicates(): Promise<void> {
    setLoadingDuplicates(true)
    setDuplicatesError(null)
    try {
      setDuplicates(await callApi((api) => api.getDuplicateCandidates()))
    } catch (err) {
      setDuplicatesError(err instanceof Error ? err.message : 'Could not check for duplicates.')
    } finally {
      setLoadingDuplicates(false)
    }
  }

  async function removeDuplicate(id: number, title: string): Promise<void> {
    try {
      await removeFromLibrary([id])
      onStatus(`Removed “${title}” from the library. The file stays on disk.`)
      await loadDuplicates()
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Could not remove song.')
    }
  }

  async function uploadBackground(): Promise<void> {
    try {
      const settings = await callApi((api) => api.setBackgroundImage())
      ui.hydrate(settings)
      onStatus('Background image updated.')
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Could not set background image.')
    }
  }

  async function removeBackgroundImage(): Promise<void> {
    try {
      const settings = await callApi((api) => api.clearBackgroundImage())
      ui.hydrate(settings)
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Could not remove background image.')
    }
  }

  async function resetAppearance(): Promise<void> {
    try {
      ui.update({
        theme: 'dark',
        accent: '#3b82f6',
        fontSize: 'medium',
        density: 'comfortable',
        backgroundPreset: 'none',
        backgroundBlur: 8,
        backgroundDim: 0.55,
        visualizerStyle: 'bars',
        visualizerSensitivity: 1
      })
      // Also drops any custom background file, then syncs from server truth.
      const settings = await callApi((api) => api.clearBackgroundImage())
      ui.hydrate(settings)
      onStatus('Appearance reset to defaults.')
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Could not reset appearance.')
    }
  }

  const duplicateCount = (duplicates?.byHash.length ?? 0) + (duplicates?.byMetadata.length ?? 0)

  async function confirmDatabaseReset(): Promise<void> {
    setConfirmReset(false)
    try {
      window.localStorage.clear()
      const result = await window.api.resetDatabase()
      if (!result.ok) onStatus(result.error)
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Could not reset the database.')
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-6 p-6 pt-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section className="flex max-w-2xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Theme</h2>
          <Button size="sm" variant="secondary" onClick={() => void resetAppearance()}>
            Reset appearance
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => ui.setTheme(option.value)}
              aria-pressed={ui.theme === option.value}
              className={cn(
                'flex flex-col gap-2 rounded border border-border bg-card p-4 text-left transition-colors hover:bg-accent',
                ui.theme === option.value && 'border-primary'
              )}
            >
              <span className={cn('h-10 rounded border border-border', option.swatch)} />
              <span className="flex items-center gap-2 text-sm font-medium">
                {option.label}
                {ui.theme === option.value && <Check />}
              </span>
              <span className="text-xs text-muted-foreground">{option.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {ui.theme === 'custom' && (
        <section className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Accent color</h2>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                title={preset.name}
                aria-label={`${preset.name} accent`}
                aria-pressed={ui.accent.toLowerCase() === preset.hex}
                onClick={() => ui.update({ accent: preset.hex })}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded border border-border',
                  ui.accent.toLowerCase() === preset.hex && 'border-primary'
                )}
                style={{ backgroundColor: preset.hex }}
              >
                {ui.accent.toLowerCase() === preset.hex && <Check className="text-white" />}
              </button>
            ))}
            <label
              className="flex h-9 items-center gap-2 rounded border border-border px-3 text-xs text-muted-foreground"
              title="Custom accent color"
            >
              Custom
              <input
                type="color"
                value={ui.accent}
                onChange={(event) => ui.update({ accent: event.target.value })}
                aria-label="Custom accent color"
                className="h-6 w-8 cursor-pointer bg-transparent"
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            The accent picker is part of the Custom theme. Other presets use their built-in accent.
          </p>
        </section>
      )}

      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Font size & density</h2>
        <div className="flex flex-wrap gap-2">
          <span className="flex overflow-hidden rounded border border-input" role="group" aria-label="Font size">
            {FONT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => ui.update({ fontSize: option.value })}
                aria-pressed={ui.fontSize === option.value}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  ui.fontSize === option.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'
                )}
              >
                {option.label}
              </button>
            ))}
          </span>
          <span className="flex overflow-hidden rounded border border-input" role="group" aria-label="Density">
            {DENSITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => ui.update({ density: option.value })}
                aria-pressed={ui.density === option.value}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  ui.density === option.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'
                )}
              >
                {option.label}
              </button>
            ))}
          </span>
        </div>
      </section>

      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Background</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {BACKGROUND_PRESETS.map((preset) => {
            const selected = ui.backgroundPreset === preset.id && !ui.backgroundImage
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => ui.update({ backgroundPreset: preset.id, backgroundImage: null })}
                aria-pressed={selected}
                className={cn(
                  'relative flex flex-col gap-2 rounded border border-border bg-card p-2 text-left transition-colors hover:bg-accent',
                  selected && 'border-primary'
                )}
              >
                <span
                  className="h-12 rounded border border-border bg-background"
                  style={preset.css ? { backgroundColor: preset.css } : undefined}
                />
                <span className="flex items-center gap-1 px-1 text-xs font-medium">{preset.name}</span>
                {selected && (
                  <span
                    aria-hidden
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground"
                  >
                    <Check />
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => void uploadBackground()}>
            <ImagePlus /> Use photo…
          </Button>
          {ui.backgroundImage && (
            <Button size="sm" variant="ghost" onClick={() => void removeBackgroundImage()}>
              <X /> Remove photo
            </Button>
          )}
        </div>
        {ui.backgroundImage && (
          <p className="truncate text-xs text-muted-foreground">Photo: {ui.backgroundImage} (blur + dim apply below)</p>
        )}
        <label className="flex max-w-md items-center gap-3 text-sm">
          <span className="w-16 shrink-0 text-xs text-muted-foreground">Blur</span>
          <input
            type="range"
            min={0}
            max={24}
            step={1}
            value={ui.backgroundBlur}
            onChange={(event) => ui.update({ backgroundBlur: Number(event.target.value) })}
            aria-label="Background blur"
            className="h-1 flex-1 cursor-pointer appearance-none rounded bg-secondary accent-primary"
          />
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{ui.backgroundBlur}px</span>
        </label>
        <label className="flex max-w-md items-center gap-3 text-sm">
          <span className="w-16 shrink-0 text-xs text-muted-foreground">Dim</span>
          <input
            type="range"
            min={0}
            max={0.9}
            step={0.05}
            value={ui.backgroundDim}
            onChange={(event) => ui.update({ backgroundDim: Number(event.target.value) })}
            aria-label="Background dim"
            className="h-1 flex-1 cursor-pointer appearance-none rounded bg-secondary accent-primary"
          />
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
            {Math.round(ui.backgroundDim * 100)}%
          </span>
        </label>
        <p className="text-xs text-muted-foreground">
          Preview: {presetCss(ui.backgroundPreset) || ui.backgroundImage ? 'active' : 'off'} — the dim overlay keeps
          text readable on any background.
        </p>
      </section>

      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Visualizer</h2>
        <div className="flex flex-wrap gap-2">
          <span className="flex overflow-hidden rounded border border-input" role="group" aria-label="Visualizer style">
            {VIZ_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => ui.update({ visualizerStyle: option.value })}
                aria-pressed={ui.visualizerStyle === option.value}
                className={cn(
                  'border px-3 py-1.5 text-xs font-medium transition-colors',
                  ui.visualizerStyle === option.value
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent'
                )}
              >
                {option.label}
              </button>
            ))}
          </span>
        </div>
        <label className="flex max-w-md items-center gap-3 text-sm">
          <span className="w-16 shrink-0 text-xs text-muted-foreground">Sensitivity</span>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.1}
            value={ui.visualizerSensitivity}
            onChange={(event) => ui.update({ visualizerSensitivity: Number(event.target.value) })}
            aria-label="Visualizer sensitivity"
            className="h-1 flex-1 cursor-pointer appearance-none rounded bg-secondary accent-primary"
          />
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
            {ui.visualizerSensitivity.toFixed(1)}×
          </span>
        </label>
      </section>

      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Library</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="density-card rounded border border-border bg-card p-4">
              <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {import.meta.env.DEV && (
        <section className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Danger zone (dev)</h2>
          <div className="rounded border border-destructive/50 bg-card p-4">
            <p className="text-sm font-medium">Reset database</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Deletes the library database and cached covers, then restarts the app with an empty library. Your audio
              files stay on disk. No Zustand persist is used, so clearing browser storage is enough for the rest.
            </p>
            <div className="mt-3">
              <Button variant="destructive" size="sm" onClick={() => setConfirmReset(true)}>
                <AlertTriangle /> Reset database…
              </Button>
            </div>
          </div>
        </section>
      )}

      <section className="flex max-w-2xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Duplicates{duplicateCount > 0 ? ` (${duplicateCount} groups)` : ''}
          </h2>
          <Button size="sm" variant="secondary" onClick={() => void loadDuplicates()} disabled={loadingDuplicates}>
            {duplicates ? 'Re-check' : 'Check for duplicates'}
          </Button>
        </div>
        {loadingDuplicates && <LoadingState message="Scanning for duplicates…" />}
        {duplicatesError && <ErrorState message={duplicatesError} onRetry={() => void loadDuplicates()} />}
        {duplicates && !loadingDuplicates && (duplicates.byHash.length + duplicates.byMetadata.length) === 0 && (
          <p className="text-sm text-muted-foreground">No duplicates found. Files are matched by hash and metadata.</p>
        )}
        {duplicates &&
          [...duplicates.byHash.map((group) => ({ ...group, kind: 'Same file content' })), ...duplicates.byMetadata.map((group) => ({ ...group, kind: 'Same metadata' }))].map(
            (group, index) => (
              <div key={`${group.kind}-${index}`} className="rounded border border-border bg-card p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.kind}</p>
                <ul className="flex flex-col gap-1">
                  {group.songs.map((song) => (
                    <li key={song.id} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">
                        {song.title} — {song.artist}
                        <span className="block truncate text-xs text-muted-foreground">{song.filePath}</span>
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => void removeDuplicate(song.id, song.title)}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
      </section>

      {confirmReset && (
        <ConfirmDialog
          title="Reset database?"
          message="This deletes the entire library database and cached covers, then restarts the app. Your audio files stay on disk and can be re-imported."
          confirmLabel="Reset and restart"
          onConfirm={() => void confirmDatabaseReset()}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  )
}
