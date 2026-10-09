import { useResource, useResourceMutation } from '@/hooks/use-resource'
import { createLabel, deleteLabel, listLabels, setTaskLabel, updateLabel } from '../services/label-service'
export const useLabels = (id: string) => useResource(['labels', id], () => listLabels(id), Boolean(id))
export function useLabelMutations(boardId: string) {
  const keys = [['labels', boardId], ['board', boardId]] as const
  const create = useResourceMutation(({ name, color }: { name: string; color: string }) => createLabel(boardId, name, color), keys)
  const update = useResourceMutation(({ id, name, color }: { id: string; name?: string; color?: string }) => updateLabel(id, { name, color }), keys)
  const remove = useResourceMutation(deleteLabel, keys)
  const toggle = useResourceMutation(({ taskId, labelId, selected }: { taskId: string; labelId: string; selected: boolean }) => setTaskLabel(taskId, labelId, selected), keys)
  return { create, update, remove, toggle }
}
