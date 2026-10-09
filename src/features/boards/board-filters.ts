import { addDays, endOfDay, isAfter, isBefore, isToday } from 'date-fns'
import type { Task, TaskPriority } from '../../types/domain.ts'
export type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'no-date'
export type BoardFilters = { assignee: string; priority: TaskPriority | 'all'; label: string; due: DueFilter; column: string; mine: boolean }
export const emptyBoardFilters: BoardFilters = { assignee: 'all', priority: 'all', label: 'all', due: 'all', column: 'all', mine: false }
export function hasBoardFilters(filters: BoardFilters, search: string) { return Boolean(search.trim() || filters.mine || filters.assignee !== 'all' || filters.priority !== 'all' || filters.label !== 'all' || filters.due !== 'all' || filters.column !== 'all') }
export function matchesBoardTask(task: Task, filters: BoardFilters, search: string, userId: string | undefined, today = new Date()) {
  if (search && !`${task.title} ${task.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))) return false
  if (filters.column !== 'all' && task.column_id !== filters.column) return false
  if (filters.priority !== 'all' && task.priority !== filters.priority) return false
  if (filters.label !== 'all' && !task.labels.includes(filters.label)) return false
  if (filters.assignee !== 'all' && !task.assignees.some(person => person.id === filters.assignee)) return false
  if (filters.mine && !task.assignees.some(person => person.id === userId)) return false
  if (filters.due === 'no-date') return !task.due_date
  if (filters.due !== 'all') {
    if (!task.due_date) return false
    const due = new Date(task.due_date)
    if (filters.due === 'overdue') return !task.completed_at && isBefore(due, today)
    if (filters.due === 'today') return isToday(due)
    if (filters.due === 'week') return !task.completed_at && isAfter(due, today) && isBefore(due, endOfDay(addDays(today, 7)))
  }
  return true
}
