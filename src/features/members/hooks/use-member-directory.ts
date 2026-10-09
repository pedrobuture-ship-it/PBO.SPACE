import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useResource } from '@/hooks/use-resource'
import { useAuth } from '@/features/auth/auth-context'
import type { MemberRole } from '@/types/domain'
import { setBoardMemberRole } from '../services/member-service'
import { createWorkspaceInvitation, listBoardDirectory, listWorkspaceDirectory, listWorkspaceInvitations, revokeWorkspaceInvitation, transferBoardOwnership, type BoardDirectoryMember, type WorkspaceDirectoryMember } from '../services/member-directory-service'
import { createWorkspaceMember } from '../services/workspace-create-member-service'
import type { WorkspaceMemberValues } from '@/schemas/workspace-member'
import { updateWorkspaceMember, type WorkspaceMemberUpdate } from '../services/workspace-update-member-service'

export const useWorkspaceDirectory = (id:string) => useResource(['workspace-directory',id],() => listWorkspaceDirectory(id),Boolean(id))
export const useBoardDirectory = (id:string) => useResource(['board-directory',id],() => listBoardDirectory(id),Boolean(id))
export const useWorkspaceInvitations = (id:string,enabled=true) => useResource(['workspace-invitations',id],() => listWorkspaceInvitations(id),Boolean(id && enabled))
export function useCreateWorkspaceMember(workspaceId:string) {
  const client=useQueryClient()
  return useMutation({
    mutationFn:(values:WorkspaceMemberValues)=>createWorkspaceMember(workspaceId,values),
    onSuccess:async()=>Promise.all([
      client.invalidateQueries({queryKey:['workspace-directory',workspaceId]}),
      client.invalidateQueries({queryKey:['workspace-members',workspaceId]}),
      client.invalidateQueries({queryKey:['board-directory']}),
      client.invalidateQueries({queryKey:['workspaces']}),
      client.invalidateQueries({queryKey:['boards']}),
      client.invalidateQueries({queryKey:['home-overview']}),
    ]),
  })
}
export function useInvitationMutations(workspaceId:string) {
  const client=useQueryClient()
  const refresh=() => client.invalidateQueries({ queryKey:['workspace-invitations',workspaceId] })
  return {
    create:useMutation({ mutationFn:({ email,role }: { email:string;role:Exclude<MemberRole,'owner'> }) => createWorkspaceInvitation(workspaceId,email,role),onSuccess:refresh }),
    revoke:useMutation({ mutationFn:revokeWorkspaceInvitation,onSuccess:refresh }),
  }
}
export function useWorkspaceRoleMutation(workspaceId:string) {
  const client=useQueryClient(); const { session }=useAuth(); const key=['workspace-directory',workspaceId,session?.user.id]
  return useMutation({ mutationFn:(input:Omit<WorkspaceMemberUpdate,'workspaceId'>) => updateWorkspaceMember({ ...input,workspaceId }),
    onMutate:async ({ memberUserId,role,displayName }) => { await client.cancelQueries({ queryKey:key }); const previous=client.getQueryData<WorkspaceDirectoryMember[]>(key); client.setQueryData<WorkspaceDirectoryMember[]>(key,items => items?.map(item => item.user_id===memberUserId ? { ...item,...(role?{role}:{}),...(displayName!==undefined?{display_name:displayName}:{}) } : item)); return { previous } },
    onError:(_error,_variables,context) => { if (context?.previous) client.setQueryData(key,context.previous) },
    onSettled:async () => { await Promise.all([client.invalidateQueries({ queryKey:key }),client.invalidateQueries({ queryKey:['workspaces'] }),client.invalidateQueries({ queryKey:['board-directory'] })]) },
  })
}
export function useBoardRoleMutation(boardId:string) {
  const client=useQueryClient(); const { session }=useAuth(); const key=['board-directory',boardId,session?.user.id]
  return useMutation({ mutationFn:({ id,role }: { id:string;role:Exclude<MemberRole,'owner'> }) => setBoardMemberRole(id,role),
    onMutate:async ({ id,role }) => { await client.cancelQueries({ queryKey:key }); const previous=client.getQueryData<BoardDirectoryMember[]>(key); client.setQueryData<BoardDirectoryMember[]>(key,items => items?.map(item => item.id===id ? { ...item,role,explicit_role:role } : item)); return { previous } },
    onError:(_error,_variables,context) => { if (context?.previous) client.setQueryData(key,context.previous) },
    onSettled:async () => { await Promise.all([client.invalidateQueries({ queryKey:key }),client.invalidateQueries({ queryKey:['board',boardId] }),client.invalidateQueries({ queryKey:['boards'] })]) },
  })
}
export function useBoardTransfer(boardId:string) {
  const client=useQueryClient()
  return useMutation({ mutationFn:(userId:string) => transferBoardOwnership(boardId,userId),onSuccess:async () => { await Promise.all([client.invalidateQueries({ queryKey:['board-directory',boardId] }),client.invalidateQueries({ queryKey:['board-members',boardId] }),client.invalidateQueries({ queryKey:['board',boardId] }),client.invalidateQueries({ queryKey:['boards'] })]) } })
}
