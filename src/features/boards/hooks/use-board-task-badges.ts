import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useAuth } from '@/features/auth/auth-context'
import { requireSupabase } from '@/services/supabase/client'

const badge = z.object({ checklist_total: z.number(), checklist_done: z.number(), comments: z.number(), attachments: z.number() })
export type TaskBadge = z.infer<typeof badge>
export function useBoardTaskBadges(boardId: string, enabled = true) {
  const { session } = useAuth()
  return useQuery({ queryKey: ['board-task-badges', boardId, session?.user.id], enabled: Boolean(session && boardId && enabled),
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('board_task_badges', { p_board_id: boardId })
      if (error) {
        if (import.meta.env.DEV) console.error('[Board] failed loading task indicators:', error)
        throw new Error('Não foi possível carregar os indicadores das tarefas.')
      }
      const parsed = z.record(z.string().uuid(), badge).safeParse(data)
      if (!parsed.success) {
        if (import.meta.env.DEV) console.error('[Board] invalid task indicators response:', parsed.error)
        throw new Error('Não foi possível ler os indicadores das tarefas.')
      }
      return parsed.data
    },
  })
}
