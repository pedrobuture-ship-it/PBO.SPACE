import { authorize, cors, inputObject, json } from '../_shared/admin.ts'
import { canResetAdminTarget, PasswordResetError, validatePasswordResetInput } from '../_shared/admin-reset-password-logic.mjs'

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const ctx = await authorize(req)
  if (ctx instanceof Response) return ctx

  let input: { targetUserId: string; newPassword: string }
  try {
    input = validatePasswordResetInput(inputObject(await req.json().catch(() => null)))
  } catch (error) {
    if (error instanceof PasswordResetError) return json({ error: error.message, code: error.code }, error.status)
    return json({ error: 'Dados inválidos.' }, 400)
  }

  const { data: target, error: targetError } = await ctx.admin.from('profiles')
    .select('app_role').eq('id', input.targetUserId).maybeSingle()
  if (targetError || !target) return json({ error: 'Usuário não encontrado.' }, 404)
  if (!canResetAdminTarget(ctx.callerRole, ctx.callerId, input.targetUserId, target.app_role)) {
    return json({ error: 'Você não possui permissão para redefinir a senha desta conta.' }, 403)
  }

  const { data: permitted, error: quotaError } = await ctx.admin.rpc('consume_admin_action_quota', {
    p_actor_id: ctx.callerId, p_action: 'admin-reset-user-password', p_limit: 5, p_window_seconds: 3600,
  })
  if (quotaError) return json({ error: 'Serviço temporariamente indisponível.' }, 503)
  if (!permitted) return json({ error: 'Limite de redefinições atingido. Tente novamente mais tarde.' }, 429)

  const { error } = await ctx.admin.auth.admin.updateUserById(input.targetUserId, { password: input.newPassword })
  if (error) {
    // Não registrar corpo, usuário, senha ou erro bruto de Auth.
    console.error('[admin-reset-user-password] Auth update failed', error.code ?? 'unexpected')
    if (error.code === 'weak_password') return json({ error: 'A nova senha não atende aos requisitos de segurança configurados.' }, 400)
    return json({ error: 'Não foi possível redefinir a senha.' }, 400)
  }
  return json({ success: true })
})
