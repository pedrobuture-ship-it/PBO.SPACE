import { z } from 'zod'
import { requireSupabase } from '@/services/supabase/client'
import type { MemberRole } from '@/types/domain'

const resultSchema = z.object({ member: z.object({ user_id: z.string().uuid(), display_name: z.string(), role: z.enum(['owner','admin','member','viewer']), changed: z.boolean() }) })
export type WorkspaceMemberUpdate = { workspaceId: string; memberUserId: string; displayName?: string; role?: Exclude<MemberRole,'owner'> }

export async function updateWorkspaceMember(input: WorkspaceMemberUpdate) {
  const { data, error } = await requireSupabase().functions.invoke('workspace-update-member', { body: {
    workspace_id: input.workspaceId,
    member_user_id: input.memberUserId,
    ...(input.displayName !== undefined ? { display_name: input.displayName } : {}),
    ...(input.role !== undefined ? { workspace_role: input.role } : {}),
  } })
  if (error) {
    const response = 'context' in error && error.context instanceof Response ? error.context : null
    const payload = await response?.json().catch(() => null) as { error?: string } | null
    throw new Error(payload?.error || 'Não foi possível atualizar o membro.')
  }
  const parsed = resultSchema.safeParse(data)
  if (!parsed.success) {
    if (import.meta.env.DEV) console.error('[Members] invalid workspace-update-member response', parsed.error.issues)
    throw new Error('Não foi possível confirmar a atualização do membro.')
  }
  return parsed.data.member
}
