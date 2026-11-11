import { useEffect, useMemo, useState } from 'react'
import { toMediaCoverUrl } from '../../shared/media'
import { callApi } from '@/lib/api'
import { useSongActions } from '@/hooks/useSongActions'
import { usePlayerStore } from '@/stores/player'
import { ConfirmDialog } from '@/components/dialogs'
import { EmptyState, ErrorState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from '@/components/skeletons'
import { formatDuration } from '@/components/SongTable'
import type { DuplicateCandidates, DuplicateGroup, Song } from '../../shared/types'

interface DuplicatesProps {
  onStatus: (message: string | null) => void
}

function groupKey(kind: string, group: DuplicateGroup, index: number): string {
  return `${kind}-${index}-${group.key}`
}

function songArt(songId: number): React.JSX.Element {
  return (
    <img
      src={toMediaCoverUrl(songId)}
      alt=""
      draggable={false}
      onError={(event) => {
        event.currentTarget.style.display = 'none'
      }}
      className="h-16 w-16 rounded bg-secondary object-cover"
    />
  )
}

function CompareGroup({
  group,
  groupId,
  keepId,
  onKeep,
  onTrashOne,
  onTrashRest
}: {
  group: DuplicateGroup
  groupId: string
  keepId: number
  onKeep: (songId: number) => void
  onTrashOne: (song: Song) => void
  onTrashRest: () => void
}): React.JSX.Element {
  const attributes: { label: string; value: (song: Song) => string }[] = [
    { label: 'Title', value: (song) => song.title },
    { label: 'Artist', value: (song) => song.artist },
    { label: 'Album', value: (song) => song.album },
    { label: 'Duration', value: (song) => formatDuration(song.duration) },
    { label: 'Year', value: (song) => (song.year === null ? '—' : String(song.year)) },
    { label: 'Added', value: (song) => new Date(song.dateAdded).toLocaleDateString() },
    { label: 'Plays', value: (song) => String(song.playCount) },
    { label: 'File', value: (song) => song.filePath }
  ]
  return (
    <div className="overflow-x-auto rounded border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="w-24 px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Keep
            </th>
            {group.songs.map((song) => (
              <th key={song.id} className="min-w-52 px-3 py-2 text-left">
                <span className="flex items-center gap-3">
                  {songArt(song.id)}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{song.title}</span>
                    <span className="truncate text-xs font-normal text-muted-foreground">{song.artist}</span>
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attributes.map((attribute) => (
            <tr key={attribute.label} className="border-b border-border/50 last:border-0">
              <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">{attribute.label}</th>
              {group.songs.map((song) => (
                <td key={song.id} className="max-w-64 truncate px-3 py-1.5" title={attribute.value(song)}>
                  {attribute.value(song)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="px-3 py-2">
              <Button size="sm" variant="secondary" onClick={onTrashRest}>
                Trash rest
              </Button>
            </td>
            {group.songs.map((song) => (
              <td key={song.id} className="px-3 py-2">
                <span className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <input
                      type="radio"
                      name={groupId}
                      checked={keepId === song.id}
                      onChange={() => onKeep(song.id)}
                      aria-label={`Keep ${song.title}`}
                      className="h-4 w-4 accent-primary"
                    />
                    Keep
                  </label>
                  {keepId !== song.id && (
                    <Button size="sm" variant="ghost" onClick={() => onTrashOne(song)}>
                      Trash
                    </Button>
                  )}
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function Duplicates({ onStatus }: DuplicatesProps): React.JSX.Element {
  const playQueue = usePlayerStore((s) => s.playQueue)
  const { moveFilesToTrash } = useSongActions()
  const [data, setData] = useState<DuplicateCandidates | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [keep, setKeep] = useState<Record<string, number>>({})
  const [confirm, setConfirm] = useState<{ title: string; message: string; ids: number[] } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  async function load(): Promise<void> {
    setError(null)
    try {
      const candidates = await callApi((api) => api.getDuplicateCandidates())
      setData(candidates)
      const defaults: Record<string, number> = {}
      const assign = (groups: DuplicateGroup[], kind: string): void => {
        groups.forEach((group, index) => {
          const first = group.songs[0]
          if (first !== undefined) defaults[groupKey(kind, group, index)] = first.id
        })
      };
      assign(candidates.byHash, 'hash')
      assign(candidates.byMetadata, 'meta')
      setKeep(defaults)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check for duplicates.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const groups = useMemo(() => {
    if (!data) return []
    return [
      ...data.byHash.map((group, index) => ({ kind: 'Exact match', group, id: groupKey('hash', group, index) })),
      ...data.byMetadata.map((group, index) => ({ kind: 'Likely match', group, id: groupKey('meta', group, index) }))
    ]
  }, [data])

  async function trashIds(ids: number[]): Promise<void> {
    setConfirmBusy(true)
    try {
      await moveFilesToTrash(ids)
      onStatus(`Moved ${ids.length} file${ids.length === 1 ? '' : 's'} to the Recycle Bin.`)
      setConfirm(null)
      await load()
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Could not trash files.')
    } finally {
      setConfirmBusy(false)
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (data === null) {
    return (
      <div className="flex h-full flex-col p-6">
        <h1 className="mb-4 text-xl font-semibold">Duplicates</h1>
        <TableSkeleton rows={6} />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Duplicates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Exact matches share file content. Likely matches share title, artist, album, and duration. Removed files go
          to the Recycle Bin — nothing is deleted permanently.
        </p>
      </div>

      {groups.length === 0 && (
        <EmptyState title="No duplicates found" hint="Files are matched by content hash and by metadata." />
      )}

      {(['Exact match', 'Likely match'] as const).map((kind) => {
        const section = groups.filter((entry) => entry.kind === kind)
        if (section.length === 0) return null
        return (
          <section key={kind} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {kind === 'Exact match' ? 'Exact duplicates' : 'Likely duplicates'} ({section.length})
            </h2>
            {section.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-2">
                <CompareGroup
                  group={entry.group}
                  groupId={entry.id}
                  keepId={keep[entry.id] ?? entry.group.songs[0]?.id ?? -1}
                  onKeep={(songId) => setKeep((previous) => ({ ...previous, [entry.id]: songId }))}
                  onTrashOne={(song) =>
                    setConfirm({
                      title: 'Move file to trash',
                      message: `Move “${song.title}” to the Recycle Bin?`,
                      ids: [song.id]
                    })
                  }
                  onTrashRest={() => {
                    const keepId = keep[entry.id] ?? entry.group.songs[0]?.id
                    const rest = entry.group.songs.map((song) => song.id).filter((id) => id !== keepId)
                    if (rest.length === 0) return
                    setConfirm({
                      title: `Trash ${rest.length} file${rest.length === 1 ? '' : 's'}`,
                      message: `Keep “${entry.group.songs.find((s) => s.id === keepId)?.title ?? 'selected'}” and move ${rest.length} other file${rest.length === 1 ? '' : 's'} to the Recycle Bin?`,
                      ids: rest
                    })
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const ids = entry.group.songs.map((song) => song.id)
                      playQueue(ids, 0)
                    }}
                  >
                    Play group
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )
      })}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={`Move ${confirm.ids.length} to trash`}
          busy={confirmBusy}
          onConfirm={() => void trashIds(confirm.ids)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
