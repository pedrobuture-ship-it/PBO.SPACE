import { useEffect, useState } from 'react'
import { Archive, CheckCheck, CircleAlert, Clock3, FolderKanban, LayoutGrid, List, Search, Star, ListTodo } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/common/states'
import { MotionGroup } from '@/components/common/motion'
import { DoodleStar, SketchUnderline } from '@/components/common/sketch'
import { useActiveWorkspace } from '@/features/workspaces/hooks/use-workspaces'
import { useUiStore } from '@/stores/ui-store'
import { CreateBoardDialog } from '@/features/boards/components/create-board-dialog'
import { HomeBoardCard } from '@/features/boards/components/home-board-card'
import { EditBoardDialog } from '@/features/boards/components/edit-board-dialog'
import { BoardMembersDialog } from '@/features/boards/components/board-members-dialog'
import { useHomeBoards, useHomeMetrics, useHomeFavorite } from '@/features/boards/hooks/use-home-overview'
import { useHomeAvatars } from '@/features/boards/hooks/use-home-avatars'
import { updateBoard } from '@/features/boards/services/board-service'
import type { HomeBoard } from '@/features/boards/services/home-service'
import { useQueryClient } from '@tanstack/react-query'

const tabs = [{ key: 'all', label: 'Todos os Quadros' }, { key: 'favorites', label: 'Favoritos' }, { key: 'recent', label: 'Recentes' }] as const
type Tab = typeof tabs[number]['key']
type View = 'grid' | 'list'
function EmptyBoardsArtwork() { return <svg viewBox="0 0 220 130" role="img" aria-label="Ilustração de um quadro vazio" className="h-32 w-56 text-primary"><path d="M24 24 Q22 19 29 19 L190 21 Q196 21 195 27 L192 105 Q192 110 187 110 L28 108 Q22 107 23 102Z" fill="none" stroke="currentColor" strokeWidth="2" opacity=".7"/><path d="M31 39 Q90 41 188 39 M80 44 L79 101 M135 43 L136 102" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".36"/><rect x="38" y="51" width="34" height="24" rx="3" fill="currentColor" opacity=".2"/><rect x="88" y="52" width="38" height="30" rx="3" fill="currentColor" opacity=".13"/><path d="M151 55 l24 0 m-24 7 l16 0 M11 111 q22 8 43 2 m-5-5 6 5-7 6 M200 19 l4-9 m4 13 9-3 m-8 7 5 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".65"/></svg> }
function HomeLoading() { return <div className="space-y-7" aria-label="Carregando visão geral"><div className="flex items-center gap-4"><Skeleton className="size-14 rounded-xl" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-6 w-full max-w-52" /><Skeleton className="h-4 w-full max-w-72" /></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}</div><Skeleton className="h-10 w-full max-w-80" /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-58 rounded-xl" />)}</div></div> }
export function HomePage() {
  const { data: workspaces, workspace, isLoading: workspaceLoading, error: workspaceError, refetch: retryWorkspaces } = useActiveWorkspace()
  const setWorkspace = useUiStore(state => state.setActiveWorkspaceId)
  const boards = useHomeBoards(workspace?.id)
  const metrics = useHomeMetrics(workspace?.id)
  const favorite = useHomeFavorite(workspace?.id)
  const avatarUrls = useHomeAvatars(boards.data ?? [], workspace?.logo_url).data ?? {}
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [view, setView] = useState<View>(() => { try { return localStorage.getItem('kanban-home-view') === 'list' ? 'list' : 'grid' } catch { return 'grid' } })
  const [editing, setEditing] = useState<{ board: HomeBoard; mode: 'edit' | 'settings' }>()
  const [members, setMembers] = useState<HomeBoard>()
  const [archiving, setArchiving] = useState<HomeBoard>()
  const [archivePending, setArchivePending] = useState(false)
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(search.trim().toLocaleLowerCase('pt-BR')), 220); return () => window.clearTimeout(timer) }, [search])
  function changeView(value: View) { setView(value); try { localStorage.setItem('kanban-home-view', value) } catch { /* private browsing */ } }
  const allBoards = boards.data ?? []
  const scoped = debounced ? allBoards.filter(board => `${board.name} ${board.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(debounced)) : allBoards
  const shown = tab === 'favorites' ? scoped.filter(board => board.favorite) : tab === 'recent' ? scoped.slice(0, 6) : scoped
  const metricCards = metrics.data ? [
    { label: 'Quadros ativos', count: metrics.data.active_boards, icon: FolderKanban, accent: 'text-primary', note: 'Acessíveis neste workspace' },
    { label: 'Minhas tarefas', count: metrics.data.my_tasks, icon: ListTodo, accent: 'text-cyan', note: 'Atribuídas e abertas' },
    { label: 'Vencendo', count: metrics.data.due_soon, icon: Clock3, accent: 'text-warning', note: 'Nos próximos 7 dias' },
    { label: 'Atrasadas', count: metrics.data.overdue, icon: CircleAlert, accent: 'text-destructive', note: 'Precisam de atenção' },
    { label: 'Concluídas recentemente', count: metrics.data.completed_recently, icon: CheckCheck, accent: 'text-success', note: 'Nos últimos 7 dias' },
  ] : []
  async function archive() {
    if (!archiving) return
    setArchivePending(true)
    try { await updateBoard(archiving.id, { archived: true }); await Promise.all([queryClient.invalidateQueries({ queryKey: ['home-overview'] }), queryClient.invalidateQueries({ queryKey: ['boards'] })]); toast.success('Quadro arquivado.'); setArchiving(undefined) }
    catch { toast.error('Não foi possível arquivar o quadro. Confira suas permissões.') }
    finally { setArchivePending(false) }
  }
  if (workspaceLoading || (workspace && boards.isLoading)) return <HomeLoading />
  if (workspaceError) return <ErrorState message="Não foi possível carregar seus workspaces." onRetry={() => void retryWorkspaces()} />
  if (!workspace) return <div className="rounded-xl border border-border bg-card p-8 text-center"><h1 className="text-xl font-semibold">Nenhum workspace disponível</h1><p className="mt-2 text-sm text-muted-foreground">Crie um workspace nas configurações para começar.</p></div>
  return <div className="space-y-8">
    <header className="flex flex-wrap items-start justify-between gap-5"><div className="flex min-w-0 items-center gap-4"><Avatar className="size-14 rounded-xl border border-primary/25"><AvatarImage className="rounded-xl" src={workspace.logo_url ? avatarUrls[workspace.logo_url] : undefined} alt="" /><AvatarFallback className="rounded-xl bg-primary/10 text-lg font-semibold text-primary">{workspace.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[.2em] text-cyan">Workspace atual</div><h1 className="relative w-fit max-w-full truncate text-2xl font-semibold tracking-tight sm:text-3xl">{workspace.name}<SketchUnderline className="absolute -bottom-1 left-0 h-1.5 w-full text-primary/40" /></h1><p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{workspace.description || 'Seus quadros, tarefas e prioridades em um só lugar.'}</p></div></div><div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{(workspaces?.length ?? 0) > 1 && <Select value={workspace.id} onValueChange={id => { setWorkspace(id); setSearch(''); setTab('all') }}><SelectTrigger aria-label="Trocar workspace" className="h-9 max-w-48"><SelectValue /></SelectTrigger><SelectContent>{workspaces?.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>}{(allBoards.length > 0 || boards.error) && <CreateBoardDialog />}</div></header>
    <section aria-label="Resumo do workspace">{metrics.error ? <ErrorState message="Não foi possível carregar os indicadores." onRetry={() => void metrics.refetch()} /> : metrics.isLoading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{metricCards.map(item => <div key={item.label} className="rounded-xl border border-border bg-card px-4 py-4"><div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{item.label}</span><item.icon className={`size-4 ${item.accent}`} /></div><div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{item.count}</div><div className="mt-1 text-[11px] text-muted-foreground">{item.note}</div></div>)}</div>}</section>
      <section aria-labelledby="boards-heading">{boards.error ? <ErrorState message="Não foi possível carregar os quadros." onRetry={() => void boards.refetch()} /> : <><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-cyan"><DoodleStar className="size-4" /> Espaços de trabalho</div><h2 id="boards-heading" className="text-xl font-semibold tracking-tight">Seus Quadros</h2></div><div className="flex w-full flex-wrap items-center gap-2 sm:w-auto"><div className="relative min-w-44 flex-1 sm:w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" value={search} onChange={event => setSearch(event.target.value)} aria-label="Buscar quadros por nome ou descrição" placeholder="Buscar quadros..." className="h-9 bg-card pl-9" /></div><div className="flex items-center rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Visualização dos quadros"><Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon-sm" aria-label="Visualização em grade" aria-pressed={view === 'grid'} onClick={() => changeView('grid')}><LayoutGrid className="size-4" /></Button><Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon-sm" aria-label="Visualização em lista" aria-pressed={view === 'list'} onClick={() => changeView('list')}><List className="size-4" /></Button></div></div></div>
        {allBoards.length > 0 && <div role="group" aria-label="Filtrar quadros" className="mb-5 flex gap-1 overflow-x-auto border-b border-border">{tabs.map(item => <button key={item.key} aria-pressed={tab === item.key} onClick={() => setTab(item.key)} className={`relative shrink-0 px-4 py-2.5 text-xs font-medium transition-colors ${tab === item.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{item.label}{item.key === 'favorites' && <span className="ml-1.5 text-[10px]">{allBoards.filter(board => board.favorite).length}</span>}{tab === item.key && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}</button>)}</div>}
        {shown.length ? <MotionGroup key={`${workspace.id}-${tab}-${view}`} className={view === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>{shown.map(board => <HomeBoardCard key={board.id} board={board} view={view} avatarUrls={avatarUrls} onFavorite={() => favorite.mutate({ boardId: board.id, selected: !board.favorite })} onEdit={() => setEditing({ board, mode: 'edit' })} onMembers={() => setMembers(board)} onSettings={() => setEditing({ board, mode: 'settings' })} onArchive={() => setArchiving(board)} />)}</MotionGroup> : allBoards.length === 0 ? <div className="flex flex-col items-center rounded-xl border border-dashed border-primary/25 bg-card/50 px-6 py-10 text-center"><EmptyBoardsArtwork /><h3 className="mt-3 text-lg font-semibold">Seu primeiro quadro começa aqui</h3><p className="mt-2 max-w-sm text-sm text-muted-foreground">{workspace.access_role === 'owner' || workspace.access_role === 'admin' ? 'Crie um quadro para reunir o trabalho da equipe neste workspace.' : 'Quando você receber acesso a um quadro, ele aparecerá aqui.'}</p>{(workspace.access_role === 'owner' || workspace.access_role === 'admin') && <div className="mt-5"><CreateBoardDialog /></div>}</div> : <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center"><Star className="mx-auto mb-3 size-6 text-primary/60" /><h3 className="font-medium">Nenhum quadro nesta visão</h3><p className="mt-1 text-sm text-muted-foreground">{debounced ? 'Tente outra busca por nome ou descrição.' : tab === 'favorites' ? 'Favorite um quadro para encontrá-lo rapidamente.' : 'A atividade recente aparecerá aqui.'}</p></div>}
        {shown.length > 0 && <p className="mt-4 text-xs text-muted-foreground">{shown.length} {shown.length === 1 ? 'quadro' : 'quadros'} nesta visão. Recentes são ordenados pela última atividade.</p>}
      </>}</section>
    {editing && <EditBoardDialog board={editing.board} mode={editing.mode} open onOpenChange={open => { if (!open) setEditing(undefined) }} />}
    {members && <BoardMembersDialog board={members} open onOpenChange={open => { if (!open) setMembers(undefined) }} />}
    <Dialog open={Boolean(archiving)} onOpenChange={open => { if (!open) setArchiving(undefined) }}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><Archive className="size-5 text-warning" /> Arquivar quadro?</DialogTitle><DialogDescription>“{archiving?.name}” sairá da lista de quadros ativos.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setArchiving(undefined)}>Cancelar</Button><Button variant="destructive" onClick={() => void archive()} disabled={archivePending}>{archivePending ? 'Arquivando...' : 'Arquivar'}</Button></div></DialogContent></Dialog>
  </div>
}
