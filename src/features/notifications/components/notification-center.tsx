import { isToday, isYesterday, isThisWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AtSign, Bell, CalendarClock, Check, CheckCheck, CircleCheck, Clock3, CornerDownRight, MessageCircle, Shield, Trash2, UserPlus, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SketchSpark, SketchUnderline } from '@/components/common/sketch'
import { ErrorState } from '@/components/common/states'
import { useNotifications, useUnreadNotifications } from '../hooks/use-notifications'
import type { NotificationItem } from '../services/notification-service'
import { formatRelativeDate } from '@/utils/format-relative-date'

const icons = {
  task_assigned: UserPlus, mention: AtSign, comment: MessageCircle, due_date_changed: CalendarClock,
  task_overdue: Clock3, board_invite: UserPlus, workspace_invite: UserPlus, role_changed: Shield,
  task_completed: CircleCheck, task_moved: CornerDownRight,
} as const
function groupOf(date: string) {
  const value = new Date(date)
  if (isToday(value)) return 'Hoje'
  if (isYesterday(value)) return 'Ontem'
  if (isThisWeek(value, { locale: ptBR })) return 'Esta semana'
  return 'Mais antigas'
}
const groups = ['Hoje', 'Ontem', 'Esta semana', 'Mais antigas'] as const
function NotificationRow({ item, onOpen, onRead, onDelete, busy }: { item: NotificationItem; onOpen: () => void; onRead: () => void; onDelete: () => void; busy: boolean }) {
  const Icon = icons[item.type as keyof typeof icons] ?? Bell
  const reduced = useReducedMotion()
  return <motion.li layout={!reduced} initial={reduced ? false : { opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, x: 12 }} transition={{ duration: reduced ? 0 : .18 }} className={`group relative rounded-lg border p-3.5 transition-colors ${item.read ? 'border-border/60 bg-card/50' : 'handcrafted-unread border-primary/25 bg-primary/[.055]'}`}>
    <div className="flex gap-3"><span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border ${item.read ? 'border-border text-muted-foreground' : 'border-primary/25 bg-primary/10 text-primary'}`}><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1"><button type="button" onClick={onOpen} className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><span className="flex items-start gap-2"><span className="min-w-0 flex-1 text-sm leading-snug text-foreground">{item.actor?.display_name && <span className="font-semibold">{item.actor.display_name} · </span>}{item.content}</span>{!item.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />}</span><span className="mt-1.5 block truncate text-[11px] text-muted-foreground">{item.board?.name && <>{item.board.name}{item.task?.title ? ' / ' : ''}</>}{item.task?.title}{!item.board && !item.task && 'Workspace'}</span></button>
        <div className="mt-2 flex items-center justify-between gap-2"><time dateTime={item.created_at} className="text-[10px] text-subtle-foreground">{formatRelativeDate(item.created_at)}</time><div className="flex gap-1">{!item.read && <Button type="button" variant="ghost" size="icon-sm" disabled={busy} onClick={onRead} aria-label="Marcar como lida" title="Marcar como lida"><Check className="size-3.5" /></Button>}<Button type="button" variant="ghost" size="icon-sm" disabled={busy} onClick={onDelete} aria-label="Excluir notificação" title="Excluir notificação"><X className="size-3.5" /></Button></div></div>
      </div></div>
  </motion.li>
}
export function NotificationCenter({ onNavigate, compact = false, showHeader = true }: { onNavigate?: () => void; compact?: boolean; showHeader?: boolean }) {
  const navigate = useNavigate()
  const notifications = useNotifications()
  const unread = useUnreadNotifications()
  const items = [...new Map((notifications.data?.pages.flat() ?? []).map(item => [item.id, item])).values()]
  const busy = notifications.markRead.isPending || notifications.markAllRead.isPending || notifications.remove.isPending || notifications.clearRead.isPending
  const mutationError = { onError: () => toast.error('Não foi possível atualizar as notificações. Tente novamente.') }
  function open(item: NotificationItem) {
    if (!item.read) notifications.markRead.mutate(item.id, mutationError)
    if (item.board_id) navigate(`/app/board/${item.board_id}${item.task_id ? `?task=${item.task_id}` : ''}`)
    onNavigate?.()
  }
  return <div className={`flex min-h-0 flex-col ${compact ? 'h-full' : ''}`}>
    {showHeader && <div className="shrink-0 border-b border-border px-5 pb-4 pt-5 pr-12"><div className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan">Seu fluxo</div><div className="mt-1 flex items-center gap-2"><h2 className="relative w-fit text-xl font-semibold">Notificações<SketchUnderline className="absolute -bottom-1 left-0 h-1 w-full text-primary/30" /></h2>{Boolean(unread.data) && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">{unread.data! > 99 ? '99+' : unread.data} novas</span>}</div><p className="mt-2 text-xs text-muted-foreground">Atualizações dos seus quadros e tarefas.</p></div>}
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-2"><span className="text-[11px] text-muted-foreground">{items.length ? `${items.length} carregadas` : 'Sua inbox'}</span><div className="flex gap-1"><Button variant="ghost" size="sm" disabled={busy || !unread.data} onClick={() => notifications.markAllRead.mutate(undefined, mutationError)} className="h-8 gap-1 text-[11px]"><CheckCheck className="size-3.5" /> Ler todas</Button><Button variant="ghost" size="sm" disabled={busy || items.length === 0} onClick={() => notifications.clearRead.mutate(undefined, mutationError)} className="h-8 gap-1 text-[11px]"><Trash2 className="size-3.5" /> Limpar lidas</Button></div></div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
      {notifications.isPending ? <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
        : notifications.isError ? <ErrorState message="Não foi possível carregar as notificações." onRetry={() => void notifications.refetch()} />
        : items.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><div className="relative mb-4 flex size-14 items-center justify-center rounded-xl border border-primary/25 bg-primary/5"><Bell className="size-6 text-primary/70" /><SketchSpark className="absolute -right-3 -top-2 size-5 rotate-12 text-cyan" /></div><p className="text-sm font-medium">Tudo em dia por aqui</p><p className="mt-1 max-w-56 text-xs leading-relaxed text-muted-foreground">Quando algo importante acontecer, você verá aqui.</p></div>
        : <>{groups.map(group => { const rows = items.filter(item => groupOf(item.created_at) === group); return rows.length ? <section key={group} className="mb-6"><h3 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[.16em] text-subtle-foreground">{group}</h3><ul className="space-y-2"><AnimatePresence initial={false}>{rows.map(item => <NotificationRow key={item.id} item={item} busy={busy} onOpen={() => open(item)} onRead={() => notifications.markRead.mutate(item.id, mutationError)} onDelete={() => notifications.remove.mutate(item.id, mutationError)} />)}</AnimatePresence></ul></section> : null })}{notifications.hasNextPage && <Button variant="outline" size="sm" className="w-full" disabled={notifications.isFetchingNextPage} onClick={() => void notifications.fetchNextPage()}>{notifications.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}</Button>}</>}
    </div>
  </div>
}
