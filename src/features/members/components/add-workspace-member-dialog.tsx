import { FieldError } from '@/components/ui/field-message'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { workspaceMemberSchema, type WorkspaceMemberValues } from '@/schemas/workspace-member'
import { useCreateWorkspaceMember } from '../hooks/use-member-directory'

export function AddWorkspaceMemberDialog({workspaceId,workspaceName,canAssignAdmin}:{workspaceId:string;workspaceName:string;canAssignAdmin:boolean}) {
  const [open,setOpen]=useState(false)
  const [showPassword,setShowPassword]=useState(false)
  const [showConfirmation,setShowConfirmation]=useState(false)
  const mutation=useCreateWorkspaceMember(workspaceId)
  const {register,handleSubmit,setValue,reset,control,formState:{errors}}=useForm<WorkspaceMemberValues>({
    resolver:zodResolver(workspaceMemberSchema),
    defaultValues:{display_name:'',email:'',password:'',confirm_password:'',workspace_role:'member'},
  })
  const role=useWatch({control,name:'workspace_role'})

  function close(next:boolean) {
    setOpen(next)
    if (!next&&!mutation.isPending) {
      reset()
      setShowPassword(false)
      setShowConfirmation(false)
    }
  }

  async function submit(values:WorkspaceMemberValues) {
    try {
      const result=await mutation.mutateAsync(values)
      if (result.status==='already_member') toast.info(result.message)
      else toast.success(result.message)
      reset()
      setOpen(false)
    } catch(error) {
      toast.error(error instanceof Error?error.message:'Não foi possível adicionar o membro.')
    }
  }

  return <Dialog open={open} onOpenChange={close}>
    <DialogTrigger asChild><Button><UserPlus className="size-4"/>Adicionar membro</Button></DialogTrigger>
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>Adicionar membro</DialogTitle>
        <DialogDescription>Adicione alguém a {workspaceName}. Se a conta já existir, o perfil e a senha serão preservados.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="workspace-member-name">Nome</Label><Input id="workspace-member-name" aria-describedby={errors.display_name ? "workspace-member-name-error" : undefined} autoComplete="name" {...register('display_name')} aria-invalid={Boolean(errors.display_name)}/>{errors.display_name&&<FieldError id="workspace-member-name-error" className="text-xs text-destructive">{errors.display_name.message}</FieldError>}</div>
        <div className="space-y-1.5"><Label htmlFor="workspace-member-email">E-mail</Label><Input id="workspace-member-email" aria-describedby={errors.email ? "workspace-member-email-error" : undefined} type="email" autoComplete="email" {...register('email')} aria-invalid={Boolean(errors.email)}/>{errors.email&&<FieldError id="workspace-member-email-error" className="text-xs text-destructive">{errors.email.message}</FieldError>}</div>
        <div className="space-y-1.5"><Label htmlFor="workspace-member-password">Senha inicial</Label><div className="relative"><Input id="workspace-member-password" aria-describedby={errors.password ? "workspace-member-password-error" : undefined} type={showPassword?'text':'password'} autoComplete="new-password" className="pr-10" {...register('password')} aria-invalid={Boolean(errors.password)}/><button type="button" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Ocultar senha':'Mostrar senha'} className="absolute inset-y-0 right-2 grid w-8 place-items-center text-muted-foreground hover:text-foreground">{showPassword?<EyeOff className="size-4"/>:<Eye className="size-4"/>}</button></div>{errors.password&&<FieldError id="workspace-member-password-error" className="text-xs text-destructive">{errors.password.message}</FieldError>}</div>
        <div className="space-y-1.5"><Label htmlFor="workspace-member-confirm-password">Confirmar senha</Label><div className="relative"><Input id="workspace-member-confirm-password" aria-describedby={errors.confirm_password ? "workspace-member-confirm-password-error" : undefined} type={showConfirmation?'text':'password'} autoComplete="new-password" className="pr-10" {...register('confirm_password')} aria-invalid={Boolean(errors.confirm_password)}/><button type="button" onClick={()=>setShowConfirmation(value=>!value)} aria-label={showConfirmation?'Ocultar confirmação de senha':'Mostrar confirmação de senha'} className="absolute inset-y-0 right-2 grid w-8 place-items-center text-muted-foreground hover:text-foreground">{showConfirmation?<EyeOff className="size-4"/>:<Eye className="size-4"/>}</button></div>{errors.confirm_password&&<FieldError id="workspace-member-confirm-password-error" className="text-xs text-destructive">{errors.confirm_password.message}</FieldError>}</div>
        <div className="space-y-1.5"><Label>Cargo no workspace</Label><Select value={role} onValueChange={value=>setValue('workspace_role',value as WorkspaceMemberValues['workspace_role'],{shouldDirty:true,shouldValidate:true})}><SelectTrigger aria-label="Cargo no workspace" className="w-full"><SelectValue/></SelectTrigger><SelectContent>{canAssignAdmin&&<SelectItem value="admin">Admin do workspace</SelectItem>}<SelectItem value="member">Membro</SelectItem><SelectItem value="viewer">Visualizador</SelectItem></SelectContent></Select>{errors.workspace_role&&<FieldError className="text-xs text-destructive">{errors.workspace_role.message}</FieldError>}</div>
        <p className="text-xs leading-relaxed text-muted-foreground">Compartilhe a senha inicial diretamente com a pessoa por um canal seguro.</p>
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="ghost" onClick={()=>close(false)} disabled={mutation.isPending}>Cancelar</Button><Button type="submit" loading={mutation.isPending}>{mutation.isPending?'Adicionando...':'Adicionar membro'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>
}
