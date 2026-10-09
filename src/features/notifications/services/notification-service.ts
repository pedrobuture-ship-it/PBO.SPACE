import { requireSupabase } from '@/services/supabase/client'
import type { WorkspaceNotification } from '@/types/domain'

export const NOTIFICATION_PAGE_SIZE = 25
export type NotificationItem = WorkspaceNotification & {
  actor: { display_name: string | null; avatar_url: string | null } | null
  board: { name: string } | null
  task: { title: string } | null
}
const selection = '*,actor:profiles!notifications_actor_id_fkey(display_name,avatar_url),board:boards!notifications_board_id_fkey(name),task:tasks!notifications_task_id_fkey(title)'

export async function listNotifications(page: number): Promise<NotificationItem[]> {
  const start = page * NOTIFICATION_PAGE_SIZE
  const { data, error } = await requireSupabase().from('notifications').select(selection)
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(start, start + NOTIFICATION_PAGE_SIZE - 1)
  if (error) throw error
  return data as NotificationItem[]
}
export async function getNotification(id: string): Promise<NotificationItem | null> {
  const { data, error } = await requireSupabase().from('notifications').select(selection).eq('id', id).maybeSingle()
  if (error) throw error
  return data as NotificationItem | null
}
export async function countUnreadNotifications(): Promise<number> {
  const { count, error } = await requireSupabase().from('notifications').select('id', { count: 'exact', head: true }).eq('read', false)
  if (error) throw error
  return count ?? 0
}
export async function markNotificationRead(id: string) {
  const { error } = await requireSupabase().from('notifications').update({ read: true }).eq('id', id)
  if (error) throw error
}
export async function markAllNotificationsRead() {
  const { error } = await requireSupabase().from('notifications').update({ read: true }).eq('read', false)
  if (error) throw error
}
export async function deleteNotification(id: string) {
  const { error } = await requireSupabase().from('notifications').delete().eq('id', id)
  if (error) throw error
}
export async function clearReadNotifications() {
  const { error } = await requireSupabase().from('notifications').delete().eq('read', true)
  if (error) throw error
}
