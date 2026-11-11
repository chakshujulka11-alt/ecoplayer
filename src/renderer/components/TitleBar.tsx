interface TitleBarProps {
  onMenuClick: () => void
  isMobile: boolean
}

export function TitleBar({ onMenuClick, isMobile }: TitleBarProps): React.JSX.Element {
  return (
    <header className="drag-region col-span-2 flex h-9 shrink-0 items-center border-b border-border bg-background pl-4 pr-36">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Toggle menu"
        className={`mr-3 rounded p-1 text-muted-foreground hover:bg-accent ${isMobile ? 'block' : 'hidden md:block lg:hidden'}`}
      >
        <span className="sr-only">Toggle menu</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <span className="text-xs font-semibold tracking-wide text-muted-foreground">Eco Player</span>
    </header>
  )
}
