import { AlertTriangle, Inbox } from 'lucide-react'
import { Button } from './ui/button'

export function Spinner(): React.JSX.Element {
  return (
    <span
      aria-label="Loading"
      className="inline-block h-6 w-6 animate-spin rounded border-2 border-muted-foreground border-t-transparent"
    />
  )
}

export function LoadingState({ message = 'Loading…' }: { message?: string }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <Spinner />
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
      <Inbox />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-sm px-6 text-center text-xs">{hint}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <AlertTriangle />
      <p className="max-w-md px-6 text-center text-sm">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
