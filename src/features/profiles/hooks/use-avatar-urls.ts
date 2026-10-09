import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { requireSupabase } from '@/services/supabase/client'

export function useAvatarUrls(paths: (string | null | undefined)[]) {
  const { session } = useAuth()
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))].sort()
  return useQuery({ queryKey: ['avatar-urls', session?.user.id, unique], enabled: Boolean(session && unique.length), staleTime: 45_000,
    queryFn: async () => {
      const groups = Array.from({ length: Math.ceil(unique.length / 50) }, (_, index) => unique.slice(index * 50, index * 50 + 50))
      const results = await Promise.all(groups.map(group => requireSupabase().storage.from('avatars').createSignedUrls(group, 60)))
      return Object.fromEntries(results.flatMap((result, groupIndex) => (result.data ?? []).flatMap((item, index) => item.signedUrl ? [[groups[groupIndex][index], item.signedUrl]] : []))) as Record<string, string>
    },
  })
}
