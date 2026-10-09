import { requireSupabase } from '@/services/supabase/client'
export async function listActivity(workspaceId: string, offset = 0) {
  const { data, error } = await requireSupabase().from('activity_logs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).order('id').range(offset, offset + 49)
  if (error) throw error
  return data
}
