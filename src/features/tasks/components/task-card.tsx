import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { CalendarDays, CheckSquare2, GripVertical, MessageCircle, Paperclip } from 'lucide-react'
import { format, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Task } from '@/types/domain'
import type { TaskBadge } from '@/features/boards/hooks/use-board-task-badges'
import { taskDragId } from '@/features/boards/board-dnd-model'
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar'
import { useLocation, useNavigate } from 'react-router'
import { priorityConfig } from '../priority'

function TaskCardContent({ task, badge, avatarUrls = {}, onOpen, dragHandle }: { task: Task; badge?: TaskBadge; avatarUrls?: Record<string, string>; onOpen?: () => void; dragHandle?: React.ReactNode }) {
  const priority = priorityConfig[task.priority]
  const PriorityIcon = priority.icon
  const overdue = task.due_date && !task.completed_at && isPast(new Date(task.due_date))
  return <div className="rounded-lg border border-border/80 bg-surface-raised/85 p-3 shadow-sm transition-colors hover:border-primary/35 focus-within:border-primary/60"><div className="flex items-start gap-2"><button type="button" onClick={onOpen} disabled={!onOpen} className="min-h-8 min-w-0 flex-1 text-left sm:min-h-6 text-[13px] font-medium leading-snug hover:text-primary">{task.title}</button>{dragHandle}</div>{task.description && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{task.description}</p>}{task.labels.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{task.labels.slice(0, 3).map(label => <span key={label} className="max-w-32 truncate rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{label}</span>)}{task.labels.length > 3 && <span className="text-[10px] text-muted-foreground">+{task.labels.length - 3}</span>}</div>}<div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[10px] text-muted-foreground">{task.priority !== 'none' && <span className="inline-flex items-center gap-1" style={{ color: priority.color }} title={`Prioridade ${priority.label}`}><PriorityIcon className="size-3.5" />{priority.label}</span>}{task.due_date && <span className={`inline-flex items-center gap-1 ${overdue ? 'text-destructive' : isToday(new Date(task.due_date)) ? 'text-warning' : ''}`} title="Prazo"><CalendarDays className="size-3.5" />{format(new Date(task.due_date), 'dd MMM', { locale: ptBR })}</span>}{badge && badge.checklist_total > 0 && <span className="inline-flex items-center gap-1" title="Checklist"><CheckSquare2 className="size-3.5" />{badge.checklist_done}/{badge.checklist_total}</span>}{badge && badge.comments > 0 && <span className="inline-flex items-center gap-1" title="Comentários"><MessageCircle className="size-3.5" />{badge.comments}</span>}{badge && badge.attachments > 0 && <span className="inline-flex items-center gap-1" title="Anexos"><Paperclip className="size-3.5" />{badge.attachments}</span>}{task.assignees.length > 0 && <AvatarGroup className="ml-auto">{task.assignees.slice(0, 3).map(person => <Avatar key={person.id} size="sm" title={person.display_name}><AvatarImage src={person.avatar_url ? avatarUrls[person.avatar_url] : undefined} alt="" /><AvatarFallback className="text-[9px]">{(person.display_name || '?').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>)}</AvatarGroup>}</div></div>
}
export function TaskCardOverlay({ task, badge, avatarUrls }: { task: Task; badge?: TaskBadge; avatarUrls?: Record<string, string> }) { const reduced = useReducedMotion(); return <div className={`w-[280px] cursor-grabbing rounded-lg border border-primary/35 shadow-[0_16px_40px_-14px_rgba(0,0,0,.8)] ${reduced ? '' : 'rotate-[.8deg] scale-[1.02]'}`}><TaskCardContent task={task} badge={badge} avatarUrls={avatarUrls} /></div> }
export function TaskCardGhost({ task, badge, avatarUrls }: { task: Task; badge?: TaskBadge; avatarUrls?: Record<string, string> }) { return <div aria-hidden="true" className="pointer-events-none rounded-lg outline outline-1 outline-dashed outline-primary/30 opacity-35"><TaskCardContent task={task} badge={badge} avatarUrls={avatarUrls} /></div> }
function Card({ task, badge, avatarUrls, dragDisabled = false, dragActive = false }: { task: Task; badge?: TaskBadge; avatarUrls?: Record<string, string>; dragDisabled?: boolean; dragActive?: boolean }) {
  const reduced = useReducedMotion()
  const location = useLocation()
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: taskDragId(task.id), disabled: dragDisabled, data: { type: 'task', taskId: task.id } })
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? 'opacity-35' : ''}><motion.div initial={reduced || dragActive ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} whileHover={reduced || dragActive ? undefined : { y: -2 }} transition={{ duration: reduced ? 0 : .16 }}><TaskCardContent task={task} badge={badge} avatarUrls={avatarUrls} onOpen={() => { const params = new URLSearchParams(location.search); params.set('task', task.id); navigate({ pathname: location.pathname, search: params.toString() }, { state: { taskDrawerOpened: true } }) }} dragHandle={!dragDisabled && <button type="button" aria-label={`Arrastar ${task.title}`} className="-mr-1 -mt-1 grid size-7 touch-none place-items-center rounded text-muted-foreground hover:text-foreground" {...attributes} {...listeners}><GripVertical className="size-4" /></button>} /></motion.div></article>
}
export const TaskCard = memo(Card)
