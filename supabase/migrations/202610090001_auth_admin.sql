-- Extensão aditiva: cargos globais, administração e bloqueio de contas.
-- Executar após 202610080001_kanban_data.sql.
begin;

create type public.app_role as enum ('superadmin', 'admin', 'user');
alter table public.profiles
  add column app_role public.app_role not null default 'user',
  add column disabled_at timestamptz;
create index profiles_app_role_idx on public.profiles (app_role, id);

-- O trigger anterior insere somente id/display_name. Os defaults agora garantem
-- app_role=user para registros novos e existentes, independentemente de metadados.
-- Não conceder UPDATE(app_role,disabled_at) a authenticated.

create function kanban_private.current_app_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select case when p.disabled_at is null then p.app_role else null end
  from public.profiles p where p.id = auth.uid();
$$;
create function kanban_private.account_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.disabled_at is null);
$$;

-- Uma sessão banida ainda pode ter JWT válido até seu vencimento. Esta policy
-- restritiva bloqueia também chamadas diretas ao PostgREST com esse JWT.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'workspaces','workspace_members','boards','board_members','board_columns','tasks',
    'task_assignees','labels','task_labels','checklists','checklist_items','comments',
    'attachments','task_dependencies','notifications','activity_logs','favorites'
  ] loop
    execute format('create policy account_active on public.%I as restrictive for all to authenticated using (kanban_private.account_active()) with check (kanban_private.account_active())',table_name);
  end loop;
end $$;
create policy profiles_active_write on public.profiles as restrictive for update to authenticated
  using (kanban_private.account_active()) with check (kanban_private.account_active());
create policy admin_avatars_read on storage.objects for select to authenticated
  using (bucket_id='avatars' and kanban_private.current_app_role() in ('admin','superadmin'));
create policy kanban_storage_active on storage.objects as restrictive for all to authenticated
  using (bucket_id not in ('avatars','task-attachments') or kanban_private.account_active())
  with check (bucket_id not in ('avatars','task-attachments') or kanban_private.account_active());

-- A tabela profiles mantém SELECT do próprio usuário para que a UI mostre
-- o estado da conta. Outros dados continuam protegidos pelas policies antigas.
create function public.admin_list_users(
  p_search text default '', p_role public.app_role default null,
  p_status text default null, p_limit integer default 50, p_offset integer default 0
)
returns table(
  id uuid, display_name text, username text, avatar_url text,
  email text, app_role public.app_role, created_at timestamptz,
  status text, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(kanban_private.current_app_role() in ('admin','superadmin'),false) then
    raise exception 'Acesso administrativo negado' using errcode='42501';
  end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 or p_status not in ('active','invited','disabled') then
    raise exception 'Filtro inválido' using errcode='22023';
  end if;
  return query
    select p.id,p.display_name,p.username,p.avatar_url,u.email,p.app_role,u.created_at,
      case when p.disabled_at is not null then 'disabled'
           when u.email_confirmed_at is null then 'invited'
           else 'active' end::text as status,
      count(*) over() as total_count
    from public.profiles p
    join auth.users u on u.id=p.id
    where (coalesce(p_search,'')='' or p.display_name ilike '%'||p_search||'%'
      or p.username ilike '%'||p_search||'%' or u.email ilike '%'||p_search||'%')
      and (p_role is null or p.app_role=p_role)
      and (p_status is null or p_status=case when p.disabled_at is not null then 'disabled'
          when u.email_confirmed_at is null then 'invited' else 'active' end)
    order by p.created_at desc,p.id
    limit p_limit offset p_offset;
end $$;

-- Serializar trocas de cargo e desativações protege o último superadmin.
create function public.admin_set_user_role(p_user_id uuid,p_role public.app_role)
returns public.app_role language plpgsql security definer set search_path = '' as $$
declare caller_role public.app_role; old_role public.app_role;
begin
  perform pg_advisory_xact_lock(hashtextextended('kanban:global-admin',0));
  caller_role:=kanban_private.current_app_role();
  if not coalesce(caller_role in ('admin','superadmin'),false) or p_role is null then
    raise exception 'Acesso administrativo negado' using errcode='42501';
  end if;
  select p.app_role into old_role from public.profiles p where p.id=p_user_id for update;
  if old_role is null then raise exception 'Usuário não encontrado' using errcode='P0002'; end if;
  if caller_role='admin' and (p_user_id=auth.uid() or old_role<>'user' or p_role<>'user') then
    raise exception 'Admin pode gerenciar somente usuários comuns' using errcode='42501';
  end if;
  if old_role='superadmin' and p_role<>'superadmin'
    and (select count(*) from public.profiles where app_role='superadmin' and disabled_at is null)<=1 then
    raise exception 'Não é possível remover o último superadmin' using errcode='23514';
  end if;
  update public.profiles set app_role=p_role where public.profiles.id=p_user_id;
  return p_role;
end $$;

create function public.admin_set_user_status(p_user_id uuid,p_disabled boolean)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare caller_role public.app_role; target_role public.app_role; prior_disabled timestamptz; result timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('kanban:global-admin',0));
  caller_role:=kanban_private.current_app_role();
  if not coalesce(caller_role in ('admin','superadmin'),false) or p_disabled is null or p_user_id=auth.uid() then
    raise exception 'Acesso administrativo negado' using errcode='42501';
  end if;
  select p.app_role,p.disabled_at into target_role,prior_disabled from public.profiles p where p.id=p_user_id for update;
  if target_role is null then raise exception 'Usuário não encontrado' using errcode='P0002'; end if;
  if caller_role='admin' and target_role<>'user' then
    raise exception 'Admin pode gerenciar somente usuários comuns' using errcode='42501';
  end if;
  if p_disabled and target_role='superadmin' and prior_disabled is null
    and (select count(*) from public.profiles where app_role='superadmin' and disabled_at is null)<=1 then
    raise exception 'Não é possível desativar o último superadmin' using errcode='23514';
  end if;
  update public.profiles set disabled_at=case when p_disabled then coalesce(disabled_at,now()) else null end
    where public.profiles.id=p_user_id returning disabled_at into result;
  return result;
end $$;

revoke execute on function kanban_private.current_app_role(),kanban_private.account_active() from public,anon;
grant execute on function kanban_private.current_app_role(),kanban_private.account_active() to authenticated;
revoke execute on function public.admin_list_users(text,public.app_role,text,integer,integer),
  public.admin_set_user_role(uuid,public.app_role),public.admin_set_user_status(uuid,boolean) from public,anon;
grant execute on function public.admin_list_users(text,public.app_role,text,integer,integer),
  public.admin_set_user_role(uuid,public.app_role),public.admin_set_user_status(uuid,boolean) to authenticated;

-- Realtime privado deixa de aceitar assinaturas de contas desativadas.
create or replace function kanban_private.can_receive_topic(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare bid uuid;
begin
  if not kanban_private.account_active() then return false; end if;
  if p_topic='notifications:'||auth.uid()::text then return true; end if;
  if p_topic !~ '^board:[0-9a-fA-F-]{36}:user:[0-9a-fA-F-]{36}$' or split_part(p_topic,':',4) <> auth.uid()::text then return false; end if;
  begin bid:=split_part(p_topic,':',2)::uuid; exception when invalid_text_representation then return false; end;
  return kanban_private.can_read_board(bid);
end $$;

notify pgrst, 'reload schema';
commit;
