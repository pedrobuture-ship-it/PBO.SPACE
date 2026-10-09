import { FieldError } from '@/components/ui/field-message'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { friendlyAuthError } from '@/features/auth/services/auth-errors'
import { requestPasswordReset } from '@/features/auth/services/auth-service'
import { forgotPasswordSchema } from '@/schemas/auth'
import { AuthFlowShell } from './auth-flow-shell'
export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema) })
  async function submit({ email }: z.infer<typeof forgotPasswordSchema>) {
    setMessage('')
    try { await requestPasswordReset(email); setSent(true) }
    catch (error) { setMessage(friendlyAuthError(error)) }
  }
  return <AuthFlowShell eyebrow="Recuperação de acesso" title="Vamos recomeçar." description="Enviaremos um link para definir uma nova senha.">
    {sent ? <div role="status" className="rounded-xl border border-success/30 bg-success/10 p-5 text-sm"><MailCheck className="mb-3 size-5 text-success" />Se esse e-mail possui uma conta, o link chegará em instantes. Confira também a pasta de spam.</div>
      : <form onSubmit={handleSubmit(submit)} className="space-y-5"><div className="space-y-2"><Label htmlFor="recovery-email">E-mail</Label><Input id="recovery-email" aria-describedby={errors.email ? "recovery-email-error" : undefined} type="email" autoComplete="email" placeholder="voce@exemplo.com" aria-invalid={Boolean(errors.email)} {...register('email')} />{errors.email && <FieldError id="recovery-email-error">{errors.email.message}</FieldError>}</div>{message && <FieldError className="text-sm text-destructive">{message}</FieldError>}<Button type="submit" className="w-full" loading={isSubmitting}>Enviar link <ArrowRight className="size-4" /></Button></form>}
  </AuthFlowShell>
}
