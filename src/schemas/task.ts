import { z } from 'zod'
export const taskSchema = z.object({
  title: z.string().trim().min(2, 'Descreva a tarefa.').max(160),
  priority: z.enum(['none', 'urgent', 'high', 'medium', 'low']),
})
export type TaskValues = z.infer<typeof taskSchema>
