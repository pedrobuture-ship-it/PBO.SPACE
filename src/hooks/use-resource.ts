import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
// Inclui o usuário em todas as chaves; Zustand guarda somente seleção de UI.
export function useResource<T>(key: readonly unknown[], load: () => Promise<T>, enabled = true) {
  const { session } = useAuth()
  return useQuery({ queryKey: [...key, session?.user.id], queryFn: load, enabled: Boolean(session && enabled) })
}
export function useResourceMutation<TInput, TResult>(mutate: (input: TInput) => Promise<TResult>, keys: readonly (readonly unknown[])[]) {
  const client = useQueryClient()
  return useMutation({ mutationFn: mutate, onSettled: async () => {
    await Promise.all(keys.map(key => client.invalidateQueries({ queryKey: key })))
  } })
}
