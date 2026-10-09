import { writeFile } from 'node:fs/promises'
import { createTestDatabase } from './database-test-context.mjs'

const db = await createTestDatabase()
try {
  const { rows: columns } = await db.query(`select table_name,column_name,is_nullable,column_default,data_type,udt_name from information_schema.columns where table_schema='public' order by table_name,ordinal_position`)
  const { rows: fks } = await db.query(`select cl.relname as table_name,c.conname as name, array(select a.attname from unnest(c.conkey) with ordinality u(attnum,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.attnum order by u.ord) as columns, fr.relname as referenced_relation,array(select a.attname from unnest(c.confkey) with ordinality u(attnum,ord) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=u.attnum order by u.ord) as referenced_columns from pg_constraint c join pg_class cl on cl.oid=c.conrelid join pg_namespace ns on ns.oid=cl.relnamespace join pg_class fr on fr.oid=c.confrelid where c.contype='f' and ns.nspname='public' order by cl.relname,c.conname`)
  const { rows: enums } = await db.query(`select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as values from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname`)
  const { rows: functions } = await db.query(`select p.proname, p.proretset, p.proargnames, array(select t.typname from unnest(p.proargtypes::oid[]) with ordinality u(id,ord) join pg_type t on t.oid=u.id order by u.ord) as argtypes, p.pronargdefaults, rt.typname as returntype from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type rt on rt.oid=p.prorettype where n.nspname='public' and has_function_privilege('authenticated',p.oid,'EXECUTE') order by p.proname`)
  const enumNames = new Set(enums.map(e => e.typname))
  function type(udt) {
    if (enumNames.has(udt)) return `Database['public']['Enums']['${udt}']`
    if (['numeric','int2','int4','int8','float4','float8'].includes(udt)) return 'number'
    if (udt === 'bool') return 'boolean'
    if (['json','jsonb'].includes(udt)) return 'Json'
    if (udt === 'void') return 'undefined'
    return 'string'
  }
  const tables = [...new Set(columns.map(c => c.table_name))]
  let out = `// Generated from the migrated PostgreSQL catalog. Run npm run db:types after SQL changes.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]\nexport type AdminUser = { id: string; display_name: string; username: string | null; avatar_url: string | null; email: string | null; app_role: 'superadmin' | 'admin' | 'user'; created_at: string; status: 'active' | 'invited' | 'disabled'; total_count: number }\n\nexport type Database = {\n  public: {\n    Tables: {\n`
  for (const table of tables) {
    out += `      ${table}: {\n`
    for (const kind of ['Row','Insert','Update']) {
      out += `        ${kind}: {\n`
      for (const col of columns.filter(c => c.table_name === table)) {
        const nullable = col.is_nullable === 'YES'
        const optional = kind === 'Update' || (kind === 'Insert' && (nullable || col.column_default !== null))
        out += `          ${col.column_name}${optional ? '?' : ''}: ${type(col.udt_name)}${nullable ? ' | null' : ''}\n`
      }
      out += '        }\n'
    }
    out += '        Relationships: [\n'
    for (const fk of fks.filter(k => k.table_name === table)) {
      out += `          { foreignKeyName: ${JSON.stringify(fk.name)}; columns: ${JSON.stringify(fk.columns)}; isOneToOne: ${table === 'profiles'}; referencedRelation: ${JSON.stringify(fk.referenced_relation)}; referencedColumns: ${JSON.stringify(fk.referenced_columns)} },\n`
    }
    out += '        ]\n      }\n'
  }
  out += '    }\n    Views: { [_ in never]: never }\n    Functions: {\n'
  for (const fn of functions) {
    out += `      ${fn.proname}: {\n        Args: {\n`
      fn.proargnames.slice(0, fn.argtypes.length).forEach((name,i) => {
      out += `          ${name}${i >= fn.argtypes.length - fn.pronargdefaults ? '?' : ''}: ${type(fn.argtypes[i])}${(name.endsWith('_id') || name === 'p_role' || name === 'p_status' || name === 'p_priority') && i >= fn.argtypes.length - fn.pronargdefaults ? ' | null' : ''}\n`
    })
    out += `        }\n        Returns: ${fn.proname === 'admin_list_users' ? 'AdminUser' : tables.includes(fn.returntype) ? `Database['public']['Tables']['${fn.returntype}']['Row']` : type(fn.returntype)}${fn.proretset ? '[]' : ''}\n      }\n`
  }
  out += '    }\n    Enums: {\n'
  for (const e of enums) out += `      ${e.typname}: ${e.values.map(v => JSON.stringify(v)).join(' | ')}\n`
  out += "    }\n    CompositeTypes: { [_ in never]: never }\n  }\n}\n\nexport type TableName = keyof Database['public']['Tables']\nexport type Tables<T extends TableName> = Database['public']['Tables'][T]['Row']\nexport type Inserts<T extends TableName> = Database['public']['Tables'][T]['Insert']\nexport type Updates<T extends TableName> = Database['public']['Tables'][T]['Update']\n"
  await writeFile(new URL('../src/types/database.ts', import.meta.url), out)
  console.log(`Generated types for ${tables.length} tables and ${functions.length} RPCs.`)
} finally { await db.close() }
