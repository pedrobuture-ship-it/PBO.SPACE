import { requireSupabase } from '@/services/supabase/client'

export type RecentReference = { type: 'command' | 'board' | 'task'; id: string }
export type SearchBoardResult = { type: 'board'; id: string; title: string; subtitle: string; workspaceId: string; color: string; icon: string }
export type SearchTaskResult = { type: 'task'; id: string; title: string; subtitle: string; workspaceId: string; boardId: string }
export type SearchEntityResult = SearchBoardResult | SearchTaskResult
export type GlobalSearchResults = { boards: SearchBoardResult[]; tasks: SearchTaskResult[]; hasMoreBoards: boolean; hasMoreTasks: boolean }

const like = (value: string) => `%${value.trim().replaceAll('%', '\\%').replaceAll('_', '\\_')}%`

async function addTaskContext(rows: { id: string; title: string; board_id: string; column_id: string }[]): Promise<SearchTaskResult[]> {
  if (!rows.length) return []
  const client = requireSupabase()
  const boardIds = [...new Set(rows.map(row => row.board_id))]
  const columnIds = [...new Set(rows.map(row => row.column_id))]
  const [boards, columns] = await Promise.all([
    client.from('boards').select('id,name,workspace_id').in('id', boardIds),
    client.from('board_columns').select('id,name').in('id', columnIds),
  ])
  if (boards.error) throw boards.error
  if (columns.error) throw columns.error
  const boardById = new Map(boards.data.map(board => [board.id, board]))
  const columnById = new Map(columns.data.map(column => [column.id, column]))
  return rows.flatMap(row => {
    const board = boardById.get(row.board_id)
    const column = columnById.get(row.column_id)
    // A missing joined row means RLS revoked access between the two reads.
    if (!board || !column) return []
    return [{ type: 'task' as const, id: row.id, title: row.title, subtitle: `${board.name} › ${column.name}`, workspaceId: board.workspace_id, boardId: board.id }]
  })
}

export async function searchGlobal(query: string, boardLimit = 6, taskLimit = 11): Promise<GlobalSearchResults> {
  const client = requireSupabase()
  const pattern = like(query)
  const [boards, tasks] = await Promise.all([
    client.from('boards').select('id,name,description,workspace_id,color,icon')
      .eq('archived', false).ilike('name', pattern).order('updated_at', { ascending: false }).limit(boardLimit),
    client.from('tasks').select('id,title,board_id,column_id')
      .eq('archived', false).ilike('title', pattern).order('updated_at', { ascending: false }).limit(taskLimit),
  ])
  if (boards.error) throw boards.error
  if (tasks.error) throw tasks.error
  const hasMoreBoards = boards.data.length === boardLimit
  const hasMoreTasks = tasks.data.length === taskLimit
  const [taskResults] = await Promise.all([addTaskContext(tasks.data)])
  return {
    boards: boards.data.slice(0, boardLimit - 1).map(board => ({ type: 'board', id: board.id, title: board.name, subtitle: board.description || 'Quadro', workspaceId: board.workspace_id, color: board.color, icon: board.icon })),
    tasks: taskResults.slice(0, taskLimit - 1),
    hasMoreBoards,
    hasMoreTasks,
  }
}

export async function resolveRecentEntities(references: RecentReference[]): Promise<SearchEntityResult[]> {
  const client = requireSupabase()
  const boardIds = [...new Set(references.filter(item => item.type === 'board').map(item => item.id))]
  const taskIds = [...new Set(references.filter(item => item.type === 'task').map(item => item.id))]
  const [boards, tasks] = await Promise.all([
    boardIds.length ? client.from('boards').select('id,name,description,workspace_id,color,icon').in('id', boardIds).eq('archived', false) : Promise.resolve({ data: [], error: null }),
    taskIds.length ? client.from('tasks').select('id,title,board_id,column_id').in('id', taskIds).eq('archived', false) : Promise.resolve({ data: [], error: null }),
  ])
  if (boards.error) throw boards.error
  if (tasks.error) throw tasks.error
  const taskResults = await addTaskContext(tasks.data)
  const boardResults: SearchBoardResult[] = boards.data.map(board => ({ type: 'board', id: board.id, title: board.name, subtitle: board.description || 'Quadro', workspaceId: board.workspace_id, color: board.color, icon: board.icon }))
  const byKey = new Map<string, SearchEntityResult>()
  for (const result of [...boardResults, ...taskResults]) byKey.set(`${result.type}:${result.id}`, result)
  return references.flatMap(reference => {
    if (reference.type === 'command') return []
    const result = byKey.get(`${reference.type}:${reference.id}`)
    return result ? [result] : []
  })
}

export type CreatableBoard = { id: string; name: string; workspaceId: string; workspaceRole: string; boardRole: string | null }
export async function listCreatableBoards(userId: string): Promise<CreatableBoard[]> {
  const client = requireSupabase()
  const { data: boards, error: boardError } = await client.from('boards').select('id,name,workspace_id').eq('archived', false).order('name')
  if (boardError) throw boardError
  if (!boards.length) return []
  const workspaceIds = [...new Set(boards.map(board => board.workspace_id))]
  const boardIds = boards.map(board => board.id)
  const [workspaces, memberships] = await Promise.all([
    client.from('workspace_members').select('workspace_id,role').eq('user_id', userId).in('workspace_id', workspaceIds),
    client.from('board_members').select('board_id,role').eq('user_id', userId).in('board_id', boardIds),
  ])
  if (workspaces.error) throw workspaces.error
  if (memberships.error) throw memberships.error
  const workspaceRoleById = new Map(workspaces.data.map(item => [item.workspace_id, item.role]))
  const boardRoleById = new Map(memberships.data.map(item => [item.board_id, item.role]))
  return boards.flatMap(board => {
    const workspaceRole = workspaceRoleById.get(board.workspace_id)
    const boardRole = boardRoleById.get(board.id) ?? null
    if (!workspaceRole) return []
    const role = workspaceRole === 'owner' ? 'owner' : boardRole === 'owner' ? 'owner' : workspaceRole === 'admin' || workspaceRole === 'viewer' ? workspaceRole : boardRole
    if (!role || role === 'viewer') return []
    return [{ id: board.id, name: board.name, workspaceId: board.workspace_id, workspaceRole, boardRole }]
  })
}

export async function listBoardColumns(boardId: string) {
  const { data, error } = await requireSupabase().from('board_columns').select('id,name,position').eq('board_id', boardId).order('position').order('id')
  if (error) throw error
  return data
}
