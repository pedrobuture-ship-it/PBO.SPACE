import type { BoardWithColumns } from '../../types/domain.ts'

export const taskDragId = (id: string) => `task:${id}`
export const columnDragId = (id: string) => `column:${id}`
export const laneDropId = (id: string) => `lane:${id}`
export type BoardDrop = { type: 'task' | 'column' | 'lane'; id: string }
export function parseBoardDrop(value: string): BoardDrop | null {
  const separator = value.indexOf(':')
  if (separator < 0) return null
  const type = value.slice(0, separator), id = value.slice(separator + 1)
  return id && (type === 'task' || type === 'column' || type === 'lane') ? { type, id } as BoardDrop : null
}
export function moveTaskDraft(board: BoardWithColumns, taskId: string, target: BoardDrop): BoardWithColumns {
  if (target.type === 'column') return board
  const sourceIndex = board.columns.findIndex(column => column.tasks.some(task => task.id === taskId))
  const destinationIndex = target.type === 'lane'
    ? board.columns.findIndex(column => column.id === target.id)
    : board.columns.findIndex(column => column.tasks.some(task => task.id === target.id))
  if (sourceIndex < 0 || destinationIndex < 0 || target.id === taskId) return board
  const source = board.columns[sourceIndex], destination = board.columns[destinationIndex]
  const from = source.tasks.findIndex(task => task.id === taskId)
  const original = source.tasks[from]
  const sourceTasks = source.tasks.filter(task => task.id !== taskId)
  const destinationTasks = sourceIndex === destinationIndex ? sourceTasks : [...destination.tasks]
  const overIndex = target.type === 'task' ? destination.tasks.findIndex(task => task.id === target.id) : destinationTasks.length
  const insertAt = overIndex < 0 ? destinationTasks.length : Math.min(overIndex, destinationTasks.length)
  destinationTasks.splice(insertAt, 0, { ...original, column_id: destination.id })
  if (sourceIndex === destinationIndex && destinationTasks.every((task, index) => task.id === source.tasks[index]?.id)) return board
  const columns = board.columns.map((column, index) => index === destinationIndex
    ? { ...column, tasks: destinationTasks }
    : index === sourceIndex ? { ...column, tasks: sourceTasks } : column)
  return { ...board, columns }
}
export function moveColumnDraft(board: BoardWithColumns, columnId: string, overColumnId: string): BoardWithColumns {
  const from = board.columns.findIndex(column => column.id === columnId)
  const to = board.columns.findIndex(column => column.id === overColumnId)
  if (from < 0 || to < 0 || from === to) return board
  const columns = [...board.columns]
  columns.splice(to, 0, columns.splice(from, 1)[0])
  return { ...board, columns }
}
export function taskNeighbors(board: BoardWithColumns, taskId: string) {
  const column = board.columns.find(item => item.tasks.some(task => task.id === taskId))
  if (!column) return null
  const index = column.tasks.findIndex(task => task.id === taskId)
  return { columnId: column.id, beforeId: column.tasks[index - 1]?.id, afterId: column.tasks[index + 1]?.id }
}
export function columnNeighbors(board: BoardWithColumns, columnId: string) {
  const index = board.columns.findIndex(column => column.id === columnId)
  if (index < 0) return null
  return { beforeId: board.columns[index - 1]?.id, afterId: board.columns[index + 1]?.id }
}
export function sameBoardOrder(left: BoardWithColumns, right: BoardWithColumns) {
  return left.columns.length === right.columns.length && left.columns.every((column, index) =>
    column.id === right.columns[index]?.id && column.tasks.length === right.columns[index].tasks.length &&
    column.tasks.every((task, taskIndex) => task.id === right.columns[index].tasks[taskIndex]?.id))
}
