import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { listAdminUsers, setAdminUserStatus, type UserFilters } from '../services/admin-service'
export function useAdminUsers(filters: UserFilters) {
  const { session } = useAuth()
  return useQuery({ queryKey: ['admin-users', session?.user.id, filters.search, filters.role, filters.status, filters.page], queryFn: () => listAdminUsers(filters), enabled: Boolean(session), staleTime: 0, refetchOnWindowFocus: true })
}
export function useAdminUserActions() {
  const client = useQueryClient()
  const invalidate = async () => { await Promise.all([client.invalidateQueries({ queryKey: ['admin-users'] }), client.invalidateQueries({ queryKey: ['profile'] })]) }
  const changeStatus = useMutation({ mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) => setAdminUserStatus(id, disabled), onSuccess: invalidate })
  return { changeStatus }
}
