import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { requireSupabase } from '@/services/supabase/client'
import type { HomeBoard } from '../services/home-service'

export function useHomeAvatars(boards: HomeBoard[], workspaceLogo: string | null | undefined) {
  const { session } = useAuth()
  const paths = [...new Set([...boards.flatMap(board => board.members.map(member => member.avatar_url)), workspaceLogo].filter((path): path is string => Boolean(path)))].sort()
  return useQuery({ queryKey: ['home-avatars', session?.user.id, paths], enabled: Boolean(session && paths.length), staleTime: 45_000,
    queryFn: async () => {
      const { data } = await requireSupabase().storage.from('avatars').createSignedUrls(paths, 60)
      return Object.fromEntries((data ?? []).flatMap((item, index) => item.signedUrl ? [[paths[index], item.signedUrl]] : [])) as Record<string, string>
    },
  })
}
