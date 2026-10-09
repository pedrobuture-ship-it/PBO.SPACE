import { useResource } from '@/hooks/use-resource'
import { listActivity } from '../services/activity-service'
export const useActivity = (workspaceId: string, offset = 0) => useResource(['activity', workspaceId, offset], () => listActivity(workspaceId, offset), Boolean(workspaceId))
