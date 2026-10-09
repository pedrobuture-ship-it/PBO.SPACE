import { z } from 'zod'

export const workspaceMemberSchema=z.object({
  display_name:z.string().trim().min(2,'Informe um nome com pelo menos 2 caracteres.').max(120,'O nome deve ter até 120 caracteres.'),
  email:z.string().trim().email('E-mail inválido.').max(254,'E-mail inválido.'),
  password:z.string().min(8,'Senha muito curta. Use ao menos 8 caracteres.').max(128,'A senha deve ter até 128 caracteres.'),
  confirm_password:z.string(),
  workspace_role:z.enum(['admin','member','viewer']),
}).refine(values=>values.password===values.confirm_password,{path:['confirm_password'],message:'As senhas não coincidem.'})

export type WorkspaceMemberValues=z.infer<typeof workspaceMemberSchema>
