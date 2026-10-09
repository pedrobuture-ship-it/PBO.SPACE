import { useResource, useResourceMutation } from '@/hooks/use-resource'
import { createChecklist, createChecklistItem, deleteChecklist, deleteChecklistItem, listChecklists, updateChecklist, updateChecklistItem } from '../services/checklist-service'
import type { Updates } from '@/types/database'
export const useChecklists = (id: string) => useResource(['checklists', id], () => listChecklists(id), Boolean(id))
export function useChecklistMutations(taskId: string) {
  const keys = [['checklists', taskId], ['board-task-badges']] as const
  const create = useResourceMutation((title: string) => createChecklist(taskId, title), keys)
  const addItem = useResourceMutation(({ checklistId, content }: { checklistId: string; content: string }) => createChecklistItem(checklistId, content), keys)
  const updateItem = useResourceMutation(({ id, values }: { id: string; values: Pick<Updates<'checklist_items'>, 'content' | 'completed' | 'position' | 'assigned_to' | 'due_date'> }) => updateChecklistItem(id, values), keys)
  const update = useResourceMutation(({ id, values }: { id: string; values: { title?: string; position?: number } }) => updateChecklist(id, values), keys)
  const remove = useResourceMutation(deleteChecklist, keys)
  const removeItem = useResourceMutation(deleteChecklistItem, keys)
  return { create, addItem, updateItem, update, remove, removeItem }
}
