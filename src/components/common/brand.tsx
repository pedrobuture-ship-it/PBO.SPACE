import { Layers3 } from 'lucide-react'

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3">
    <div className="relative grid size-8 shrink-0 place-items-center rounded-lg border border-primary/40 bg-primary/10 text-primary shadow-[var(--glow-brand)]">
      <Layers3 className="size-5 -rotate-12" strokeWidth={2.3} />
      <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-cyan" />
    </div>
    {!compact && <div className="leading-tight"><div className="text-[15px] font-semibold tracking-tight">hwd<span className="text-cyan">.</span>space</div><div className="mt-1 text-[8px] uppercase tracking-[.12em] text-muted-foreground">handcrafted digital workspace</div></div>}
  </div>
}
