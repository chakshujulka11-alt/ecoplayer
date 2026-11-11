# Eco Player

A fast, local-only music player for Windows. Built with Electron + React + TypeScript + Vite. No Spotify, no YouTube, no downloads — just your local files, played offline.

![Eco Player](https://img.shields.io/badge/Electron-43-blue?logo=electron) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript) ![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)

## Features

- **Local library** — import audio files or whole folders; drag-and-drop anywhere in the window
- **Playback** — play/pause, next/previous, seek, shuffle, loop current, sleep timer
- **Playlists** — create, rename, delete, reorder by drag, custom or auto cover art
- **Favorites** — star songs, view most-played and recently-added charts
- **Volume boost** — Web Audio gain with limiter (up to 3×)
- **Visualizer** — canvas bars / wave / mirror, synced to playback
- **Themes** — dark, light, AMOLED, custom; solid accent color; background image with blur + dim
- **Metadata editing** — edit title, artist, album, genre, year; replace cover art
- **Duplicate finder** — exact (content hash) and likely (metadata) matches; trash duplicates safely
- **Settings persisted** — everything saved to a local SQLite database
- **Keyboard shortcuts** — Space play/pause, N/P next/previous, arrow volume, M mute

## Tech stack

| Layer | Tech |
|-------|------|
| Shell | Electron 43 |
| UI | React 19 + TypeScript + Vite 7 |
| Styling | Tailwind CSS + shadcn/ui primitives |
| State | Zustand |
| Database | better-sqlite3 (SQLite) |
| Audio | HTMLAudioElement + Web Audio API (gain, compressor, analyser) |
| Metadata | music-metadata |
| Packaging | electron-builder (NSIS + portable, x64) |
| Android | Capacitor web view (IndexedDB fallback) |

## Design direction

Flat Zinc Minimal: solid colors, sharp 2px corners, crisp 1px borders, no gradients, no glassmorphism, no neon, no shadows, purposeful motion only.

## Getting started

### Prerequisites

- Node.js (LTS)
- Windows (primary target)

### Install

```bash
git clone https://github.com/chakshujulka11-alt/ecoplayer.git
cd ecoplayer
npm install
```

### One-time native setup (Windows)

`better-sqlite3` needs a native binding matching your Electron ABI:

```bash
node scripts/setup-sqlite.cjs
```

### Run in development

```bash
npm run dev
```

### Build

```bash
npm run build        # Electron + renderer bundles
npm run package      # NSIS installer + portable (x64)
```

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Launch dev Electron window |
| `npm run build` | Production build (main + preload + renderer) |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm run package` | NSIS + portable Windows installer |
| `npm run icon` | Regenerate `build/icon.png` + `build/icon.ico` |

## Project structure

```
src/main          Electron main process, IPC handlers, media:// protocol
src/preload       Typed window.api bridge (contextBridge, sandboxed)
src/renderer      React app: views, components, audio engine, Zustand stores
src/shared        Types, IPC channels, media URL helpers
src/db            SQLite repositories (desktop)
src/renderer/web  IndexedDB bridge (web/Android fallback)
```

## License

ISC

---

Made with ☀️ for local music lovers.
