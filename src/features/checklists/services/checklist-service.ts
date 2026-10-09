import { requireSupabase } from '@/services/supabase/client'
import type { Updates } from '@/types/database'
export async function listChecklists(taskId: string) {
  const { data, error } = await requireSupabase().from('checklists').select('*,items:checklist_items(*)').eq('task_id', taskId).order('position').order('id')
  if (error) throw error
  return data.map(checklist => ({ ...checklist, items: checklist.items.sort((a,b) => a.position - b.position || a.id.localeCompare(b.id)) }))
}
export async function createChecklist(taskId: string, title: string, position = 1024) {
  const last = await requireSupabase().from('checklists').select('position').eq('task_id', taskId).order('position', { ascending: false }).limit(1)
  if (last.error) throw last.error
  position = (last.data[0]?.position ?? 0) + 1024
  const { data, error } = await requireSupabase().from('checklists').insert({ task_id: taskId, title: title.trim(), position }).select().single()
  if (error) throw error
  return data
}
export async function createChecklistItem(checklistId: string, content: string, position = 1024) {
  const last = await requireSupabase().from('checklist_items').select('position').eq('checklist_id', checklistId).order('position', { ascending: false }).limit(1)
  if (last.error) throw last.error
  position = (last.data[0]?.position ?? 0) + 1024
  const { data, error } = await requireSupabase().from('checklist_items').insert({ checklist_id: checklistId, content: content.trim(), position }).select().single()
  if (error) throw error
  return data
}
export async function updateChecklist(id: string, values: { title?: string; position?: number }) {
  const { data, error } = await requireSupabase().from('checklists').update(values).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function updateChecklistItem(id: string, values: Pick<Updates<'checklist_items'>, 'content' | 'completed' | 'position' | 'assigned_to' | 'due_date'>) {
  const { data, error } = await requireSupabase().from('checklist_items').update(values).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteChecklist(id: string) {
  const { error } = await requireSupabase().from('checklists').delete().eq('id', id)
  if (error) throw error
}
export async function deleteChecklistItem(id: string) {
  const { error } = await requireSupabase().from('checklist_items').delete().eq('id', id)
  if (error) throw error
}
