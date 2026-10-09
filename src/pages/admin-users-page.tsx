import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, KeyRound, Search } from 'lucide-react'
import { PageHeading } from '@/components/common/page-heading'
import { EmptyState, ErrorState } from '@/components/common/states'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminUsers, useAdminUserActions } from '@/features/admin/hooks/use-admin-users'
import { ResetUserPasswordDialog } from '@/features/admin/components/reset-user-password-dialog'
import type { AdminStatus } from '@/features/admin/services/admin-service'
import { getAvatarUrl } from '@/features/profiles/services/profile-service'
import { useProfile } from '@/features/profiles/hooks/use-profile'
import { useAuth } from '@/features/auth/auth-context'
import type { AdminUser } from '@/types/database'
import type { AppRole } from '@/types/domain'
const roleLabels: Record<AppRole, string> = { superadmin: 'Superadmin', admin: 'Admin', user: 'Usuário' }
const statusLabels: Record<AdminStatus, string> = { active: 'Ativo', invited: 'Convite pendente', disabled: 'Desativado' }
function UserAvatar({ user }: { user: AdminUser }) {
  const { data: url } = useQuery({ queryKey: ['admin-avatar', user.id, user.avatar_url], queryFn: () => getAvatarUrl(user.avatar_url!), enabled: Boolean(user.avatar_url), staleTime: 40_000 })
  return <Avatar className="size-9 shrink-0 border border-primary/20"><AvatarImage src={url} alt="" /><AvatarFallback className="bg-primary/10 text-xs text-primary">{(user.display_name || user.email || '?').slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
}
function UserRow({ user }: { user: AdminUser }) {
  const [resetOpen, setResetOpen] = useState(false)
  const { session } = useAuth()
  const { data: profile } = useProfile()
  const { changeStatus } = useAdminUserActions()
  const isSelf = user.id === session?.user.id
  const superadmin = profile?.app_role === 'superadmin'
  const canManage = !isSelf && (superadmin || user.app_role === 'user')
  const canResetPassword = !isSelf && user.app_role !== 'superadmin' && (superadmin || user.app_role === 'user')
  async function setStatus(disabled: boolean) {
    try { await changeStatus.mutateAsync({ id: user.id, disabled }); toast.success(disabled ? 'Conta desativada.' : 'Conta reativada.') }
    catch { toast.error('Não foi possível alterar o status. Verifique suas permissões e tente novamente.') }
  }
  return <><tr className="border-b border-border/70 last:border-0"><td className="px-4 py-4"><div className="flex items-center gap-3"><UserAvatar user={user} /><div className="min-w-0"><div className="truncate text-sm font-medium">{user.display_name || 'Sem nome'}</div>{user.username && <div className="text-xs text-muted-foreground">@{user.username}</div>}</div></div></td><td className="px-4 py-4 text-sm text-muted-foreground">{user.email || '—'}</td><td data-label="Cargo" className="px-4 py-4"><span className="text-xs text-muted-foreground">{roleLabels[user.app_role]}</span></td><td data-label="Status" className="px-4 py-4"><span className={`rounded-md px-2.5 py-1 text-xs ${user.status === 'active' ? 'bg-success/10 text-success' : user.status === 'disabled' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>{statusLabels[user.status]}</span></td><td data-label="Criado em" className="px-4 py-4 text-xs text-muted-foreground">{format(new Date(user.created_at), 'dd MMM yyyy', { locale: ptBR })}</td><td className="px-4 py-4"><div className="flex flex-wrap justify-end gap-2">{canResetPassword && <Button size="sm" variant="outline" onClick={() => setResetOpen(true)}><KeyRound className="size-3.5"/>Redefinir senha</Button>}{canManage && <Button size="sm" variant="outline" disabled={changeStatus.isPending} onClick={() => void setStatus(user.status !== 'disabled')}>{user.status === 'disabled' ? 'Reativar' : 'Desativar'}</Button>}</div></td></tr><ResetUserPasswordDialog userId={user.id} userName={user.display_name || user.email || 'usuário'} open={resetOpen} onOpenChange={setResetOpen}/></>
}
export function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<AdminStatus | 'all'>('all')
  const [page, setPage] = useState(0)
  useEffect(() => { const timer = window.setTimeout(() => { setTerm(search); setPage(0) }, 250); return () => window.clearTimeout(timer) }, [search])
  const { data, isLoading, error, refetch } = useAdminUsers({ search: term, status, page })
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><PageHeading decorated={false} eyebrow="Pessoas" title="Usuários" description="Contas, acessos e status da aplicação. As ações disponíveis respeitam suas permissões." /></div><div className="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome, usuário ou e-mail" aria-label="Buscar usuários" className="pl-9" /></div><select aria-label="Filtrar por status" value={status} onChange={event => { setStatus(event.target.value as AdminStatus | 'all'); setPage(0) }} className="h-9 min-h-9 w-full rounded-lg border border-input bg-background px-3 text-[13px] sm:w-auto max-sm:min-h-11"><option value="all">Todos os status</option><option value="active">Ativos</option><option value="invited">Convites pendentes</option><option value="disabled">Desativados</option></select></div>{error ? <ErrorState message="Não foi possível carregar os usuários." onRetry={() => refetch()} /> : isLoading ? <Skeleton className="h-72" /> : data?.users.length ? <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="responsive-table w-full text-left"><thead className="border-b border-border bg-surface-raised text-[10px] uppercase tracking-[.16em] text-muted-foreground"><tr><th scope="col" className="px-4 py-3">Nome</th><th scope="col" className="px-4 py-3">E-mail</th><th scope="col" className="px-4 py-3">Cargo</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Criado em</th><th scope="col" className="px-4 py-3 text-right">Ações</th></tr></thead><tbody>{data.users.map(user => <UserRow key={user.id} user={user} />)}</tbody></table></div> : <EmptyState title="Nenhum usuário encontrado" description="Ajuste a busca ou o filtro." />}
    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{data?.total ?? 0} usuário(s)</span><div className="flex items-center gap-2"><Button variant="outline" size="icon-sm" aria-label="Página anterior" disabled={page === 0 || isLoading} onClick={() => setPage(value => value - 1)}><ChevronLeft /></Button><span>Página {page + 1}</span><Button variant="outline" size="icon-sm" aria-label="Próxima página" disabled={!data || data.users.length < 20 || isLoading} onClick={() => setPage(value => value + 1)}><ChevronRight /></Button></div></div>
  </div>
}
