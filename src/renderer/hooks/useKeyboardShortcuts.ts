import { useEffect } from 'react'
import { usePlayerStore } from '../stores/player'

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  // Space/letters on focused buttons already activate them; don't double-handle.
  if (tag === 'BUTTON' || target.getAttribute('role') === 'menuitem') return true
  return false
}

/**
 * Global shortcuts (ignored while typing or when a control has focus):
 * Space play/pause, N next, P previous, ArrowUp/Down volume, M mute.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isEditable(event.target)) return
      const state = usePlayerStore.getState()
      switch (event.key) {
        case ' ':
          event.preventDefault()
          state.toggle()
          break
        case 'n':
        case 'N':
          state.next()
          break
        case 'p':
        case 'P':
          state.previous()
          break
        case 'ArrowUp':
          event.preventDefault()
          state.setVolume(Math.min(1, Math.round((state.volume + 0.05) * 100) / 100))
          break
        case 'ArrowDown':
          event.preventDefault()
          state.setVolume(Math.max(0, Math.round((state.volume - 0.05) * 100) / 100))
          break
        case 'm':
        case 'M':
          state.toggleMute()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
