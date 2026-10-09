import { Fragment, memo, useState } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ChevronDown, ChevronRight, Ellipsis, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { BoardWithColumns, Task } from '@/types/domain'
import type { TaskBadge } from '@/features/boards/hooks/use-board-task-badges'
import { columnDragId, laneDropId, taskDragId } from '@/features/boards/board-dnd-model'
import { TaskCard, TaskCardGhost } from '@/features/tasks/components/task-card'
import { CreateTaskDialog } from '@/features/tasks/components/create-task-dialog'
import { useColumnMutations } from '../hooks/use-columns'
import { ColumnDialog } from './column-dialog'

function Lane({ column, boardId, canManage, canEditTasks, dragDisabled, visibleTasks, badges, avatarUrls, dragActive, placeholder }: { column: BoardWithColumns['columns'][number]; boardId: string; canManage: boolean; canEditTasks: boolean; dragDisabled: boolean; visibleTasks: Task[]; badges: Record<string, TaskBadge>; avatarUrls: Record<string, string>; dragActive: boolean; placeholder?: { task: Task; index: number } }) {
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const mutation = useColumnMutations(boardId)
  const { setNodeRef: setSortableNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: columnDragId(column.id), disabled: !canManage || dragDisabled, data: { type: 'column', columnId: column.id } })
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({ id: laneDropId(column.id), data: { type: 'lane', columnId: column.id }, disabled: dragDisabled })
  const count = column.tasks.length
  const wipCount = column.tasks.filter(task => !task.completed_at).length
  const atLimit = column.wip_limit !== null && wipCount >= column.wip_limit
  async function remove() { try { await mutation.remove.mutateAsync(column.id); toast.success('Coluna excluída.'); setDeleting(false) } catch { toast.error('Não foi possível excluir. Mova as tarefas desta coluna antes de removê-la.') } }
  return <section ref={setSortableNodeRef} style={{ transform: CSS.Transform.toString(transform), transition: transition }} aria-label={`Coluna ${column.name}`} className={`flex w-[296px] shrink-0 flex-col self-start rounded-xl border bg-card/70 p-3 sm:w-[310px] ${isDragging ? 'opacity-35' : ''} ${isOver ? 'border-primary bg-primary/5 shadow-[0_0_18px_-8px_var(--primary)]' : 'border-border/80'}`}>
    <header className="mb-3 flex items-center gap-2 px-1"><button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={`${collapsed ? 'Expandir' : 'Recolher'} ${column.name}`} aria-expanded={!collapsed} className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">{collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}</button><span className="size-2.5 shrink-0 rounded-full" style={{ background: column.color }} /><h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{column.name}</h3><span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${atLimit ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'}`} title={atLimit ? 'Limite WIP atingido' : undefined}>{count}</span>{column.wip_limit !== null && <span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${atLimit ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'}`} title="Tarefas abertas / WIP Limit">{wipCount} / {column.wip_limit}</span>}{canManage && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Ações da coluna ${column.name}`}><Ellipsis className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setEditing(true)}><Pencil className="size-4" /> Editar coluna</DropdownMenuItem><DropdownMenuItem onSelect={() => setDeleting(true)} disabled={count > 0}><Trash2 className="size-4" /> Excluir coluna</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}{canManage && <button type="button" aria-label={`Arrastar coluna ${column.name}`} disabled={dragDisabled} className="grid size-8 touch-none place-items-center rounded text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40" {...attributes} {...listeners}><GripVertical className="size-4" /></button>}</header>
    {atLimit && <p className="mb-3 px-1 text-[10px] text-warning">Limite WIP {wipCount > (column.wip_limit ?? 0) ? 'excedido' : 'atingido'}</p>}
    <div ref={setDropNodeRef} className={`rounded-lg transition-colors ${isOver ? 'bg-primary/8 ring-1 ring-primary/30' : ''} ${collapsed ? 'min-h-10' : 'min-h-20'}`}>{!collapsed && <SortableContext items={visibleTasks.map(task => taskDragId(task.id))} strategy={verticalListSortingStrategy}><div className="space-y-2.5">{visibleTasks.map((task, index) => <Fragment key={task.id}>{placeholder?.index === index && <TaskCardGhost task={placeholder.task} badge={badges[placeholder.task.id]} avatarUrls={avatarUrls} />}<TaskCard task={task} badge={badges[task.id]} avatarUrls={avatarUrls} dragDisabled={dragDisabled} dragActive={dragActive} /></Fragment>)}{placeholder && placeholder.index >= visibleTasks.length && <TaskCardGhost task={placeholder.task} badge={badges[placeholder.task.id]} avatarUrls={avatarUrls} />}{visibleTasks.length === 0 && !placeholder && <div className={`rounded-lg border border-dashed px-3 py-6 text-center text-xs ${isOver ? 'border-primary/50 text-primary' : 'border-border text-muted-foreground'}`}>{isOver ? 'Solte a tarefa aqui' : column.tasks.length > 0 ? 'Nenhuma tarefa corresponde aos filtros' : canEditTasks && !dragDisabled ? 'Arraste tarefas para cá' : 'Nenhuma tarefa nesta coluna'}</div>}</div></SortableContext>}</div>
    {!collapsed && canEditTasks && <div className="mt-2"><CreateTaskDialog boardId={boardId} columnId={column.id} compact /></div>}
    <ColumnDialog boardId={boardId} column={column} open={editing} onOpenChange={setEditing} />
    <Dialog open={deleting} onOpenChange={setDeleting}><DialogContent><DialogHeader><DialogTitle>Excluir coluna?</DialogTitle><DialogDescription>“{column.name}” será removida do quadro. Esta ação só é permitida quando a coluna está vazia.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDeleting(false)}>Cancelar</Button><Button variant="destructive" onClick={() => void remove()} disabled={mutation.remove.isPending}>Excluir coluna</Button></div></DialogContent></Dialog>
  </section>
}
export const BoardLane = memo(Lane)
