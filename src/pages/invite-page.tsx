import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MailCheck, ShieldCheck } from 'lucide-react'
import { Brand } from '@/components/common/brand'
import { DoodleStar } from '@/components/common/sketch'
import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { signOut } from '@/features/auth/services/auth-service'
import { acceptWorkspaceInvitation, lookupWorkspaceInvitation } from '@/features/members/services/member-directory-service'
import { useUiStore } from '@/stores/ui-store'

export function InvitePage() {
  const { token='' }=useParams()
  const { session,loading }=useAuth()
  const location=useLocation()
  const navigate=useNavigate()
  const client=useQueryClient()
  const setWorkspace=useUiStore(state => state.setActiveWorkspaceId)
  const [busy,setBusy]=useState(false)
  const invite=useQuery({ queryKey:['invite-preview',token],queryFn:() => lookupWorkspaceInvitation(token),enabled:Boolean(token),retry:false })
  async function accept() {
    setBusy(true)
    try { const workspaceId=await acceptWorkspaceInvitation(token); setWorkspace(workspaceId); await Promise.all([client.invalidateQueries({ queryKey:['workspaces'] }),client.invalidateQueries({ queryKey:['workspace-directory'] }),client.invalidateQueries({ queryKey:['boards'] })]); toast.success('Convite aceito. Bem-vindo ao workspace.'); navigate('/app',{ replace:true }) }
    catch { toast.error('Não foi possível aceitar. Confirme seu e-mail e tente novamente.') }
    finally { setBusy(false) }
  }
  async function switchAccount() { try { await signOut(); navigate('/login',{ state:{ from:location },replace:true }) } catch { toast.error('Não foi possível sair da conta.') } }
  const preview=invite.data
  const matches=Boolean(session?.user.email && preview?.email && session.user.email.toLowerCase()===preview.email.toLowerCase())
  return <div className="flex min-h-svh flex-col bg-background p-6 sm:p-10"><Brand /><main className="mx-auto my-auto w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-(--shadow-card) sm:p-8"><div className="mb-5 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10"><MailCheck className="size-5 text-primary" /></div><DoodleStar className="ml-auto size-6 text-cyan/70" /></div><div className="mb-2 text-[10px] font-semibold uppercase tracking-[.2em] text-cyan">Convite para workspace</div><h1 className="text-2xl font-semibold tracking-tight">Faça parte da equipe</h1>{invite.isLoading || loading ? <div className="mt-6 space-y-3"><Skeleton className="h-5 w-48" /><Skeleton className="h-10 w-full" /></div> : invite.error ? <div className="mt-5"><ErrorState message="Não foi possível verificar o convite." onRetry={() => void invite.refetch()} /></div> : preview?.status!=='pending' ? <div className="mt-5 space-y-4"><p className="text-sm text-muted-foreground">{preview?.status==='expired' ? 'Este convite expirou. Peça um novo link ao administrador.' : preview?.status==='accepted' ? 'Este convite já foi usado.' : 'Este convite não está mais disponível.'}</p><Button asChild variant="outline"><Link to="/app">Ir para o aplicativo</Link></Button></div> : <div className="mt-5 space-y-5"><p className="text-sm text-muted-foreground">Você foi convidado para <strong className="text-foreground">{preview.workspace_name}</strong> como <strong className="text-foreground">{preview.role}</strong>. O convite foi enviado para <strong className="text-foreground">{preview.email}</strong>.</p>{!session ? <Button asChild><Link to="/login" state={{ from:location }}>Entrar para aceitar</Link></Button> : !matches ? <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm"><p>Você está conectado como {session.user.email}. Entre com o e-mail convidado para aceitar.</p><Button variant="outline" size="sm" onClick={() => void switchAccount()}>Trocar de conta</Button></div> : <div className="space-y-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-success" /> O banco validará o e-mail confirmado e a validade do convite.</div><Button disabled={busy} onClick={() => void accept()}>{busy?'Aceitando...':'Aceitar convite'}</Button></div>}</div>}</main></div>
}
