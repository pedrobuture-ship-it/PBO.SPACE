import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import { BoardIcon } from './board-style-fields'
import { MotionCard } from '@/components/common/motion'
import type { Board } from '@/types/domain'
import { formatRelativeDate } from '@/utils/format-relative-date'

export function BoardCard({ board, index = 0 }: { board: Board; index?: number }) {
  return <Link to={`/app/board/${board.id}`} className="group block rounded-xl"><MotionCard className="relative flex min-h-[184px] flex-col overflow-hidden p-5">
    <div className="flex items-start justify-between"><div className="grid size-9 place-items-center rounded-lg border border-border bg-surface-raised" style={{ color: board.color }}><BoardIcon name={board.icon} className="size-4" /></div><span className="text-[10px] font-medium tracking-wider text-muted-foreground">{String(index + 1).padStart(2, '0')}</span></div>
    <div className="my-5"><div className="flex items-center justify-between gap-3"><h3 className="truncate text-base font-semibold tracking-tight">{board.name}</h3><ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition group-hover:text-cyan" /></div><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{board.description || 'Sem descrição'}</p></div>
    <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full" style={{ background: board.color }} /> Projeto</span><span>{formatRelativeDate(board.created_at)}</span></div>
  </MotionCard></Link>
}
