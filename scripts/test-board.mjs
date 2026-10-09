import assert from 'node:assert/strict'
import { createTestDatabase } from './database-test-context.mjs'
import { moveTaskDraft, moveColumnDraft, taskNeighbors, columnNeighbors, parseBoardDrop, sameBoardOrder } from '../src/features/boards/board-dnd-model.ts'
import { emptyBoardFilters, matchesBoardTask } from '../src/features/boards/board-filters.ts'
import { commitBoardMove } from '../src/features/boards/board-optimistic.ts'
import { QueryClient } from '@tanstack/react-query'
import { BoardRealtimeGate } from '../src/hooks/board-realtime-gate.ts'
let checks = 0
function check(actual, expected, label) { assert.deepEqual(actual, expected, label); checks++ }
const task = (id, column_id, extras = {}) => ({ id, column_id, board_id: 'board', title: id, description: null, priority: 'none', due_date: null, completed_at: null, labels: [], assignees: [], ...extras })
const board = { id: 'board', access_role: 'member', columns: [{ id: 'a', tasks: [task('one', 'a'), task('two', 'a'), task('three', 'a')] }, { id: 'b', tasks: [task('four', 'b')] }, { id: 'c', tasks: [] }] }
const same = moveTaskDraft(board, 'one', { type: 'task', id: 'three' })
check(same.columns[0].tasks.map(item => item.id), ['two', 'three', 'one'], 'Reordenação na mesma coluna')
check(taskNeighbors(same, 'one'), { columnId: 'a', beforeId: 'three', afterId: undefined }, 'Vizinhos para RPC da tarefa')
check(board.columns[0].tasks.map(item => item.id), ['one', 'two', 'three'], 'Modelo original imutável')
const cross = moveTaskDraft(board, 'two', { type: 'task', id: 'four' })
check(cross.columns[0].tasks.map(item => item.id), ['one', 'three'], 'Origem após mover entre colunas')
check(cross.columns[1].tasks.map(item => item.id), ['two', 'four'], 'Destino na posição prevista')
check(taskNeighbors(cross, 'two'), { columnId: 'b', beforeId: undefined, afterId: 'four' }, 'Vizinhos em outra coluna')
const empty = moveTaskDraft(board, 'three', { type: 'lane', id: 'c' })
check(empty.columns[2].tasks.map(item => item.id), ['three'], 'Drop em coluna vazia')
const reordered = moveColumnDraft(board, 'a', 'c')
check(reordered.columns.map(item => item.id), ['b', 'c', 'a'], 'Reordenação de coluna')
check(columnNeighbors(reordered, 'a'), { beforeId: 'c', afterId: undefined }, 'Vizinhos da coluna')
check(parseBoardDrop('task:one'), { type: 'task', id: 'one' }, 'IDs distintos por tipo')
check(sameBoardOrder(board, board), true, 'Soltar no lugar não precisa persistir')
const sample = task('x', 'a', { title: 'Revisar tela', description: 'Checar contraste', priority: 'high', labels: ['UX'], assignees: [{ id: 'me' }], due_date: new Date(Date.now() - 86400000).toISOString() })
check(matchesBoardTask(sample, emptyBoardFilters, 'contraste', 'me'), true, 'Busca na descrição')
check(matchesBoardTask(sample, { ...emptyBoardFilters, mine: true, priority: 'high', label: 'UX', due: 'overdue', column: 'a' }, '', 'me'), true, 'Filtros combinados')
check(matchesBoardTask(sample, { ...emptyBoardFilters, mine: true }, '', 'other'), false, 'Minhas tarefas isoladas')
const cache = new QueryClient()
const cacheKey = ['board', 'board', 'user']
cache.setQueryData(cacheKey, board)
let rollback = false
const failed = await commitBoardMove(cache, cacheKey, cross, async () => { throw new Error('RPC failed') }, async () => {}, previous => { rollback = previous === board })
check(failed, false, 'Falha na persistência é sinalizada')
check(rollback, true, 'Rollback recebe snapshot anterior')
check(cache.getQueryData(cacheKey), board, 'Cache restaurado após falha')
const saved = await commitBoardMove(cache, cacheKey, cross, async () => {}, async () => {}, () => { throw new Error('Não deve haver rollback') })
check(saved, true, 'Persistência bem-sucedida')
check(cache.getQueryData(cacheKey), cross, 'Cache mantém posição após sucesso')
let refreshes = 0
const gate = new BoardRealtimeGate(true, () => { refreshes++ })
gate.notify(); gate.notify()
check(refreshes, 0, 'Realtime não sobrepõe o drag local')
gate.setBusy(false)
check(refreshes, 1, 'Eventos pendentes geram um refetch após o drag')
gate.notify()
check(refreshes, 2, 'Evento remoto fora do drag atualiza imediatamente')

const db = await createTestDatabase()
const uid = n => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`
async function rows(sql, args = []) { return (await db.query(sql, args)).rows }
async function root() { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)") }
async function actor(n) { await root(); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid(n)]); await db.exec('set role authenticated') }
async function denied(sql, args) { let error; try { await rows(sql, args) } catch (cause) { error = cause }; assert.equal(error?.code, '42501', error?.message); checks++ }
try {
  for (let n = 1; n <= 4; n++) await rows('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [uid(n), { display_name: `User ${n}` }])
  const workspace = (await rows('select id from public.workspaces where owner_id=$1', [uid(1)]))[0].id
  await actor(1)
  await root()
  await rows("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'member'),($1,$3,'viewer')", [workspace, uid(2), uid(3)])
  await actor(1)
  const boardId = (await rows('insert into public.boards(workspace_id,name) values($1,$2) returning id', [workspace, 'Teste board']))[0].id
  await rows("insert into public.board_members(board_id,user_id,role) values($1,$2,'member'),($1,$3,'viewer')", [boardId, uid(2), uid(3)])
  const column = (await rows('select id from public.board_columns where board_id=$1 order by position limit 1', [boardId]))[0].id
  const taskId = (await rows('select id from public.create_task($1,$2,$3)', [boardId, column, 'Teste tarefa']))[0].id
  const checklist = (await rows('insert into public.checklists(task_id,title) values($1,$2) returning id', [taskId, 'Pronto']))[0].id
  await rows('insert into public.checklist_items(checklist_id,content,completed) values($1,$2,true),($1,$3,false)', [checklist, 'Primeiro', 'Segundo'])
  await rows('insert into public.comments(task_id,content) values($1,$2)', [taskId, 'Comentário'])
  const path = `${boardId}/${taskId}/arquivo.txt`
  await rows("insert into storage.objects(bucket_id,name,owner_id) values('task-attachments',$1,$2)", [path, uid(1)])
  await rows('insert into public.attachments(task_id,file_name,file_url,file_size) values($1,$2,$3,12)', [taskId, 'arquivo.txt', path])
  await actor(3)
  const badges = (await rows('select public.board_task_badges($1) as value', [boardId]))[0].value
  check(badges[taskId], { checklist_total: 2, checklist_done: 1, comments: 1, attachments: 1 }, 'Viewer lê indicadores do board autorizado')
  await denied('select public.create_task($1,$2,$3)', [boardId, column, 'Burlado'])
  await denied('select public.move_task($1,$2)', [taskId, column])
  await actor(2)
  check(Object.keys((await rows('select public.board_task_badges($1) as value', [boardId]))[0].value).length, 1, 'Member lê cards acessíveis')
  check((await rows('select id from public.create_task($1,$2,$3)', [boardId, column, 'Tarefa do membro'])).length, 1, 'Member pode criar tarefa')
  await denied('select public.create_column($1,$2)', [boardId, 'Bloqueada'])
  await actor(1)
  check((await rows('select id from public.create_column($1,$2)', [boardId, 'Coluna do owner'])).length, 1, 'Owner administra colunas')
  await rows("update public.board_members set role='admin' where board_id=$1 and user_id=$2", [boardId, uid(2)])
  await actor(2)
  check((await rows('select id from public.create_column($1,$2)', [boardId, 'Coluna do admin'])).length, 1, 'Admin do board administra colunas')
  await actor(4)
  await denied('select public.board_task_badges($1)', [boardId])
  await root()
  await rows("update public.profiles set app_role='admin' where id=$1", [uid(4)])
  await actor(4)
  await denied('select public.board_task_badges($1)', [boardId])
  await root(); await db.exec('set role anon')
  await denied('select public.board_task_badges($1)', [boardId])
  console.log(`PASS: ${checks} verificações de drag, filtros, badges e RLS do board.`)
} catch (error) { console.error(error); process.exitCode = 1 } finally { await db.close() }
