# UI IMPLEMENTATION PLAN — MyOwnPlayer

## Goal
Convert the existing AI-slop UI (gradients, glass, neon, pills, shadows) into a Flat Zinc Minimal design: solid colors, sharp 2px corners, 1px borders, restrained palette, custom presets. Application must continue to work: `npm run typecheck`, `npm run build` pass; runtime behavior unchanged.

## Order of implementation (dependencies respected)

### Phase 1 — Tokens & config (no UI breakage)
1. `tailwind.config.js` — set all `borderRadius` to derive from `--radius` (2px).
2. `src/renderer/index.css` — `--radius: 0.125rem` in all themes; flatten scrollbar (radius 2px, solid thumb, no decorative borders); remove any backdrop/gradient utilities.
3. `src/renderer/lib/appearance.ts` — replace `BACKGROUND_PRESETS` radial-gradient CSS strings with solid `background-color` values; keep `ACCENT_PRESETS` solid hex.

### Phase 2 — Base component (button)
4. `src/renderer/components/ui/button.tsx` — solid variants only (drop opacity hovers), all `rounded` (2px), no `rounded-full`.

### Phase 3 — Shell & navigation
5. `src/renderer/components/TitleBar.tsx` — verify sharp, no change needed beyond radius.
6. `src/renderer/components/Sidebar.tsx` — `rounded-md`→`rounded`, `hover:bg-accent` solid, remove decorative plus hover.

### Phase 4 — Player bar
7. `src/renderer/components/PlayerBar.tsx` — `rounded-md`→`rounded`, remove neon amber, `shadow-lg`→none on timer menu, solid hover states, remove `transition-all` on progress fill.

### Phase 5 — Background
8. `src/renderer/components/BackgroundLayer.tsx` — remove `scale(1.05)`; preset CSS now solid color from appearance.ts.

### Phase 6 — Views
9. `src/renderer/views/Settings.tsx` — biggest file: remove gradient swatch, sharp accent squares, solid fills, `rounded-lg`→`rounded`, `hover:bg-accent/60`→`hover:bg-accent`, `trackFill` solid.
10. `src/renderer/views/Home.tsx` — sharp cards, solid hovers, remove number-badge pill, remove translucent badge bg.
11. `src/renderer/views/Library.tsx` — sharp cards/links, solid hovers, view-toggle group sharp.
12. `src/renderer/views/Playlists.tsx` — sharp playlist art, remove scale transform, remove black overlay, sharp cards.

### Phase 7 — Components
13. `src/renderer/components/SongGrid.tsx` — sharp cards/art, solid hover.
14. `src/renderer/components/SongTable.tsx` — solid row hover/active, sharp art.
15. `src/renderer/components/dialogs.tsx` — sharp radius, solid backdrop, remove shadow.
16. `src/renderer/components/SongContextMenu.tsx` — remove `shadow-lg`, sharp radius, solid hover.
17. `src/renderer/components/Visualizer.tsx` — verify no CSS glass (canvas alpha is fine).
18. `src/renderer/components/skeletons.tsx` — sharp radius, no gradient pulse.
19. `src/renderer/components/feedback.tsx` — sharp radius.

### Phase 8 — App shell
20. `src/renderer/App.tsx` — remove decorative drag overlay (border-2 dashed), solid progress bar, solid status border.

## Verification
- `npm run typecheck` — TypeScript strict passes.
- `npm run build` — Vite build passes.
- `npm run lint` if configured.
- Visual spot-check at 1280x720, 1440x900, 1920x1080 (per AGENTS.md).
- Zero instances of banned patterns (grep for `bg-gradient`, `rounded-full`, `shadow-`, `text-amber-500`, `bg-accent/60`, `scale-105`, `border-dashed`).

## Rollback
All changes are UI-only (CSS/Tailwind class strings and solid-color values). No IPC, store, or audio logic touched. If a build fails, revert the specific file.
