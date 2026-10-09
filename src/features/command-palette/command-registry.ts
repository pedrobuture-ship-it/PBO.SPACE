import type { LucideIcon } from 'lucide-react'
import { Bell, FolderKanban, Home, LayoutDashboard, Plus, Shield, Settings2, SquareCheckBig, UsersRound } from 'lucide-react'

export type CommandSection = 'Ações' | 'Navegação' | 'Admin'
export type CommandExecutionContext = {
  navigate: (path: string) => void
  createTask: () => void
  createBoard: () => void
  openNotifications: () => void
}
export type CommandDefinition = {
  id: string
  title: string
  section: CommandSection
  subtitle: string
  keywords: string[]
  icon: LucideIcon
  execute: (context: CommandExecutionContext) => void
}

export function buildCommandRegistry(context: CommandExecutionContext, options: { canCreateBoard: boolean; appRole: string | undefined }): CommandDefinition[] {
  const commands: CommandDefinition[] = [
    { id: 'create-task', title: 'Criar tarefa', section: 'Ações', subtitle: 'Adicionar uma tarefa a um quadro', keywords: ['nova', 'adicionar', 'card'], icon: SquareCheckBig, execute: context.createTask },
    { id: 'go-dashboard-action', title: 'Ir para Analytics', section: 'Ações', subtitle: 'Abrir Analytics do workspace', keywords: ['dashboard', 'analytics', 'indicadores', 'gráficos'], icon: LayoutDashboard, execute: () => context.navigate('/app/dashboard') },
    { id: 'open-notifications', title: 'Abrir Notificações', section: 'Ações', subtitle: 'Ver atualizações recentes', keywords: ['sino', 'inbox', 'alertas'], icon: Bell, execute: context.openNotifications },
  ]
  if (options.canCreateBoard) commands.unshift({ id: 'create-board', title: 'Criar quadro', section: 'Ações', subtitle: 'Novo quadro no workspace', keywords: ['projeto', 'novo', 'board'], icon: Plus, execute: context.createBoard })
  commands.push(
    { id: 'nav-home', title: 'Visão geral', section: 'Navegação', subtitle: 'Visão geral do workspace', keywords: ['home', 'início', 'overview'], icon: Home, execute: () => context.navigate('/app') },
    { id: 'nav-boards', title: 'Projetos', section: 'Navegação', subtitle: 'Ver quadros do workspace', keywords: ['boards', 'projetos', 'quadros'], icon: FolderKanban, execute: () => context.navigate('/app/boards') },
    { id: 'nav-dashboard', title: 'Analytics', section: 'Navegação', subtitle: 'Analytics e métricas', keywords: ['dashboard', 'analytics', 'indicadores'], icon: LayoutDashboard, execute: () => context.navigate('/app/dashboard') },
    { id: 'nav-settings', title: 'Configurações', section: 'Navegação', subtitle: 'Configurações da conta', keywords: ['settings', 'perfil', 'preferências'], icon: Settings2, execute: () => context.navigate('/app/settings') },
  )
  if (options.appRole === 'admin' || options.appRole === 'superadmin') commands.push(
    { id: 'admin-home', title: 'Administração', section: 'Admin', subtitle: 'Administração global', keywords: ['administração', 'sistema'], icon: Shield, execute: () => context.navigate('/admin') },
    { id: 'admin-users', title: 'Usuários', section: 'Admin', subtitle: 'Gerenciar contas da aplicação', keywords: ['pessoas', 'contas'], icon: UsersRound, execute: () => context.navigate('/admin/users') },
  )
  return commands
}
