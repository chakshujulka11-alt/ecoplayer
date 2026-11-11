/**
 * Helpers for local media URLs (served by the main process on desktop).
 * Pure functions, safe to import in the renderer and the main process.
 *
 * Audio:  media://audio/<encodeURIComponent(absoluteFilePath)>
 * Covers: media://cover/<trackId>
 *
 * Web/Android build: the `media://` protocol does not exist. The web bridge
 * enables "web media mode", in which blob:/data: URLs pass through untouched
 * and cover art resolves through a synchronous object-URL registry keyed by
 * song id.
 */
export const MEDIA_SCHEME = 'media'
export const MEDIA_AUDIO_HOST = 'audio'
export const MEDIA_COVER_HOST = 'cover'

let webMode = false
const webObjectUrls = new Map<string, string>()

/** Activate blob:/data: pass-through and the cover object-URL registry (web/Android only). */
export function enableWebMediaMode(): void {
  webMode = true
}

export function isWebMediaMode(): boolean {
  return webMode
}

/** Register a reusable object URL under a key such as `cover:<songId>`. */
export function cacheWebObjectUrl(key: string, url: string): void {
  const previous = webObjectUrls.get(key)
  if (previous) URL.revokeObjectURL(previous)
  webObjectUrls.set(key, url)
}

/** Read a cached object URL without creating one. */
export function peekWebObjectUrl(key: string): string | undefined {
  return webObjectUrls.get(key)
}

/** Revoke and drop the object URL stored under a key. */
export function revokeWebObjectUrl(key: string): void {
  const url = webObjectUrls.get(key)
  if (url) {
    URL.revokeObjectURL(url)
    webObjectUrls.delete(key)
  }
}

/** Revoke every cached object URL (database reset / unload). */
export function clearWebObjectUrls(): void {
  for (const url of webObjectUrls.values()) URL.revokeObjectURL(url)
  webObjectUrls.clear()
}

export function toMediaAudioUrl(filePath: string): string {
  if (webMode && /^(blob:|data:)/.test(filePath)) return filePath
  return `${MEDIA_SCHEME}://${MEDIA_AUDIO_HOST}/${encodeURIComponent(filePath)}`
}

export function toMediaCoverUrl(trackId: number): string {
  if (webMode) return webObjectUrls.get(`cover:${trackId}`) ?? ''
  return `${MEDIA_SCHEME}://${MEDIA_COVER_HOST}/${trackId}`
}

export function parseMediaAudioPath(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== `${MEDIA_SCHEME}:` || parsed.host !== MEDIA_AUDIO_HOST) return null
    return decodeURIComponent(parsed.pathname.slice(1))
  } catch {
    return null
  }
}

export function parseMediaCoverId(url: string): number | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== `${MEDIA_SCHEME}:` || parsed.host !== MEDIA_COVER_HOST) return null
    const id = Number(parsed.pathname.slice(1))
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}
