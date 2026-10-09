import { FieldError } from '@/components/ui/field-message'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWorkspaceRoleMutation } from '../hooks/use-member-directory'
import { workspaceMemberEditSchema, type WorkspaceMemberEditValues } from '@/schemas/workspace-member-edit'
import { z } from 'zod'
import type { WorkspaceDirectoryMember } from '../services/member-directory-service'

export function EditWorkspaceMemberDialog({ workspaceId, member, mode, canAssignAdmin, onOpenChange }: {
  workspaceId: string
  member: WorkspaceDirectoryMember | null
  mode: 'all' | 'role'
  canAssignAdmin: boolean
  onOpenChange: (open: boolean) => void
}) {
  const roleOnlySchema = z.object({ display_name: z.string(), workspace_role: z.enum(['admin','member','viewer']) })
  const mutation = useWorkspaceRoleMutation(workspaceId)
  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<WorkspaceMemberEditValues>({
    resolver: zodResolver(mode === 'all' ? workspaceMemberEditSchema : roleOnlySchema),
    defaultValues: { display_name: '', workspace_role: 'member' },
  })
  const role = useWatch({ control, name: 'workspace_role' })
  useEffect(() => {
    if (member) reset({ display_name: member.display_name, workspace_role: member.role === 'owner' ? 'member' : member.role })
  }, [member, reset])

  async function submit(values: WorkspaceMemberEditValues) {
    if (!member) return
    try {
      const result = await mutation.mutateAsync({ memberUserId: member.user_id, ...(mode === 'all' ? { displayName: values.display_name } : {}), role: values.workspace_role })
      toast.success(result.changed ? 'Membro atualizado.' : 'Nenhuma alteração necessária.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o membro.')
    }
  }

  return <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[460px]">
      <DialogHeader>
        <DialogTitle>{mode === 'role' ? 'Alterar cargo' : 'Editar membro'}</DialogTitle>
        <DialogDescription>
          {mode === 'role' ? 'Defina o nível de participação neste workspace.' : 'O nome de exibição aparecerá em todos os workspaces. As permissões de edição continuam sendo verificadas.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        {mode === 'all' && <div className="space-y-1.5"><Label htmlFor="edit-member-name">Nome</Label><Input id="edit-member-name" aria-describedby={errors.display_name ? "edit-member-name-error" : undefined} autoComplete="off" {...register('display_name')} aria-invalid={Boolean(errors.display_name)} />{errors.display_name && <FieldError id="edit-member-name-error" className="text-xs text-destructive">{errors.display_name.message}</FieldError>}</div>}
        <div className="space-y-1.5"><Label>Cargo no workspace</Label><Select value={role} onValueChange={value => setValue('workspace_role', value as WorkspaceMemberEditValues['workspace_role'], { shouldDirty: true, shouldValidate: true })}><SelectTrigger aria-label="Cargo no workspace" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{canAssignAdmin && <SelectItem value="admin">Admin do workspace</SelectItem>}<SelectItem value="member">Membro</SelectItem><SelectItem value="viewer">Visualizador</SelectItem></SelectContent></Select>{errors.workspace_role && <FieldError className="text-xs text-destructive">{errors.workspace_role.message}</FieldError>}</div>
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button><Button type="submit" loading={mutation.isPending}>{mutation.isPending ? 'Salvando...' : 'Salvar alterações'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>
}
