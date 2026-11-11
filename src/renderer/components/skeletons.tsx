import { cn } from '@/lib/utils'

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }): React.JSX.Element {
  return <div aria-hidden style={style} className={cn('animate-pulse rounded bg-secondary', className)} />
}

export function TableSkeleton({ rows = 8 }: { rows?: number }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col gap-1 p-4" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 border-b border-border/50 py-2">
          <Skeleton className="h-10 w-10 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-4" style={{ width: `${70 - (index % 4) * 12}%` }} />
            <Skeleton className="h-3" style={{ width: `${45 - (index % 3) * 8}%` }} />
          </div>
          <Skeleton className="h-4 w-12 shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function CardsSkeleton({ cards = 10 }: { cards?: number }): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-3 lg:grid-cols-5" aria-label="Loading">
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}
