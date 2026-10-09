import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { useResource, useResourceMutation } from '@/hooks/use-resource'
import type { MemberRole } from '@/types/domain'
import { addBoardMember, addWorkspaceMember, listBoardMembers, listWorkspaceMembers, removeBoardMember, removeWorkspaceMember, setBoardMemberRole } from '../services/member-service'
export const useBoardMembers = (id: string) => useResource(['board-members', id], () => listBoardMembers(id), Boolean(id))
export const useWorkspaceMembers = (id: string) => useResource(['workspace-members', id], () => listWorkspaceMembers(id), Boolean(id))
export function useBoardMemberMutations(boardId: string) {
  const keys = [['board-members', boardId], ['board-directory', boardId], ['board', boardId], ['boards'], ['home-overview']] as const
  const add = useResourceMutation(({ userId, role }: { userId: string; role: MemberRole }) => addBoardMember(boardId, userId, role), keys)
  const update = useResourceMutation(({ id, role }: { id: string; role: MemberRole }) => setBoardMemberRole(id, role), keys)
  const remove = useResourceMutation(removeBoardMember, keys)
  return { add, update, remove }
}
export function useWorkspaceMemberMutations(workspaceId: string) {
  const client = useQueryClient()
  const { session } = useAuth()
  const keys = [['workspace-members', workspaceId], ['workspace-directory', workspaceId], ['board-directory'], ['workspaces'], ['boards'], ['board'], ['home-overview']] as const
  const add = useResourceMutation(({ userId, role }: { userId: string; role: Exclude<MemberRole, 'owner'> }) => addWorkspaceMember(workspaceId, userId, role), keys)
  const directoryKey = ['workspace-directory', workspaceId, session?.user.id] as const
  const membersKey = ['workspace-members', workspaceId, session?.user.id] as const
  const remove = useMutation({
    mutationFn: removeWorkspaceMember,
    onMutate: async id => {
      await Promise.all([client.cancelQueries({ queryKey: directoryKey }), client.cancelQueries({ queryKey: membersKey })])
      const previousDirectory = client.getQueryData<{ id: string | null }[]>(directoryKey)
      const previousMembers = client.getQueryData<{ id: string }[]>(membersKey)
      client.setQueryData(directoryKey, (items: typeof previousDirectory) => items?.filter(item => item.id !== id))
      client.setQueryData(membersKey, (items: typeof previousMembers) => items?.filter(item => item.id !== id))
      return { previousDirectory, previousMembers }
    },
    onError: (_error, _id, context) => {
      if (context?.previousDirectory) client.setQueryData(directoryKey, context.previousDirectory)
      if (context?.previousMembers) client.setQueryData(membersKey, context.previousMembers)
    },
    onSettled: async () => Promise.all(keys.map(key => client.invalidateQueries({ queryKey: key }))),
  })
  return { add, remove }
}
