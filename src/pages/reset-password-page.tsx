import { FieldError, FieldHint } from '@/components/ui/field-message'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/auth-context'
import { friendlyAuthError } from '@/features/auth/services/auth-errors'
import { signOut, updatePassword } from '@/features/auth/services/auth-service'
import { passwordSchema, type PasswordValues } from '@/schemas/auth'
import { AuthFlowShell } from './auth-flow-shell'
export function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })
  async function submit({ password }: PasswordValues) {
    setMessage('')
    try { await updatePassword(password); await signOut(); navigate('/login?password=updated', { replace: true }) }
    catch (error) { setMessage(friendlyAuthError(error)) }
  }
  const invitation = params.get('mode') === 'invite'
  return <AuthFlowShell eyebrow={invitation ? 'Convite para o workspace' : 'Recuperação de acesso'} title="Defina sua senha." description="Escolha uma senha forte para continuar com segurança.">
    {loading ? <p role="status" className="text-sm text-muted-foreground">Validando seu link...</p>
      : !session ? <div role="alert" className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm leading-relaxed text-warning">Este link é inválido ou expirou. Solicite um novo link para continuar.</div>
      : <form onSubmit={handleSubmit(submit)} className="space-y-5"><div className="space-y-2"><Label htmlFor="new-password">Nova senha</Label><div className="relative"><Input id="new-password" aria-describedby={errors.password ? "new-password-hint new-password-error" : "new-password-hint"} type={show ? 'text' : 'password'} autoComplete="new-password" className="pr-11" aria-invalid={Boolean(errors.password)} {...register('password')} /><button type="button" onClick={() => setShow(value => !value)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-1 top-1/2 -translate-y-1/2 grid size-9 place-items-center text-muted-foreground">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div><FieldHint id="new-password-hint">Use entre 8 e 72 caracteres.</FieldHint>{errors.password && <FieldError id="new-password-error">{errors.password.message}</FieldError>}</div><div className="space-y-2"><Label htmlFor="confirm-password">Confirmar senha</Label><Input id="confirm-password" aria-describedby={errors.confirmation ? "confirm-password-error" : undefined} type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmation)} {...register('confirmation')} />{errors.confirmation && <FieldError id="confirm-password-error">{errors.confirmation.message}</FieldError>}</div>{message && <FieldError className="text-sm text-destructive">{message}</FieldError>}<Button type="submit" className="w-full" loading={isSubmitting}>Salvar senha <ArrowRight className="size-4" /></Button></form>}
  </AuthFlowShell>
}
