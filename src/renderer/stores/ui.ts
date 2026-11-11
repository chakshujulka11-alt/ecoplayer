import { create } from 'zustand'
import { callApi } from '../lib/api'
import { hexToHslTriplet } from '../lib/appearance'
import type { AppSettings, Density, FontSize, Theme, VisualizerStyle } from '../../shared/types'

const FONT_PX: Record<FontSize, number> = { small: 14, medium: 16, large: 18 }

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.classList.toggle('dark', theme !== 'light')
}

function applyAccent(accent: string): void {
  const triplet = hexToHslTriplet(accent)
  document.documentElement.style.setProperty('--primary', triplet)
  document.documentElement.style.setProperty('--ring', triplet)
}

function applyFontSize(fontSize: FontSize): void {
  document.documentElement.style.fontSize = `${FONT_PX[fontSize]}px`
}

export type AppearancePatch = Partial<AppSettings>

interface UiState {
  theme: Theme
  accent: string
  fontSize: FontSize
  density: Density
  backgroundPreset: string | null
  backgroundImage: string | null
  backgroundBlur: number
  backgroundDim: number
  visualizerStyle: VisualizerStyle
  visualizerSensitivity: number
  /** Apply a full settings snapshot without persisting (startup). */
  hydrate: (settings: AppSettings) => void
  /** Apply + persist appearance changes. */
  update: (patch: AppearancePatch) => void
  /** Apply one of the built-in themes (keeps accent/background). */
  setTheme: (theme: Theme) => void
}

function applyAll(state: Pick<UiState, 'theme' | 'accent' | 'fontSize'>): void {
  applyTheme(state.theme)
  applyAccent(state.accent)
  applyFontSize(state.fontSize)
}

export const useUiStore = create<UiState>()((set, get) => ({
  theme: 'dark',
  accent: '#3b82f6',
  fontSize: 'medium',
  density: 'comfortable',
  backgroundPreset: 'none',
  backgroundImage: null,
  backgroundBlur: 8,
  backgroundDim: 0.55,
  visualizerStyle: 'bars',
  visualizerSensitivity: 1,

  hydrate: (settings) => {
    set({
      theme: settings.theme,
      accent: settings.accent,
      fontSize: settings.fontSize,
      density: settings.density,
      backgroundPreset: settings.backgroundPreset,
      backgroundImage: settings.backgroundImage,
      backgroundBlur: settings.backgroundBlur,
      backgroundDim: settings.backgroundDim,
      visualizerStyle: settings.visualizerStyle,
      visualizerSensitivity: settings.visualizerSensitivity
    })
    applyAll({ theme: settings.theme, accent: settings.accent, fontSize: settings.fontSize })
  },

  update: (patch) => {
    const merged = { ...get(), ...patch }
    set(patch)
    applyAll(merged)
    void callApi((api) => api.updateSettings(patch)).catch(() => undefined)
  },

  setTheme: (theme) => {
    get().update({ theme })
  }
}))

export { applyTheme }
