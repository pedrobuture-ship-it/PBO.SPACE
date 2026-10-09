import { useEffect } from 'react'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { getNotification, type NotificationItem } from '@/features/notifications/services/notification-service'
import { notificationKeys } from '@/features/notifications/hooks/use-notifications'
import { supabase } from '@/services/supabase/client'

// O broadcast transporta apenas IDs; a leitura do item passa novamente pela RLS.
export function usePrivateRealtime(topic: string | undefined, enabled = true) {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const accessToken = session?.access_token
  const userId = session?.user.id
  useEffect(() => {
    const client = supabase
    if (!client || !accessToken || !topic || !userId || !enabled) return
    let disposed = false
    const refreshNotifications = () => {
      if (disposed) return
      void queryClient.invalidateQueries({ queryKey: notificationKeys.feed(userId) })
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unread(userId) })
    }
    const channel = client.channel(topic, { config: { private: true } }).on('broadcast', { event: 'data-change' }, ({ payload }) => {
      if (disposed) return
      if (payload?.table === 'notifications') {
        if (payload.operation === 'INSERT' && typeof payload.id === 'string') {
          void getNotification(payload.id).then(item => {
            if (!item || disposed) return
            queryClient.setQueryData<InfiniteData<NotificationItem[], number>>(notificationKeys.feed(userId), current => {
              if (!current?.pages.length || current.pages.some(page => page.some(entry => entry.id === item.id))) return current
              return { ...current, pages: [[item, ...current.pages[0]], ...current.pages.slice(1)] }
            })
            void queryClient.invalidateQueries({ queryKey: notificationKeys.unread(userId) })
          }).catch(() => { if (!disposed) refreshNotifications() })
        } else refreshNotifications()
        return
      }
      // Alterações de participação podem tornar boards e notificações inacessíveis.
      void queryClient.resetQueries({ queryKey: notificationKeys.feed(userId) })
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unread(userId) })
      void queryClient.invalidateQueries({ predicate: query => [
        'workspaces', 'boards', 'board', 'board-task-badges', 'board-directory',
        'workspace-directory', 'home-overview', 'dashboard',
      ].includes(String(query.queryKey[0])) })
    })
    void client.realtime.setAuth(accessToken).then(() => { if (!disposed) channel.subscribe(status => { if (status === 'SUBSCRIBED') refreshNotifications() }) }).catch(refreshNotifications)
    return () => { disposed = true; void client.removeChannel(channel) }
  }, [accessToken, topic, userId, enabled, queryClient])
}
