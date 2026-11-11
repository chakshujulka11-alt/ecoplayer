# COMPONENT SPECIFICATION — MyOwnPlayer

This spec lists every UI component and the exact minimalist changes required. "Slop to remove" items are deleted; "Replace with" items are the new implementation. Corner radius never exceeds 2px (`rounded`). No gradients, glass, neon, shadows, or pill shapes anywhere.

## 1. `tailwind.config.js`

**Change**: `borderRadius.lg` → `var(--radius)` (2px), `md` → `calc(var(--radius) - 2px)`, `sm` → `calc(var(--radius) - 4px)`. Effectively all radii resolve to ≤2px.

## 2. `src/renderer/index.css`

**Remove / change**:
- `--radius: 0.5rem` → `--radius: 0.125rem` in all four themes.
- Scrollbar thumb: `border-radius: 8px` → `border-radius: 2px`; remove `border: 2px solid transparent` + `background-clip: content-box` (decorative); keep solid `background: hsl(var(--muted))`.
- Remove any `backdrop-filter`, `background-clip: text`, `text-transparent`.

**Keep**: app-shell grid, drag-region/no-drag utilities, density-compact utilities, base resets.

## 3. `src/renderer/components/ui/button.tsx`

**Variants** (all solid, no translucent tints):
- `default`: `bg-primary text-primary-foreground hover:bg-primary/90` → `hover:bg-primary` solid (drop opacity).
- `secondary`: `bg-secondary text-secondary-foreground hover:bg-secondary/80` → `hover:bg-secondary` solid.
- `ghost`: `hover:bg-accent hover:text-accent-foreground` → keep, but ensure solid `bg-accent` on hover.
- `outline`: `border border-input bg-background hover:bg-accent hover:text-accent-foreground` → keep solid hover.
- `destructive`: `bg-destructive text-destructive-foreground hover:bg-destructive/90` → `hover:bg-destructive` solid.

**Sizes**: `default h-9 px-4 py-2`, `sm h-8 px-3 text-xs`, `icon h-9 w-9`. All `rounded` (2px), never `rounded-full`.

**Base**: `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0`.

## 4. `src/renderer/components/Sidebar.tsx`

- Import buttons: `variant="default"` / `variant="secondary"`, size `sm` — keep, they now render solid per new button spec.
- Nav links: `rounded-md` → `rounded`; `hover:bg-accent` → `hover:bg-accent` (now solid via button spec; for NavLink anchor, use `bg-accent` solid on hover, no opacity).
- Active state: `bg-accent text-accent-foreground` solid.
- Create-playlist plus button: `rounded p-1` → `rounded`; hover solid.
- Playlist list items: `rounded-md` → `rounded`; active `bg-accent` solid.
- "No playlists yet" text: keep, small muted.
- Section label: `uppercase tracking-wider text-xs font-semibold text-muted-foreground`.
- Remove any `gap-4` that feels decorative; keep `gap-4` between import group and nav.

## 5. `src/renderer/components/PlayerBar.tsx`

- Art: `rounded-md` → `rounded` (2px). Fallback span same.
- Control buttons: `size="icon"` ghost — keep; active state `text-primary` solid.
- Loop button: `text-primary` on active; keep `Repeat1` vs `Repeat`.
- Random button: keep `Dices`.
- Sleep timer menu: `shadow-lg` → remove shadow; `rounded-md` → `rounded`; `border border-border` keep solid; menu items `hover:bg-accent` solid (no opacity).
- Volume/boost sliders: `rounded` keep; `accent-primary` keep; remove any `text-amber-500` neon → use `text-primary` or `text-muted-foreground`.
- Boost label: `AlertTriangle` amber → replace with primary or muted; no neon.
- Time displays: `tabular-nums text-muted-foreground` keep.
- Progress bar: `rounded bg-secondary` keep; fill `bg-primary` solid; remove `transition-all` (decorative).
- Footer: `border-t border-border bg-card px-4` keep; `h-[76px]` keep.

## 6. `src/renderer/components/BackgroundLayer.tsx`

- Gradient presets removed; `presetCss()` returns solid `background-color` string (hex) not a gradient.
- Custom image: keep `blur()` + `dim` overlay (functional, not decorative) but remove `transform: scale(1.05)`.
- Container: `pointer-events-none fixed inset-0 overflow-hidden` keep.

## 7. `src/renderer/lib/appearance.ts`

**ACCENT_PRESETS**: keep solid hex swatches; change UI to render sharp squares (`rounded`, h-9 w-9), not circles (`rounded-full` removed from Settings).

**BACKGROUND_PRESETS**: replace all `radial-gradient(...)` CSS strings with solid `background-color` values:
- `none`: `''`
- `midnight`: `hsl(222 60% 12%)`
- `forest`: `hsl(150 50% 10%)`
- `ocean`: `hsl(210 70% 12%)`
- `sunset`: removed (gradient) — replaced by solid warm tone or dropped.

**presetCss(id)**: return `background-color: hsl(...)` inline style string or empty; consumers apply as `style={{ backgroundColor: ... }}`.

## 8. `src/renderer/views/Settings.tsx`

**Theme options**: remove `swatch` gradient (`bg-gradient-to-br from-violet-600 to-sky-500`); use solid `bg-card` swatch with `border border-border`; selected state = `border-primary` solid (no ring offset).

**Accent presets (custom theme only)**: `rounded-full` → `rounded` (sharp squares); remove `hover:scale-105` transform; remove `ring-2 ring-ring ring-offset-2` decorative ring; selected = `border-primary` solid.

**Custom color input**: keep `<input type="color">` but label `rounded-full` → `rounded`.

**trackFill()**: remove `linear-gradient`; return `backgroundColor: hsl(var(--primary))` solid fill from 0 to percent (use a `div` overlay or `background: linear-gradient` is banned — instead use a solid-width inner bar or set `backgroundColor` only to the filled portion via a child `div`). Simplest: render range with solid accent track via CSS `accent-primary` and skip custom fill entirely.

**Density/font buttons**: `rounded-md` removed (group uses `overflow-hidden rounded`); active `bg-accent text-accent-foreground` solid; hover `bg-accent/60` → `bg-accent` solid.

**Background preset buttons**: `rounded-lg` → `rounded`; `hover:bg-accent/60` → `hover:bg-accent` solid; selected `border-primary ring-2 ring-ring` → `border-primary` only (no ring).

**Stat cards**: `rounded-lg` → `rounded`; `p-4` keep; remove `density-card` if it adds decorative padding (keep padding functional).

**Duplicate groups**: `rounded-lg` → `rounded`; `p-4` keep.

**Reset appearance button**: keep `variant="secondary" size="sm"`.

**Remove**: the `bg-gradient-to-br` custom-theme swatch; all `hover:bg-accent/60` → `hover:bg-accent`; all `rounded-lg` → `rounded`.

## 9. `src/renderer/views/Home.tsx`

**SongCards**: `rounded-lg` → `rounded`; `hover:bg-accent/60` → `hover:bg-accent` solid; `p-3` keep; art `rounded-md` → `rounded`; number badge `rounded-full` → `rounded`; remove `bg-background/85` translucent → `bg-background` solid.

**"Now playing" section**: `rounded-lg` → `rounded`; `border border-border bg-card p-4` keep.

**Browse links/cards**: `rounded-lg` → `rounded`; `hover:bg-accent/60` → `hover:bg-accent` solid; icon `rounded bg-secondary` keep sharp.

**Top count / Top period groups**: `overflow-hidden rounded-md` → `overflow-hidden rounded`; active `bg-accent` solid.

**EmptyState / ErrorState / LoadingState**: keep as-is (feedback components).

**Visualizer**: keep canvas; `accentHsl` solid color.

## 10. `src/renderer/components/SongGrid.tsx`

- Card: `rounded-lg` → `rounded`; `hover:bg-accent/60` → `hover:bg-accent` solid; `p-3` keep.
- Art: `rounded-md` → `rounded`.
- Checkbox overlay: `bg-background/80` → `bg-background` solid; `rounded` keep.
- Playing badge: `rounded bg-primary` keep sharp (remove `px-2 py-0.5` if it makes a pill — keep small but not fully rounded).
- Duration row: `Music` icon + `formatDuration` keep.

## 11. `src/renderer/components/SongTable.tsx`

- Row hover: `hover:bg-accent/60` → `hover:bg-accent` solid.
- Active row: `bg-accent/60` → `bg-accent` solid.
- Checked row: `bg-primary/10` → `bg-primary/5` (subtle) or `bg-accent` solid — choose `bg-accent` solid for consistency.
- SongArt: `rounded` keep (already 2px via theme? currently `rounded` — keep).
- Favorite/trash icon buttons: `rounded p-1.5` keep sharp; hover `hover:bg-accent` solid.
- Header: sticky `bg-background`, `border-b border-border`, `text-xs uppercase tracking-wider text-muted-foreground` keep.

## 12. `src/renderer/views/Library.tsx`

- Toolbar: keep search, sort, filters, view toggle.
- View toggle group: `overflow-hidden rounded-md border border-input` → `overflow-hidden rounded`; active `bg-accent` solid.
- Browse cards (Home-style links): `rounded-lg` → `rounded`; `hover:bg-accent/60` → `hover:bg-accent` solid; icon `rounded bg-secondary` sharp.
- Selection bar: `rounded-md border border-border bg-card px-3 py-2` → `rounded`; buttons `variant="secondary" size="sm"` solid.
- Action buttons in selection bar: `rounded p-1` → `rounded`; hover solid.

## 13. `src/renderer/views/Playlists.tsx`

- Playlist cards: `rounded-lg` → `rounded`; `hover:bg-accent/60` → `hover:bg-accent` solid; `p-4` keep.
- PlaylistArt: `rounded-lg` → `rounded`; remove `group-hover:scale-105` transform; remove `bg-black/25` opacity overlay; remove `shadow` on custom badge; `rounded-lg` → `rounded`.
- Detail page header actions: buttons `size="sm"` variants solid; `variant="ghost"` keep.
- Rename input: `rounded-md` → `rounded`.
- EmptyState: keep.

## 14. `src/renderer/components/dialogs.tsx`

- EditMetadataDialog: backdrop `bg-background/70` → `bg-black/20` solid or `bg-background` solid; container `rounded-lg` → `rounded`; `border border-border bg-card p-5` keep; remove `shadow` if any.
- ConfirmDialog: same — `rounded-lg` → `rounded`, backdrop solid, no shadow.
- Form fields: `rounded-md` → `rounded`; focus `ring-2 ring-ring` keep.
- DialogCover: `rounded-md` → `rounded`.

## 15. `src/renderer/components/SongContextMenu.tsx`

- Container: `shadow-lg` → remove shadow; `rounded-md` → `rounded`; `border border-border bg-popover p-1` keep solid.
- Menu items: `hover:bg-accent` → `hover:bg-accent` solid (no opacity); `itemClass` keep `rounded px-3 py-1.5` but ensure no `rounded-full`.
- Divider: `border-t border-border` keep.
- Backdrop: `fixed inset-0 z-40` — no backdrop color (transparent) or solid `bg-black/10`.

## 16. `src/renderer/components/Visualizer.tsx`

- Keep canvas visualizer; `ctx.globalAlpha = 0.35 + magnitude * 0.65` keep (canvas alpha, not CSS glass).
- `base = hsl(${accentHsl})` solid accent color. No glow, no drop shadow.

## 17. `src/renderer/App.tsx`

- Drag overlay: `border-2 border-dashed border-primary bg-background/80` → remove entirely or replace with solid `border border-border bg-card` non-dashed. Recommend removing the decorative overlay; real paths arrive via preload.
- Import progress bar: `rounded bg-secondary` keep; fill `bg-primary transition-all` → `bg-primary` (remove `transition-all`).
- Status bar: `border-t border-border/50` → `border-t border-border` solid.
- Shell: `app-shell` grid keep.

## 18. `src/renderer/components/TitleBar.tsx`

- `drag-region col-span-2 flex h-9 shrink-0 items-center border-b border-border bg-background pl-4 pr-36` keep sharp; text `text-xs font-semibold tracking-wide text-muted-foreground` keep.

## 19. `src/renderer/components/skeletons.tsx`

- Keep skeleton styling; ensure no `rounded-lg` → `rounded`; no gradient pulse animation (replace with solid opacity pulse if animation needed).

## 20. `src/renderer/components/feedback.tsx` (EmptyState, ErrorState, LoadingState)

- Keep; ensure `rounded-lg` → `rounded`; no decorative icons beyond lucide; no gradient.

## Summary of banned patterns (project-wide)

- `bg-gradient-`, `linear-gradient`, `radial-gradient`
- `rounded-full`, `rounded-lg`, `rounded-md` → `rounded` (2px max)
- `shadow-lg`, `shadow-md`, `shadow`
- `bg-black/25`, `bg-background/80`, `bg-primary/90`, `bg-accent/60`, `bg-primary/10` translucent tints
- `text-amber-500` neon
- `hover:scale-105`, `transition-transform` decorative
- `border-2 border-dashed`
- `backdrop-filter`, `background-clip: text`
