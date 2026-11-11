# Music Player Project - Coding Agent Rules

## Project Setup
- `npm run dev` opens a clean Electron window.
- `npm run typecheck` passes.
- `npm run build` passes.
- No renderer Node access.

## Stack
- Electron + React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Zustand for state
- better-sqlite3 for local database
- music-metadata for audio metadata
- Web Audio API for volume boost and visualizer
- electron-builder for Windows packaging

## Hard Rules
- This is a LOCAL music player only. Do NOT add Spotify integration.
- Do NOT add YouTube download.
- Do NOT add any download center or online media downloading.
- contextIsolation: true, nodeIntegration: false, sandbox: true where possible.
- Renderer must never access Node APIs directly. Use preload IPC only.
- TypeScript strict. No `any` unless justified.
- Use Tailwind design tokens. No random inline CSS.
- UI must be clean, consistent, and free of visual bugs.
- Test at 1280x720, 1440x900, 1920x1080 and Windows scaling 100/125/150%.

## After Each Task
- Run typecheck, lint, build, and report changed files.

## IPC Bridge
- Preload exposes typed `window.api` for DB, files, dialogs, media protocol.
- Custom `media://` protocol for local audio and cover images.
- IPC handlers: import files/folder, read library, create/update/delete playlist, update settings, delete file to trash.
- Error handling for all IPC calls.

## Folder Structure
- src/main - Electron main process
- src/preload - Preload script
- src/renderer - React renderer code
- src/shared - Shared types and utils
- src/db - Database logic
- src/audio - Audio processing