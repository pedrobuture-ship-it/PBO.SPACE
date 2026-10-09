import { z } from 'zod'

export const adminResetPasswordSchema = z.object({
  new_password: z.string().min(8, 'Use ao menos 8 caracteres.').max(128, 'A senha deve ter até 128 caracteres.'),
  confirm_password: z.string(),
}).refine(values => values.new_password === values.confirm_password, {
  path: ['confirm_password'],
  message: 'As senhas não coincidem.',
})

export type AdminResetPasswordValues = z.infer<typeof adminResetPasswordSchema>
