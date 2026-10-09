export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3">
    <img src="/notepb-fox.webp" alt="" className="size-9 shrink-0 rounded-lg object-cover shadow-[var(--glow-brand)]" />
    {!compact && <div className="leading-tight"><div className="text-[15px] font-semibold tracking-tight">Note<span className="text-cyan">PB</span></div><div className="mt-1 text-[8px] uppercase tracking-[.12em] text-muted-foreground">handcrafted digital workspace</div></div>}
  </div>
}
