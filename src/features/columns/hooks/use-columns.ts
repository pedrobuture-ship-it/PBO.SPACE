import { useResourceMutation } from '@/hooks/use-resource'
import { createColumn, deleteColumn, moveColumn, updateColumn } from '../services/column-service'
export function useColumnMutations(boardId: string) {
  const keys = [['board', boardId], ['dashboard'], ['home-overview']] as const
  const create = useResourceMutation(({ name, color, wipLimit }: { name: string; color?: string; wipLimit?: number }) => createColumn(boardId, name, color, wipLimit), keys)
  const move = useResourceMutation(({ id, beforeId, afterId }: { id: string; beforeId?: string; afterId?: string }) => moveColumn(id, beforeId, afterId), keys)
  const update = useResourceMutation(({ id, name, color, wip_limit }: { id: string; name?: string; color?: string; wip_limit?: number | null }) => updateColumn(id, { name, color, wip_limit }), keys)
  const remove = useResourceMutation(deleteColumn, keys)
  return { create, move, update, remove }
}
