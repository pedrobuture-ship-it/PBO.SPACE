import { Link } from 'react-router'
import { ArrowUpRight, ShieldCheck, UsersRound } from 'lucide-react'
import { PageHeading } from '@/components/common/page-heading'
import { MotionCard } from '@/components/common/motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/states'
import { useAdminUsers } from '@/features/admin/hooks/use-admin-users'
import { useProfile } from '@/features/profiles/hooks/use-profile'
export function AdminPage() {
  const { data: profile } = useProfile()
  const { data, isLoading, error, refetch } = useAdminUsers({ search: '', role: 'all', status: 'all', page: 0 })
  return <div className="space-y-7"><PageHeading decorated={false} eyebrow="Sistema" title="Administração" description="Pessoas e permissões globais da aplicação." /><div className="grid gap-4 sm:grid-cols-2"><MotionCard className="p-6"><UsersRound className="mb-4 size-5 text-primary" /><p className="text-xs text-muted-foreground">Usuários cadastrados</p>{isLoading ? <Skeleton className="mt-3 h-10 w-20" /> : <strong className="mt-3 block text-4xl">{data?.total ?? '—'}</strong>}</MotionCard><MotionCard className="p-6"><ShieldCheck className="mb-4 size-5 text-cyan" /><p className="text-xs text-muted-foreground">Seu cargo global</p><strong className="mt-3 block text-xl">{profile?.app_role === 'superadmin' ? 'Superadmin' : 'Admin'}</strong></MotionCard></div>{error && <ErrorState message="Não foi possível carregar o resumo administrativo." onRetry={() => refetch()} />}<section className="rounded-xl border border-border bg-card p-6"><h2 className="text-lg font-semibold">Gerenciar pessoas</h2><p className="mt-2 text-sm text-muted-foreground">Consulte contas, redefina senhas e gerencie os status permitidos pelo seu cargo.</p><Button asChild className="mt-5"><Link to="/admin/users">Abrir usuários <ArrowUpRight className="size-4" /></Link></Button></section></div>
}
