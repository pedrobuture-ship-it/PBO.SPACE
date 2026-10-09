import { z } from 'zod'
import { requireSupabase } from '@/services/supabase/client'

const point = z.object({ date:z.string().optional(), week:z.string().optional(), name:z.string().optional(), id:z.string().optional(), column_id:z.string().optional(), color:z.string().optional(), value:z.number(), created:z.number().optional(), completed:z.number().optional(), avg_hours:z.number().nullable().optional(), observations:z.number().optional() })
const trendPoint = z.object({ date:z.string(), created:z.number(), completed:z.number() })
const columnTimePoint = z.object({ id:z.string(), name:z.string(), color:z.string(), avg_hours:z.number().nullable(), observations:z.number() })
const schema = z.object({
  summary:z.object({ total:z.number(), in_progress:z.number(), completed:z.number(), completed_total:z.number(), overdue:z.number(), created_in_period:z.number(), previous_created:z.number(), previous_completed:z.number(), completion_rate:z.number().nullable(), avg_completion_hours:z.number().nullable() }),
  boards:z.array(z.object({id:z.string(),name:z.string()})), status:z.array(point), priority:z.array(point), trend:z.array(trendPoint), workload:z.array(point), overdue_by_assignee:z.array(point), throughput:z.array(point), column_time:z.array(columnTimePoint), labels:z.array(point), cumulative_flow:z.array(point), history_started_at:z.string().nullable(), cumulative_flow_available:z.boolean(),
})
export type AnalyticsData = z.infer<typeof schema>
export type AnalyticsFilters = { workspaceId:string; boardId:string | null; from:string; to:string; assigneeId:string | null; priority:'none'|'low'|'medium'|'high'|'urgent'|null }

export async function getAnalytics(filters:AnalyticsFilters):Promise<AnalyticsData> {
  const { data,error } = await requireSupabase().rpc('dashboard_analytics', {
    p_workspace_id:filters.workspaceId, p_board_id:filters.boardId, p_from:filters.from, p_to:filters.to,
    p_assignee_id:filters.assigneeId, p_priority:filters.priority,
  })
  if (error) {
    // O detalhe fica no console para diagnóstico; a interface recebe uma mensagem segura.
    if (import.meta.env.DEV) console.error('[Analytics] dashboard_analytics failed', {
      code:error.code, message:error.message, details:error.details, hint:error.hint,
    })
    if (error.code==='PGRST202'||error.code==='42883') {
      throw new Error('A estrutura de Analytics ainda não está aplicada no Supabase. Aplique a migration de Analytics e tente novamente.')
    }
    if (error.code==='42501') {
      throw new Error('Sua sessão não tem acesso às métricas deste workspace. Atualize a sessão e tente novamente.')
    }
    throw new Error('Não foi possível carregar as métricas. Consulte o console do navegador para identificar a falha.')
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    if (import.meta.env.DEV) console.error('[Analytics] invalid dashboard_analytics response', parsed.error.issues.map(issue=>({path:issue.path.join('.'),code:issue.code,message:issue.message})))
    throw new Error('As métricas vieram em um formato inesperado. Consulte o console do navegador para diagnóstico.')
  }
  return parsed.data
}
