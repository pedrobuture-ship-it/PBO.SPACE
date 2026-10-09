import { useResource, useResourceMutation } from '@/hooks/use-resource'
import { createSubtask, listSubtaskLinks, listTaskActivity, unlinkSubtask } from '../services/task-detail-service'

export const useSubtasks = (taskId: string) => useResource(['subtasks', taskId], () => listSubtaskLinks(taskId), Boolean(taskId))
export const useTaskActivity = (taskId: string) => useResource(['activity', taskId], () => listTaskActivity(taskId), Boolean(taskId))
export function useSubtaskMutations(boardId: string, taskId: string) {
  const keys = [['subtasks', taskId], ['board', boardId], ['board-task-badges', boardId]] as const
  return {
    create: useResourceMutation((title: string) => createSubtask(taskId, title), keys),
    unlink: useResourceMutation(unlinkSubtask, keys),
  }
}
