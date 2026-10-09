import { Link, Outlet } from 'react-router'
import { ShieldX } from 'lucide-react'
import { useProfile } from '@/features/profiles/hooks/use-profile'
import { LoadingScreen } from '@/components/common/states'
import { Button } from '@/components/ui/button'
export function AdminRoute() {
  const { data: profile, isLoading, error, refetch } = useProfile()
  if (isLoading) return <LoadingScreen />
  if (error) return <div className="mx-auto max-w-lg p-8 text-center"><p className="text-sm text-destructive">Não foi possível verificar suas permissões.</p><Button className="mt-5" onClick={() => refetch()}>Tentar novamente</Button></div>
  if (profile?.app_role !== 'admin' && profile?.app_role !== 'superadmin') return <div className="grid min-h-svh place-items-center bg-background p-6"><div className="max-w-sm text-center"><ShieldX className="mx-auto mb-5 size-9 text-primary" /><h1 className="text-2xl font-semibold">Acesso restrito</h1><p className="mt-3 text-sm text-muted-foreground">Esta área é destinada à administração da aplicação.</p><Button asChild className="mt-6"><Link to="/app">Voltar ao workspace</Link></Button></div></div>
  return <Outlet />
}
