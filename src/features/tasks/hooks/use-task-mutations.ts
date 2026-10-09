import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useResourceMutation } from '@/hooks/use-resource'
import { createTask, moveTask, updateTask, deleteTask, assignTask, unassignTask } from '../services/task-service'

export function useCreateTask(boardId: string) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: createTask, onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['board', boardId] }), queryClient.invalidateQueries({ queryKey: ['board-task-badges', boardId] }), queryClient.invalidateQueries({ queryKey: ['dashboard'] }), queryClient.invalidateQueries({ queryKey: ['home-overview'] })]) } })
}

export function useMoveTask(boardId: string) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: moveTask, onSettled: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['board', boardId] }), queryClient.invalidateQueries({ queryKey: ['home-overview'] })]) } })
}

export function useTaskMutations(boardId: string) {
  const keys = [['board', boardId], ['dashboard'], ['home-overview']] as const
  const update = useResourceMutation(({ id, values }: { id: string; values: Parameters<typeof updateTask>[1] }) => updateTask(id, values), keys)
  const remove = useResourceMutation(deleteTask, keys)
  const assign = useResourceMutation(({ taskId, userId }: { taskId: string; userId: string }) => assignTask(taskId, userId), keys)
  const unassign = useResourceMutation(({ taskId, userId }: { taskId: string; userId: string }) => unassignTask(taskId, userId), keys)
  return { update, remove, assign, unassign }
}
