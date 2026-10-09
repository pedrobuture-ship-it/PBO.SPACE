import { requireSupabase } from '@/services/supabase/client'
import type { BoardWithColumns, MemberRole, Task } from '@/types/domain'
import type { BoardValues } from '@/schemas/board'
export async function listBoards(workspaceId: string) {
  const { data, error } = await requireSupabase().from('boards').select('*').eq('workspace_id', workspaceId).eq('archived', false).order('created_at', { ascending: false })
  if (error) throw error
  return data
}
async function listBoardTasks(boardId: string) {
  const all = [] as Task[]
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await requireSupabase().from('tasks').select('*,task_labels(label:labels(name)),task_assignees(profile:profiles(*))')
      .eq('board_id', boardId).eq('archived', false).order('position').order('id').range(offset, offset + 999)
    if (error) throw error
    all.push(...data.map(({ task_labels, task_assignees, ...task }) => ({ ...task,
      labels: task_labels.flatMap(item => item.label ? [item.label.name] : []),
      assignees: task_assignees.flatMap(item => item.profile ? [item.profile] : []),
    })))
    if (data.length < 1000) return all
  }
}
export async function getBoard(id: string, userId: string): Promise<BoardWithColumns> {
  const client = requireSupabase()
  const board = await client.from('boards').select('*').eq('id', id).eq('archived', false).maybeSingle()
  if (board.error || !board.data) throw new Error('Quadro indisponível ou sem acesso.')
  const [membership, workspaceMember] = await Promise.all([
    client.from('board_members').select('role').eq('board_id', id).eq('user_id', userId).maybeSingle(),
    client.from('workspace_members').select('role').eq('workspace_id', board.data.workspace_id).eq('user_id', userId).maybeSingle(),
  ])
  if (membership.error || workspaceMember.error || !workspaceMember.data) throw new Error('Quadro indisponível ou sem acesso.')
  const workspaceRole = workspaceMember.data.role
  const role: MemberRole | undefined = workspaceRole === 'owner' ? 'owner' : membership.data?.role === 'owner' ? 'owner' : workspaceRole === 'admin' || workspaceRole === 'viewer' ? workspaceRole : membership.data?.role
  if (!role) throw new Error('Quadro indisponível ou sem acesso.')
  const [columns, tasks] = await Promise.all([
    client.from('board_columns').select('*').eq('board_id', id).order('position').order('id'),
    listBoardTasks(id),
  ])
  if (columns.error) throw columns.error
  const byColumn = new Map<string, Task[]>()
  for (const task of tasks) { const group = byColumn.get(task.column_id) ?? []; group.push(task); byColumn.set(task.column_id, group) }
  return { ...board.data, access_role: role, columns: columns.data.map(column => ({ ...column, tasks: byColumn.get(column.id) ?? [] })) }
}
export async function createBoard(values: BoardValues, workspaceId: string) {
  const { data, error } = await requireSupabase().from('boards').insert({ workspace_id: workspaceId, name: values.name, description: values.description || null, icon: values.icon, color: values.color }).select().single()
  if (error) throw error
  return data
}

export async function updateBoard(id: string, values: { name?: string; description?: string | null; icon?: string; color?: string; archived?: boolean }) {
  const { data, error } = await requireSupabase().from('boards').update(values).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteBoard(id: string) {
  const { error } = await requireSupabase().from('boards').delete().eq('id', id)
  if (error) throw error
}
