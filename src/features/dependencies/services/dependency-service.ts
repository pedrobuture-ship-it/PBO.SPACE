import { requireSupabase } from '@/services/supabase/client'
export async function listDependencies(taskId: string) {
  const { data, error } = await requireSupabase().from('task_dependencies').select('*').or(`task_id.eq.${taskId},depends_on_task_id.eq.${taskId}`)
  if (error) throw error
  return data
}
export async function addDependency(taskId: string, dependsOnTaskId: string) {
  const { data, error } = await requireSupabase().from('task_dependencies').insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId }).select().single()
  if (error) throw error
  return data
}
export async function removeDependency(id: string) {
  const { error } = await requireSupabase().from('task_dependencies').delete().eq('id', id)
  if (error) throw error
}
