import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { useUiStore } from '@/stores/ui-store'
import { listWorkspaces } from '../services/workspace-service'
export function useWorkspaces() {
  const { session } = useAuth()
  return useQuery({ queryKey: ['workspaces', session?.user.id], queryFn: () => listWorkspaces(session!.user.id), enabled: Boolean(session) })
}
export function useActiveWorkspace() {
  const query = useWorkspaces()
  const selectedId = useUiStore(state => state.activeWorkspaceId)
  return { ...query, workspace: query.data?.find(item => item.id === selectedId) ?? query.data?.[0] }
}
