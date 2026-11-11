import { toMediaAudioUrl } from '../../shared/media'
import { presetCss } from '@/lib/appearance'
import { useUiStore } from '@/stores/ui'

/**
 * Full-window background behind the app shell: preset gradient and/or a
 * custom image (blurred), always under a dim overlay so text stays readable.
 */
export function BackgroundLayer(): React.JSX.Element | null {
  const backgroundPreset = useUiStore((s) => s.backgroundPreset)
  const backgroundImage = useUiStore((s) => s.backgroundImage)
  const backgroundBlur = useUiStore((s) => s.backgroundBlur)
  const backgroundDim = useUiStore((s) => s.backgroundDim)

  const gradient = presetCss(backgroundPreset)
  if (!gradient && !backgroundImage) return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {gradient && <div className="absolute inset-0" style={{ backgroundImage: gradient }} />}
      {backgroundImage && (
        <img
          src={toMediaAudioUrl(backgroundImage)}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined }}
        />
      )}
      <div className="absolute inset-0 bg-black" style={{ opacity: backgroundDim }} />
    </div>
  )
}
