import { requireSupabase } from '@/services/supabase/client'
import type { WorkspaceWithRole } from '@/types/domain'
export async function listWorkspaces(userId: string): Promise<WorkspaceWithRole[]> {
  const client = requireSupabase()
  const [workspacesResult, membershipsResult] = await Promise.allSettled([
    client.from('workspaces').select('*').order('created_at'),
    client.from('workspace_members').select('workspace_id,role').eq('user_id', userId),
  ])
  if (import.meta.env.DEV) {
    if (workspacesResult.status === 'rejected') console.error('[Home] failed loading workspaces:', workspacesResult.reason)
    if (membershipsResult.status === 'rejected') console.error('[Home] failed loading workspace memberships:', membershipsResult.reason)
  }
  if (workspacesResult.status === 'rejected' || membershipsResult.status === 'rejected') throw new Error('Não foi possível carregar seus workspaces.')
  const workspaces = workspacesResult.value
  const memberships = membershipsResult.value
  if (workspaces.error) {
    if (import.meta.env.DEV) console.error('[Home] failed loading workspaces:', workspaces.error)
    throw new Error('Não foi possível carregar seus workspaces.')
  }
  if (memberships.error) {
    if (import.meta.env.DEV) console.error('[Home] failed loading workspace memberships:', memberships.error)
    throw new Error('Não foi possível carregar seus workspaces.')
  }
  return workspaces.data.flatMap(workspace => {
    const membership = memberships.data.find(member => member.workspace_id === workspace.id)
    return membership ? [{ ...workspace, access_role: membership.role }] : []
  })
}
export async function createWorkspace(name: string, description?: string) {
  const { data, error } = await requireSupabase().from('workspaces').insert({ name: name.trim(), description: description || null }).select().single()
  if (error) throw error
  return data
}
export async function updateWorkspace(id: string, values: { name?: string; description?: string | null }) {
  const { data, error } = await requireSupabase().from('workspaces').update(values).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteWorkspace(id: string) {
  const { error } = await requireSupabase().from('workspaces').delete().eq('id', id)
  if (error) throw error
}
export async function transferWorkspaceOwnership(workspaceId: string, userId: string) {
  const { error } = await requireSupabase().rpc('transfer_workspace_ownership', { p_workspace_id: workspaceId, p_new_owner_id: userId })
  if (error) throw error
}
