/** Settings repository (main process only). */
import { getDatabase } from './connection'
import type { AppSettings, Density, FontSize, Theme, VisualizerStyle } from '../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  volume: 0.8,
  boost: 1,
  theme: 'dark',
  accent: '#3b82f6',
  fontSize: 'medium',
  density: 'comfortable',
  backgroundPreset: 'none',
  backgroundImage: null,
  backgroundBlur: 8,
  backgroundDim: 0.55,
  visualizerStyle: 'bars',
  visualizerSensitivity: 1
}

const THEMES: Theme[] = ['dark', 'light', 'amoled', 'custom']
const FONT_SIZES: FontSize[] = ['small', 'medium', 'large']
const DENSITIES: Density[] = ['compact', 'comfortable']
const VISUALIZER_STYLES: VisualizerStyle[] = ['bars', 'wave', 'mirror']

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback
}

function accentOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value.length === 0 || value.length > 1000) return null
  return value
}

export function readSettings(): AppSettings {
  const rows = getDatabase().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const parsed: Record<string, unknown> = {}
  for (const row of rows) {
    try {
      parsed[row.key] = JSON.parse(row.value)
    } catch {
      // Ignore corrupt rows; defaults apply.
    }
  }
  return {
    volume: clampNumber(parsed.volume, DEFAULT_SETTINGS.volume, 0, 1),
    boost: clampNumber(parsed.boost, DEFAULT_SETTINGS.boost, 1, 3),
    theme: oneOf(parsed.theme, THEMES, DEFAULT_SETTINGS.theme),
    accent: accentOr(parsed.accent, DEFAULT_SETTINGS.accent),
    fontSize: oneOf(parsed.fontSize, FONT_SIZES, DEFAULT_SETTINGS.fontSize),
    density: oneOf(parsed.density, DENSITIES, DEFAULT_SETTINGS.density),
    backgroundPreset: nullableString(parsed.backgroundPreset) ?? DEFAULT_SETTINGS.backgroundPreset,
    backgroundImage: nullableString(parsed.backgroundImage),
    backgroundBlur: clampNumber(parsed.backgroundBlur, DEFAULT_SETTINGS.backgroundBlur, 0, 24),
    backgroundDim: clampNumber(parsed.backgroundDim, DEFAULT_SETTINGS.backgroundDim, 0, 0.9),
    visualizerStyle: oneOf(parsed.visualizerStyle, VISUALIZER_STYLES, DEFAULT_SETTINGS.visualizerStyle),
    visualizerSensitivity: clampNumber(
      parsed.visualizerSensitivity,
      DEFAULT_SETTINGS.visualizerSensitivity,
      0.5,
      3
    )
  }
}

export function writeSettings(patch: Partial<AppSettings>): AppSettings {
  const current = readSettings()
  const next: AppSettings = {
    volume: patch.volume === undefined ? current.volume : clampNumber(patch.volume, current.volume, 0, 1),
    boost: patch.boost === undefined ? current.boost : clampNumber(patch.boost, current.boost, 1, 3),
    theme: patch.theme === undefined ? current.theme : oneOf(patch.theme, THEMES, current.theme),
    accent: patch.accent === undefined ? current.accent : accentOr(patch.accent, current.accent),
    fontSize: patch.fontSize === undefined ? current.fontSize : oneOf(patch.fontSize, FONT_SIZES, current.fontSize),
    density: patch.density === undefined ? current.density : oneOf(patch.density, DENSITIES, current.density),
    backgroundPreset:
      patch.backgroundPreset === undefined ? current.backgroundPreset : (nullableString(patch.backgroundPreset) ?? 'none'),
    backgroundImage: patch.backgroundImage === undefined ? current.backgroundImage : nullableString(patch.backgroundImage),
    backgroundBlur:
      patch.backgroundBlur === undefined
        ? current.backgroundBlur
        : clampNumber(patch.backgroundBlur, current.backgroundBlur, 0, 24),
    backgroundDim:
      patch.backgroundDim === undefined
        ? current.backgroundDim
        : clampNumber(patch.backgroundDim, current.backgroundDim, 0, 0.9),
    visualizerStyle:
      patch.visualizerStyle === undefined
        ? current.visualizerStyle
        : oneOf(patch.visualizerStyle, VISUALIZER_STYLES, current.visualizerStyle),
    visualizerSensitivity:
      patch.visualizerSensitivity === undefined
        ? current.visualizerSensitivity
        : clampNumber(patch.visualizerSensitivity, current.visualizerSensitivity, 0.5, 3)
  }
  const upsert = getDatabase().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  const save = (key: string, value: unknown): void => {
    upsert.run(key, JSON.stringify(value))
  }
  save('volume', next.volume)
  save('boost', next.boost)
  save('theme', next.theme)
  save('accent', next.accent)
  save('fontSize', next.fontSize)
  save('density', next.density)
  save('backgroundPreset', next.backgroundPreset)
  save('backgroundImage', next.backgroundImage)
  save('backgroundBlur', next.backgroundBlur)
  save('backgroundDim', next.backgroundDim)
  save('visualizerStyle', next.visualizerStyle)
  save('visualizerSensitivity', next.visualizerSensitivity)
  return next
}
