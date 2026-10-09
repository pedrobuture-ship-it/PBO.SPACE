import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, CornerDownLeft, FolderKanban, LoaderCircle, Search, SquareCheckBig, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/states'
import { SketchSpark } from '@/components/common/sketch'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { useProfile } from '@/features/profiles/hooks/use-profile'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { useUiStore } from '@/stores/ui-store'
import { buildCommandRegistry, type CommandDefinition, type CommandExecutionContext } from '../command-registry'
import { resolveRecentEntities, searchGlobal, type RecentReference, type SearchEntityResult } from '../services/global-search-service'
import { CreateBoardDialog } from '@/features/boards/components/create-board-dialog'
import { QuickCreateTaskDialog } from './quick-create-task-dialog'

const RECENTS_LIMIT = 8
const RECENTS_KEY = 'handcrafted-command-recent-v1'
type Selectable = { key: string; kind: 'command'; command: CommandDefinition } | { key: string; kind: 'entity'; entity: SearchEntityResult }

function readRecents(userId?: string): RecentReference[] {
  if (!userId || typeof localStorage === 'undefined') return []
  try {
    const stored = JSON.parse(localStorage.getItem(`${RECENTS_KEY}:${userId}`) ?? '[]') as unknown
    if (!Array.isArray(stored)) return []
    return stored.filter((entry): entry is RecentReference => entry && typeof entry.id === 'string' && ['command', 'board', 'task'].includes(entry.type)).slice(0, RECENTS_LIMIT)
  } catch { return [] }
}

function remember(userId: string | undefined, reference: RecentReference) {
  if (!userId || typeof localStorage === 'undefined') return
  const items = [reference, ...readRecents(userId).filter(item => item.type !== reference.type || item.id !== reference.id)].slice(0, RECENTS_LIMIT)
  try { localStorage.setItem(`${RECENTS_KEY}:${userId}`, JSON.stringify(items)) } catch { /* Search remains usable when local storage is unavailable. */ }
}

function commandMatches(command: CommandDefinition, query: string) {
  const value = query.trim().toLocaleLowerCase()
  return !value || [command.title, command.subtitle, ...command.keywords].some(part => part.toLocaleLowerCase().includes(value))
}

export function CommandPalette({ open, onOpenChange, currentBoardId, onOpenNotifications }: { open: boolean; onOpenChange: (open: boolean) => void; currentBoardId?: string; onOpenNotifications: () => void }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { data: profile } = useProfile()
  const { data: workspaces } = useWorkspaces()
  const setActiveWorkspaceId = useUiStore(state => state.setActiveWorkspaceId)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [boardDialogOpen, setBoardDialogOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const recents = open ? readRecents(session?.user.id) : []

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [open, session?.user.id])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const search = useQuery({
    queryKey: ['command-global-search', session?.user.id, debouncedQuery, expanded],
    queryFn: () => searchGlobal(debouncedQuery, expanded ? 26 : 6, expanded ? 51 : 11),
    enabled: open && debouncedQuery.length >= 2,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  const recentEntities = useQuery({
    queryKey: ['command-recent-entities', session?.user.id, recents],
    queryFn: () => resolveRecentEntities(recents),
    enabled: open && query.trim().length === 0 && recents.some(item => item.type !== 'command'),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

  const createTask = useCallback(() => setTaskDialogOpen(true), [])
  const createBoard = useCallback(() => setBoardDialogOpen(true), [])
  const openNotifications = useCallback(() => onOpenNotifications(), [onOpenNotifications])
  const context: CommandExecutionContext = { navigate, createTask, createBoard, openNotifications }
  const canCreateBoard = Boolean(workspaces?.some(item => item.access_role === 'owner' || item.access_role === 'admin'))
  const registry = buildCommandRegistry(context, { canCreateBoard, appRole: profile?.app_role })
  const commandById = new Map(registry.map(command => [command.id, command]))
  const matchingCommands = registry.filter(command => commandMatches(command, query))
  const wasRecent = (id: string) => recents.some(item => item.type === 'command' && item.id === id)
  const quickCommands = registry.filter(command => ['create-task', 'create-board', 'go-dashboard-action', 'open-notifications'].includes(command.id) && !wasRecent(command.id))
  const navCommands = registry.filter(command => command.section === 'Navegação' && !wasRecent(command.id))
  const adminCommands = registry.filter(command => command.section === 'Admin' && !wasRecent(command.id))
  const recentCommands = recents.flatMap(item => item.type === 'command' ? (commandById.has(item.id) ? [commandById.get(item.id)!] : []) : [])
  const recentEntitiesList = query.trim() ? [] : (recentEntities.data ?? [])
  const searchBoards = search.data?.boards ?? []
  const searchTasks = search.data?.tasks ?? []
  const hasMore = !expanded && Boolean(search.data?.hasMoreBoards || search.data?.hasMoreTasks)

  const selectable: Selectable[] = (() => {
    const items: Selectable[] = []
    if (query.trim().length === 0) {
      for (const command of recentCommands) items.push({ key: `command:${command.id}`, kind: 'command', command })
      for (const entity of recentEntitiesList) items.push({ key: `${entity.type}:${entity.id}`, kind: 'entity', entity })
      for (const command of quickCommands) if (!items.some(item => item.key === `command:${command.id}`)) items.push({ key: `command:${command.id}`, kind: 'command', command })
      for (const command of navCommands) if (!items.some(item => item.key === `command:${command.id}`)) items.push({ key: `command:${command.id}`, kind: 'command', command })
      for (const command of adminCommands) if (!items.some(item => item.key === `command:${command.id}`)) items.push({ key: `command:${command.id}`, kind: 'command', command })
    } else if (query.trim() === debouncedQuery && debouncedQuery.length >= 2 && search.isSuccess) {
      for (const command of matchingCommands) items.push({ key: `command:${command.id}`, kind: 'command', command })
      for (const board of searchBoards) items.push({ key: `board:${board.id}`, kind: 'entity', entity: board })
      for (const task of searchTasks) items.push({ key: `task:${task.id}`, kind: 'entity', entity: task })
    }
    return items
  })()
  const activeIndex = Math.min(selectedIndex, Math.max(0, selectable.length - 1))
  const activeKey = selectable[activeIndex]?.key
  useEffect(() => { if (open && activeKey) document.getElementById(`palette-result-${activeKey}`)?.scrollIntoView({ block: 'nearest' }) }, [open, activeKey])

  function executeCommand(command: CommandDefinition) {
    remember(session?.user.id, { type: 'command', id: command.id })
    changeOpen(false)
    const opensOverlay = ['create-task', 'create-board', 'open-notifications'].includes(command.id)
    if (opensOverlay) window.setTimeout(() => command.execute(context), 150)
    else command.execute(context)
  }

  function openEntity(entity: SearchEntityResult) {
    remember(session?.user.id, { type: entity.type, id: entity.id })
    setActiveWorkspaceId(entity.workspaceId)
    changeOpen(false)
    if (entity.type === 'board') navigate(`/app/board/${entity.id}`)
    else navigate(`/app/board/${entity.boardId}?task=${entity.id}`, { state: { taskDrawerOpened: true } })
  }

  function select(item = selectable[activeIndex]) {
    if (!item) return
    if (item.kind === 'command') executeCommand(item.command)
    else openEntity(item.entity)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.max(0, Math.min(activeIndex + (event.key === 'ArrowDown' ? 1 : -1), selectable.length - 1))
      setSelectedIndex(next)
      if (event.target !== inputRef.current && selectable[next]) document.getElementById(`palette-result-${selectable[next].key}`)?.focus()
    } else if (event.key === 'Enter' && (event.target === inputRef.current || (event.target as HTMLElement).getAttribute('role') === 'option')) {
      event.preventDefault()
      select()
    }
  }

  function section(title: string, items: Selectable[]) {
    if (!items.length) return null
    return <section key={title} aria-label={title} className="pb-2">
      <div className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{title}</div>
      <div className="space-y-0.5">{items.map(item => <ResultRow key={item.key} item={item} active={selectable[activeIndex]?.key === item.key} onSelect={() => select(item)} onHover={() => setSelectedIndex(selectable.findIndex(candidate => candidate.key === item.key))} />)}</div>
    </section>
  }

  const resultCommands = query.trim() ? matchingCommands : []
  const emptyQuery = query.trim().length === 0
  const error = (!emptyQuery && search.isError) || (emptyQuery && recentEntities.isError)
  const loading = (!emptyQuery && query.trim() !== debouncedQuery) || (!emptyQuery && debouncedQuery.length >= 2 && search.isPending) || (emptyQuery && recentEntities.isPending && recents.some(item => item.type !== 'command'))

  function changeOpen(value: boolean) {
    if (!value) { setQuery(''); setDebouncedQuery(''); setExpanded(false); setSelectedIndex(0) }
    onOpenChange(value)
  }

  return <>
    <Dialog open={open} onOpenChange={changeOpen}><DialogContent onKeyDown={onKeyDown} showCloseButton={false} className="grid max-h-[min(84svh,720px)] w-[calc(100vw-1rem)] max-w-[720px] sm:max-w-[720px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-xl border border-border bg-popover p-0 sm:p-0 shadow-2xl sm:w-[calc(100vw-2rem)]">
      <DialogTitle className="sr-only">Busca global e comandos</DialogTitle><DialogDescription className="sr-only">Pesquise quadros e tarefas ou execute ações usando as setas e Enter.</DialogDescription>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5 sm:px-5"><Search aria-hidden="true" className="size-5 shrink-0 text-primary" /><Input ref={inputRef} value={query} onChange={event => { setQuery(event.target.value); setSelectedIndex(0); setExpanded(false) }} placeholder="Buscar quadros, tarefas e ações…" aria-label="Buscar quadros, tarefas e ações" role="combobox" aria-expanded={open} aria-autocomplete="list" aria-controls="global-command-results" aria-activedescendant={activeKey ? `palette-result-${activeKey}` : undefined} className="h-10 border-0 bg-transparent px-2 text-base shadow-none focus-visible:ring-1 focus-visible:ring-ring/60" />{loading && <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Buscando" />}<Button variant="ghost" size="icon-sm" aria-label="Fechar busca" onClick={() => changeOpen(false)}><X className="size-4" /></Button></div>
      <div id="global-command-results" className="min-h-0 overflow-y-auto px-2 pb-2" role="listbox" aria-label="Resultados da busca" aria-busy={loading}>
        {error && <div className="p-3"><ErrorState message="Não foi possível carregar alguns resultados." onRetry={() => { if (emptyQuery) void recentEntities.refetch(); else void search.refetch() }} /></div>}
        {!error && !emptyQuery && (debouncedQuery.length < 2 || loading) && <div className="px-5 py-10 text-center text-sm text-muted-foreground">{query.trim().length < 2 ? 'Digite ao menos 2 caracteres para buscar.' : 'Buscando…'}</div>}
        {emptyQuery && <>
          {recentCommands.length > 0 || recentEntitiesList.length > 0 ? section('Recentes', [...recentCommands.map(command => ({ key: `command:${command.id}`, kind: 'command' as const, command })), ...recentEntitiesList.map(entity => ({ key: `${entity.type}:${entity.id}`, kind: 'entity' as const, entity }))]) : null}
          {section('Ações rápidas', quickCommands.map(command => ({ key: `command:${command.id}`, kind: 'command' as const, command })))}
          {section('Navegação', navCommands.map(command => ({ key: `command:${command.id}`, kind: 'command' as const, command })))}
          {section('Admin', adminCommands.map(command => ({ key: `command:${command.id}`, kind: 'command' as const, command })))}
          <div className="mx-3 mb-2 mt-2 hidden items-center gap-2 rounded-lg border border-border/70 bg-card/40 px-3 py-2.5 text-xs text-muted-foreground sm:flex"><SketchSpark className="size-4 text-cyan" />Ctrl K ou ⌘ K para abrir a busca de qualquer lugar.</div>
        </>}
        {!error && !emptyQuery && debouncedQuery.length >= 2 && !loading && <>
          {section('Ações', resultCommands.filter(command => command.section === 'Ações').map(command => ({ key: `command:${command.id}`, kind: 'command' as const, command })))}
          {section('Navegação', resultCommands.filter(command => command.section === 'Navegação').map(command => ({ key: `command:${command.id}`, kind: 'command' as const, command })))}
          {section('Admin', resultCommands.filter(command => command.section === 'Admin').map(command => ({ key: `command:${command.id}`, kind: 'command' as const, command })))}
          {section('Quadros', searchBoards.map(entity => ({ key: `board:${entity.id}`, kind: 'entity' as const, entity })))}
          {section('Tarefas', searchTasks.map(entity => ({ key: `task:${entity.id}`, kind: 'entity' as const, entity })))}
          {selectable.length === 0 && <div className="px-5 py-12 text-center"><div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground"><Search className="size-4" /></div><p className="text-sm font-medium">Nenhum resultado encontrado</p><p className="mt-1 text-xs text-muted-foreground">Tente outro nome de quadro, tarefa ou comando.</p></div>}
          {hasMore && <button type="button" onClick={() => setExpanded(true)} className="mx-3 mt-2 w-[calc(100%-1.5rem)] rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">Ver mais resultados</button>}
        </>}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-[11px] text-muted-foreground sm:px-5"><span className="hidden sm:inline">Quadros, tarefas e ações</span><span className="sm:hidden">Toque em um resultado para abrir</span><span className="hidden items-center gap-3 sm:flex"><span className="inline-flex items-center gap-1"><ArrowUp className="size-3" /><ArrowDown className="size-3" /> navegar</span><span className="inline-flex items-center gap-1"><CornerDownLeft className="size-3" /> abrir</span><kbd>ESC fechar</kbd></span></div>
    </DialogContent></Dialog>
    <QuickCreateTaskDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} currentBoardId={currentBoardId} />
    <CreateBoardDialog open={boardDialogOpen} onOpenChange={setBoardDialogOpen} showTrigger={false} />
  </>
}

function ResultRow({ item, active, onSelect, onHover }: { item: Selectable; active: boolean; onSelect: () => void; onHover: () => void }) {
  const isCommand = item.kind === 'command'
  const Icon = isCommand ? item.command.icon : item.entity.type === 'board' ? FolderKanban : SquareCheckBig
  const title = isCommand ? item.command.title : item.entity.title
  const subtitle = isCommand ? item.command.subtitle : item.entity.subtitle
  const typeLabel = isCommand ? (item.command.section === 'Admin' ? 'ADMIN' : item.command.section === 'Navegação' ? 'PÁGINA' : 'AÇÃO') : item.entity.type === 'board' ? 'QUADRO' : 'TAREFA'
  return <button id={`palette-result-${item.key}`} type="button" role="option" aria-selected={active} onFocus={onHover} onMouseEnter={onHover} onClick={onSelect} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${active ? 'bg-primary/10 text-foreground ring-1 ring-primary/20' : 'text-foreground hover:bg-surface-raised'}`}>
    <span className={`grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card ${!isCommand && item.entity.type === 'board' ? '' : 'text-muted-foreground'}`} style={!isCommand && item.entity.type === 'board' ? { color: item.entity.color } : undefined}><Icon className="size-4" /></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span></span>
    <span className="shrink-0 text-[9px] font-semibold tracking-[.12em] text-subtle-foreground">{typeLabel}</span>
  </button>
}
