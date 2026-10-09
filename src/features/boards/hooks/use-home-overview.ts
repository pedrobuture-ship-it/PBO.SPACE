import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/auth-context'
import { getHomeBoards, getHomeMetrics, type HomeBoard } from '../services/home-service'
import { setFavorite } from '@/features/favorites/services/favorite-service'

export const homeKey = (userId: string | undefined, workspaceId: string | undefined, section: 'boards' | 'metrics') => ['home-overview', userId, workspaceId, section] as const

export function useHomeBoards(workspaceId: string | undefined, enabled = true) {
  const { session } = useAuth()
  return useQuery({ queryKey: homeKey(session?.user.id, workspaceId, 'boards'), queryFn: () => getHomeBoards(workspaceId!), enabled: Boolean(session && workspaceId && enabled), staleTime: 30_000 })
}
export function useHomeMetrics(workspaceId: string | undefined, enabled = true) {
  const { session } = useAuth()
  return useQuery({ queryKey: homeKey(session?.user.id, workspaceId, 'metrics'), queryFn: () => getHomeMetrics(workspaceId!), enabled: Boolean(session && workspaceId && enabled), staleTime: 30_000 })
}
export function useHomeFavorite(workspaceId: string | undefined) {
  const { session } = useAuth()
  const client = useQueryClient()
  const key = homeKey(session?.user.id, workspaceId, 'boards')
  return useMutation({
    mutationFn: ({ boardId, selected }: { boardId: string; selected: boolean }) => setFavorite(boardId, selected),
    onMutate: async ({ boardId, selected }) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<HomeBoard[]>(key)
      client.setQueryData<HomeBoard[]>(key, old => old?.map(board => board.id === boardId ? { ...board, favorite: selected } : board))
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(key, context.previous)
      toast.error('Não foi possível atualizar o favorito. Tente novamente.')
    },
    onSettled: async () => { await client.invalidateQueries({ queryKey: key }); await client.invalidateQueries({ queryKey: ['favorites'] }) },
  })
}
