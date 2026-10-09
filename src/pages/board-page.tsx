import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { useReducedMotion } from 'framer-motion'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Archive, ArrowLeft, Ellipsis, FilterX, LayoutGrid, Pencil, Search, Settings2, Star, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SketchUnderline } from '@/components/common/sketch'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ErrorState } from '@/components/common/states'
import { useAuth } from '@/features/auth/auth-context'
import { useBoard } from '@/features/boards/hooks/use-boards'
import { useBoardDnd } from '@/features/boards/hooks/use-board-dnd'
import { useBoardTaskBadges, type TaskBadge } from '@/features/boards/hooks/use-board-task-badges'
import { useAvatarUrls } from '@/features/profiles/hooks/use-avatar-urls'
import { useBoardMembers, useWorkspaceMembers } from '@/features/members/hooks/use-members'
import { useLabels } from '@/features/labels/hooks/use-labels'
import { useFavorites, useSetFavorite } from '@/features/favorites/hooks/use-favorites'
import { BoardIcon } from '@/features/boards/components/board-style-fields'
import { BoardMembersDialog } from '@/features/boards/components/board-members-dialog'
import { EditBoardDialog } from '@/features/boards/components/edit-board-dialog'
import { updateBoard } from '@/features/boards/services/board-service'
import { BoardLane } from '@/features/columns/components/board-lane'
import { ColumnDialog } from '@/features/columns/components/column-dialog'
import { TaskCardOverlay } from '@/features/tasks/components/task-card'
import { TaskDetailDrawer } from '@/features/tasks/components/task-detail-drawer'
import { CreateTaskDialog } from '@/features/tasks/components/create-task-dialog'
import { useBoardRealtime } from '@/hooks/use-board-realtime'
import { useQueryClient } from '@tanstack/react-query'
import { columnDragId } from '@/features/boards/board-dnd-model'
import { emptyBoardFilters, hasBoardFilters, matchesBoardTask, type BoardFilters } from '@/features/boards/board-filters'
import type { TaskPriority } from '@/types/domain'

const priorityNames: Record<TaskPriority, string> = { none: 'Sem prioridade', low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' }
const dueNames = { overdue: 'Atrasadas', today: 'Hoje', week: 'Próximos 7 dias', 'no-date': 'Sem prazo' }
const noBadges: Record<string, TaskBadge> = {}
const noAvatars: Record<string, string> = {}
function BoardSkeleton() { return <div className="space-y-6" aria-label="Carregando quadro"><Skeleton className="h-8 w-72" /><Skeleton className="h-20 w-full" /><Skeleton className="h-12 w-full" /><div className="flex gap-4 overflow-hidden">{[1, 2, 3].map(i => <Skeleton key={i} className="h-[480px] w-[300px] shrink-0 rounded-xl" />)}</div></div> }
export function BoardPage() {
  const { boardId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const activeTaskId = new URLSearchParams(location.search).get('task')
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const reducedMotion = useReducedMotion()
  const query = useBoard(boardId)
  const dnd = useBoardDnd(boardId, query.data)
  const board = dnd.board
  useBoardRealtime(boardId, Boolean(query.data), dnd.busy, activeTaskId)
  const badges = useBoardTaskBadges(boardId, Boolean(query.data))
  const labels = useLabels(board?.id ?? '')
  const boardMembers = useBoardMembers(board?.id ?? '')
  const workspaceMembers = useWorkspaceMembers(board?.workspace_id ?? '')
  const favorites = useFavorites()
  const favoriteMutation = useSetFavorite()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filters, setFilters] = useState<BoardFilters>(emptyBoardFilters)
  const [membersOpen, setMembersOpen] = useState(false)
  const [editing, setEditing] = useState<'edit' | 'settings' | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archivePending, setArchivePending] = useState(false)
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(search.trim()), 180); return () => window.clearTimeout(timer) }, [search])
  const tasks = useMemo(() => board?.columns.flatMap(column => column.tasks) ?? [], [board])
  const memberList = useMemo(() => {
    const explicit = new Set((boardMembers.data ?? []).map(item => item.user_id))
    return (workspaceMembers.data ?? []).filter(item => ['owner', 'admin'].includes(item.role) || explicit.has(item.user_id))
  }, [boardMembers.data, workspaceMembers.data])
  const avatarUrls = useAvatarUrls([...memberList.map(item => item.profile?.avatar_url), ...tasks.flatMap(task => task.assignees.slice(0, 3).map(person => person.avatar_url))]).data ?? noAvatars
  const userId = session?.user.id
  const activeFilters = hasBoardFilters(filters, debounced)
  const filtered = useMemo(() => new Map((board?.columns ?? []).map(column => [column.id, activeFilters ? column.tasks.filter(task => matchesBoardTask(task, filters, debounced, userId)) : column.tasks])), [board, activeFilters, filters, debounced, userId])
  const canManage = board?.access_role === 'owner' || board?.access_role === 'admin'
  const canEditTasks = Boolean(board && board.access_role !== 'viewer')
  const favorite = favorites.data?.some(item => item.board_id === boardId) ?? false
  const filteredCount = [...filtered.values()].reduce((total, group) => total + group.length, 0)
  function dragName(id: string | number) {
    const entityId = String(id).split(':').pop()
    return tasks.find(task => task.id === entityId)?.title ?? board?.columns.find(column => column.id === entityId)?.name ?? 'Item'
  }
  function dropName(id: string | number) {
    const entityId = String(id).split(':').pop()
    const columnId = tasks.find(task => task.id === entityId)?.column_id ?? entityId
    return board?.columns.find(column => column.id === columnId)?.name ?? 'quadro'
  }
  function updateFilter<K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) { setFilters(current => ({ ...current, [key]: value })) }
  function clearFilters() { setFilters(emptyBoardFilters); setSearch(''); setDebounced('') }
  async function toggleFavorite() { try { await favoriteMutation.mutateAsync({ boardId, selected: !favorite }); toast.success(favorite ? 'Removido dos favoritos.' : 'Adicionado aos favoritos.') } catch { toast.error('Não foi possível alterar o favorito.') } }
  async function archiveBoard() { if (!board) return; setArchivePending(true); try { await updateBoard(board.id, { archived: true }); await queryClient.invalidateQueries({ queryKey: ['boards'] }); await queryClient.invalidateQueries({ queryKey: ['home-overview'] }); toast.success('Quadro arquivado.'); navigate('/app') } catch { toast.error('Não foi possível arquivar o quadro.') } finally { setArchivePending(false) } }
  if (query.error) return <ErrorState message="Quadro indisponível ou sem acesso. Confira o endereço e suas permissões." onRetry={() => void query.refetch()} />
  if (query.isLoading || !query.data) return <BoardSkeleton />
  if (!board) return <ErrorState message="Quadro indisponível." onRetry={() => void query.refetch()} />
  return <div className="min-w-0 space-y-5">
    <header className="space-y-4"><Link to="/app" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"><ArrowLeft className="size-3.5" /> Workspace</Link><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><div className="grid size-12 shrink-0 place-items-center rounded-xl border border-border bg-card" style={{ color: board.color }}><BoardIcon name={board.icon} className="size-6" /></div><div className="min-w-0"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[.2em] text-cyan">Quadro Kanban</div><h1 className="relative w-fit max-w-full truncate text-2xl font-semibold tracking-tight sm:text-3xl">{board.name}<SketchUnderline className="absolute -bottom-1 left-0 h-1 w-full text-primary/35" /></h1>{board.description && <p className="mt-1 line-clamp-1 max-w-xl text-xs text-muted-foreground">{board.description}</p>}</div></div><div className="flex w-full flex-wrap items-center gap-2 sm:w-auto"><Button variant="ghost" size="icon" aria-label={favorite ? 'Remover dos favoritos' : 'Favoritar quadro'} aria-pressed={favorite} onClick={() => void toggleFavorite()} className={favorite ? 'text-warning' : 'text-muted-foreground'}><Star className={`size-4 ${favorite ? 'fill-current' : ''}`} /></Button><button type="button" onClick={() => setMembersOpen(true)} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:border-primary/40" aria-label="Ver membros do quadro"><AvatarGroup>{memberList.slice(0, 3).map(item => <Avatar key={item.user_id} size="sm" title={item.profile?.display_name}><AvatarImage src={item.profile?.avatar_url ? avatarUrls[item.profile.avatar_url] : undefined} alt="" /><AvatarFallback className="text-[9px]">{(item.profile?.display_name || '?').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>)}{memberList.length > 3 && <AvatarGroupCount className="size-6 text-[9px]">+{memberList.length - 3}</AvatarGroupCount>}</AvatarGroup><span>{memberList.length}</span></button>{board.columns[0] && canEditTasks && <CreateTaskDialog boardId={board.id} columnId={board.columns[0].id} />}{canManage && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Opções do quadro"><Ellipsis className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setEditing('edit')}><Pencil className="size-4" /> Editar quadro</DropdownMenuItem><DropdownMenuItem onSelect={() => setMembersOpen(true)}><Users className="size-4" /> Membros</DropdownMenuItem><DropdownMenuItem onSelect={() => setEditing('settings')}><Settings2 className="size-4" /> Configurações</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setArchiveOpen(true)} className="text-destructive"><Archive className="size-4" /> Arquivar</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</div></div></header>
    <section aria-label="Busca e filtros" className="space-y-3 rounded-xl border border-border bg-card/60 p-3"><div className="flex flex-wrap items-center gap-2"><div className="relative min-w-48 flex-1 sm:max-w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar título ou descrição" aria-label="Buscar tarefas" className="h-9 pl-9" /></div><Button variant={filters.mine ? 'secondary' : 'outline'} size="sm" aria-pressed={filters.mine} onClick={() => updateFilter('mine', !filters.mine)}>Minhas tarefas</Button><span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground"><LayoutGrid className="size-3.5" />{filteredCount} / {tasks.length}</span></div><div className="flex flex-wrap gap-2"><Select value={filters.assignee} onValueChange={value => updateFilter('assignee', value)}><SelectTrigger aria-label="Filtrar responsável" className="w-36"><SelectValue placeholder="Responsável" /></SelectTrigger><SelectContent><SelectItem value="all">Responsável: todos</SelectItem>{memberList.map(item => <SelectItem key={item.user_id} value={item.user_id}>{item.profile?.display_name || 'Membro'}</SelectItem>)}</SelectContent></Select><Select value={filters.priority} onValueChange={value => updateFilter('priority', value as BoardFilters['priority'])}><SelectTrigger aria-label="Filtrar prioridade" className="w-35"><SelectValue placeholder="Prioridade" /></SelectTrigger><SelectContent><SelectItem value="all">Prioridade: todas</SelectItem>{(Object.keys(priorityNames) as TaskPriority[]).map(priority => <SelectItem key={priority} value={priority}>{priorityNames[priority]}</SelectItem>)}</SelectContent></Select><Select value={filters.label} onValueChange={value => updateFilter('label', value)}><SelectTrigger aria-label="Filtrar label" className="w-32"><SelectValue placeholder="Label" /></SelectTrigger><SelectContent><SelectItem value="all">Labels: todas</SelectItem>{labels.data?.map(label => <SelectItem key={label.id} value={label.name}>{label.name}</SelectItem>)}</SelectContent></Select><Select value={filters.due} onValueChange={value => updateFilter('due', value as BoardFilters['due'])}><SelectTrigger aria-label="Filtrar prazo" className="w-32"><SelectValue placeholder="Prazo" /></SelectTrigger><SelectContent><SelectItem value="all">Prazo: todos</SelectItem><SelectItem value="overdue">Atrasadas</SelectItem><SelectItem value="today">Hoje</SelectItem><SelectItem value="week">Próximos 7 dias</SelectItem><SelectItem value="no-date">Sem prazo</SelectItem></SelectContent></Select><Select value={filters.column} onValueChange={value => updateFilter('column', value)}><SelectTrigger aria-label="Filtrar status ou coluna" className="w-36"><SelectValue placeholder="Status / coluna" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as colunas</SelectItem>{board.columns.map(column => <SelectItem key={column.id} value={column.id}>{column.name}</SelectItem>)}</SelectContent></Select></div>{activeFilters && <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3 text-xs"><span className="mr-1 text-muted-foreground">Ativos:</span>{debounced && <FilterChip label={`Busca: ${debounced}`} onRemove={() => setSearch('')} />}{filters.mine && <FilterChip label="Minhas tarefas" onRemove={() => updateFilter('mine', false)} />}{filters.assignee !== 'all' && <FilterChip label={`Responsável: ${memberList.find(item => item.user_id === filters.assignee)?.profile?.display_name ?? 'Membro'}`} onRemove={() => updateFilter('assignee', 'all')} />}{filters.priority !== 'all' && <FilterChip label={`Prioridade: ${priorityNames[filters.priority]}`} onRemove={() => updateFilter('priority', 'all')} />}{filters.label !== 'all' && <FilterChip label={`Label: ${filters.label}`} onRemove={() => updateFilter('label', 'all')} />}{filters.due !== 'all' && <FilterChip label={`Prazo: ${dueNames[filters.due]}`} onRemove={() => updateFilter('due', 'all')} />}{filters.column !== 'all' && <FilterChip label={`Coluna: ${board.columns.find(column => column.id === filters.column)?.name ?? 'Coluna'}`} onRemove={() => updateFilter('column', 'all')} />}<Button variant="ghost" size="sm" onClick={clearFilters}><FilterX className="size-3.5" /> Limpar filtros</Button></div>}</section>
    {badges.error && <ErrorState message="Os indicadores dos cards não puderam ser carregados." onRetry={() => void badges.refetch()} />}
    {activeFilters && canEditTasks && <p className="text-xs text-muted-foreground">Limpe os filtros para reorganizar tarefas e colunas. A criação de tarefas continua disponível.</p>}
    <DndContext accessibility={{
      screenReaderInstructions: { draggable: 'Para mover, pressione Espaço. Use as setas para escolher o destino, Espaço para soltar ou Escape para cancelar.' },
      announcements: {
        onDragStart: ({ active }) => `Movendo ${dragName(active.id)}.`,
        onDragOver: ({ over }) => over ? `Destino: ${dropName(over.id)}.` : 'Fora de uma área de destino.',
        onDragEnd: ({ active, over }) => over ? `${dragName(active.id)} solto em ${dropName(over.id)}.` : 'Nenhum destino selecionado.',
        onDragCancel: () => 'Movimentação cancelada.',
      },
    }} sensors={dnd.sensors} collisionDetection={dnd.collisionDetection} onDragStart={dnd.onDragStart} onDragOver={dnd.onDragOver} onDragEnd={dnd.onDragEnd} onDragCancel={dnd.onDragCancel}><SortableContext items={board.columns.map(column => columnDragId(column.id))} strategy={horizontalListSortingStrategy}><div tabIndex={0} role="region" aria-label="Colunas do quadro. Role horizontalmente para ver todas." className="kanban-scroll -mx-4 flex items-start gap-4 overflow-x-auto px-4 pb-6 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">{board.columns.map(column => <BoardLane key={column.id} column={column} boardId={board.id} canManage={Boolean(canManage)} canEditTasks={canEditTasks} dragDisabled={activeFilters || !canEditTasks} dragActive={dnd.busy} visibleTasks={filtered.get(column.id) ?? []} badges={badges.data ?? noBadges} avatarUrls={avatarUrls} placeholder={dnd.origin && dnd.origin.columnId === column.id && dnd.activeTask?.column_id !== column.id ? { task: dnd.origin.task, index: dnd.origin.index } : undefined} />)}{canManage && <ColumnDialog boardId={board.id} />}{board.columns.length === 0 && !canManage && <div className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">Este quadro ainda não tem colunas.</div>}</div></SortableContext><DragOverlay dropAnimation={null}>{dnd.activeTask ? <TaskCardOverlay task={dnd.activeTask} badge={badges.data?.[dnd.activeTask.id]} avatarUrls={avatarUrls} /> : dnd.activeColumn ? <div className={`w-[296px] cursor-grabbing rounded-xl border border-primary/40 bg-card p-4 shadow-2xl ${reducedMotion ? '' : 'rotate-[.8deg] scale-[1.02]'}`}><span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: dnd.activeColumn.color }} />{dnd.activeColumn.name}<span className="ml-2 text-xs text-muted-foreground">{dnd.activeColumn.tasks.length}</span></div> : null}</DragOverlay></DndContext>
    <TaskDetailDrawer boardId={board.id} tasks={tasks} columns={board.columns} readOnly={!canEditTasks} canManage={Boolean(canManage)} labels={labels.data ?? []} members={memberList.map(item => item.profile).filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))} />
    {membersOpen && <BoardMembersDialog board={board} open readOnly={!canManage} onOpenChange={setMembersOpen} />}{editing && <EditBoardDialog board={board} mode={editing} open onOpenChange={open => { if (!open) setEditing(null) }} />}
    <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}><DialogContent><DialogHeader><DialogTitle>Arquivar quadro?</DialogTitle><DialogDescription>“{board.name}” deixará de aparecer nos quadros ativos.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setArchiveOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={() => void archiveBoard()} disabled={archivePending}>{archivePending ? 'Arquivando...' : 'Arquivar'}</Button></div></DialogContent></Dialog>
  </div>
}
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) { return <button type="button" onClick={onRemove} aria-label={`Remover filtro ${label}`} className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-primary hover:bg-primary/15">{label}<X className="size-3" /></button> }
