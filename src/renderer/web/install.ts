import { installWebApi } from './api'

/**
 * Electron's preload script installs `window.api` itself. On the web/Android
 * build there is no preload, so this installs the web bridge instead.
 */
export async function installPlatformApi(): Promise<void> {
  if (typeof window === 'undefined') return
  const existing = (window as unknown as { api?: unknown }).api
  if (existing) return
  installWebApi()
}
