import { requireSupabase } from '@/services/supabase/client'
export async function listLabels(boardId: string) {
  const { data, error } = await requireSupabase().from('labels').select('*').eq('board_id', boardId).order('name')
  if (error) throw error
  return data
}
export async function createLabel(boardId: string, name: string, color: string) {
  const { data, error } = await requireSupabase().from('labels').insert({ board_id: boardId, name: name.trim(), color }).select().single()
  if (error) throw error
  return data
}
export async function updateLabel(id: string, values: { name?: string; color?: string }) {
  const { data, error } = await requireSupabase().from('labels').update(values).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteLabel(id: string) {
  const { error } = await requireSupabase().from('labels').delete().eq('id', id)
  if (error) throw error
}
export async function setTaskLabel(taskId: string, labelId: string, selected: boolean) {
  const client = requireSupabase()
  const { error } = selected ? await client.from('task_labels').insert({ task_id: taskId, label_id: labelId }) : await client.from('task_labels').delete().eq('task_id', taskId).eq('label_id', labelId)
  if (error) throw error
}
