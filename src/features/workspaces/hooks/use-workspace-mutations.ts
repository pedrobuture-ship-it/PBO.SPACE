import { useResourceMutation } from '@/hooks/use-resource'
import { createWorkspace, deleteWorkspace, transferWorkspaceOwnership, updateWorkspace } from '../services/workspace-service'
export function useWorkspaceMutations() {
  const keys = [['workspaces'], ['workspace-members'], ['boards'], ['board'], ['dashboard']] as const
  const create = useResourceMutation(({ name, description }: { name: string; description?: string }) => createWorkspace(name, description), keys)
  const update = useResourceMutation(({ id, name, description }: { id: string; name?: string; description?: string | null }) => updateWorkspace(id, { name, description }), keys)
  const remove = useResourceMutation(deleteWorkspace, keys)
  const transfer = useResourceMutation(({ id, userId }: { id: string; userId: string }) => transferWorkspaceOwnership(id, userId), keys)
  return { create, update, remove, transfer }
}
