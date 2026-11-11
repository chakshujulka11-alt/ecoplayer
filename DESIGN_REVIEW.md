# DESIGN REVIEW — Eco Player

## Project & Audience
- **Product**: Eco Player — a local-only Electron music player (no Spotify, no YouTube, no downloads).
- **Audience**: Users who want a fast, offline, library-first music player with plain local files.
- **Constraints**: Electron + React + TS + Vite + Tailwind + shadcn/ui; TypeScript strict; renderer must not access Node APIs; local music only.

## Current State Assessment
The application is functionally complete (library, playlists, playback, visualizer, settings, duplicates) but visually it is **generic AI-generated slop**: gradients, glassmorphism, neon accents, pill buttons, oversized shadows, decorative hover scales, and random rounded cards with no visual hierarchy or restraint.

### Specific AI-slop findings

| Area | Slop pattern | Location |
|------|--------------|----------|
| Background | Radial-gradient presets (Midnight, Sunset, Forest, Ocean) | `src/renderer/lib/appearance.ts` |
| Background layer | `blur()` filter + `scale(1.05)` decorative transform | `BackgroundLayer.tsx` |
| Custom theme swatch | `bg-gradient-to-br from-violet-600 to-sky-500` | `Settings.tsx` |
| Accent buttons | `rounded-full` pills + `hover:scale-105` | `Settings.tsx` |
| Range tracks | `linear-gradient` fill on every slider | `Settings.tsx` |
| Buttons | `hover:bg-accent/60`, `hover:bg-primary/90`, translucent overlays | `button.tsx`, `Sidebar.tsx`, `PlayerBar.tsx` |
| Cards | `hover:bg-accent/60`, `rounded-lg`, translucent selection states | `SongGrid.tsx`, `SongTable.tsx`, `Library.tsx`, `Playlists.tsx` |
| Menus | `shadow-lg`, `rounded-md`, `hover:bg-accent` | `SongContextMenu.tsx`, `dialogs.tsx` |
| Player bar | `text-amber-500` neon boost indicator, `rounded-md` art, `shadow-lg` timer menu | `PlayerBar.tsx` |
| Drag overlay | `border-2 border-dashed border-primary bg-background/80` decorative drop zone | `App.tsx` |
| Scrollbar | `border-radius: 8px` thumbs, `border: 2px solid transparent` | `index.css` |
| Border radius | `--radius: 0.5rem` (8px) everywhere, far too soft | `index.css`, `tailwind.config.js` |

### What works and should be kept
- Layout shell (app-shell grid, sidebar + main + player bar) is sound.
- Navigation structure (Home / Library / Playlists / Duplicates / Settings) is clear.
- IPC bridge, database, audio engine, and visualizer all function.
- Zustand stores, keyboard shortcuts, drag-and-drop import all work.

## Required Design Direction: "Flat Zinc Minimal"
- **No gradients** anywhere — solid colors only.
- **No glassmorphism** — no `bg-*/80` translucent overlays, no backdrop-blur, no `bg-black/25`.
- **No neon** — no `text-amber-500`, no glowing indicators.
- **No shadows** — `shadow-lg` removed; separation via 1px borders only.
- **No pill buttons** — `rounded-full` removed; max corner radius 2px (sharp).
- **No decorative transforms** — no `scale-105`, no pulsing, no spinning decorative elements.
- **Crisp 1px borders**, intentional whitespace, strong typographic hierarchy.
- **Custom presets**: solid-color themes and accent presets only; users pick a flat accent color, no gradient presets.

## Acceptance Criteria (visual)
- Zero `bg-gradient`, `linear-gradient`, `radial-gradient` in the source.
- Zero `rounded-full`; max `rounded` (2px) or `rounded-sm`.
- Zero `shadow-` utilities.
- Zero `bg-black/25`, `bg-background/80`, `bg-primary/90` translucent overlays.
- No `text-amber-500` or other neon accent colors.
- Hover states use solid background changes (e.g. `bg-accent`), not translucent tints.
- All corners ≤ 2px radius.
- Build (`npm run build`) and typecheck (`npm run typecheck`) pass.
