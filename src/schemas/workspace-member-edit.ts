import { z } from 'zod'

export const workspaceMemberEditSchema = z.object({
  display_name: z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres.').max(120, 'O nome deve ter até 120 caracteres.'),
  workspace_role: z.enum(['admin','member','viewer']),
})

export type WorkspaceMemberEditValues = z.infer<typeof workspaceMemberEditSchema>
