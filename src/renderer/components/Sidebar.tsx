import { useState } from 'react'
import { Copy, FolderOpen, Home, Library, ListMusic, Plus, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import type { PlaylistWithCount } from '../../shared/types'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

interface SidebarProps {
  playlists: PlaylistWithCount[]
  onCreatePlaylist: (name: string) => void
  onImportFiles: () => void
  onImportFolder: () => void
  busy: boolean
  mobile?: boolean
}

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/library', label: 'Library', icon: Library, end: false },
  { to: '/playlists', label: 'Playlists', icon: ListMusic, end: false },
  { to: '/duplicates', label: 'Duplicates', icon: Copy, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false }
] as const

export function Sidebar({ playlists, onCreatePlaylist, onImportFiles, onImportFolder, busy, mobile }: SidebarProps): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [creating, setCreating] = useState(false)

  function submit(): void {
    const name = draft.trim()
    if (name) onCreatePlaylist(name)
    setDraft('')
    setCreating(false)
  }

  return (
    <aside className={`flex ${mobile ? 'h-full w-72' : 'w-60 shrink-0'} flex-col gap-4 overflow-y-auto border-r border-border bg-card p-4`}>
      <div className="flex flex-col gap-2">
        <Button variant="default" size={mobile ? 'default' : 'sm'} onClick={onImportFiles} disabled={busy} className={mobile ? 'h-11 min-h-[44px]' : ''}>
          <Plus className={mobile ? 'w-5 h-5' : ''} /> Add files
        </Button>
        <Button variant="secondary" size={mobile ? 'default' : 'sm'} onClick={onImportFolder} disabled={busy} className={mobile ? 'h-11 min-h-[44px]' : ''}>
          <FolderOpen className={mobile ? 'w-5 h-5' : ''} /> Add folder
        </Button>
      </div>

      <nav className="flex flex-col gap-1" aria-label="Primary">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                `flex items-center gap-2 rounded px-3 ${mobile ? 'py-3 min-h-[48px]' : 'py-2'} text-sm font-medium transition-colors hover:bg-accent`,
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              )
            }
          >
            <item.icon className={mobile ? 'w-5 h-5' : ''} /> {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Playlists</span>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Create playlist"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {creating && (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={submit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
              if (event.key === 'Escape') {
                setCreating(false)
                setDraft('')
              }
            }}
            placeholder="Playlist name"
            className={`mx-1 rounded border border-input bg-background px-3 ${mobile ? 'py-2.5 min-h-[44px] text-base' : 'py-1.5 text-sm'} outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring`}
          />
        )}
        {playlists.slice(0, 8).map((playlist) => (
          <NavLink
            key={playlist.id}
            to={`/playlists/${playlist.id}`}
            className={({ isActive }) =>
              cn(
                `flex items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors hover:bg-accent`,
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              )
            }
          >
            <ListMusic className="w-4 h-4" />
            <span className="flex-1 truncate">{playlist.name}</span>
            <span className="text-xs text-muted-foreground">{playlist.songCount}</span>
          </NavLink>
        ))}
        {playlists.length === 0 && !creating && (
          <p className="px-3 py-1 text-xs text-muted-foreground">No playlists yet.</p>
        )}
      </div>
    </aside>
  )
}
