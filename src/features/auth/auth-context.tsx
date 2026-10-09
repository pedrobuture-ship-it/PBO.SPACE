import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase/client'
import { useUiStore } from '@/stores/ui-store'
interface AuthContextValue { session: Session | null; loading: boolean }
const AuthContext = createContext<AuthContextValue | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!supabase) return
    let alive = true
    let currentUser: string | undefined
    let authEventVersion = 0
    const update = (next: Session | null) => {
      if (!alive) return
      if (currentUser !== next?.user.id) {
        queryClient.clear()
        useUiStore.getState().setActiveTaskId(null)
        useUiStore.getState().setActiveWorkspaceId(null)
      }
      currentUser = next?.user.id
      setSession(next)
      setLoading(false)
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { authEventVersion++; update(next) })
    const requestVersion = authEventVersion
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive || authEventVersion !== requestVersion) return
      if (!error) update(data.session)
      else { if (import.meta.env.DEV) console.error('[Auth] failed loading session:', error); update(null) }
    }).catch(error => {
      if (!alive || authEventVersion !== requestVersion) return
      if (import.meta.env.DEV) console.error('[Auth] failed loading session:', error)
      update(null)
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [queryClient])
  const value = useMemo(() => ({ session, loading }), [session, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider.')
  return context
}
