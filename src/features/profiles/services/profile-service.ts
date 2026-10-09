import { requireSupabase } from '@/services/supabase/client'
export async function getProfile(id: string) {
  const { data, error } = await requireSupabase().from('profiles').select('*').eq('id', id).single()
  if (error) {
    if (import.meta.env.DEV) console.error('[Home] failed loading profile:', error)
    throw error
  }
  return data
}
export async function updateProfile(id: string, values: { display_name?: string; username?: string | null; avatar_url?: string | null }) {
  const { data, error } = await requireSupabase().from('profiles').update(values).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function uploadAvatar(file: File) {
  if (!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Use JPEG, PNG, WebP ou AVIF de até 5 MB.')
  const client = requireSupabase()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Faça login.')
  const path = `${user.id}/${crypto.randomUUID()}`
  const { error } = await client.storage.from('avatars').upload(path, file, { contentType: file.type })
  if (error) throw error
  try { return await updateProfile(user.id, { avatar_url: path }) }
  catch (error) { await client.storage.from('avatars').remove([path]); throw error }
}
export async function getAvatarUrl(path: string) {
  const { data, error } = await requireSupabase().storage.from('avatars').createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}
