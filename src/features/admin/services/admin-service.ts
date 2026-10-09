import { requireSupabase } from '@/services/supabase/client'
import type { AdminUser } from '@/types/database'
import type { AppRole } from '@/types/domain'
export type AdminStatus = 'active' | 'invited' | 'disabled'
export interface UserFilters { search: string; role?: AppRole | 'all'; status: AdminStatus | 'all'; page: number }
export async function listAdminUsers(filters: UserFilters): Promise<{ users: AdminUser[]; total: number }> {
  const { data, error } = await requireSupabase().rpc('admin_list_users', {
    p_search: filters.search.trim(), p_role: !filters.role || filters.role === 'all' ? undefined : filters.role,
    p_status: filters.status === 'all' ? undefined : filters.status,
    p_limit: 20, p_offset: filters.page * 20,
  })
  if (error) throw new Error('Não foi possível carregar os usuários.')
  return { users: data, total: data[0]?.total_count ?? 0 }
}
async function invokeAdmin<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke(name, { body })
  if (error) {
    const response = 'context' in error && error.context instanceof Response ? error.context : null
    const payload = await response?.json().catch(() => null) as { error?: string } | null
    throw new Error(payload?.error || 'Não foi possível concluir a ação administrativa.')
  }
  return data as T
}
export async function setAdminUserStatus(id: string, disabled: boolean) {
  return invokeAdmin<{ id: string; status: AdminStatus }>('admin-update-user', { userId: id, disabled })
}
export async function resetAdminUserPassword(targetUserId: string, newPassword: string) {
  const result = await invokeAdmin<{ success: boolean }>('admin-reset-user-password', { target_user_id: targetUserId, new_password: newPassword })
  if (result.success !== true) throw new Error('Não foi possível redefinir a senha.')
}
