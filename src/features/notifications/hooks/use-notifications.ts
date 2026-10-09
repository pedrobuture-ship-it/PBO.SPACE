import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { countUnreadNotifications, clearReadNotifications, deleteNotification, listNotifications, markAllNotificationsRead, markNotificationRead, NOTIFICATION_PAGE_SIZE } from '../services/notification-service'

export const notificationKeys = {
  feed: (userId?: string) => ['notifications-feed', userId] as const,
  unread: (userId?: string) => ['notifications-unread', userId] as const,
}
export function useUnreadNotifications() {
  const { session } = useAuth()
  return useQuery({ queryKey: notificationKeys.unread(session?.user.id), queryFn: countUnreadNotifications, enabled: Boolean(session), staleTime: 15_000 })
}
export function useNotifications() {
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()
  const feed = useInfiniteQuery({
    queryKey: notificationKeys.feed(userId),
    queryFn: ({ pageParam }) => listNotifications(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => lastPage.length === NOTIFICATION_PAGE_SIZE ? pages.length : undefined,
    enabled: Boolean(userId),
  })
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationKeys.feed(userId) }),
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread(userId) }),
    ])
  }
  return {
    ...feed,
    markRead: useMutation({ mutationFn: markNotificationRead, onSuccess: refresh }),
    markAllRead: useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh }),
    remove: useMutation({ mutationFn: deleteNotification, onSuccess: refresh }),
    clearRead: useMutation({ mutationFn: clearReadNotifications, onSuccess: refresh }),
  }
}
