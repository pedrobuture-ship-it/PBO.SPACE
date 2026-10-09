import { requireSupabase } from '@/services/supabase/client'
export async function listFavorites() {
  const { data, error } = await requireSupabase().from('favorites').select('*,board:boards(*)').order('created_at', { ascending: false })
  if (error) throw error
  return data
}
export async function setFavorite(boardId: string, selected: boolean) {
  const client = requireSupabase()
  const { error } = selected ? await client.from('favorites').insert({ board_id: boardId }) : await client.from('favorites').delete().eq('board_id', boardId)
  if (error) throw error
}
