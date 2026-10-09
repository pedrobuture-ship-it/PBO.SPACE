import { requireSupabase } from '@/services/supabase/client'
import type { Task, TaskPriority } from '@/types/domain'
import type { Updates } from '@/types/database'
export async function createTask(input: { boardId: string; columnId: string; title: string; priority: TaskPriority }): Promise<Task> {
  const { data, error } = await requireSupabase().rpc('create_task', { p_board_id: input.boardId, p_column_id: input.columnId, p_title: input.title, p_priority: input.priority }).single()
  if (error) throw error
  return { ...data, labels: [], assignees: [] }
}
export async function moveTask(input: { taskId: string; columnId: string; beforeId?: string; afterId?: string }) {
  const { data, error } = await requireSupabase().rpc('move_task', { p_task_id: input.taskId, p_column_id: input.columnId, p_before_id: input.beforeId, p_after_id: input.afterId }).single()
  if (error) throw error
  return data
}
export async function updateTask(id: string, values: Pick<Updates<'tasks'>, 'title' | 'description' | 'priority' | 'due_date' | 'start_date' | 'estimated_minutes' | 'archived' | 'completed_at'>) {
  const { data, error } = await requireSupabase().from('tasks').update(values).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteTask(id: string) {
  const { error } = await requireSupabase().from('tasks').delete().eq('id', id)
  if (error) throw error
}
export async function assignTask(taskId: string, userId: string) {
  const { error } = await requireSupabase().from('task_assignees').insert({ task_id: taskId, user_id: userId })
  if (error) throw error
}
export async function unassignTask(taskId: string, userId: string) {
  const { error } = await requireSupabase().from('task_assignees').delete().eq('task_id', taskId).eq('user_id', userId)
  if (error) throw error
}
