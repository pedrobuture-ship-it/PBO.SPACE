import assert from 'node:assert/strict'
import { createTestDatabase } from './database-test-context.mjs'

const db = await createTestDatabase()
let checks = 0
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
async function root() { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)") }
async function actor(n) { await root(); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid(n)]); await db.exec('set role authenticated') }
async function rows(sql,args=[]) { return (await db.query(sql,args)).rows }
async function denied(sql,args=[],codes=['42501','23514','23503','40001']) {
  let caught
  try { await db.query(sql,args) } catch(e) { caught=e }
  assert.ok(caught, `Expected rejection: ${sql}`)
  assert.ok(codes.includes(caught.code), `${caught.code}: ${caught.message}`)
  checks++
}
function check(actual,expected,context) { assert.deepEqual(actual,expected,context); checks++ }
try {
  for (let n=1;n<=8;n++) await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)",[uid(n),{display_name:`User ${n}`}])
  check((await rows('select count(*)::int as n from public.profiles'))[0].n,8,'Auth provisiona profiles')
  check((await rows('select count(*)::int as n from public.workspaces'))[0].n,8,'Auth provisiona workspaces reais vazios')
  const wa=(await rows('select id from public.workspaces where owner_id=$1',[uid(1)]))[0].id
  const wb=(await rows('select id from public.workspaces where owner_id=$1',[uid(5)]))[0].id
  await actor(1)
  await root()
  for (const [n,role] of [[2,'admin'],[3,'member'],[4,'viewer'],[6,'viewer'],[7,'member'],[8,'member']]) {
    await db.query('insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,$3)',[wa,uid(n),role])
  }
  await actor(1)
  const ba=(await rows('insert into public.boards(workspace_id,name) values($1,$2) returning *',[wa,'Board A']))[0].id
  const hidden=(await rows('insert into public.boards(workspace_id,name) values($1,$2) returning *',[wa,'Board restrito']))[0].id
  for (const [n,role] of [[3,'member'],[4,'viewer'],[6,'admin'],[8,'admin']]) await db.query('insert into public.board_members(board_id,user_id,role) values($1,$2,$3)',[ba,uid(n),role])
  await actor(5)
  await rows('insert into public.boards(workspace_id,name) values($1,$2) returning *',[wb,'Board B'])
  await actor(1)
  const cols=await rows('select id,position from public.board_columns where board_id=$1 order by position',[ba])
  check(cols.map(c=>Number(c.position)),[1024,2048,3072,4096],'Colunas iniciais espaçadas')
  const ca=cols[0].id
  await actor(3)
  await rows('select * from public.create_task($1,$2,$3,$4)',[ba,ca,'Task one','medium'])
  await rows('select * from public.create_task($1,$2,$3,$4)',[ba,ca,'Task two','none'])
  await rows('select * from public.create_task($1,$2,$3,$4)',[ba,ca,'Task three','high'])
  check((await rows('select count(*)::int n from public.tasks where board_id=$1',[ba]))[0].n,3,'RPC cria uma única tarefa')
  const analytics=(await rows('select public.dashboard_analytics($1,$2,now()-interval \'7 days\',now()+interval \'1 day\',null,null) data',[wa,ba]))[0].data
  check(analytics.summary.total,3,'Analytics agrega somente tarefas do board autorizado')
  check(analytics.status.reduce((sum,item)=>sum+item.value,0),3,'Analytics retorna tarefas por status')
  check(analytics.priority.reduce((sum,item)=>sum+item.value,0),3,'Analytics retorna tarefas por prioridade')
  assert.ok(analytics.trend.length>0 && analytics.trend.every(item=>typeof item.created==='number'&&typeof item.completed==='number'&&!('value' in item))); checks++
  assert.ok(analytics.column_time.every(item=>typeof item.observations==='number'&&'avg_hours' in item&&!('value' in item))); checks++
  check(analytics.summary.previous_created,0,'Analytics retorna período anterior sem inventar uma base')
  check(analytics.cumulative_flow_available,false,'Fluxo cumulativo não é mostrado antes da cobertura histórica')
  check((await rows('select id from public.boards where id=$1',[hidden])).length,0,'Member não lê outro board do workspace')
  check((await rows('update public.boards set name=$2 where id=$1 returning id',[ba,'Burlado'])).length,0,'Member não edita board')
  check((await rows('delete from public.boards where id=$1 returning id',[ba])).length,0,'Member não remove board')
  await denied('insert into public.boards(workspace_id,name) values($1,$2)',[wa,'Burlado'])
  await denied('insert into public.board_columns(board_id,name) values($1,$2)',[ba,'Burlado'])
  await denied('update public.workspace_members set role=$3 where workspace_id=$1 and user_id=$2',[wa,uid(3),'admin'])
} catch(e) { await db.close(); throw e }
// Continua com IDs recuperados do banco (sem seed no schema de produção).
try {
  await root()
  const wa=(await rows('select id from public.workspaces where owner_id=$1',[uid(1)]))[0].id
  const wb=(await rows('select id from public.workspaces where owner_id=$1',[uid(5)]))[0].id
  const ba=(await rows("select id from public.boards where name='Board A'"))[0].id
  const bb=(await rows("select id from public.boards where name='Board B'"))[0].id
  const hidden=(await rows("select id from public.boards where name='Board restrito'"))[0].id
  const cols=await rows('select id from public.board_columns where board_id=$1 order by position',[ba])
  const ca=cols[0].id, ca2=cols[1].id
  const cb=(await rows('select id from public.board_columns where board_id=$1 order by position',[bb]))[0].id
  const tasks=await rows('select id from public.tasks where board_id=$1 order by position,id',[ba])
  const [t1,t2,t3]=tasks.map(t=>t.id)
  await actor(3)
  check((await rows('select role from public.workspace_members where workspace_id=$1 and user_id=$2',[wa,uid(3)]))[0].role,'member','Elevação do próprio papel não aconteceu')
  check((await rows('update public.board_members set role=$3 where board_id=$1 and user_id=$2 returning id',[ba,uid(3),'admin'])).length,0,'Member não eleva papel do board')
  await denied('update public.tasks set board_id=$2 where id=$1',[t1,bb],['42501'])
  await denied('update public.tasks set created_by=$2 where id=$1',[t1,uid(5)],['42501'])
  await denied('update public.tasks set column_id=$2 where id=$1',[t1,cb],['23503'])
  await denied('select public.move_task($1,$2)',[t1,cb],['23514'])
  check((await rows('update public.tasks set title=$2 where id=$1 returning title',[t1,'Task editada']))[0].title,'Task editada','Member altera tarefa')
  await db.query('select public.move_task($1,$2,$3,$4)',[t3,ca,t1,t2])
  check((await rows('select id from public.tasks where column_id=$1 order by position,id',[ca])).map(t=>t.id),[t1,t3,t2],'Move fracionado entre vizinhos')
  await denied('select public.move_task($1,$2,$3,$4)',[t2,ca,null,t3],['40001'])
  await db.query('select public.move_task($1,$2)',[t2,ca2])
  check((await rows('select column_id from public.tasks where id=$1',[t2]))[0].column_id,ca2,'Move entre colunas do mesmo board')
  check((await rows('select count(*)::int n from public.task_status_history where task_id=$1',[t2]))[0].n,2,'Histórico registra mudança de coluna')
  await denied('insert into public.task_assignees(task_id,user_id) values($1,$2)',[t1,uid(5)],['23514'])
  await denied('insert into public.task_assignees(task_id,user_id) values($1,$2)',[t1,uid(7)],['23514'])
  await db.query('insert into public.task_assignees(task_id,user_id) values($1,$2)',[t1,uid(1)])
  const comment=(await rows('insert into public.comments(task_id,content) values($1,$2) returning *',[t1,'Comentário real']))[0]
  check(comment.user_id,uid(3),'Autor é derivado do JWT')
  await db.query('insert into public.comment_mentions(comment_id,user_id) values($1,$2)',[comment.id,uid(1)])
  check((await rows('select user_id from public.comment_mentions where comment_id=$1',[comment.id]))[0].user_id,uid(1),'Menção estruturada para membro do board')
  await denied('insert into public.comment_mentions(comment_id,user_id) values($1,$2)',[comment.id,uid(5)],['42501'])
  const mentioned=(await rows('select * from public.create_comment_with_mentions($1,$2,$3::jsonb)',[t1,'Olá @User 1',JSON.stringify([uid(1)])]))[0]
  check((await rows('select user_id from public.comment_mentions where comment_id=$1',[mentioned.id]))[0].user_id,uid(1),'Comentário e menção criados na mesma transação')
  await denied('select * from public.create_comment_with_mentions($1,$2,$3::jsonb)',[t1,'Menção inválida',JSON.stringify([uid(5)])],['42501'])
  check((await rows('select id from public.comments where content=$1',['Menção inválida'])).length,0,'Menção inválida reverte comentário inteiro')
  const subtask=(await rows('select * from public.create_subtask($1,$2)',[t1,'Subtarefa real']))[0]
  check((await rows('select parent_task_id from public.task_subtasks where child_task_id=$1',[subtask.id]))[0].parent_task_id,t1,'RPC cria subtarefa vinculada atomicamente')
  await denied('insert into public.task_subtasks(parent_task_id,child_task_id) values($1,$2)',[subtask.id,t1],['23514'])
  await root()
  await db.query('delete from public.tasks where id=$1',[subtask.id])
  await actor(3)
  await denied('insert into public.comments(task_id,user_id,content) values($1,$2,$3)',[t1,uid(1),'Autor falso'],['42501'])
  const label=(await rows('insert into public.labels(board_id,name) values($1,$2) returning id',[ba,'Label A']))[0].id
  await db.query('insert into public.task_labels(task_id,label_id) values($1,$2)',[t1,label])
  await db.query('insert into public.task_dependencies(task_id,depends_on_task_id) values($1,$2)',[t1,t2])
  await db.query('insert into public.task_dependencies(task_id,depends_on_task_id) values($1,$2)',[t2,t3])
  await denied('insert into public.task_dependencies(task_id,depends_on_task_id) values($1,$2)',[t3,t1],['23514'])
  await denied('insert into public.task_dependencies(task_id,depends_on_task_id) values($1,$2)',[t1,t1],['23514'])
  const checklist=(await rows('insert into public.checklists(task_id,title) values($1,$2) returning id',[t1,'Checklist']))[0].id
  await denied('insert into public.checklist_items(checklist_id,content,assigned_to) values($1,$2,$3)',[checklist,'Item',uid(5)],['23514'])
  const path=`${ba}/${t1}/file.pdf`
  await db.query('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['task-attachments',path,uid(3)])
  await db.query('insert into public.attachments(task_id,file_name,file_url,file_size) values($1,$2,$3,$4)',[t1,'file.pdf',path,100])
  await denied('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['task-attachments',`${bb}/${t1}/invalid.pdf`,uid(3)],['42501'])
  await denied('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['avatars',`${uid(5)}/avatar.png`,uid(3)],['42501'])
  await db.query('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['avatars',`${uid(3)}/avatar.png`,uid(3)])
  await denied('insert into public.notifications(user_id,type,content) values($1,$2,$3)',[uid(3),'spoof','Falsa'],['42501'])
  await denied('insert into public.activity_logs(workspace_id,action) values($1,$2)',[wa,'spoof'],['42501'])
  await denied("select public.transfer_workspace_ownership($1,$2)",[wa,uid(3)],['42501'])
  await actor(4)
  await denied('select public.create_subtask($1,$2)',[t1,'Viewer não cria'],['42501'])
  check((await rows('select id from public.tasks where board_id=$1',[ba])).length,3,'Viewer lê tarefas permitidas')
  check((await rows('update public.tasks set title=$2 where id=$1 returning id',[t1,'Burlado'])).length,0,'Viewer não altera tarefa')
  await denied('select public.create_task($1,$2,$3)',[ba,ca,'Burlado'],['42501'])
  await denied('select public.move_task($1,$2)',[t1,ca2],['42501'])
  await denied('insert into public.comments(task_id,content) values($1,$2)',[t1,'Burlado'],['42501'])
  await denied('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['task-attachments',`${ba}/${t1}/viewer.pdf`,uid(4)],['42501'])
  check((await rows('select name from storage.objects where name=$1',[path])).length,1,'Viewer lê anexo autorizado')
  await actor(6)
  check((await rows('update public.boards set name=$2 where id=$1 returning id',[ba,'Burlado'])).length,0,'Viewer do workspace limita board admin')
  await denied('select public.create_task($1,$2,$3)',[ba,ca,'Burlado'],['42501'])
  await actor(5)
  await denied("select public.dashboard_analytics($1,null,now()-interval '7 days',now()+interval '1 day',null,null)",[wa],['42501'])
  check((await rows('select id from public.task_status_history where board_id=$1',[ba])).length,0,'Histórico de status não vaza para outro workspace')
  check((await rows('select id from public.workspaces where id=$1',[wa])).length,0,'Isolamento entre workspaces')
  check((await rows('select id from public.boards where id=$1',[ba])).length,0,'Isolamento entre boards')
  check((await rows('select id from public.tasks where board_id=$1',[ba])).length,0,'Task não vaza entre tenants')
  check((await rows('select id from public.profiles where id=$1',[uid(3)])).length,0,'Profile externo não vaza')
  check((await rows('select name from storage.objects where name=$1',[path])).length,0,'Arquivo externo não vaza')
  const lb=(await rows('insert into public.labels(board_id,name) values($1,$2) returning id',[bb,'Label B']))[0].id
  const tb=(await rows('select * from public.create_task($1,$2,$3)',[bb,cb,'Task B']))[0].id
  await actor(1)
  await denied('insert into public.task_subtasks(parent_task_id,child_task_id) values($1,$2)',[t1,tb],['42501','23514'])
  await denied('insert into public.task_labels(task_id,label_id) values($1,$2)',[t1,lb],['23514'])
  await denied('insert into public.task_dependencies(task_id,depends_on_task_id) values($1,$2)',[t1,tb],['42501','23514'])
  await denied('update public.workspaces set owner_id=$2 where id=$1',[wa,uid(3)],['42501'])
  await denied('update public.workspace_members set role=$3 where workspace_id=$1 and user_id=$2',[wa,uid(3),'owner'],['23514','42501'])
  check((await rows('delete from public.workspace_members where workspace_id=$1 and user_id=$2 returning id',[wa,uid(1)])).length,0,'Owner não pode ser removido por RLS')
  const notices=await rows('select id from public.notifications where user_id=$1',[uid(1)])
  assert.ok(notices.length>0); checks++
  const notice=notices[0].id
  await db.query('update public.notifications set read=true where id=$1',[notice])
  await denied('update public.notifications set content=$2 where id=$1',[notice,'Burlado'],['42501'])
  await actor(3)
  check((await rows('select id from public.notifications where id=$1',[notice])).length,0,'Notificação só do destinatário')
  check((await rows('update public.notifications set read=false where id=$1 returning id',[notice])).length,0,'Não marca inbox alheio')
  await actor(2)
  check((await rows('update public.boards set description=$2 where id=$1 returning id',[hidden,'Atualizado'])).length,1,'Admin de workspace administra todos os boards')
  await actor(8)
  check((await rows('update public.boards set description=$2 where id=$1 returning id',[ba,'Atualizado'])).length,1,'Board admin administra esse board')
  check((await rows('update public.workspaces set name=$2 where id=$1 returning id',[wa,'Burlado'])).length,0,'Board admin não administra workspace')
  await actor(4)
  await actor(1)
  const extraWorkspace=(await rows('insert into public.workspaces(name) values($1) returning id',['Outro workspace']))[0].id
  check((await rows('select role from public.workspace_members where workspace_id=$1 and user_id=$2',[extraWorkspace,uid(1)]))[0].role,'owner','Workspace API retorna novo owner')
  await db.query('delete from public.workspaces where id=$1',[extraWorkspace])
  const extraColumn=(await rows('select * from public.create_column($1,$2)',[ba,'Revisão']))[0]
  check(extraColumn.name,'Revisão','RPC cria coluna')
  await db.query('select public.move_column($1,$2,$3)',[extraColumn.id,null,ca])
  check((await rows('select id from public.board_columns where board_id=$1 order by position,id',[ba]))[0].id,extraColumn.id,'RPC move coluna no início')
  await denied('delete from public.board_columns where id=$1',[ca],['23503'])
  await db.query('delete from public.board_columns where id=$1',[extraColumn.id])
  await actor(4)
  await denied('select public.create_column($1,$2)',[ba,'Burlado'],['42501'])
  await denied('select public.move_column($1)',[ca],['42501'])
  const topic=`board:${ba}:user:${uid(4)}`
  await db.query("select set_config('realtime.topic',$1,false)",[topic])
  assert.ok((await rows('select id from realtime.messages where topic=$1',[topic])).length>0); checks++
  await denied('insert into realtime.messages(topic,extension,payload,event,private) values($1,$2,$3,$4,true)',[topic,'broadcast',{},'data-change'],['42501'])
  await db.query("select set_config('realtime.topic',$1,false)",[`board:${ba}:user:${uid(1)}`])
  check((await rows('select id from realtime.messages')).length,0,'Não recebe canal de outro usuário')
  await root()
  await db.query('update public.tasks set position=1 where id=$1',[t1])
  await db.query('update public.tasks set position=1.000000000000000001 where id=$1',[t3])
  await actor(3)
  await db.query('select public.move_task($1,$2,$3,$4)',[t2,ca,t1,t3])
  const ordered=await rows('select id,position from public.tasks where column_id=$1 order by position,id',[ca])
  check(ordered.map(t=>t.id),[t1,t2,t3],'Rebalanceamento quando precisão esgota')
  assert.ok(Number(ordered[1].position)>Number(ordered[0].position)); checks++
  await actor(1)
  await db.query('delete from public.board_members where board_id=$1 and user_id=$2',[ba,uid(3)])
  await root()
  const prior=(await rows('select count(*)::int n from realtime.messages where topic=$1',[`board:${ba}:user:${uid(3)}`]))[0].n
  await actor(1)
  await db.query('update public.tasks set description=$2 where id=$1',[t1,'Depois da revogação'])
  await root()
  check((await rows('select count(*)::int n from realtime.messages where topic=$1',[`board:${ba}:user:${uid(3)}`]))[0].n,prior,'Fanout para imediatamente após revogação')
  await actor(3)
  check((await rows('select id from public.tasks where board_id=$1',[ba])).length,0,'Revogação impede leitura imediatamente')
  await actor(1)
  await db.query('select public.transfer_workspace_ownership($1,$2)',[wa,uid(2)])
  check((await rows('select owner_id from public.workspaces where id=$1',[wa]))[0].owner_id,uid(2),'Transferência atômica de propriedade')
  check((await rows('select role from public.workspace_members where workspace_id=$1 and user_id=$2',[wa,uid(1)]))[0].role,'admin','Owner anterior vira admin')
  await actor(2)
  await db.query('delete from public.boards where id=$1',[ba])
  await root()
  check((await rows('select id from public.tasks where board_id=$1',[ba])).length,0,'Cascade de board remove tarefas')
  check((await rows('select id from public.comments where task_id=$1',[t1])).length,0,'Cascade remove comentários')
  check((await rows('select id from public.attachments where task_id=$1',[t1])).length,0,'Cascade remove metadados dos anexos')
  check((await rows('select task_id from public.task_dependencies where task_id=$1',[t1])).length,0,'Cascade remove dependências')
  assert.ok((await rows('select id from public.activity_logs where workspace_id=$1',[wa])).length>0); checks++
  await actor(5)
  await db.query('delete from public.workspaces where id=$1',[wb])
  check((await rows('select id from public.boards where id=$1',[bb])).length,0,'Workspace cascade remove boards')
  check((await rows('select id from public.tasks where id=$1',[tb])).length,0,'Workspace cascade remove tarefas')
  await root()
  await db.exec('set role anon')
  await denied('select * from public.boards',[],['42501'])
  await denied('select public.create_task($1,$2,$3)',[ba,ca,'Burlado'],['42501'])
  await root()
  check((await rows("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity"))[0].n,22,'RLS habilitado nas 22 tabelas')
  check((await rows("select public from storage.buckets order by id")).map(b=>b.public),[false,false],'Buckets privados')
  check((await rows("select allowed_mime_types from storage.buckets where id='task-attachments'"))[0].allowed_mime_types,
    ['image/jpeg','image/png','image/webp','image/avif','application/pdf','text/plain'],
    'Storage restringe MIME dos anexos mesmo em chamadas fora do React')
  await db.exec('set role authenticated')
  await denied("select public.consume_admin_action_quota($1,'admin-reset-user-password',2,3600)",[uid(1)],['42501'])
  await root(); await db.exec('set role service_role')
  check((await rows("select public.consume_admin_action_quota($1,'admin-reset-user-password',2,3600) as permitted",[uid(1)]))[0].permitted,true,'Primeira ação administrativa permitida')
  check((await rows("select public.consume_admin_action_quota($1,'admin-reset-user-password',2,3600) as permitted",[uid(1)]))[0].permitted,true,'Segunda ação administrativa permitida')
  check((await rows("select public.consume_admin_action_quota($1,'admin-reset-user-password',2,3600) as permitted",[uid(1)]))[0].permitted,false,'Limite transacional bloqueia terceira ação')
  check((await rows("select public.consume_admin_action_quota($1,'admin-reset-user-password',2,3600) as permitted",[uid(2)]))[0].permitted,true,'Quota isolada por operador')
  console.log(`PASS: ${checks} verificações PostgreSQL de schema, permissões, isolamento, Storage, Realtime e ordenação.`)
} finally { await db.close() }
