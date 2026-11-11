import { useState } from 'react'
import { ImagePlus, Music } from 'lucide-react'
import { toMediaCoverUrl } from '../../shared/media'
import type { Song, UpdateSongMetadata } from '../../shared/types'
import { Button } from './ui/button'

interface EditMetadataDialogProps {
  song: Song
  onClose: () => void
  onSave: (patch: UpdateSongMetadata) => Promise<string | null>
  onPickCover: () => Promise<string | null>
}

function DialogCover({ songId }: { songId: number }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground">
        <Music />
      </span>
    )
  }
  return (
    <img
      src={toMediaCoverUrl(songId)}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className="h-20 w-20 shrink-0 rounded bg-secondary object-cover"
    />
  )
}

export function EditMetadataDialog({ song, onClose, onSave, onPickCover }: EditMetadataDialogProps): React.JSX.Element {
  const [title, setTitle] = useState(song.title)
  const [artist, setArtist] = useState(song.artist)
  const [album, setAlbum] = useState(song.album)
  const [genre, setGenre] = useState(song.genre ?? '')
  const [year, setYear] = useState(song.year !== null ? String(song.year) : '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pickingCover, setPickingCover] = useState(false)

  async function replaceCover(): Promise<void> {
    setPickingCover(true)
    setError(null)
    try {
      const failure = await onPickCover()
      if (failure) setError(failure)
    } finally {
      setPickingCover(false)
    }
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const parsedYear = year.trim() === '' ? null : Number(year)
    const failure = await onSave({
      title: title.trim(),
      artist: artist.trim(),
      album: album.trim(),
      genre: genre.trim() === '' ? null : genre.trim(),
      year: parsedYear
    })
    setSaving(false)
    if (failure) {
      setError(failure)
      return
    }
    onClose()
  }

  function field(label: string, value: string, setValue: (value: string) => void, placeholder?: string): React.JSX.Element {
    return (
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="h-9 rounded border border-input bg-background px-3 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
      </label>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10" onClick={onClose}>
      <form
        onSubmit={(event) => void submit(event)}
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-3 rounded border border-border bg-card p-5"
        aria-label="Edit metadata"
      >
        <h2 className="text-base font-semibold">Edit metadata</h2>
        <p className="truncate text-xs text-muted-foreground">{song.filePath}</p>
        <div className="flex items-center gap-3 rounded border border-border p-3">
          <DialogCover key={song.coverPath ?? 'none'} songId={song.id} />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Cover art</span>
            <span className="truncate text-xs text-muted-foreground">
              {song.coverPath ? 'Custom or embedded cover' : 'No cover — showing fallback icon'}
            </span>
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void replaceCover()}
                disabled={pickingCover || saving}
              >
                <ImagePlus /> {pickingCover ? 'Choosing…' : 'Replace cover'}
              </Button>
            </div>
          </div>
        </div>
        {field('Title', title, setTitle)}
        {field('Artist', artist, setArtist)}
        {field('Album', album, setAlbum)}
        <div className="grid grid-cols-2 gap-3">
          {field('Genre (optional)', genre, setGenre)}
          {field('Year (optional)', year, setYear, 'e.g. 1999')}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  )
}

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel, busy, onConfirm, onCancel }: ConfirmDialogProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-3 rounded border border-border bg-card p-5"
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
