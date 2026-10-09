import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { configuredKey, cors, inputObject, json } from '../_shared/admin.ts'
import { addWorkspaceMember, MemberCreationError, validateWorkspaceMemberInput } from '../_shared/workspace-member-logic.mjs'

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'
type MemberDeps = {
  getWorkspaceRole: (workspaceId: string, callerId: string) => Promise<WorkspaceRole | null>
  findAuthUser: (email: string) => Promise<string | null>
  hasMembership: (workspaceId: string, userId: string) => Promise<boolean>
  createAuthUser: (input: { email: string; password: string; displayName: string; emailConfirmed: boolean }) => Promise<{ id: string }>
  ensureProfile: (userId: string, displayName: string, isNewUser: boolean) => Promise<void>
  addMembership: (workspaceId: string, userId: string, role: Exclude<WorkspaceRole, 'owner'>) => Promise<{ display_name: string | null; email: string; role: string; joined_at: string }>
  rollbackCreatedUser: (userId: string, startedAt: string) => Promise<boolean>
}

Deno.serve(async req => {
  if (req.method==='OPTIONS') return new Response(null,{status:204,headers:cors})
  if (req.method!=='POST') return json({error:'Método não permitido.'},405)

  const url=Deno.env.get('SUPABASE_URL')
  const secret=configuredKey('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY')
  if (!url||!secret) return json({error:'Serviço temporariamente indisponível.'},503)
  const authorization=req.headers.get('Authorization')
  const token=authorization?.startsWith('Bearer ')?authorization.slice(7):''
  if (!token) return json({error:'Faça login para adicionar um membro.'},401)

  const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}})
  const {data:{user},error:authError}=await admin.auth.getUser(token)
  if (authError||!user) return json({error:'Sua sessão expirou. Entre novamente.'},401)

  let input: { workspaceId: string; displayName: string; email: string; password: string; workspaceRole: Exclude<WorkspaceRole, 'owner'> }
  try { input=validateWorkspaceMemberInput(inputObject(await req.json().catch(()=>null))) }
  catch(error) {
    if (error instanceof MemberCreationError) return json({error:error.message,code:error.code},error.status)
    return json({error:'Dados inválidos.'},400)
  }

  const {data:profile,error:profileError}=await admin.from('profiles').select('disabled_at').eq('id',user.id).maybeSingle()
  if (profileError||!profile||profile.disabled_at) return json({error:'Sua conta não pode executar esta ação.'},403)

  const deps: MemberDeps={
    async getWorkspaceRole(workspaceId,callerId) {
      const [workspaceResult,membershipResult]=await Promise.all([
        admin.from('workspaces').select('owner_id').eq('id',workspaceId).maybeSingle(),
        admin.from('workspace_members').select('role').eq('workspace_id',workspaceId).eq('user_id',callerId).maybeSingle(),
      ])
      if (workspaceResult.error||membershipResult.error||!workspaceResult.data) return null
      if (workspaceResult.data.owner_id===callerId) return 'owner'
      return membershipResult.data?.role??null
    },
    async findAuthUser(email) {
      const {data,error}=await admin.rpc('workspace_find_auth_user_by_email',{p_email:email})
      if (error) throw error
      return data
    },
    async hasMembership(workspaceId,userId) {
      const {data,error}=await admin.from('workspace_members').select('id').eq('workspace_id',workspaceId).eq('user_id',userId).maybeSingle()
      if (error) throw error
      return Boolean(data)
    },
    async createAuthUser({email,password,displayName,emailConfirmed}) {
      const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:emailConfirmed,user_metadata:{display_name:displayName}})
      if (error||!data.user) throw error??new Error('Auth user creation failed')
      return {id:data.user.id}
    },
    async ensureProfile(userId,displayName,isNewUser) {
      const {data:existing,error:lookupError}=await admin.from('profiles').select('id,display_name,app_role').eq('id',userId).maybeSingle()
      if (lookupError) throw lookupError
      if (!existing) {
        const {error}=await admin.from('profiles').insert({id:userId,display_name:displayName,app_role:'user'})
        if (error) throw error
        return
      }
      // Só a conta criada nesta operação recebe valores iniciais; conta preexistente não muda de perfil/cargo.
      if (isNewUser&&(existing.app_role!=='user'||existing.display_name!==displayName)) {
        const {error}=await admin.from('profiles').update({display_name:displayName,app_role:'user'}).eq('id',userId)
        if (error) throw error
      }
    },
    async addMembership(workspaceId,userId,role) {
      const {data:memberProfile,error:memberProfileError}=await admin.from('profiles').select('display_name').eq('id',userId).single()
      if (memberProfileError) throw memberProfileError
      const {data,error}=await admin.from('workspace_members').insert({workspace_id:workspaceId,user_id:userId,role}).select('joined_at').single()
      if (error) throw error
      return {display_name:memberProfile.display_name,email:input.email,role,joined_at:data.joined_at}
    },
    async rollbackCreatedUser(userId,startedAt) {
      const [memberships,workspaces]=await Promise.all([
        admin.from('workspace_members').select('workspace_id,role').eq('user_id',userId),
        admin.from('workspaces').select('id').eq('owner_id',userId).gte('created_at',startedAt),
      ])
      if (memberships.error||workspaces.error) return false
      const freshWorkspaceIds=new Set(workspaces.data.map(item=>item.id))
      if (memberships.data.some(item=>item.role!=='owner'||!freshWorkspaceIds.has(item.workspace_id))) return false
      for (const workspaceId of freshWorkspaceIds) {
        const {count,error}=await admin.from('boards').select('id',{count:'exact',head:true}).eq('workspace_id',workspaceId)
        if (error||count) return false
      }
      for (const workspaceId of freshWorkspaceIds) {
        const {error}=await admin.from('workspaces').delete().eq('id',workspaceId)
        if (error) return false
      }
      const {error}=await admin.auth.admin.deleteUser(userId)
      return !error
    },
  }

  try {
    const { data: permitted, error: quotaError } = await admin.rpc('consume_admin_action_quota', {
      p_actor_id: user.id, p_action: 'workspace-create-member', p_limit: 20, p_window_seconds: 3600,
    })
    if (quotaError) return json({error:'Serviço temporariamente indisponível.'},503)
    if (!permitted) return json({error:'Limite de criação de membros atingido. Tente novamente mais tarde.'},429)
    const result=await addWorkspaceMember(input,user.id,deps)
    return json(result,result.status==='already_member'?200:201)
  } catch(error) {
    if (error instanceof MemberCreationError) return json({error:error.message,code:error.code},error.status)
    // Nunca registre corpo, email, senha, Auth user ou token.
    const errorCode = typeof error === 'object' && error !== null && 'code' in error ? error.code : 'unexpected'
    console.error('[workspace-create-member] operation failed',errorCode)
    return json({error:'Não foi possível adicionar o membro.'},500)
  }
})
