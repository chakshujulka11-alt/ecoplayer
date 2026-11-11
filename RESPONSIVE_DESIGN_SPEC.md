# RESPONSIVE DESIGN SPEC — MyOwnPlayer

## Target breakpoints (per AGENTS.md)
Test at 1280×720, 1440×900, 1920×1080 and Windows scaling 100%/125%/150%.

## Layout model
Single app-shell grid (`.app-shell` in `index.css`):
- Columns: `15rem minmax(0, 1fr)` — sidebar fixed 15rem (rem so it scales with font-size setting).
- Rows: `36px minmax(0, 1fr) auto` — title bar, content, player bar.
- `overflow: hidden` on shell; content area `overflow-y-auto overflow-x-clip`.
- Player bar fixed `h-[76px]` at bottom.

This is a **desktop-first fixed-shell** layout (Electron desktop app). No mobile breakpoint is required; responsiveness is handled by:
1. Font-size setting (14/16/18px root) — sidebar width in rem tracks it.
2. Density setting (comfortable/compact) — tighter table rows/cards.
3. Content area scrolls vertically; horizontal content clipped.
4. Grid columns in views use Tailwind `sm:`/`lg:`/`xl:` modifiers where useful (e.g. SongGrid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`).

## View-specific responsive behavior

| View | Small (1280×720) | Large (1920×1080) |
|------|------------------|-------------------|
| Sidebar | Fixed 15rem; collapses not supported (desktop app) | Same |
| Home SongGrid | 2–3 columns | 5 columns |
| Library table | All columns visible; genre/album hidden below `lg` | Genre (`xl`) and album (`lg`) appear |
| Library grid | 2–3 columns | 5 columns |
| Playlists grid | 1–2 columns | 3 columns |
| Player bar | Volume/boost/timer hidden below `md`/`lg` breakpoints | All controls visible |
| Settings | Single column `max-w-2xl` sections; grid-cols-2→4 on `sm` | Wider grids |

## Breakpoints used
Tailwind default: `sm` 640px, `lg` 1024px, `xl` 1280px. Player bar uses `md:flex` (768px) and `lg:flex` (1024px) to hide volume/boost on narrow windows.

## Font-size scaling
Root `font-size` set by store (`applyFontSize`): 14/16/18px. Sidebar width (`15rem`) and all rem-based spacing scale proportionally, so the shell stays in sync at 125%/150% Windows scaling.

## Density
`density-compact` utility reduces table row padding and card padding. Toggled in Settings; persists.

## Acceptance
- No horizontal overflow at 1280×720.
- Sidebar width matches grid column at all font sizes.
- Player bar controls remain reachable (hide behind breakpoints, not off-screen).
- All text remains legible at 14px root size.
