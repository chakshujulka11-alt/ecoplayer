/**
 * Typed access to the preload bridge. Throws a plain Error with the
 * main-process message so UI code can show it in the status line.
 * No Node.js APIs are used here — only `window.api`.
 */
import type { IpcResult, RendererApi } from '../../shared/types'

function getBridge(): RendererApi {
  const bridge = (window as unknown as { api?: RendererApi }).api
  if (!bridge) throw new Error('Preload bridge is unavailable.')
  return bridge
}

export async function callApi<T>(fn: (api: RendererApi) => Promise<IpcResult<T>>): Promise<T> {
  const result = await fn(getBridge())
  if (!result.ok) throw new Error(result.error)
  return result.data
}
