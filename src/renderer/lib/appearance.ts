/** Small color helpers (renderer only). No dependencies. */

/** Convert #rrggbb to an "H S% L%" triplet for hsl(var(--primary)) tokens. */
export function hexToHslTriplet(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  if (max === min) return `0 0% ${Math.round(lightness * 100)}%`
  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue = 0
  if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60
  else if (max === g) hue = ((b - r) / delta + 2) * 60
  else hue = ((r - g) / delta + 4) * 60
  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`
}

export const ACCENT_PRESETS = [
  { name: 'Neon', hex: '#39ff14' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Pink', hex: '#ec4899' }
] as const

export const BACKGROUND_PRESETS = [
  { id: 'none', name: 'None', css: '' },
  { id: 'midnight', name: 'Midnight', css: 'hsl(0 0% 10%)' },
  { id: 'forest', name: 'Forest', css: 'hsl(150 50% 10%)' },
  { id: 'ocean', name: 'Ocean', css: 'hsl(0 0% 8%)' }
] as const

export type BackgroundPresetId = (typeof BACKGROUND_PRESETS)[number]['id']

export function presetCss(id: string | null): string {
  return BACKGROUND_PRESETS.find((preset) => preset.id === id)?.css ?? ''
}
