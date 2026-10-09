import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors })

export function configuredKey(name: string, fallback: string): string | undefined {
  const values = Deno.env.get(name)
  if (values) {
    try {
      const keys = JSON.parse(values) as Record<string, string>
      return keys.default ?? Object.values(keys)[0]
    } catch { return undefined }
  }
  return Deno.env.get(fallback)
}

export type AdminRole = 'superadmin' | 'admin' | 'user'
export interface AdminContext {
  admin: SupabaseClient
  callerId: string
  callerRole: 'superadmin' | 'admin'
  anonKey: string
  url: string
  token: string
}
export async function authorize(req: Request): Promise<AdminContext | Response> {
  const url = Deno.env.get('SUPABASE_URL')
  const secret = configuredKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = configuredKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
  if (!url || !secret || !anonKey) return json({ error: 'Configuração indisponível.' }, 503)
  const header = req.headers.get('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return json({ error: 'Faça login para continuar.' }, 401)
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })
  // getUser consulta Auth; decodificar o JWT localmente não comprova sua validade.
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return json({ error: 'Sessão inválida.' }, 401)
  const { data: profile, error } = await admin.from('profiles').select('app_role,disabled_at').eq('id', user.id).single()
  if (error || !profile || profile.disabled_at || !['superadmin', 'admin'].includes(profile.app_role)) {
    return json({ error: 'Acesso administrativo negado.' }, 403)
  }
  return { admin, callerId: user.id, callerRole: profile.app_role, anonKey, url, token }
}

export function userClient(ctx: AdminContext) {
  return createClient(ctx.url, ctx.anonKey, {
    global: { headers: { Authorization: `Bearer ${ctx.token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function inputObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
