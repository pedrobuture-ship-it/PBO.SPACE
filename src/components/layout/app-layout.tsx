import { usePrivateRealtime } from '@/hooks/use-private-realtime'
import { useProfile } from '@/features/profiles/hooks/use-profile'
import { useActiveWorkspace } from '@/features/workspaces/hooks/use-workspaces'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEffect, useState, type CSSProperties } from 'react'
import { useOutlet, NavLink, useLocation, useNavigate } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Bell, Shield, ChevronUp, FolderKanban, Home, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings2, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import { Brand } from '@/components/common/brand'
import { MotionPage } from '@/components/common/motion'
import { DoodleStar, SketchDivider } from '@/components/common/sketch'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/auth-context'
import { signOut } from '@/features/auth/services/auth-service'
import { useUiStore } from '@/stores/ui-store'
import { useAvatarUrls } from '@/features/profiles/hooks/use-avatar-urls'
import { useBoards } from '@/features/boards/hooks/use-boards'
import { useHomeBoards } from '@/features/boards/hooks/use-home-overview'
import { useMotionTransition } from '@/lib/motion'
import { useUnreadNotifications } from '@/features/notifications/hooks/use-notifications'
import { NotificationCenter } from '@/features/notifications/components/notification-center'
import { CommandPalette } from '@/features/command-palette/components/command-palette'

const links = [
  { to: '/app', label: 'Visão geral', icon: Home, end: true },
  { to: '/app/boards', label: 'Projetos', icon: FolderKanban },
  { to: '/app/members', label: 'Membros', icon: UsersRound },
  { to: '/app/dashboard', label: 'Analytics', icon: LayoutDashboard },
  { to: '/app/notifications', label: 'Notificações', icon: Bell },
]

function AccountMenu({ collapsed, onLogout }: { collapsed: boolean; onLogout: () => void }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { data: profile } = useProfile()
  const avatarUrls = useAvatarUrls([profile?.avatar_url]).data ?? {}
  const name = String(profile?.display_name || session?.user.user_metadata.display_name || session?.user.user_metadata.full_name || session?.user.email?.split('@')[0] || 'Usuário')
  return <DropdownMenu><DropdownMenuTrigger asChild>
    <button type="button" className={`flex w-full items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-border hover:bg-surface-raised ${collapsed ? 'justify-center' : ''}`} aria-label={`Menu da conta de ${name}`}>
      <Avatar className="size-8 shrink-0 border border-primary/30"><AvatarImage src={profile?.avatar_url ? avatarUrls[profile.avatar_url] : undefined} alt="" /><AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
      {!collapsed && <><div className="min-w-0 flex-1 text-left"><div className="truncate text-xs font-medium">{name}</div><div className="mt-0.5 truncate text-[10px] text-muted-foreground">{session?.user.email}</div></div><ChevronUp className="size-3.5 text-muted-foreground" /></>}
    </button>
  </DropdownMenuTrigger><DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56"><div className="px-2 py-2 text-xs text-muted-foreground">{session?.user.email}</div><DropdownMenuSeparator />{(profile?.app_role === 'admin' || profile?.app_role === 'superadmin') && <DropdownMenuItem onClick={() => navigate('/admin')}><Shield className="size-4" /> Administração</DropdownMenuItem>}<DropdownMenuItem onClick={() => navigate('/app/settings')}><Settings2 className="size-4" /> Configurações</DropdownMenuItem><DropdownMenuItem onClick={onLogout}><LogOut className="size-4" /> Sair</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
}

function SidebarContent({ collapsed = false, close, onLogout, onToggle }: { collapsed?: boolean; close?: () => void; onLogout: () => void; onToggle?: () => void }) {
  const { data: profile } = useProfile()
  const isHome = useLocation().pathname === '/app'
  const { data: workspaces, workspace } = useActiveWorkspace()
  const boardQuery = useBoards(!isHome)
  const homeQuery = useHomeBoards(workspace?.id, isHome)
  const boardsQuery = isHome ? homeQuery : boardQuery
  const selectWorkspace = useUiStore(state => state.setActiveWorkspaceId)
  const reduced = useReducedMotion()
  const transition = useMotionTransition()
  const boards = isHome ? homeQuery.data ?? [] : boardQuery.data ?? []
  return <div className={`flex h-full min-h-0 flex-col ${collapsed ? 'px-3' : 'px-4'} pb-4 pt-6`}>
    <div className={`mb-7 flex items-center ${collapsed ? 'flex-col gap-5' : 'justify-between gap-1 px-1'}`}><Brand compact={collapsed} />{onToggle && <Button variant="ghost" size="icon-sm" aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'} aria-expanded={!collapsed} onClick={onToggle} className="shrink-0 text-muted-foreground">{collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}</Button>}</div>
    <div className={`${collapsed ? 'sr-only' : 'mb-3 px-3'} text-[10px] font-semibold uppercase tracking-[.18em] text-subtle-foreground`}>Workspace</div>
    {!collapsed && workspace && <Select value={workspace.id} onValueChange={id => { selectWorkspace(id); close?.() }}><SelectTrigger className="mb-4 w-full" aria-label="Workspace ativo"><SelectValue /></SelectTrigger><SelectContent>{workspaces?.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>}
    <nav aria-label="Navegação principal" className="space-y-1">
      {links.map(({ to, label, icon: Icon, end }) => <Tooltip key={to}><motion.div whileHover={reduced ? undefined : { x: 2 }} transition={transition}><TooltipTrigger asChild><NavLink to={to} end={end} onClick={close} aria-label={collapsed ? label : undefined} className={`nav-item ${collapsed ? 'justify-center px-0' : ''}`}><Icon className="size-4 shrink-0" />{!collapsed && <span>{label}</span>}</NavLink></TooltipTrigger></motion.div>{collapsed && <TooltipContent side="right" sideOffset={12}>{label}</TooltipContent>}</Tooltip>)}
    </nav>
    {(profile?.app_role === 'admin' || profile?.app_role === 'superadmin') && <nav aria-label="Administração global" className="mt-3 border-t border-sidebar-border pt-3"><Tooltip><TooltipTrigger asChild><NavLink to="/admin" onClick={close} aria-label={collapsed ? 'Administração global' : undefined} className={`nav-item text-muted-foreground ${collapsed ? 'justify-center px-0' : ''}`}><Shield className="size-4 shrink-0" />{!collapsed && <span>Administração global</span>}</NavLink></TooltipTrigger>{collapsed && <TooltipContent side="right">Administração global</TooltipContent>}</Tooltip></nav>}
    <SketchDivider className="my-6 text-sidebar-border" />
    <div className="mb-3 flex items-center justify-between px-3"><span className={`${collapsed ? 'sr-only' : ''} text-[10px] font-semibold uppercase tracking-[.18em] text-subtle-foreground`}>Quadros</span>{!collapsed && <NavLink to="/app/boards" onClick={close} aria-label="Ver quadros" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-cyan"><Plus className="size-3.5" /></NavLink>}</div>
    <nav aria-label="Quadros" className="min-h-0 space-y-1 overflow-y-auto overflow-x-hidden pb-2">
      {boards.slice(0, 5).map(board => <Tooltip key={board.id}><TooltipTrigger asChild><NavLink to={`/app/board/${board.id}`} onClick={close} aria-label={collapsed ? board.name : undefined} className={`nav-item ${collapsed ? 'justify-center px-0' : ''}`}><span className="size-2 shrink-0 rounded-sm" style={{ background: board.color }} />{!collapsed && <span className="truncate">{board.name}</span>}</NavLink></TooltipTrigger>{collapsed && <TooltipContent side="right" sideOffset={12}>{board.name}</TooltipContent>}</Tooltip>)}
      {boardsQuery.isPending && <div role="status" aria-label="Carregando quadros" className="space-y-2 px-2"><Skeleton className={collapsed ? 'size-8' : 'h-8 w-full'} /><Skeleton className={collapsed ? 'size-8' : 'h-8 w-4/5'} /></div>}
      {boardsQuery.isError && !collapsed && <div className="px-3 text-xs text-muted-foreground"><p>Quadros indisponíveis.</p><Button variant="ghost" size="sm" className="mt-1 -ml-3" onClick={() => void boardsQuery.refetch()}>Tentar novamente</Button></div>}
      {boardsQuery.isSuccess && boards.length === 0 && !collapsed && <p className="px-3 text-xs text-muted-foreground">Seus quadros aparecerão aqui.</p>}
    </nav>
    <div className="mt-auto pt-6">{!collapsed && <div className="mb-5 flex items-start gap-3 rounded-lg border border-border bg-card p-3"><DoodleStar className="size-5 text-cyan/70" /><p className="text-[11px] leading-relaxed text-muted-foreground">Dê espaço às ideias.<br /><span className="text-foreground">O próximo passo é seu.</span></p></div>}<div className="mb-3 border-t border-sidebar-border" /><AccountMenu collapsed={collapsed} onLogout={onLogout} /></div>
  </div>
}

export function AppLayout() {
  const { session } = useAuth()
  const { workspace } = useActiveWorkspace()
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const { data: unreadCount } = useUnreadNotifications()
  usePrivateRealtime(session ? `notifications:${session.user.id}` : undefined)
  const location = useLocation()
  const outlet = useOutlet()
  const navigate = useNavigate()
  const currentBoardId = location.pathname.match(/^\/app\/board\/([^/]+)/)?.[1]
  const searchShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K'

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  const mobileNavOpen = useUiStore(s => s.mobileNavOpen)
  const setMobileNavOpen = useUiStore(s => s.setMobileNavOpen)
  const collapsed = useUiStore(s => s.sidebarCollapsed)
  const toggleSidebar = useUiStore(s => s.toggleSidebar)
  const transition = useMotionTransition(.24)
  const label = location.pathname.includes('/board/') ? 'Quadro' : location.pathname.split('/').pop() === 'app' ? 'Visão geral' : ({ boards: 'Projetos', dashboard: 'Analytics', notifications: 'Notificações', settings: 'Configurações', members: 'Membros' } as Record<string, string>)[location.pathname.split('/').pop() || ''] || 'Workspace'
  async function logout() {
    try { await signOut(); navigate('/login', { replace: true }) }
    catch { toast.error('Não foi possível sair. Tente novamente.') }
  }
  return <div className="min-h-svh bg-background" style={{ '--sidebar-width': collapsed ? '76px' : '248px' } as CSSProperties}>
    <a href="#main-content" className="skip-link">Ir para o conteúdo</a>
    <motion.aside animate={{ width: collapsed ? 76 : 248 }} transition={transition} className="fixed inset-y-0 left-0 z-30 hidden overflow-x-hidden border-r border-sidebar-border bg-sidebar lg:block"><SidebarContent collapsed={collapsed} onToggle={toggleSidebar} onLogout={logout} /></motion.aside>
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}><SheetContent side="left" className="w-[280px] border-sidebar-border bg-sidebar p-0"><SheetTitle className="sr-only">Navegação</SheetTitle><SheetDescription className="sr-only">Navegue entre páginas e quadros do workspace.</SheetDescription><SidebarContent close={() => setMobileNavOpen(false)} onLogout={logout} /></SheetContent></Sheet>
    <div className="transition-[padding-left] duration-240 ease-out lg:pl-[var(--sidebar-width)]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-border bg-background px-4 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={() => setMobileNavOpen(true)}><Menu /></Button><span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:block">{workspace?.name ?? 'Workspace'}</span><span className="hidden text-subtle-foreground sm:block">/</span><span className="truncate text-sm font-medium">{label}</span></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => setCommandOpen(true)} aria-label={`Busca global (${searchShortcut})`} className="flex h-11 w-11 items-center justify-center gap-2 rounded-lg border border-border bg-card text-xs text-muted-foreground transition-colors hover:border-primary/40 sm:h-9 sm:w-52 sm:justify-start sm:px-3"><Search className="size-3.5 shrink-0" /><span className="hidden sm:inline">Buscar em tudo</span><kbd className="ml-auto hidden rounded border border-border px-1.5 py-0.5 text-[9px] sm:inline-flex">{searchShortcut}</kbd></button><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={`Notificações${unreadCount ? `, ${unreadCount} não lidas` : ''}`} onClick={() => setNotificationOpen(true)} className="relative text-muted-foreground"><Bell className="size-4" />{Boolean(unreadCount) && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">{unreadCount! > 99 ? '99+' : unreadCount}</span>}</Button></TooltipTrigger><TooltipContent>Notificações</TooltipContent></Tooltip><Button variant="ghost" size="icon" aria-label="Configurações" onClick={() => navigate('/app/settings')} className="text-muted-foreground"><Settings2 className="size-4" /></Button></div>
      </header>
      <main tabIndex={-1} id="main-content" className="mx-auto min-w-0 w-full max-w-[1600px] px-4 py-6 sm:px-8 lg:px-10 lg:py-8"><AnimatePresence initial={false} mode="wait"><MotionPage key={location.pathname}>{outlet}</MotionPage></AnimatePresence></main>
    </div>
    <Sheet open={notificationOpen} onOpenChange={setNotificationOpen}><SheetContent className="w-screen max-w-none gap-0 overflow-clip border-border bg-card p-0 sm:w-[min(100vw,480px)] sm:max-w-none"><SheetTitle className="sr-only">Central de notificações</SheetTitle><SheetDescription className="sr-only">Atualizações dos seus quadros e tarefas.</SheetDescription><NotificationCenter compact onNavigate={() => setNotificationOpen(false)} /></SheetContent></Sheet>
    <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} currentBoardId={currentBoardId} onOpenNotifications={() => setNotificationOpen(true)} />
  </div>
}
