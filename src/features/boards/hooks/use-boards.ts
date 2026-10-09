import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useResourceMutation } from '@/hooks/use-resource'
import { useAuth } from '@/features/auth/auth-context'
import { useActiveWorkspace } from '@/features/workspaces/hooks/use-workspaces'
import { createBoard, getBoard, listBoards, updateBoard, deleteBoard } from '../services/board-service'
import type { BoardValues } from '@/schemas/board'
export function useBoards(enabled = true) {
  const { session } = useAuth()
  const { workspace, error: workspaceError, isLoading: workspaceLoading } = useActiveWorkspace()
  const query = useQuery({ queryKey: ['boards', session?.user.id, workspace?.id], queryFn: () => listBoards(workspace!.id), enabled: Boolean(session && workspace && enabled) })
  return { ...query, error: workspaceError ?? query.error, isLoading: workspaceLoading || query.isLoading }
}
export function useBoard(id: string) {
  const { session } = useAuth()
  return useQuery({ queryKey: ['board', id, session?.user.id], queryFn: () => getBoard(id, session!.user.id), enabled: Boolean(id && session) })
}
export function useCreateBoard() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: ({ values, workspaceId }: { values: BoardValues; workspaceId: string }) => createBoard(values, workspaceId),
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['boards'] }), queryClient.invalidateQueries({ queryKey: ['home-overview'] })]) } })
}

export function useBoardMutations(boardId: string) {
  const keys = [['boards'], ['board', boardId], ['dashboard'], ['favorites'], ['home-overview']] as const
  const update = useResourceMutation((values: Parameters<typeof updateBoard>[1]) => updateBoard(boardId, values), keys)
  const remove = useResourceMutation(() => deleteBoard(boardId), keys)
  return { update, remove }
}
