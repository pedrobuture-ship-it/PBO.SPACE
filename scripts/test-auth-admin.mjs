import assert from 'node:assert/strict'
import { createTestDatabase } from './database-test-context.mjs'
const db = await createTestDatabase()
const uid = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
let checks = 0
async function rows(sql, args = []) { return (await db.query(sql, args)).rows }
async function root() { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)") }
async function actor(n) { await root(); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid(n)]); await db.exec('set role authenticated') }
function check(actual, expected, label) { assert.deepEqual(actual, expected, label); checks++ }
async function denied(sql, args, expectedCodes = ['42501']) {
  let failure
  try { await db.query(sql, args) } catch (error) { failure = error }
  assert.ok(failure, `Expected rejection: ${sql}`)
  assert.ok(expectedCodes.includes(failure.code), `${failure.code}: ${failure.message}`)
  checks++
}
try {
  for (let n = 1; n <= 5; n++) await db.query(
    'insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',
    [uid(n), `person${n}@example.test`, { display_name: `Pessoa ${n}`, app_role: 'superadmin' }],
  )
  check((await rows('select app_role from public.profiles order by id')).map(item => item.app_role), Array(5).fill('user'), 'Cadastro ignora app_role em metadados')
  check((await rows('select count(*)::int n from public.profiles'))[0].n, 5, 'Profiles automáticos com UUID do Auth')
  await actor(1)
  await denied("update public.profiles set app_role='superadmin' where id=$1", [uid(1)])
  await denied("update public.profiles set disabled_at=now() where id=$1", [uid(1)])
  check((await rows("update public.profiles set display_name='Nome editado' where id=$1 returning id", [uid(1)])).length, 1, 'Campos de perfil permitidos continuam editáveis pelo usuário')
  await denied('select * from public.admin_list_users()', [])
  check((await rows("select to_regprocedure('public.admin_set_user_role(uuid,public.app_role)') is null as removed"))[0].removed, true, 'RPC de promoção global foi removida')
  check((await rows("select has_column_privilege('authenticated','public.profiles','app_role','UPDATE') as allowed"))[0].allowed, false, 'Cliente não pode alterar app_role via REST')
  check((await rows("select has_column_privilege('authenticated','public.profiles','disabled_at','UPDATE') as allowed"))[0].allowed, false, 'Cliente não pode alterar disabled_at via REST')
  await root()
  await db.query("update public.profiles set app_role='superadmin' where id=$1", [uid(1)])
  await actor(1)
  const users = await rows('select id,email,app_role,status,total_count from public.admin_list_users($1,$2,$3,$4,$5)', ['person', null, null, 20, 0])
  check(users.length, 5, 'Superadmin lista usuários sem depender de workspace')
  check(users[0].total_count, 5, 'Paginação retorna total')
  check(users.map(item => item.email).includes('person2@example.test'), true, 'Email disponível somente na RPC admin')
  await root()
  await db.query("update public.profiles set app_role='admin' where id=$1", [uid(2)])
  await db.query("update public.profiles set app_role='superadmin' where id=$1", [uid(3)])
  await actor(1)
  check((await rows("select count(*)::int n from public.admin_list_users($1,'superadmin')", ['person']))[0].n, 2, 'Filtro de cargo global')
  await actor(2)
  check((await rows('select count(*)::int n from public.admin_list_users()'))[0].n, 5, 'Admin pode listar')
  check((await rows("select to_regprocedure('public.admin_set_user_role(uuid,public.app_role)') is null as removed"))[0].removed, true, 'Nem admin global possui RPC de promoção')
  await root()
  await db.query('update public.profiles set disabled_at=now() where id=$1', [uid(4)])
  await actor(4)
  check((await rows('select id from public.workspaces')).length, 0, 'Conta desativada não acessa workspace com JWT antigo')
  check((await rows('select disabled_at from public.profiles where id=$1', [uid(4)]))[0].disabled_at !== null, true, 'Usuário pode ver estado da própria conta')
  check((await rows("update public.profiles set display_name='Burlado' where id=$1 returning id", [uid(4)])).length, 0, 'Conta desativada não altera perfil')
  await denied('select * from public.admin_list_users()', [])
  await actor(1)
  await root()
  await db.query('update public.profiles set disabled_at=null where id=$1', [uid(4)])
  await root()
  await db.query("update public.profiles set app_role='user' where id=$1", [uid(3)])
  await actor(1)
  check((await rows("select to_regprocedure('public.admin_set_user_role(uuid,public.app_role)') is null as removed"))[0].removed, true, 'Promoção continua indisponível pela aplicação')
  await root()
  await db.query("update public.profiles set app_role='superadmin' where id=$1", [uid(3)])
  await db.query("update public.profiles set app_role='user' where id=$1", [uid(1)])
  await actor(1)
  await denied('select * from public.admin_list_users()', [])
  await root()
  check((await rows("select relrowsecurity from pg_class where oid='public.profiles'::regclass"))[0].relrowsecurity, true, 'RLS profiles ativa')
  check((await rows("select count(*)::int n from pg_policy where polname='account_active'"))[0].n, 20, 'Policy restritiva em todas as tabelas colaborativas')
  check((await rows("select tablename from pg_policies where policyname='account_active' and tablename in ('task_subtasks','comment_mentions','workspace_invitations') order by tablename")).map(row => row.tablename), ['comment_mentions','task_subtasks','workspace_invitations'], 'Tabelas incrementais também bloqueiam contas desativadas')
  console.log(`PASS: ${checks} verificações de Auth, cargos globais e gestão administrativa.`)
} catch (error) {
  console.error(error.message, error.code ?? '')
  process.exitCode = 1
} finally { await db.close() }
