import assert from 'node:assert/strict'
import { createTestDatabase } from './database-test-context.mjs'
const db = await createTestDatabase()
const uid = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`
let checks = 0
async function rows(sql, args = []) { return (await db.query(sql, args)).rows }
async function root() { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)") }
async function actor(n) { await root(); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid(n)]); await db.exec('set role authenticated') }
function check(actual, expected, label) { assert.deepEqual(actual, expected, label); checks++ }
async function denied(sql, args = []) { let error; try { await rows(sql, args) } catch (cause) { error = cause }; assert.equal(error?.code, '42501', error?.message); checks++ }
try {
  for (let n = 1; n <= 4; n++) await rows('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [uid(n), { display_name: `User ${n}` }])
  const wa = (await rows('select id from public.workspaces where owner_id=$1', [uid(1)]))[0].id
  const wb = (await rows('select id from public.workspaces where owner_id=$1', [uid(4)]))[0].id
  await actor(1)
  await root()
  for (const [n, role] of [[2, 'member'], [3, 'viewer']]) await rows('insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,$3)', [wa, uid(n), role])
  await actor(1)
  const a = (await rows('insert into public.boards(workspace_id,name) values($1,$2) returning id', [wa, 'Aberto']))[0].id
  await rows('insert into public.boards(workspace_id,name) values($1,$2)', [wa, 'Restrito'])
  for (const n of [2, 3]) await rows('insert into public.board_members(board_id,user_id,role) values($1,$2,$3)', [a, uid(n), n === 2 ? 'member' : 'viewer'])
  const column = (await rows('select id from public.board_columns where board_id=$1 order by position limit 1', [a]))[0].id
  const t1 = (await rows('select id from public.create_task($1,$2,$3)', [a, column, 'Minha tarefa']))[0].id
  const t2 = (await rows('select id from public.create_task($1,$2,$3)', [a, column, 'Tarefa pronta']))[0].id
  await rows('insert into public.task_assignees(task_id,user_id) values($1,$2),($3,$4)', [t1, uid(2), t2, uid(2)])
  await rows("update public.tasks set due_date=now()-interval '1 day' where id=$1", [t1])
  await rows('update public.tasks set completed_at=now() where id=$1', [t2])
  await actor(2)
  const own = (await rows('select public.home_overview($1) as value', [wa]))[0].value
  check(own.boards.map(b => b.id), [a], 'Membro só vê quadro autorizado')
  check(own.boards[0].access_role, 'member', 'Papel efetivo do board')
  check(own.boards[0].task_count, 2, 'Contagem agregada')
  check(own.boards[0].completed_count, 1, 'Progresso agregado')
  check(own.boards[0].member_count, 3, 'Membros efetivos, incluindo owner')
  check(own.metrics.active_boards, 1, 'Quadros acessíveis')
  check(own.metrics.my_tasks, 1, 'Minhas tarefas abertas')
  check(own.metrics.overdue, 1, 'Atrasadas')
  check(own.metrics.completed_recently, 1, 'Concluídas recentes')
  const splitBoards = (await rows('select public.home_boards($1) as value', [wa]))[0].value
  const splitMetrics = (await rows('select public.home_metrics($1) as value', [wa]))[0].value
  check(splitBoards, own.boards, 'RPC de quadros mantém dados e ordem da Home')
  check(splitMetrics, own.metrics, 'RPC de indicadores mantém métricas da Home')
  await rows('insert into public.favorites(board_id) values($1)', [a])
  check((await rows('select public.home_boards($1) as value', [wa]))[0].value[0].favorite, true, 'Favorito real aparece no quadro acessível')
  await rows('delete from public.favorites where board_id=$1', [a])
  await denied('select public.home_overview($1)', [wb])
  await denied('select public.home_boards($1)', [wb])
  await denied('select public.home_metrics($1)', [wb])
  await actor(3)
  check((await rows('select public.home_overview($1) as value', [wa]))[0].value.boards[0].access_role, 'viewer', 'Viewer mantém leitura')
  await actor(4)
  await denied('select public.home_overview($1)', [wa])
  await root()
  await rows("update public.profiles set app_role='admin' where id=$1", [uid(4)])
  await actor(4)
  await denied('select public.home_overview($1)', [wa])
  await actor(1)
  check((await rows('select public.home_overview($1) as value', [wa]))[0].value.boards.length, 2, 'Owner vê todos os boards do workspace')
  await root()
  await db.exec('revoke execute on function public.home_metrics(uuid) from authenticated')
  await actor(1)
  check((await rows('select public.home_boards($1) as value', [wa]))[0].value.length, 2, 'Falha isolada em métricas não impede quadros')
  await denied('select public.home_metrics($1)', [wa])
  await root()
  await db.exec('grant execute on function public.home_metrics(uuid) to authenticated')
  await root()
  await db.exec('set role anon')
  await denied('select public.home_overview($1)', [wa])
  await root()
  await rows('update public.profiles set disabled_at=now() where id=$1', [uid(2)])
  await actor(2)
  await denied('select public.home_overview($1)', [wa])
  console.log(`PASS: ${checks} verificações da Home, agregação e isolamento.`)
} catch (error) { console.error(error); process.exitCode = 1 } finally { await db.close() }
