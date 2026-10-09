import { FieldError } from '@/components/ui/field-message'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ArrowRight, Eye, EyeOff, Layers3 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { MotionPage } from '@/components/common/motion'
import { DoodleStar, SketchSpark, SketchUnderline } from '@/components/common/sketch'
import { Brand } from '@/components/common/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/auth-context'
import { friendlyAuthError } from '@/features/auth/services/auth-errors'
import { signIn } from '@/features/auth/services/auth-service'
import { isSupabaseConfigured } from '@/services/supabase/client'
import { loginSchema } from '@/schemas/auth'

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const passwordUpdated = new URLSearchParams(location.search).get('password') === 'updated'
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string; password: string }>({ resolver: zodResolver(loginSchema) })
  if (session) return <Navigate to="/app" replace />

  const requested = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
  const destination = requested?.startsWith('/app') || requested?.startsWith('/admin') || /^\/invite\/[0-9a-f]{64}$/.test(requested ?? '') ? requested! : '/app'
  async function onSubmit(values: { email: string; password: string }) {
    setBusy(true)
    try {
      await signIn(values)
      navigate(destination, { replace: true })
    } catch (error) { toast.error(friendlyAuthError(error)) }
    finally { setBusy(false) }
  }

  return <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.02fr)_minmax(0,.98fr)]">
    <div className="relative hidden min-h-svh overflow-hidden border-r border-border bg-sidebar p-10 lg:flex lg:flex-col xl:p-14">
      <div className="absolute inset-0 highlight-panel opacity-50" />
      <div className="relative z-10"><Brand /></div>
      <div className="relative z-10 my-auto max-w-[550px]">
        <div className="mb-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.3em] text-primary"><span className="h-px w-8 bg-primary" /> Seu espaço criativo começa aqui</div>
        <MotionPage><h1 className="text-[clamp(2.8rem,5vw,5rem)] font-semibold leading-[1.08] tracking-[-.055em]">Ideias em<br /><span className="relative inline-block text-primary">movimento.<SketchUnderline className="absolute -bottom-3 left-0 h-3 w-full text-primary/60" /></span></h1></MotionPage>
        <p className="mt-8 max-w-md text-base leading-relaxed text-muted-foreground">Um lugar para transformar o caos criativo em trabalho extraordinário. Planeje com clareza, crie com liberdade.</p>
        <div className="relative mt-14 max-w-[460px] rounded-xl border border-border bg-card p-5 shadow-(--shadow-card)">
          <div className="mb-5 text-xs font-semibold text-primary">Seu processo, do início à entrega.</div>
          <div className="grid grid-cols-3 gap-3">{['Planeje', 'Crie', 'Entregue'].map((stage, index) => <div key={stage} className="rounded-lg border border-border bg-surface-raised p-4"><span className="text-[10px] text-cyan">0{index + 1}</span><p className="mt-3 text-xs font-medium">{stage}</p></div>)}</div>
          <DoodleStar className="absolute -right-4 -top-4 size-8 text-cyan" />
        </div>
      </div>
      <div className="relative z-10 flex items-center justify-between text-[11px] text-muted-foreground"><span>© 2026 hwd.space</span><span>HANDCRAFTED DIGITAL WORKSPACE</span></div>
    </div>
    <div className="flex min-h-svh flex-col bg-background px-6 py-8 sm:px-12 lg:px-16 xl:px-24">
      <div className="flex items-center justify-between lg:justify-end"><div className="lg:hidden"><Brand /></div></div>
      <MotionPage className="mx-auto my-auto w-full max-w-[420px] py-10 sm:py-16">
        <div className="mb-8 flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Layers3 className="size-6 -rotate-12" /></div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[.28em] text-primary">Bem-vindo de volta</div>
        <h2 className="text-3xl font-semibold leading-tight tracking-[-.045em] sm:text-4xl">Entre no seu espaço.</h2>
        <p className="mt-3 text-sm text-muted-foreground">Suas ideias e projetos estão esperando por você.</p>
        {passwordUpdated && <p role="status" className="mt-6 rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success">Senha atualizada. Entre com sua nova senha.</p>}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-9 space-y-5">
          <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" placeholder="voce@exemplo.com" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} {...register('email')} className="h-11 bg-card" />{errors.email && <FieldError id="email-error" className="text-xs text-destructive">{errors.email.message}</FieldError>}</div>
          <div className="space-y-2"><Label htmlFor="password">Senha</Label><div className="relative"><Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined} {...register('password')} className="h-11 bg-card pr-11" /><button type="button" className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-muted-foreground" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{errors.password && <FieldError id="password-error" className="text-xs text-destructive">{errors.password.message}</FieldError>}</div>
          <Button type="submit" size="lg" className="h-11 w-full justify-between px-5 font-semibold" loading={busy} disabled={!isSupabaseConfigured}>{busy ? 'Aguarde...' : 'Entrar no workspace'}<ArrowRight className="size-4" /></Button>
        </form>
        <Link to="/forgot-password" className="mt-5 inline-flex text-xs font-medium text-primary hover:underline">Esqueceu sua senha?</Link>
        {!isSupabaseConfigured && <p className="mt-4 rounded-xl border border-warning/20 bg-warning/10 p-3 text-xs leading-relaxed text-warning">A conexão Supabase ainda não foi configurada. Preencha o arquivo .env.local para habilitar o login.</p>}
      </MotionPage>
      <div className="flex items-center justify-center gap-2 text-center text-[10px] uppercase tracking-[.22em] text-muted-foreground">Pensado para quem faz acontecer <SketchSpark className="size-3.5 text-cyan/70" /></div>
    </div>
  </div>
}
