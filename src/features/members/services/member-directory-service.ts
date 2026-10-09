import { z } from 'zod'
import { requireSupabase } from '@/services/supabase/client'
import type { MemberRole } from '@/types/domain'

const role = z.enum(['owner','admin','member','viewer'])
const member = z.object({ id:z.string().uuid().nullable(), user_id:z.string().uuid(), role, joined_at:z.string().nullable(), display_name:z.string(), username:z.string().nullable(), avatar_url:z.string().nullable(), email:z.string().nullable() })
const boardMember = member.extend({ workspace_role:role, explicit_role:role.nullable() })
const invite = z.object({ id:z.string().uuid(), email:z.string().email(), role, expires_at:z.string(), secret:z.string().regex(/^[0-9a-f]{64}$/) })
const invitePreview = z.object({ status:z.enum(['invalid','expired','revoked','accepted','pending']), workspace_name:z.string().nullable().optional(), email:z.string().optional(), role:role.optional(), expires_at:z.string().optional() })
export type WorkspaceDirectoryMember = z.infer<typeof member>
export type BoardDirectoryMember = z.infer<typeof boardMember>
export type InvitePreview = z.infer<typeof invitePreview>

export async function listWorkspaceDirectory(workspaceId:string) {
  const { data,error }=await requireSupabase().rpc('workspace_member_directory',{ p_workspace_id:workspaceId })
  if (error) throw error
  return z.array(member).parse(data)
}
export async function listBoardDirectory(boardId:string) {
  const { data,error }=await requireSupabase().rpc('board_member_directory',{ p_board_id:boardId })
  if (error) throw error
  return z.array(boardMember).parse(data)
}
export async function listWorkspaceInvitations(workspaceId:string) {
  const { data,error }=await requireSupabase().from('workspace_invitations').select('id,workspace_id,email,role,invited_by,expires_at,accepted_at,revoked_at,created_at').eq('workspace_id',workspaceId).order('created_at',{ ascending:false }).limit(100)
  if (error) throw error
  return data
}
export async function createWorkspaceInvitation(workspaceId:string,email:string,invitationRole:Exclude<MemberRole,'owner'>) {
  const { data,error }=await requireSupabase().rpc('create_workspace_invitation',{ p_workspace_id:workspaceId,p_email:email,p_role:invitationRole })
  if (error) throw error
  return invite.parse(data)
}
export async function revokeWorkspaceInvitation(id:string) {
  const { error }=await requireSupabase().rpc('revoke_workspace_invitation',{ p_invitation_id:id })
  if (error) throw error
}
export async function lookupWorkspaceInvitation(token:string) {
  const { data,error }=await requireSupabase().rpc('lookup_workspace_invitation',{ p_token:token })
  if (error) throw error
  return invitePreview.parse(data)
}
export async function acceptWorkspaceInvitation(token:string) {
  const { data,error }=await requireSupabase().rpc('accept_workspace_invitation',{ p_token:token })
  if (error) throw error
  return data
}
export async function transferBoardOwnership(boardId:string,userId:string) {
  const { error }=await requireSupabase().rpc('transfer_board_ownership',{ p_board_id:boardId,p_new_owner_id:userId })
  if (error) throw error
}
