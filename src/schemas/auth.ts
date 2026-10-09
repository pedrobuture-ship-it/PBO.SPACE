import { z } from 'zod'
export const loginSchema = z.object({
  email: z.string().email('Digite um e-mail válido.'),
  password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({ email: z.string().trim().email('Digite um e-mail válido.') })
export const passwordSchema = z.object({ password: z.string().min(8, 'Use pelo menos 8 caracteres.').max(72, 'Use até 72 caracteres.'), confirmation: z.string() }).refine(value => value.password === value.confirmation, { path: ['confirmation'], message: 'As senhas precisam ser iguais.' })
export type PasswordValues = z.infer<typeof passwordSchema>
