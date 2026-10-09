import { z } from 'zod'
export const boardSchema = z.object({
  name: z.string().trim().min(2, 'Dê um nome ao projeto.').max(80, 'Use até 80 caracteres no nome.'),
  description: z.string().max(500, 'Use até 500 caracteres na descrição.').optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.enum(['layers', 'layout', 'rocket', 'sparkles', 'target', 'lightbulb']),
})
export type BoardValues = z.infer<typeof boardSchema>
