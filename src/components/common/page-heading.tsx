import type { ReactNode } from 'react'
import { SketchUnderline } from './sketch'

export function PageHeading({ eyebrow, title, description, action, decorated = true }: { eyebrow: string; title: string; description?: string; action?: ReactNode; decorated?: boolean }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
    <div className="min-w-0 flex-1"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-primary"><span className="size-1.5 rounded-full bg-primary" />{eyebrow}</div><h1 className="relative inline-block max-w-full text-2xl font-semibold leading-tight tracking-[-.035em] sm:text-3xl">{title}{decorated && <SketchUnderline className="absolute -bottom-2 left-0 h-1.5 w-20 text-primary/65" />}</h1>{description && <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p>}</div>
    {action}
  </div>
}
