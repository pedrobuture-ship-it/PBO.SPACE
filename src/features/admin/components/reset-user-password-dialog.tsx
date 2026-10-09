import { FieldError } from '@/components/ui/field-message'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetAdminUserPassword } from '../services/admin-service'
import { adminResetPasswordSchema, type AdminResetPasswordValues } from '@/schemas/admin-reset-password'

export function ResetUserPasswordDialog({ userId, userName, open, onOpenChange }: {
  userId: string
  userName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pending, setPending] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AdminResetPasswordValues>({
    resolver: zodResolver(adminResetPasswordSchema),
    defaultValues: { new_password: '', confirm_password: '' },
  })

  function close(next: boolean) {
    if (!next && pending) return
    onOpenChange(next)
    if (!next) {
      reset()
      setShowPassword(false)
      setShowConfirmation(false)
    }
  }

  async function submit(values: AdminResetPasswordValues) {
    setPending(true)
    try {
      await resetAdminUserPassword(userId, values.new_password)
      toast.success('Senha redefinida com sucesso.')
      reset()
      setShowPassword(false)
      setShowConfirmation(false)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível redefinir a senha.')
    } finally { setPending(false) }
  }

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="sm:max-w-[440px]">
      <DialogHeader>
        <DialogTitle>Redefinir senha de {userName}</DialogTitle>
        <DialogDescription>Defina uma nova senha. A senha atual não pode ser consultada; esta ação não altera o e-mail nem o cargo global.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="admin-new-password">Nova senha</Label><div className="relative"><Input id="admin-new-password" aria-describedby={errors.new_password ? "admin-new-password-error" : undefined} type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="pr-10" {...register('new_password')} aria-invalid={Boolean(errors.new_password)} /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} className="absolute inset-y-0 right-2 grid w-8 place-items-center text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{errors.new_password && <FieldError id="admin-new-password-error" className="text-xs text-destructive">{errors.new_password.message}</FieldError>}</div>
        <div className="space-y-1.5"><Label htmlFor="admin-confirm-password">Confirmar nova senha</Label><div className="relative"><Input id="admin-confirm-password" aria-describedby={errors.confirm_password ? "admin-confirm-password-error" : undefined} type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" className="pr-10" {...register('confirm_password')} aria-invalid={Boolean(errors.confirm_password)} /><button type="button" onClick={() => setShowConfirmation(value => !value)} aria-label={showConfirmation ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'} className="absolute inset-y-0 right-2 grid w-8 place-items-center text-muted-foreground hover:text-foreground">{showConfirmation ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{errors.confirm_password && <FieldError id="admin-confirm-password-error" className="text-xs text-destructive">{errors.confirm_password.message}</FieldError>}</div>
        <p className="text-xs text-muted-foreground">A senha é enviada somente ao Supabase Auth e não é armazenada pela aplicação.</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => close(false)} disabled={pending}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? 'Redefinindo...' : 'Redefinir senha'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>
}
