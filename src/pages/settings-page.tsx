import { FieldError, FieldHint } from '@/components/ui/field-message'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { Bell, CircleCheck, Database, LockKeyhole, UserRound } from 'lucide-react'
import { PageHeading } from '@/components/common/page-heading'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProfile, useProfileMutations } from '@/features/profiles/hooks/use-profile'
import { getAvatarUrl } from '@/features/profiles/services/profile-service'
import { useAuth } from '@/features/auth/auth-context'
import { friendlyAuthError } from '@/features/auth/services/auth-errors'
import { updatePassword } from '@/features/auth/services/auth-service'
import { passwordSchema, type PasswordValues } from '@/schemas/auth'
import { isSupabaseConfigured } from '@/services/supabase/client'
const profileSchema = z.object({ display_name: z.string().trim().min(2, 'Digite seu nome.').max(120), username: z.string().trim().regex(/^$|^[a-z0-9_]{3,32}$/, 'Use 3 a 32 letras minúsculas, números ou _.') })
type ProfileValues = z.infer<typeof profileSchema>
function ProfileForm() {
  const { data: profile } = useProfile()
  const { update, avatar } = useProfileMutations()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { display_name: '', username: '' } })
  useEffect(() => { if (profile) reset({ display_name: profile.display_name, username: profile.username ?? '' }) }, [profile, reset])
  async function submit(values: ProfileValues) {
    try { await update.mutateAsync({ display_name: values.display_name, username: values.username || null }); toast.success('Perfil atualizado.') }
    catch { toast.error('Não foi possível salvar. Confira se o nome de usuário está disponível.') }
  }
  async function upload(file?: File) {
    if (!file) return
    try { await avatar.mutateAsync(file); toast.success('Avatar atualizado.') }
    catch { toast.error('Não foi possível enviar o avatar. Confira o formato e o limite de 5 MB.') }
  }
  return <form onSubmit={handleSubmit(submit)} className="mt-6 grid gap-5 border-t border-border pt-6 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="profile-name">Nome de exibição</Label><Input id="profile-name" aria-describedby={errors.display_name ? "profile-name-error" : undefined} {...register('display_name')} aria-invalid={Boolean(errors.display_name)} />{errors.display_name && <FieldError id="profile-name-error">{errors.display_name.message}</FieldError>}</div><div className="space-y-2"><Label htmlFor="profile-username">Nome de usuário</Label><Input id="profile-username" aria-describedby={errors.username ? "profile-username-error" : undefined} {...register('username')} aria-invalid={Boolean(errors.username)} placeholder="seu_usuario" />{errors.username && <FieldError id="profile-username-error">{errors.username.message}</FieldError>}</div><div className="space-y-2 sm:col-span-2"><Label htmlFor="profile-avatar">Avatar</Label><Input id="profile-avatar" aria-describedby="profile-avatar-hint" type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={avatar.isPending} onChange={event => void upload(event.currentTarget.files?.[0])} /><FieldHint id="profile-avatar-hint">JPEG, PNG, WebP ou AVIF, até 5 MB.</FieldHint></div><div className="sm:col-span-2"><Button type="submit" loading={update.isPending}>Salvar perfil</Button></div></form>
}
function ChangePasswordForm() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })
  const [message, setMessage] = useState('')
  async function submit({ password }: PasswordValues) {
    setMessage('')
    try { await updatePassword(password); reset(); toast.success('Senha atualizada.') }
    catch (error) { setMessage(friendlyAuthError(error)) }
  }
  return <form onSubmit={handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="settings-password">Nova senha</Label><Input id="settings-password" aria-describedby={errors.password ? "settings-password-error" : undefined} type="password" autoComplete="new-password" {...register('password')} aria-invalid={Boolean(errors.password)} />{errors.password && <FieldError id="settings-password-error">{errors.password.message}</FieldError>}</div><div className="space-y-2"><Label htmlFor="settings-confirmation">Confirmar senha</Label><Input id="settings-confirmation" aria-describedby={errors.confirmation ? "settings-confirmation-error" : undefined} type="password" autoComplete="new-password" {...register('confirmation')} aria-invalid={Boolean(errors.confirmation)} />{errors.confirmation && <FieldError id="settings-confirmation-error">{errors.confirmation.message}</FieldError>}</div>{message && <FieldError className="text-sm text-destructive sm:col-span-2">{message}</FieldError>}<div className="sm:col-span-2"><Button type="submit" loading={isSubmitting}>Atualizar senha</Button></div></form>
}
export function SettingsPage() {
  const { session } = useAuth()
  const { data: profile } = useProfile()
  const { data: avatarUrl } = useQuery({ queryKey: ['my-avatar', profile?.avatar_url], queryFn: () => getAvatarUrl(profile!.avatar_url!), enabled: Boolean(profile?.avatar_url), staleTime: 40_000 })
  const name = profile?.display_name || session?.user.user_metadata.display_name || 'Seu perfil'
  return <div><PageHeading eyebrow="Preferências" title="Configurações" description="Os detalhes do seu espaço de trabalho." />
    <Tabs defaultValue="profile" className="max-w-4xl gap-5"><TabsList aria-label="Seções de configurações" className="h-10"><TabsTrigger value="profile" className="px-4"><UserRound className="size-4" /> Perfil</TabsTrigger><TabsTrigger value="workspace" className="px-4"><Database className="size-4" /> Workspace</TabsTrigger></TabsList>
      <TabsContent value="profile" className="space-y-5"><section className="rounded-xl border border-border bg-card p-4 sm:p-6"><h2 className="mb-6 flex items-center gap-2 text-sm font-semibold"><UserRound className="size-4 text-primary" /> Seu perfil</h2><div className="flex items-center gap-4"><Avatar className="size-14 shrink-0 border border-primary/25"><AvatarImage src={avatarUrl} alt="" /><AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">{String(name).slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><div className="break-words font-semibold">{name}</div><div className="mt-1 break-all text-xs text-muted-foreground">{session?.user.email}</div><div className="mt-2 text-[10px] uppercase tracking-[.16em] text-cyan">{profile?.app_role === 'superadmin' ? 'Superadmin' : profile?.app_role === 'admin' ? 'Admin' : 'Usuário'}</div></div></div><ProfileForm /></section><section className="rounded-xl border border-border bg-card p-4 sm:p-6"><h2 className="mb-5 text-sm font-semibold">Segurança</h2><ChangePasswordForm /></section></TabsContent>
      <TabsContent value="workspace" className="space-y-5"><section className="rounded-xl border border-border bg-card p-4 sm:p-6"><h2 className="mb-5 flex items-center gap-2 text-sm font-semibold"><Database className="size-4 text-primary" /> Conexão</h2><div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface-raised p-4"><div><div className="text-sm font-medium">Supabase</div><p className="mt-1 text-xs text-muted-foreground">Conexão segura para dados e arquivos do workspace.</p></div><span className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] ${isSupabaseConfigured ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}><CircleCheck className="size-3" />{isSupabaseConfigured ? 'Configurado' : 'Não configurado'}</span></div></section><section className="rounded-xl border border-border bg-card p-4 sm:p-6"><h2 className="mb-3 text-sm font-semibold">Privacidade e alertas</h2><Accordion type="single" collapsible><AccordionItem value="privacy"><AccordionTrigger><span className="flex items-center gap-2"><LockKeyhole className="size-4 text-primary" /> Privacidade</span></AccordionTrigger><AccordionContent>Somente pessoas autorizadas podem acessar os quadros, tarefas e arquivos do workspace.</AccordionContent></AccordionItem><AccordionItem value="notifications"><AccordionTrigger><span className="flex items-center gap-2"><Bell className="size-4 text-primary" /> Preferências de notificação</span></AccordionTrigger><AccordionContent>A central reúne atribuições, comentários, menções e mudanças nos seus quadros. As notificações chegam sem som.</AccordionContent></AccordionItem></Accordion></section></TabsContent>
    </Tabs>
  </div>
}
