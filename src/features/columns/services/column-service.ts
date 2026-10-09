import { requireSupabase } from '@/services/supabase/client'
export async function createColumn(boardId: string, name: string, color?: string, wipLimit?: number) {
  const { data, error } = await requireSupabase().rpc('create_column', { p_board_id: boardId, p_name: name.trim(), p_color: color, p_wip_limit: wipLimit }).single()
  if (error) throw error
  return data
}
export async function moveColumn(columnId: string, beforeId?: string, afterId?: string) {
  const { data, error } = await requireSupabase().rpc('move_column', { p_column_id: columnId, p_before_id: beforeId, p_after_id: afterId }).single()
  if (error) throw error
  return data
}
export async function updateColumn(id: string, values: { name?: string; color?: string; wip_limit?: number | null }) {
  const { data, error } = await requireSupabase().from('board_columns').update(values).eq('id', id).select().single()
  if (error) throw error
  return data
}
export const renameColumn = (id: string, name: string) => updateColumn(id, { name: name.trim() })
export async function deleteColumn(id: string) {
  const { error } = await requireSupabase().from('board_columns').delete().eq('id', id)
  if (error) throw error
}
