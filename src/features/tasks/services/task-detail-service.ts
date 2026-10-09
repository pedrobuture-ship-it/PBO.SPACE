import { requireSupabase } from '@/services/supabase/client'

export async function listSubtaskLinks(taskId: string) {
  const { data, error } = await requireSupabase().from('task_subtasks').select('*').or(`parent_task_id.eq.${taskId},child_task_id.eq.${taskId}`).order('position')
  if (error) throw error
  return data
}

export async function createSubtask(parentTaskId: string, title: string) {
  const { data, error } = await requireSupabase().rpc('create_subtask', { p_parent_task_id: parentTaskId, p_title: title }).single()
  if (error) throw error
  return data
}

export async function unlinkSubtask(childTaskId: string) {
  const { error } = await requireSupabase().from('task_subtasks').delete().eq('child_task_id', childTaskId)
  if (error) throw error
}

export async function listTaskActivity(taskId: string) {
  const { data, error } = await requireSupabase().from('activity_logs').select('*').eq('task_id', taskId).order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return data
}
