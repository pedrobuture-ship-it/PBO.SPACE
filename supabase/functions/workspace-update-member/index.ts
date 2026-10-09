import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { configuredKey, cors, inputObject, json } from '../_shared/admin.ts'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const roles = new Set(['admin', 'member', 'viewer'])

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const secret = configuredKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = configuredKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
  if (!url || !secret || !publicKey) return json({ error: 'Serviço temporariamente indisponível.' }, 503)
  const header = req.headers.get('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return json({ error: 'Faça login para editar membros.' }, 401)

  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return json({ error: 'Sua sessão expirou. Entre novamente.' }, 401)

  const body = inputObject(await req.json().catch(() => null))
  const allowed = new Set(['workspace_id', 'member_user_id', 'display_name', 'workspace_role'])
  if (!body || Object.keys(body).some(key => !allowed.has(key))) return json({ error: 'Dados inválidos.' }, 400)
  const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : ''
  const memberUserId = typeof body.member_user_id === 'string' ? body.member_user_id : ''
  const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : null
  const workspaceRole = body.workspace_role
  if (!uuidPattern.test(workspaceId) || !uuidPattern.test(memberUserId)
    || (body.display_name !== undefined && (displayName === null || displayName.length < 2 || displayName.length > 120))
    || (workspaceRole !== undefined && !roles.has(String(workspaceRole)))
    || (body.display_name === undefined && workspaceRole === undefined)) {
    return json({ error: 'Revise os dados do membro.' }, 400)
  }

  const { data: profile, error: profileError } = await admin.from('profiles').select('disabled_at').eq('id', user.id).maybeSingle()
  if (profileError || !profile || profile.disabled_at) return json({ error: 'Sua conta não pode executar esta ação.' }, 403)
  const [workspaceResult, membershipResult] = await Promise.all([
    admin.from('workspaces').select('owner_id').eq('id', workspaceId).maybeSingle(),
    admin.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle(),
  ])
  if (workspaceResult.error || membershipResult.error || !workspaceResult.data) return json({ error: 'Workspace não encontrado ou sem acesso.' }, 404)
  const callerRole = workspaceResult.data.owner_id === user.id ? 'owner' : membershipResult.data?.role
  if (callerRole !== 'owner' && callerRole !== 'admin') return json({ error: 'Você não possui permissão para editar membros.' }, 403)
  if (callerRole === 'admin' && workspaceRole !== undefined && !['member', 'viewer'].includes(String(workspaceRole))) {
    return json({ error: 'Workspace admin pode atribuir somente Membro ou Visualizador.' }, 403)
  }

  // RPC executada com o JWT do chamador valida novamente owner/admin e altera os dados atomicamente.
  const actorClient = createClient(url, publicKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await actorClient.rpc('workspace_update_member', {
    p_workspace_id: workspaceId,
    p_member_user_id: memberUserId,
    p_display_name: displayName,
    p_workspace_role: workspaceRole ?? null,
  })
  if (error) {
    if (error.code === '42501') return json({ error: 'Você não possui permissão para alterar este membro ou cargo.' }, 403)
    if (error.code === 'P0002') return json({ error: 'Membro não encontrado neste workspace.' }, 404)
    if (error.code === '22023') return json({ error: 'Revise os dados do membro.' }, 400)
    console.error('[workspace-update-member] update failed', error.code ?? 'unexpected')
    return json({ error: 'Não foi possível atualizar o membro.' }, 500)
  }
  return json({ member: data })
})
