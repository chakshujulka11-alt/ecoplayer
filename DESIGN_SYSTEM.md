# DESIGN SYSTEM — Eco Player

## Visual Direction: Flat Zinc Minimal

Solid colors, sharp borders (max 2px radius), crisp 1px separators, restrained palette, strong typography. No gradients, no glass, no neon, no shadows, no pill shapes, no decorative motion.

## Color Tokens (HSL)

All themes share the same structure; only the values change.

### Dark (default)
| Token | HSL | Usage |
|-------|-----|-------|
| `--background` | 240 10% 3.9% | App shell, body |
| `--foreground` | 0 0% 98% | Primary text |
| `--card` | 240 10% 6% | Surface containers |
| `--card-foreground` | 0 0% 98% | Card text |
| `--popover` | 240 10% 8% | Dropdowns, menus |
| `--popover-foreground` | 0 0% 98% | Menu text |
| `--primary` | 217 91% 60% | Accent / interactive |
| `--primary-foreground` | 0 0% 98% | Text on primary |
| `--secondary` | 240 4% 16% | Secondary surfaces |
| `--secondary-foreground` | 0 0% 98% | Secondary text |
| `--muted` | 240 4% 16% | Muted surfaces |
| `--muted-foreground` | 240 5% 65% | Muted / secondary text |
| `--accent` | 240 4% 18% | Hover / subtle states |
| `--accent-foreground` | 0 0% 98% | Text on accent |
| `--destructive` | 0 72% 51% | Destructive actions |
| `--destructive-foreground` | 0 0% 98% | Text on destructive |
| `--border` | 240 4% 16% | Borders, dividers |
| `--input` | 240 4% 20% | Input backgrounds |
| `--ring` | 217 91% 60% | Focus ring |
| `--radius` | 0.125rem (2px) | Max corner radius |

### Light
Same structure; `--background` 0 0% 100%, `--card` 0 0% 100%, `--border` 240 6% 90%, `--muted` 240 5% 96%, `--input` 240 6% 85%, `--primary` 221 83% 53%, `--ring` 221 83% 53%.

### AMOLED
`--background` 0 0% 0%, `--card` 0 0% 2%, `--border` 0 0% 12%, `--primary` 217 91% 65%, `--ring` 217 91% 65%, `--destructive` 0 84% 60%.

### Custom
User picks a solid accent hex; `--primary` and `--ring` derive from it. Background/card/border stay dark-zinc. No gradient swatches.

## Typography

| Role | Size | Weight | Color | Use |
|------|------|--------|-------|-----|
| App title | 0.75rem | 600 | muted-foreground | Title bar |
| Page heading | 1.25rem | 600 | foreground | H1 in views |
| Section heading | 0.875rem | 600 | muted-foreground | H2 uppercase tracking-wide |
| Body | 0.875rem | 400 | foreground | Default text |
| Small / caption | 0.75rem | 400 | muted-foreground | Hints, meta |
| Label | 0.75rem | 500 | muted-foreground | Form labels, section headers |
| Tabular numbers | 0.875rem | 400 | foreground | Durations, counts, percentages |

Font stack: `Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif`. `font-size` root set by font-size setting (14/16/18px).

## Spacing

- Page padding: `p-6` (1.5rem) on views; `pt-6` to clear title bar.
- Section gap: `gap-6` (1.5rem) between sections.
- Component gap: `gap-2` to `gap-4` internally.
- Sidebar padding: `p-4`.
- Player bar padding: `px-4`, height `76px`.
- Inter-element gap: `gap-3` (0.75rem) default, `gap-2` (0.5rem) tight.

## Borders & Radius

- All borders: `1px solid hsl(var(--border))`.
- Max radius: **2px** (`rounded`). No `rounded-md` (6px), `rounded-lg` (8px), `rounded-full` (9999px).
- Focus ring: `2px solid hsl(var(--ring))`, offset `2px`, radius `4px`.
- Disabled opacity: `50%`, `pointer-events-none`.

## Components

### Button
Variants: `default` (solid primary), `secondary` (solid secondary), `ghost` (transparent, solid hover bg), `outline` (1px border, solid hover bg), `destructive` (solid destructive).
Sizes: `default` (h-9 px-4), `sm` (h-8 px-3), `icon` (h-9 w-9).
All corners `rounded` (2px). No pills. Hover = solid background shift, never translucent tint.

### Card / surface
`rounded` (2px), `border border-border`, `bg-card`, `p-3`/`p-4`. Hover = `bg-accent` (solid), never `bg-accent/60`.

### Table
`border-collapse`, `text-sm`, sticky header `bg-background`, row borders `border-b border-border/50`, hover `bg-accent` (solid).

### Input / select
`rounded` (2px), `border border-input`, `bg-background`, focus `ring-2 ring-ring`, no inner shadows.

### Scrollbar
Width `10px`, track transparent, thumb `hsl(var(--muted))` solid, radius `2px`, no decorative transparent border.

### Background layer
Solid preset colors only (no radial gradients). Custom image supported with blur + dim overlay. No `scale()` transforms.

## Custom Presets

### Themes (flat, solid)
- `dark` — dark zinc (default)
- `light` — light zinc
- `amoled` — pure black
- `custom` — user-defined solid accent + dark base

### Accent presets (solid hex swatches, sharp squares — not circles)
Blue `#3b82f6`, Green `#22c55e`, Purple `#a855f7`, Orange `#f97316`, Red `#ef4444`, Pink `#ec4899`.

### Background presets (solid colors only)
- `none`
- `midnight` — solid deep zinc
- `forest` — solid deep green
- `ocean` — solid deep blue
- Custom image (file picker)

### Density
`comfortable` / `compact`.

### Font size
`small` (14px) / `medium` (16px) / `large` (18px).

### Visualizer style
`bars` / `wave` / `mirror` — canvas-drawn, accent-colored, no glow.

## Motion

- Only purposeful motion: focus ring, pressed states, rAF visualizer loop while playing.
- No entrance animations, no hover scales, no spinners beyond the loading indicator, no gradient shifts.

## Accessibility

- Contrast meets WCAG AA on `--border` / `--foreground` pairings.
- Focus-visible ring on all interactive elements.
- `aria-label` on icon buttons; `aria-pressed` on toggles.
- `tabular-nums` for durations/counts.
- `user-select: none` on body (app-like), but text in inputs/selectable.
