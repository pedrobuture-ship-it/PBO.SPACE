import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { useResourceMutation } from '@/hooks/use-resource'
import { getProfile, updateProfile, uploadAvatar } from '../services/profile-service'
export function useProfile() {
  const { session } = useAuth()
  return useQuery({ queryKey: ['profile', session?.user.id], queryFn: () => getProfile(session!.user.id), enabled: Boolean(session), staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true })
}
export function useProfileMutations() {
  const { session } = useAuth()
  const update = useResourceMutation((values: { display_name?: string; username?: string | null }) => {
    if (!session) throw new Error('Faça login.')
    return updateProfile(session.user.id, values)
  }, [['profile']])
  const avatar = useResourceMutation(uploadAvatar, [['profile']])
  return { update, avatar }
}
