import { authorize, cors, inputObject, json, userClient } from '../_shared/admin.ts'

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const ctx = await authorize(req)
  if (ctx instanceof Response) return ctx
  const body = inputObject(await req.json().catch(() => null))
  const id = typeof body?.userId === 'string' ? body.userId : ''
  const disabled = body?.disabled
  if (!/^[0-9a-f-]{36}$/i.test(id) || typeof disabled !== 'boolean') return json({ error: 'Dados inválidos.' }, 400)
  const { data: target, error: targetError } = await ctx.admin.from('profiles').select('app_role,disabled_at').eq('id', id).maybeSingle()
  if (targetError || !target) return json({ error: 'Usuário não encontrado.' }, 404)
  if (id === ctx.callerId || (ctx.callerRole === 'admin' && target.app_role !== 'user')) return json({ error: 'Acesso administrativo negado.' }, 403)
  const caller = userClient(ctx)
  // RPC valida novamente no banco: alvo, papel, autoedição e último superadmin.
  if (disabled) {
    const { error } = await caller.rpc('admin_set_user_status', { p_user_id: id, p_disabled: true })
    if (error) return json({ error: 'Você não pode desativar essa conta.' }, 403)
    const { error: banError } = await ctx.admin.auth.admin.updateUserById(id, { ban_duration: '876000h' })
    if (banError) return json({ error: 'Conta bloqueada no banco; repita a ação para concluir o bloqueio no Auth.' }, 502)
  } else {
    const { error: banError } = await ctx.admin.auth.admin.updateUserById(id, { ban_duration: 'none' })
    if (banError) return json({ error: 'Não foi possível reativar a conta no Auth.' }, 502)
    const { error } = await caller.rpc('admin_set_user_status', { p_user_id: id, p_disabled: false })
    if (error) return json({ error: 'Não foi possível reativar essa conta no banco.' }, 403)
  }
  return json({ id, status: disabled ? 'disabled' : 'active' })
})
