import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { ArrowRightLeft, MoreHorizontal, Pencil, Search, ShieldCheck, Trash2, UserRoundCog } from 'lucide-react'
import { PageHeading } from '@/components/common/page-heading'
import { EmptyState, ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { useActiveWorkspace } from '@/features/workspaces/hooks/use-workspaces'
import { useWorkspaceMutations } from '@/features/workspaces/hooks/use-workspace-mutations'
import { useWorkspaceMemberMutations } from '@/features/members/hooks/use-members'
import { useWorkspaceDirectory } from '@/features/members/hooks/use-member-directory'
import { AddWorkspaceMemberDialog } from '@/features/members/components/add-workspace-member-dialog'
import { EditWorkspaceMemberDialog } from '@/features/members/components/edit-workspace-member-dialog'
import { useAvatarUrls } from '@/features/profiles/hooks/use-avatar-urls'
import type { WorkspaceDirectoryMember } from '@/features/members/services/member-directory-service'
import type { MemberRole } from '@/types/domain'

const names: Record<MemberRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Membro', viewer: 'Visualizador' }
const date = (value: string) => format(new Date(value), 'd MMM yyyy', { locale: ptBR })
type MemberEditState = { member: WorkspaceDirectoryMember; mode: 'all' | 'role' }

export function WorkspaceMembersPage() {
  const { workspace, isLoading: workspaceLoading, error: workspaceError, refetch: retryWorkspace } = useActiveWorkspace()
  const { session } = useAuth()
  const workspaceId = workspace?.id ?? ''
  const directory = useWorkspaceDirectory(workspaceId)
  const canManage = workspace?.access_role === 'owner' || workspace?.access_role === 'admin'
  const canAssignAdmin = workspace?.access_role === 'owner'
  const memberMutation = useWorkspaceMemberMutations(workspaceId)
  const transferMutation = useWorkspaceMutations().transfer
  const avatarUrls = useAvatarUrls((directory.data ?? []).map(item => item.avatar_url)).data ?? {}
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<MemberRole | 'all'>('all')
  const [removing, setRemoving] = useState<WorkspaceDirectoryMember | null>(null)
  const [transferTo, setTransferTo] = useState<WorkspaceDirectoryMember | null>(null)
  const [editing, setEditing] = useState<MemberEditState | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const filtered = useMemo(() => (directory.data ?? []).filter(item =>
    (roleFilter === 'all' || item.role === roleFilter)
    && `${item.display_name} ${item.email ?? ''} ${item.username ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  ), [directory.data, search, roleFilter])
  const canEdit = (member: WorkspaceDirectoryMember) => workspace?.access_role === 'owner'
    ? member.role !== 'owner'
    : workspace?.access_role === 'admin' && (member.role === 'member' || member.role === 'viewer')

  async function remove() {
    if (!removing?.id) return
    try {
      await memberMutation.remove.mutateAsync(removing.id)
      setRemoving(null)
      toast.success('Membro removido do workspace e dos boards relacionados.')
    } catch { toast.error('Não foi possível remover o membro.') }
  }
  async function transfer() {
    if (!workspace || !transferTo || confirmation !== workspace.name) return
    try {
      await transferMutation.mutateAsync({ id: workspace.id, userId: transferTo.user_id })
      setTransferTo(null)
      setConfirmation('')
      toast.success('Propriedade transferida.')
    } catch { toast.error('Não foi possível transferir a propriedade.') }
  }
  if (workspaceLoading) return <Skeleton className="h-80 w-full" />
  if (workspaceError || !workspace) return <ErrorState message="Não foi possível abrir os membros deste workspace." onRetry={() => void retryWorkspace()} />

  return <div className="space-y-6">
    <PageHeading eyebrow="Workspace" title="Membros e permissões" description={`Equipe de ${workspace.name}. Gerencie a participação e os cargos dentro deste workspace.`} action={canManage && <AddWorkspaceMemberDialog workspaceId={workspace.id} workspaceName={workspace.name} canAssignAdmin={canAssignAdmin} />} />
    <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-3">
      <div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar nome ou e-mail" aria-label="Buscar membros" className="pl-9" /></div>
      <Select value={roleFilter} onValueChange={value => setRoleFilter(value as MemberRole | 'all')}><SelectTrigger aria-label="Filtrar cargo do workspace" className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os cargos</SelectItem>{(Object.keys(names) as MemberRole[]).map(role => <SelectItem key={role} value={role}>{names[role]}</SelectItem>)}</SelectContent></Select>
    </div>
    {directory.error ? <ErrorState message="Não foi possível carregar os membros." onRetry={() => void directory.refetch()} /> : directory.isLoading ? <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : filtered.length ? <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="hidden grid-cols-[minmax(190px,2fr)_minmax(180px,1.4fr)_120px_120px_56px] gap-3 border-b border-border bg-surface-raised px-4 py-3 text-[10px] uppercase tracking-[.15em] text-muted-foreground xl:grid"><span>Pessoa</span><span>E-mail</span><span>Cargo</span><span>Entrada</span><span className="text-right">Ações</span></div>
      {filtered.map(member => {
        const editable = canEdit(member)
        const canTransfer = workspace.access_role === 'owner' && member.user_id !== session?.user.id
        const hasActions = editable || canTransfer
        return <div key={member.user_id} className="relative grid gap-3 border-b border-border/60 p-4 pr-16 transition-colors hover:bg-surface-raised/40 last:border-b-0 xl:pr-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_120px_120px_40px] xl:items-center">
          <div className="flex min-w-0 items-center gap-3"><Avatar className="size-9 border border-border"><AvatarImage src={member.avatar_url ? avatarUrls[member.avatar_url] : undefined} alt="" /><AvatarFallback>{(member.display_name || member.email || '?').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><div className="truncate text-sm font-medium">{member.display_name || 'Sem nome'}</div>{member.username && <div className="truncate text-xs text-muted-foreground">@{member.username}</div>}</div></div>
          <div className="truncate text-xs text-muted-foreground">{member.email || '—'}</div>
          <div><span className="inline-flex rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">{names[member.role]}</span></div>
          <div className="text-xs text-muted-foreground"><span className="mr-1 xl:hidden">Entrada:</span>{member.joined_at ? date(member.joined_at) : '—'}</div>
          <div className="absolute right-3 top-3 flex justify-end xl:static">{hasActions && <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Ações para ${member.display_name || member.email}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {editable && <>
                <DropdownMenuItem onSelect={() => setEditing({ member, mode: 'all' })}><Pencil />Editar membro</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setEditing({ member, mode: 'role' })}><UserRoundCog />Alterar cargo</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(member)}><Trash2 />Remover membro</DropdownMenuItem>
              </>}
              {canTransfer && <DropdownMenuItem onSelect={() => { setTransferTo(member); setConfirmation('') }}><ArrowRightLeft />Transferir propriedade</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>}</div>
        </div>
      })}
    </div> : <EmptyState title="Nenhum membro encontrado" description={search || roleFilter !== 'all' ? 'Ajuste a busca ou o filtro.' : 'Adicione alguém para começar a colaborar.'} />}

    <EditWorkspaceMemberDialog workspaceId={workspace.id} member={editing?.member ?? null} mode={editing?.mode ?? 'all'} canAssignAdmin={canAssignAdmin} onOpenChange={open => { if (!open) setEditing(null) }} />
    <Dialog open={Boolean(removing)} onOpenChange={open => { if (!open && !memberMutation.remove.isPending) setRemoving(null) }}><DialogContent><DialogHeader><DialogTitle>Remover {removing?.display_name || 'membro'} deste workspace?</DialogTitle><DialogDescription>Ele perderá acesso aos quadros e tarefas vinculados a este workspace. A conta global e o histórico serão preservados.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="ghost" disabled={memberMutation.remove.isPending} onClick={() => setRemoving(null)}>Cancelar</Button><Button variant="destructive" disabled={memberMutation.remove.isPending} onClick={() => void remove()}>{memberMutation.remove.isPending ? 'Removendo...' : 'Remover membro'}</Button></div></DialogContent></Dialog>
    <Dialog open={Boolean(transferTo)} onOpenChange={open => { if (!open) setTransferTo(null) }}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-warning" />Transferir propriedade</DialogTitle><DialogDescription>{transferTo?.display_name || 'A pessoa selecionada'} se tornará owner de {workspace.name}. Seu cargo passará a Admin. Digite o nome do workspace para confirmar.</DialogDescription></DialogHeader><Input aria-label="Confirme o nome do workspace" value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder={workspace.name} /><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setTransferTo(null)}>Cancelar</Button><Button variant="destructive" disabled={confirmation !== workspace.name || transferMutation.isPending} onClick={() => void transfer()}>Transferir propriedade</Button></div></DialogContent></Dialog>
  </div>
}
