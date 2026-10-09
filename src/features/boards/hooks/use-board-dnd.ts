import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { closestCenter, KeyboardSensor, PointerSensor, TouchSensor, pointerWithin, rectIntersection, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/auth-context'
import { moveTask } from '@/features/tasks/services/task-service'
import { moveColumn } from '@/features/columns/services/column-service'
import type { BoardWithColumns, Task } from '@/types/domain'
import { columnNeighbors, moveColumnDraft, moveTaskDraft, parseBoardDrop, sameBoardOrder, taskNeighbors } from '../board-dnd-model'
import { commitBoardMove } from '../board-optimistic'

export const boardCollision: CollisionDetection = args => {
  const moving = parseBoardDrop(String(args.active.id))
  const containers = args.droppableContainers.filter(container => {
    const target = parseBoardDrop(String(container.id))
    return moving?.type === 'task' ? target?.type === 'task' || target?.type === 'lane' : target?.type === 'column'
  })
  const scoped = { ...args, droppableContainers: containers }
  const pointer = pointerWithin(scoped)
  if (moving?.type === 'task') {
    const card = pointer.find(item => parseBoardDrop(String(item.id))?.type === 'task')
    if (card) return [card]
  }
  return pointer.length ? pointer : rectIntersection(scoped).length ? rectIntersection(scoped) : closestCenter(scoped)
}

export function useBoardDnd(boardId: string, source?: BoardWithColumns) {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const key = ['board', boardId, session?.user.id] as const
  const [draft, setDraft] = useState<BoardWithColumns | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [origin, setOrigin] = useState<{ task: Task; columnId: string; index: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const originalRef = useRef<BoardWithColumns | null>(null)
  const draftRef = useRef<BoardWithColumns | null>(null)
  const lastOverRef = useRef<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const board = draft ?? source
  function finish() { draftRef.current = null; originalRef.current = null; lastOverRef.current = null; setActiveId(null); setOrigin(null); setDraft(null); setBusy(false) }
  function onDragStart(event: DragStartEvent) {
    if (!source || source.access_role === 'viewer') return
    const target = parseBoardDrop(String(event.active.id))
    if (!target || target.type === 'lane' || (target.type === 'column' && !['owner', 'admin'].includes(source.access_role))) return
    if (target.type === 'task') {
      const column = source.columns.find(item => item.tasks.some(task => task.id === target.id))
      const index = column?.tasks.findIndex(task => task.id === target.id) ?? -1
      if (column && index >= 0) setOrigin({ task: column.tasks[index], columnId: column.id, index })
    }
    originalRef.current = source; draftRef.current = source; lastOverRef.current = null
    setDraft(source); setActiveId(String(event.active.id)); setBusy(true)
  }
  function onDragOver(event: DragOverEvent) {
    const moving = parseBoardDrop(String(event.active.id))
    const over = event.over && parseBoardDrop(String(event.over.id))
    if (!moving || !over || !draftRef.current || lastOverRef.current === String(event.over?.id)) return
    lastOverRef.current = String(event.over?.id)
    const next = moving.type === 'task' ? moveTaskDraft(draftRef.current, moving.id, over) : draftRef.current
    if (next !== draftRef.current) { draftRef.current = next; setDraft(next) }
  }
  async function onDragEnd(event: DragEndEvent) {
    const moving = parseBoardDrop(String(event.active.id))
    const over = event.over && parseBoardDrop(String(event.over.id))
    const original = originalRef.current
    if (!moving || !original || !over) { finish(); return }
    let final = draftRef.current ?? original
    if (moving.type === 'column' && over.type === 'column') final = moveColumnDraft(original, moving.id, over.id)
    else if (moving.type === 'task' && (final === original || lastOverRef.current !== String(event.over?.id))) final = moveTaskDraft(final, moving.id, over)
    if (sameBoardOrder(final, original)) { finish(); return }
    const taskTarget = moving.type === 'task' ? taskNeighbors(final, moving.id) : null
    const columnTarget = moving.type === 'column' ? columnNeighbors(final, moving.id) : null
    if (!taskTarget && !columnTarget) { finish(); return }
    setDraft(final)
    setActiveId(null)
    setOrigin(null)
    try {
      const saved = await commitBoardMove(queryClient, key, final, async () => {
        if (taskTarget) await moveTask({ taskId: moving.id, columnId: taskTarget.columnId, beforeId: taskTarget.beforeId, afterId: taskTarget.afterId })
        if (columnTarget) await moveColumn(moving.id, columnTarget.beforeId, columnTarget.afterId)
      }, async () => {
        await Promise.all([queryClient.invalidateQueries({ queryKey: key }), queryClient.invalidateQueries({ queryKey: ['home-overview'] })])
      }, previous => { draftRef.current = previous; setDraft(previous) })
      if (!saved) toast.error('Não foi possível salvar a nova posição. O quadro foi restaurado.')
    } catch { toast.error('Não foi possível atualizar o quadro. Tente novamente.') }
    finally { finish() }
  }
  const active = activeId ? parseBoardDrop(activeId) : null
  const activeTask = active?.type === 'task' ? board?.columns.flatMap(column => column.tasks).find(task => task.id === active.id) : undefined
  const activeColumn = active?.type === 'column' ? board?.columns.find(column => column.id === active.id) : undefined
  return { board, sensors, busy, activeTask, activeColumn, origin, onDragStart, onDragOver, onDragEnd, onDragCancel: finish, collisionDetection: boardCollision }
}
