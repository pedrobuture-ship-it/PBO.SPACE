import { z } from 'zod'
import { requireSupabase } from '@/services/supabase/client'

const member = z.object({ id: z.string().uuid(), name: z.string(), avatar_url: z.string().nullable() })
const summary = z.object({
  id: z.string().uuid(), workspace_id: z.string().uuid(), name: z.string(),
  description: z.string().nullable(), icon: z.string(), color: z.string(),
  created_at: z.string(), updated_at: z.string(), last_activity: z.string(),
  access_role: z.enum(['owner', 'admin', 'member', 'viewer']),
  task_count: z.number(), completed_count: z.number(), member_count: z.number(),
  members: z.array(member), favorite: z.boolean(),
})
const metrics = z.object({ active_boards: z.number(), my_tasks: z.number(), due_soon: z.number(), overdue: z.number(), completed_recently: z.number() })
export type HomeBoard = z.infer<typeof summary>
export type HomeMetrics = z.infer<typeof metrics>

function logHomeFailure(query: string, error: unknown) {
  if (import.meta.env.DEV) console.error(`[Home] failed loading ${query}:`, error)
}
export async function getHomeBoards(workspaceId: string): Promise<HomeBoard[]> {
  try {
    const { data, error } = await requireSupabase().rpc('home_boards', { p_workspace_id: workspaceId })
    if (error) throw error
    const parsed = z.array(summary).safeParse(data)
    if (!parsed.success) throw parsed.error
    return parsed.data
  } catch (error) {
    logHomeFailure('boards', error)
    throw new Error('Não foi possível carregar os quadros.')
  }
}
export async function getHomeMetrics(workspaceId: string): Promise<HomeMetrics> {
  try {
    const { data, error } = await requireSupabase().rpc('home_metrics', { p_workspace_id: workspaceId })
    if (error) throw error
    const parsed = metrics.safeParse(data)
    if (!parsed.success) throw parsed.error
    return parsed.data
  } catch (error) {
    logHomeFailure('metrics', error)
    throw new Error('Não foi possível carregar os indicadores.')
  }
}
