import { requireSupabase } from '@/services/supabase/client'
import type { MemberRole } from '@/types/domain'
export type { BoardMember } from '@/types/domain'
export async function listBoardMembers(boardId: string) {
  const { data, error } = await requireSupabase().from('board_members').select('*,profile:profiles(*)').eq('board_id', boardId).order('created_at')
  if (error) throw error
  return data
}
export async function listWorkspaceMembers(workspaceId: string) {
  const { data, error } = await requireSupabase().from('workspace_members').select('*,profile:profiles(*)').eq('workspace_id', workspaceId).order('joined_at')
  if (error) throw error
  return data
}
export async function addBoardMember(boardId: string, userId: string, role: MemberRole = 'member') {
  const { data, error } = await requireSupabase().from('board_members').insert({ board_id: boardId, user_id: userId, role }).select().single()
  if (error) throw error
  return data
}
export async function addWorkspaceMember(workspaceId: string, userId: string, role: Exclude<MemberRole, 'owner'> = 'member') {
  const { data, error } = await requireSupabase().from('workspace_members').insert({ workspace_id: workspaceId, user_id: userId, role }).select().single()
  if (error) throw error
  return data
}
export async function setBoardMemberRole(id: string, role: MemberRole) {
  const { data, error } = await requireSupabase().from('board_members').update({ role }).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function removeBoardMember(id: string) {
  const { error } = await requireSupabase().from('board_members').delete().eq('id', id)
  if (error) throw error
}
export async function removeWorkspaceMember(id: string) {
  const { error } = await requireSupabase().from('workspace_members').delete().eq('id', id)
  if (error) throw error
}
