import { z } from 'zod'
import { requireSupabase } from '@/services/supabase/client'
import type { WorkspaceMemberValues } from '@/schemas/workspace-member'

const resultSchema=z.object({
  status:z.enum(['created','existing_added','already_member']),
  message:z.string(),
  member:z.object({display_name:z.string(),email:z.string().email(),role:z.enum(['admin','member','viewer']),joined_at:z.string()}).optional(),
})

export type CreateWorkspaceMemberResult=z.infer<typeof resultSchema>

export async function createWorkspaceMember(workspaceId:string,values:WorkspaceMemberValues):Promise<CreateWorkspaceMemberResult> {
  const {confirm_password:_,...member}=values
  const {data,error}=await requireSupabase().functions.invoke('workspace-create-member',{body:{
    workspace_id:workspaceId,
    display_name:member.display_name,
    email:member.email,
    password:member.password,
    workspace_role:member.workspace_role,
  }})
  if (error) {
    const response='context' in error&&error.context instanceof Response?error.context:null
    const payload=await response?.json().catch(()=>null) as {error?:string;code?:string}|null
    if (payload?.error) throw new Error(payload.error)
    if (error.name==='FunctionsFetchError') throw new Error('Não foi possível conectar ao serviço de membros.')
    throw new Error('Não foi possível adicionar o membro.')
  }
  const parsed=resultSchema.safeParse(data)
  if (!parsed.success) {
    if (import.meta.env.DEV) console.error('[Members] invalid workspace-create-member response',parsed.error.issues)
    throw new Error('Não foi possível confirmar a inclusão do membro. Atualize a lista antes de tentar novamente.')
  }
  return parsed.data
}
