import { useNavigate } from 'react-router'
import { LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/services/auth-service'
export function DisabledAccountPage() {
  const navigate = useNavigate()
  async function leave() { await signOut(); navigate('/login', { replace: true }) }
  return <div className="grid min-h-svh place-items-center bg-background p-6"><div className="max-w-sm text-center"><LockKeyhole className="mx-auto mb-5 size-9 text-primary" /><h1 className="text-2xl font-semibold">Conta desativada</h1><p className="mt-3 text-sm text-muted-foreground">Fale com um administrador para recuperar seu acesso.</p><Button onClick={leave} className="mt-6">Sair da conta</Button></div></div>
}
