import { requireSupabase } from '@/services/supabase/client'
export type { TaskComment } from '@/types/domain'
export async function listComments(taskId: string) {
  const { data, error } = await requireSupabase().from('comments').select('*,comment_mentions(user_id)').eq('task_id', taskId).order('created_at')
  if (error) throw error
  return data
}
export async function addComment(taskId: string, content: string, mentionIds: string[] = []) {
  const { data, error } = await requireSupabase().rpc('create_comment_with_mentions', { p_task_id: taskId, p_content: content, p_mentions: [...new Set(mentionIds)] })
  if (error) throw error
  return data
}
export async function updateComment(id: string, content: string, mentionIds: string[] = []) {
  const { data, error } = await requireSupabase().rpc('update_comment_with_mentions', { p_comment_id: id, p_content: content, p_mentions: [...new Set(mentionIds)] })
  if (error) throw error
  return data
}
export async function deleteComment(id: string) {
  const { error } = await requireSupabase().from('comments').delete().eq('id', id)
  if (error) throw error
}
