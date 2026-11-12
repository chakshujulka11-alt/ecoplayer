import { useCallback, useEffect, useRef, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BackgroundLayer } from './components/BackgroundLayer'
import { PlayerBar } from './components/PlayerBar'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { callApi } from './lib/api'
import { usePlayerStore } from './stores/player'
import { useUiStore } from './stores/ui'
import { Duplicates } from './views/Duplicates'
import { Home } from './views/Home'
import { Library } from './views/Library'
import { Playlists, PlaylistDetail } from './views/Playlists'
import { Settings } from './views/Settings'
import type { ImportProgress } from '../shared/types'

export default function App(): React.JSX.Element {
  useKeyboardShortcuts()
  const setSongs = usePlayerStore((s) => s.setSongs)
  const setPlaylists = usePlayerStore((s) => s.setPlaylists)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const setBoost = usePlayerStore((s) => s.setBoost)
  const volume = usePlayerStore((s) => s.volume)
  const boost = usePlayerStore((s) => s.boost)
  const playlists = usePlayerStore((s) => s.playlists)
  const density = useUiStore((s) => s.density)
  const hydrateUi = useUiStore((s) => s.hydrate)
  const backgroundPreset = useUiStore((s) => s.backgroundPreset)
  const backgroundImage = useUiStore((s) => s.backgroundImage)
  const backgroundActive = (backgroundPreset !== null && backgroundPreset !== 'none') || backgroundImage !== null

  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [ready, setReady] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const settingsLoaded = useRef(false)
  const persistTimer = useRef<number | null>(null)

  const refreshAll = useCallback(async () => {
    try {
      const [freshSongs, freshPlaylists] = await Promise.all([
        callApi((api) => api.getSongs()),
        callApi((api) => api.listPlaylists())
      ])
      setSongs(freshSongs)
      setPlaylists(freshPlaylists)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not load the library.')
    }
  }, [setSongs, setPlaylists])

  const runImport = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return
      setBusy(true)
      setStatus(null)
      setProgress({ total: paths.length, processed: 0, added: 0, updated: 0, skipped: 0, current: '', done: false })
      try {
        const summary = await callApi((api) => api.scanPaths(paths))
        await refreshAll()
        if (summary.errors.length > 0) {
          setStatus(
            `Imported ${summary.added} new, updated ${summary.updated}, skipped ${summary.skipped} (${summary.errors.length} errors).`
          )
        } else {
          setStatus(`Imported ${summary.added} new, updated ${summary.updated}, skipped ${summary.skipped}.`)
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Import failed.')
      } finally {
        setBusy(false)
      }
    },
    [refreshAll]
  )

  // Detect mobile (touch + small viewport) for responsive layout.
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768 || ('ontouchstart' in window))
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close sidebar when navigating on mobile.
  useEffect(() => {
    if (!isMobile) return
    const unblock = () => setSidebarOpen(false)
    return unblock
  }, [isMobile])

  // Initial load: settings first (so the correct theme paints immediately),
  // then the library. Content renders only after settings arrive.
  useEffect(() => {
    void (async () => {
      try {
        const settings = await callApi((api) => api.getSettings())
        setVolume(settings.volume)
        setBoost(settings.boost)
        hydrateUi(settings)
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Could not load settings.')
      } finally {
        settingsLoaded.current = true
        setReady(true)
      }
      await refreshAll()
    })()
  }, [refreshAll, setVolume, setBoost, hydrateUi])

  // Persist volume/boost changes, debounced (skip until stored values loaded).
  useEffect(() => {
    if (!settingsLoaded.current) return
    if (persistTimer.current !== null) window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => {
      void callApi((api) => api.updateSettings({ volume, boost })).catch((err: unknown) => {
        setStatus(err instanceof Error ? err.message : 'Could not save settings.')
      })
    }, 500)
    return () => {
      if (persistTimer.current !== null) window.clearTimeout(persistTimer.current)
    }
  }, [volume, boost])

  // Live import progress + OS drag-and-drop (paths resolved in preload).
  useEffect(() => {
    const progressId = window.api.onImportProgress((update) => {
      setProgress(update.done ? null : update)
    })
    const dropId = window.api.onFilesDropped((paths) => {
      void runImport(paths)
    })
    return () => {
      window.api.offImportProgress(progressId)
      window.api.offFilesDropped(dropId)
    }
  }, [runImport])

  async function importFiles(): Promise<void> {
    try {
      const picked = await callApi((api) => api.pickAudioFiles())
      await runImport(picked)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import failed.')
    }
  }

  async function importFolder(): Promise<void> {
    try {
      const folder = await callApi((api) => api.pickFolder())
      if (folder) await runImport([folder])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import failed.')
    }
  }

  async function createPlaylist(name: string): Promise<void> {
    try {
      await callApi((api) => api.createPlaylist(name))
      await refreshAll()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not create playlist.')
    }
  }

  const progressPercent = progress && progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0

  return (
    <HashRouter>
      <BackgroundLayer />
      <div
        className={`app-shell relative text-foreground ${backgroundActive ? 'bg-transparent app-bg-on' : 'bg-background'}`}
      >
        <TitleBar onMenuClick={() => setSidebarOpen((open) => !open)} isMobile={isMobile} />
        {/* Mobile: overlay sidebar. Desktop: fixed sidebar column. */}
        {isMobile ? (
          <>
            <div
              className={`fixed inset-0 z-30 bg-background/90 ${sidebarOpen ? 'block' : 'hidden'}`}
              onClick={() => setSidebarOpen(false)}
            />
            <aside
              className={`fixed left-0 top-0 bottom-0 z-40 w-72 bg-card border-r border-border shadow-lg transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-border bg-card/95 backdrop-blur">
                <span className="text-base font-semibold tracking-tight">Menu</span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="w-10 h-10 rounded-lg border border-border bg-background flex items-center justify-center text-foreground hover:bg-accent hover:text-accent-foreground transition-all"
                  aria-label="Close menu"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <Sidebar
                playlists={playlists}
                onCreatePlaylist={(name) => { void createPlaylist(name); setSidebarOpen(false) }}
                onImportFiles={() => { void importFiles(); setSidebarOpen(false) }}
                onImportFolder={() => { void importFolder(); setSidebarOpen(false) }}
                busy={busy}
                mobile
              />
            </aside>
            <main className="min-w-0 overflow-y-auto overflow-x-clip pt-12 pb-24">
              {!ready && (
                <div className="flex h-full items-center justify-center" aria-label="Loading">
                  <span className="inline-block h-6 w-6 animate-spin rounded border-2 border-muted-foreground border-t-transparent" />
                </div>
              )}
              {ready && (
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/library" element={<Library onStatus={setStatus} />} />
                  <Route path="/playlists" element={<Playlists />} />
                  <Route path="/playlists/:id" element={<PlaylistDetail onStatus={setStatus} onChanged={refreshAll} />} />
                  <Route path="/duplicates" element={<Duplicates onStatus={setStatus} />} />
                  <Route path="/settings" element={<Settings onStatus={setStatus} />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              )}
            </main>
          </>
        ) : (
          <>
            <Sidebar
              playlists={playlists}
              onCreatePlaylist={(name) => void createPlaylist(name)}
              onImportFiles={() => void importFiles()}
              onImportFolder={() => void importFolder()}
              busy={busy}
            />
            <main className={`min-w-0 overflow-y-auto overflow-x-clip ${density === 'compact' ? 'density-compact' : ''}`}>
              {!ready && (
                <div className="flex h-full items-center justify-center" aria-label="Loading">
                  <span className="inline-block h-6 w-6 animate-spin rounded border-2 border-muted-foreground border-t-transparent" />
                </div>
              )}
              {ready && (
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/library" element={<Library onStatus={setStatus} />} />
                  <Route path="/playlists" element={<Playlists />} />
                  <Route path="/playlists/:id" element={<PlaylistDetail onStatus={setStatus} onChanged={refreshAll} />} />
                  <Route path="/duplicates" element={<Duplicates onStatus={setStatus} />} />
                  <Route path="/settings" element={<Settings onStatus={setStatus} />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              )}
            </main>
          </>
        )}
        <div className="col-span-2 shrink-0">
          {sidebarOpen && isMobile && (
            <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center border-2 border-dashed border-primary bg-background/90">
              <p className="text-sm font-medium text-primary">Drop audio files or folders to import</p>
            </div>
          )}
          {!sidebarOpen && progress && (
            <div role="status" className="border-t border-border px-4 py-2 sm:px-6 text-xs text-muted-foreground">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate sm:max-w-none">
                  Importing {progress.processed}/{progress.total} — {progress.current.split(/[\\/]/).pop()}
                </span>
                <span className="tabular-nums">{progressPercent}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-secondary">
                <div className="h-full rounded bg-primary" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}
          <div role="status" className="min-h-6 border-t border-border px-4 py-1 sm:px-6 text-xs text-muted-foreground">
            {status ?? ''}
          </div>
          <PlayerBar
            onPlaybackError={setStatus}
            onVolumeChange={setVolume}
            onBoostChange={setBoost}
          />
        </div>
      </div>
    </HashRouter>
  )
}
