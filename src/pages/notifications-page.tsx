import { PageHeading } from '@/components/common/page-heading'
import { NotificationCenter } from '@/features/notifications/components/notification-center'
export function NotificationsPage() {
  return <div><PageHeading eyebrow="Inbox" title="Notificações" description="Atualizações importantes, em um só lugar." /><div className="min-h-[60vh] overflow-hidden rounded-lg border border-border bg-card"><NotificationCenter showHeader={false} /></div></div>
}
