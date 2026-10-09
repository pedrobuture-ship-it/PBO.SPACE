import { AlertCircle, ArrowRight, Layers3 } from 'lucide-react'
import { DoodleCircle, HandDrawnArrow } from './sketch'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { LucideIcon } from 'lucide-react'

export function LoadingScreen() {
  return <div className="grid min-h-svh place-items-center bg-background"><div role="status" aria-live="polite" className="w-60 space-y-4"><div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="grid size-9 place-items-center rounded-lg border border-primary/20 bg-primary/10"><Layers3 className="size-4 text-primary" /></span>Preparando seu espaço…</div><Skeleton className="h-2 w-full" /><Skeleton className="h-2 w-2/3" /></div></div>
}

export function EmptyState({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 text-center">
    <div className="relative mb-5 grid size-12 place-items-center text-cyan"><DoodleCircle className="absolute -inset-2 size-16 text-primary/45" /><Layers3 className="size-6" /><HandDrawnArrow className="absolute -right-14 top-4 h-8 w-12 text-primary/45" /></div>
    <h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
    {action && <Button className="mt-5" onClick={onAction}>{action}<ArrowRight className="size-4" /></Button>}
  </div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
    <AlertCircle className="size-5 shrink-0 text-destructive" /><span className="min-w-0 flex-1 basis-40 text-[13px] leading-relaxed">{message}</span>{onRetry && <Button variant="outline" size="sm" className="ml-auto" onClick={onRetry}>Tentar novamente</Button>}
  </div>
}

export function SectionEmptyState({ title, description, icon: Icon = Layers3 }: { title: string; description?: string; icon?: LucideIcon }) {
  return <div className="flex min-h-20 items-center gap-3 rounded-lg border border-dashed border-border bg-background/40 p-3"><Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="text-[13px] font-medium">{title}</p>{description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}</div></div>
}
