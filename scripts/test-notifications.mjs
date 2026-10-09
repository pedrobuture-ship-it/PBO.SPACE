import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createTestDatabase } from './database-test-context.mjs'
const db = await createTestDatabase()
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
let checks = 0
async function root() { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)") }
async function actor(n) { await root(); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid(n)]); await db.exec('set role authenticated') }
async function rows(sql,args=[]) { return (await db.query(sql,args)).rows }
function check(actual,expected,label) { assert.deepEqual(actual,expected,label); checks++ }
try {
  await db.exec(await readFile(new URL('../supabase/migrations/202610140001_notifications.sql', import.meta.url), 'utf8'))
  checks++ // A migration pode ser repetida após uma execução parcial no SQL Editor.
  for (let n=1;n<=4;n++) await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[uid(n),`notify${n}@example.test`,{display_name:`User ${n}`}])
  const workspace=(await rows('select id from public.workspaces where owner_id=$1',[uid(1)]))[0].id
  await actor(1)
  await root()
  for (const n of [2,3]) await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'member')",[workspace,uid(n)])
  await actor(1)
  const board=(await rows("insert into public.boards(workspace_id,name) values($1,'Notify board') returning id",[workspace]))[0].id
  for (const n of [2,3]) await db.query("insert into public.board_members(board_id,user_id,role) values($1,$2,'member')",[board,uid(n)])
  const column=(await rows('select id from public.board_columns where board_id=$1 order by position limit 1',[board]))[0].id
  const task=(await rows("select * from public.create_task($1,$2,'Notify task')",[board,column]))[0].id
  await db.query('insert into public.task_assignees(task_id,user_id) values($1,$2),($1,$3)',[task,uid(1),uid(2)])
  check((await rows("select count(*)::int as n from public.notifications where type='task_assigned' and user_id=$1",[uid(1)]))[0].n,0,'Atribuição própria não notifica')
  await actor(2)
  check((await rows("select count(*)::int as n from public.notifications where type='task_assigned'",[]))[0].n,1,'Atribuição gera notificação persistida')
  await db.query("select set_config('realtime.topic',$1,false)",[`notifications:${uid(2)}`])
  check((await rows("select count(*)::int as n from realtime.messages where topic=$1 and payload->>'table'='notifications' and payload->>'operation'='INSERT'",[`notifications:${uid(2)}`]))[0].n>0,true,'Broadcast chega ao canal privado do destinatário')
  check((await rows('select count(*)::int as n from realtime.messages where topic=$1',[`notifications:${uid(3)}`]))[0].n,0,'Destinatário não lê canal de outro usuário')
  await actor(1)
  await db.query('select public.create_comment_with_mentions($1,$2,$3::jsonb)',[task,'Olá @User 2 e @User 3',JSON.stringify([uid(2),uid(3)])])
  await actor(2)
  check((await rows("select type from public.notifications where task_id=$1 and type in ('mention','comment')",[task])).map(r=>r.type),['mention'],'Mencionado atribuído recebe somente menção')
  await actor(3)
  check((await rows("select type from public.notifications where task_id=$1 and type in ('mention','comment')",[task])).map(r=>r.type),['mention'],'Mencionado recebe menção')
  await actor(1)
  await db.query('select public.create_comment_with_mentions($1,$2,$3::jsonb)',[task,'Comentário sem menção','[]'])
  await actor(2)
  check((await rows("select count(*)::int as n from public.notifications where type='comment' and task_id=$1",[task]))[0].n,1,'Assignee recebe comentário relevante')
  await actor(1)
  await db.query('update public.tasks set due_date=now()+interval \'2 days\' where id=$1',[task])
  await db.query('update public.tasks set completed_at=now() where id=$1',[task])
  await db.query('update public.tasks set completed_at=null,due_date=now()-interval \'2 days\' where id=$1',[task])
  await db.query("insert into public.board_columns(board_id,name,position) values($1,'Em andamento',2048)",[board])
  const nextColumn=(await rows("select id from public.board_columns where board_id=$1 and name='Em andamento'",[board]))[0].id
  await db.query('update public.tasks set column_id=$2 where id=$1',[task,nextColumn])
  await actor(2)
  for (const type of ['due_date_changed','task_completed','task_moved']) check((await rows('select count(*)::int as n from public.notifications where task_id=$1 and type=$2',[task,type]))[0].n>0,true,`${type} persistida`)
  await root()
  check((await rows('select public.process_overdue_notifications() as n'))[0].n,2,'Overdue gera para envolvidos')
  check((await rows('select public.process_overdue_notifications() as n'))[0].n,0,'Overdue idempotente')
  await actor(2)
  check((await rows("select count(*)::int as n from public.notifications where type='task_overdue'",[]))[0].n,1,'Atraso visível ao destinatário')
  await db.query("delete from public.notifications where type='task_overdue'")
  await root()
  check((await rows('select public.process_overdue_notifications() as n'))[0].n,0,'Excluir da inbox não recria o mesmo alerta de atraso')
  await actor(2)
  check((await rows("select count(*)::int as n from public.notifications where type='task_overdue'",[]))[0].n,0,'Alerta excluído permanece excluído')
  await actor(1)
  await db.query("update public.board_members set role='viewer' where board_id=$1 and user_id=$2",[board,uid(2)])
  await actor(2)
  check((await rows("select count(*)::int as n from public.notifications where type='role_changed'",[]))[0].n,1,'Mudança de papel notificada')
  await actor(1)
  const invite=(await rows("select public.create_workspace_invitation($1,$2,'member') as data",[workspace,'notify4@example.test']))[0].data
  await actor(4)
  check((await rows("select count(*)::int as n from public.notifications where type='workspace_invite'",[]))[0].n,1,'Convite de workspace visível ao destinatário')
  check((await rows('select display_name from public.profiles where id=$1',[uid(1)]))[0].display_name,'User 1','Destinatário pode identificar ator do convite')
  await actor(1)
  await db.query("select public.create_workspace_invitation($1,$2,'member')",[workspace,'notify4@example.test'])
  await actor(4)
  check((await rows("select count(*)::int as n from public.notifications where type='workspace_invite'",[]))[0].n,1,'Reenvio remove aviso de convite revogado')
  await actor(1)
  await db.query('delete from public.board_members where board_id=$1 and user_id=$2',[board,uid(2)])
  await actor(2)
  check((await rows('select count(*)::int as n from public.notifications where board_id=$1',[board]))[0].n,0,'Revogação oculta notificações anteriores do board')
  check((await rows('select count(*)::int as n from public.notifications where id=$1',[invite.id]))[0].n,0,'Notificações de terceiros invisíveis por UUID')
  await root()
  check((await rows('select count(*)::int as n from public.notifications where task_id=$1 and user_id=$2 and type=\'mention\'',[task,uid(2)]))[0].n,1,'Notificação oculta preservada sem vazamento')
  console.log(`PASS: ${checks} verificações de eventos, deduplicação, RLS e atrasos.`)
} finally { await db.close() }
