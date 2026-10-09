import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/services/supabase/client'
import { BoardRealtimeGate } from './board-realtime-gate'

// Um canal privado por board; durante o drag, eventos aguardam o commit ou rollback local.
export function useBoardRealtime(boardId: string, enabled: boolean, busy: boolean, activeTaskId?: string | null) {
  const { session } = useAuth()
  const client = useQueryClient()
  const userId = session?.user.id
  const accessToken = session?.access_token
  const gateRef = useRef<BoardRealtimeGate | null>(null)
  const busyRef = useRef(busy)
  const activeTaskRef = useRef(activeTaskId)
  useEffect(() => { activeTaskRef.current = activeTaskId }, [activeTaskId])
  useEffect(() => {
    busyRef.current = busy
    gateRef.current?.setBusy(busy)
  }, [busy])
  useEffect(() => {
    if (!supabase || !enabled || !boardId || !userId || !accessToken) return
    const current = supabase
    let disposed = false
    const gate = new BoardRealtimeGate(busyRef.current, () => {
      if (disposed) return
      void client.invalidateQueries({ queryKey: ['board', boardId, userId] })
      void client.invalidateQueries({ queryKey: ['board-task-badges', boardId, userId] })
    })
    gateRef.current = gate
    const refresh = () => { if (!disposed) gate.notify() }
    const refreshDetail = (event: { payload: { task_id?: string; related_task_id?: string } }) => {
      refresh()
      const taskId = activeTaskRef.current
      if (taskId && (event.payload.task_id === taskId || event.payload.related_task_id === taskId)) for (const key of ['checklists','comments','attachments','dependencies','subtasks','activity']) {
        void client.invalidateQueries({ queryKey: [key, taskId, userId] })
      }
    }
    const channel = current.channel(`board:${boardId}:user:${userId}`, { config: { private: true } })
      .on('broadcast', { event: 'data-change' }, refreshDetail)
    void current.realtime.setAuth(accessToken).then(() => {
      if (!disposed) channel.subscribe(status => { if (status === 'SUBSCRIBED') refresh() })
    }).catch(() => { if (!disposed) refresh() })
    return () => { disposed = true; gate.clear(); gateRef.current = null; void current.removeChannel(channel) }
  }, [boardId, enabled, userId, accessToken, client])
}
