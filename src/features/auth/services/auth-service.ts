import { requireSupabase } from '@/services/supabase/client'
import type { LoginValues } from '@/schemas/auth'

export async function signIn(values: LoginValues) {
  const { data, error } = await requireSupabase().auth.signInWithPassword(values)
  if (error) throw error
  return data
}
export async function requestPasswordReset(email: string) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}
export async function updatePassword(password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password })
  if (error) throw error
}
export async function signOut() {
  const { error } = await requireSupabase().auth.signOut()
  if (error) throw error
}
