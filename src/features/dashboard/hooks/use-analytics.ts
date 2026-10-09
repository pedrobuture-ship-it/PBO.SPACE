import { useQuery } from '@tanstack/react-query'
import { getAnalytics, type AnalyticsFilters } from '../services/analytics-service'

export function useAnalytics(filters:AnalyticsFilters | null) {
  return useQuery({
    queryKey:['analytics', filters],
    queryFn:() => getAnalytics(filters!),
    enabled:Boolean(filters?.workspaceId),
    staleTime:60_000,
    refetchOnWindowFocus:false,
  })
}
