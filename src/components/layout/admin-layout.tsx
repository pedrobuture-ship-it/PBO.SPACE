import { Link, NavLink, Outlet } from 'react-router'
import { ArrowLeft, LayoutDashboard, UsersRound } from 'lucide-react'
import { Brand } from '@/components/common/brand'
import { useProfile } from '@/features/profiles/hooks/use-profile'
export function AdminLayout() {
  const { data: profile } = useProfile()
  return <div className="min-h-svh bg-background"><header className="border-b border-border bg-sidebar"><div className="mx-auto flex min-h-16 max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-8"><div className="flex items-center gap-5"><Brand compact /><span className="hidden h-6 w-px bg-border sm:block" /><span className="text-xs font-semibold uppercase tracking-[.2em] text-cyan">Administração</span></div><Link to="/app" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> Workspace</Link></div></header><div className="mx-auto grid max-w-[1500px] gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[210px_minmax(0,1fr)]"><aside><nav aria-label="Navegação administrativa" className="flex gap-2 lg:flex-col"><NavLink end to="/admin" className="nav-item"><LayoutDashboard className="size-4" /> Visão geral</NavLink><NavLink to="/admin/users" className="nav-item"><UsersRound className="size-4" /> Usuários</NavLink></nav><p className="mt-6 hidden text-xs text-muted-foreground lg:block">Cargo: {profile?.app_role === 'superadmin' ? 'Superadmin' : 'Admin'}</p></aside><main className="min-w-0"><Outlet /></main></div></div>
}
