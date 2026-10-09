-- HANDCRAFTED DIGITAL WORKSPACE — modelo real, permissões e API transacional.
-- Executar uma vez no SQL Editor do Supabase, em um projeto sem o schema legado.
-- Nenhum dado de demonstração é criado. BEGIN garante rollback se houver conflito.
begin;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public'
    and table_name = any(array['profiles','workspaces','workspace_members','boards','board_members','board_columns','tasks','task_assignees','labels','task_labels','checklists','checklist_items','comments','attachments','task_dependencies','notifications','activity_logs','favorites'])) then
    raise exception 'Já existem tabelas da aplicação. Esta migração é inicial; não apaga nem sobrescreve dados. Migre o schema existente antes de aplicá-la.';
  end if;
end $$;

create schema if not exists kanban_private;
revoke all on schema kanban_private from public, anon;
grant usage on schema kanban_private to authenticated;

create type public.member_role as enum ('owner','admin','member','viewer');
create type public.task_priority as enum ('none','low','medium','high','urgent');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  username text check (username ~ '^[a-z0-9_]{3,32}$'),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_username_unique on public.profiles (lower(username)) where username is not null;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  description text check (char_length(description) <= 2000),
  owner_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create unique index workspace_single_owner on public.workspace_members (workspace_id) where role = 'owner';
create index workspace_members_user_idx on public.workspace_members (user_id, workspace_id);
create index workspaces_owner_idx on public.workspaces (owner_id);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  description text check (char_length(description) <= 5000),
  icon text not null default 'layers' check (char_length(icon) <= 64),
  color text not null default '#4c8dff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boards_workspace_idx on public.boards (workspace_id, archived, created_at desc);
create index boards_creator_idx on public.boards (created_by);
create table public.board_members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (board_id, user_id)
);
create index board_members_user_idx on public.board_members (user_id, board_id);

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  position numeric(38,18) not null default 1024 check (position <> 'NaN'::numeric),
  color text not null default '#69dff1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  wip_limit integer check (wip_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, board_id)
);
create index columns_order_idx on public.board_columns (board_id, position, id);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  column_id uuid not null,
  title text not null check (char_length(btrim(title)) between 2 and 300),
  description text check (char_length(description) <= 50000),
  priority public.task_priority not null default 'none',
  position numeric(38,18) not null default 1024 check (position <> 'NaN'::numeric),
  due_date timestamptz,
  start_date timestamptz,
  estimated_minutes integer check (estimated_minutes >= 0),
  archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (start_date is null or due_date is null or start_date <= due_date),
  foreign key (column_id, board_id) references public.board_columns(id, board_id)
    on delete no action deferrable initially deferred
);
create index tasks_order_idx on public.tasks (column_id, archived, position, id);
create index tasks_board_idx on public.tasks (board_id, archived, position, id);
create index tasks_due_idx on public.tasks (board_id, due_date) where not archived and completed_at is null;
create index tasks_creator_idx on public.tasks (created_by);

create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (task_id, user_id)
);
create index task_assignees_user_idx on public.task_assignees (user_id, task_id);
create table public.labels (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  color text not null default '#b49aff' check (color ~ '^#[0-9a-fA-F]{6}$')
);
create unique index labels_board_name_unique on public.labels (board_id, lower(name));
create table public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);
create index task_labels_label_idx on public.task_labels (label_id, task_id);
create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  position numeric(38,18) not null default 1024 check (position <> 'NaN'::numeric)
);
create index checklists_task_order_idx on public.checklists (task_id, position, id);
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  completed boolean not null default false,
  position numeric(38,18) not null default 1024 check (position <> 'NaN'::numeric),
  assigned_to uuid references public.profiles(id) on delete set null,
  due_date timestamptz
);
create index checklist_items_order_idx on public.checklist_items (checklist_id, position, id);
create index checklist_items_assignee_idx on public.checklist_items (assigned_to) where assigned_to is not null;
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_task_created_idx on public.comments (task_id, created_at, id);
create index comments_user_idx on public.comments (user_id);
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_url text not null unique, -- caminho no bucket privado; URL assinada é gerada sob demanda
  file_type text not null default 'application/octet-stream',
  file_size bigint not null check (file_size between 0 and 10485760),
  created_at timestamptz not null default now()
);
create index attachments_task_idx on public.attachments (task_id, created_at);
create index attachments_user_idx on public.attachments (user_id);
create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  check (task_id <> depends_on_task_id),
  unique (task_id, depends_on_task_id)
);
create index dependencies_reverse_idx on public.task_dependencies (depends_on_task_id, task_id);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (char_length(type) between 1 and 100),
  board_id uuid references public.boards(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  content text not null check (char_length(content) between 1 and 2000),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_inbox_idx on public.notifications (user_id, read, created_at desc);
create index notifications_board_idx on public.notifications (board_id);
create index notifications_task_idx on public.notifications (task_id);
create index notifications_actor_idx on public.notifications (actor_id);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  board_id uuid references public.boards(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index activity_workspace_idx on public.activity_logs (workspace_id, created_at desc);
create index activity_board_idx on public.activity_logs (board_id, created_at desc);
create index activity_task_idx on public.activity_logs (task_id, created_at desc);
create index activity_user_idx on public.activity_logs (user_id);
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, board_id)
);
create index favorites_board_idx on public.favorites (board_id);

-- Helpers privados evitam recursão de RLS. auth.uid() é sempre a identidade do JWT.
create function kanban_private.workspace_role_for_user(p_workspace uuid, p_user uuid)
returns public.member_role language sql stable security definer set search_path = '' as $$
  select role from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
$$;
create function kanban_private.board_role_for_user(p_board uuid, p_user uuid)
returns public.member_role language sql stable security definer set search_path = '' as $$
  select case
    when wm.role in ('owner','admin') then wm.role
    when bm.user_id is null then null
    when wm.role = 'viewer' then 'viewer'::public.member_role
    else bm.role
  end
  from public.boards b
  join public.workspace_members wm on wm.workspace_id = b.workspace_id and wm.user_id = p_user
  left join public.board_members bm on bm.board_id = b.id and bm.user_id = p_user
  where b.id = p_board;
$$;
create function kanban_private.workspace_role(p_workspace uuid)
returns public.member_role language sql stable security definer set search_path = '' as $$
  select kanban_private.workspace_role_for_user(p_workspace,auth.uid());
$$;
create function kanban_private.board_role(p_board uuid)
returns public.member_role language sql stable security definer set search_path = '' as $$
  select kanban_private.board_role_for_user(p_board,auth.uid());
$$;
create function kanban_private.can_manage_workspace(p_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(kanban_private.workspace_role(p_workspace) in ('owner','admin'), false);
$$;
create function kanban_private.can_read_board(p_board uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select kanban_private.board_role(p_board) is not null;
$$;
create function kanban_private.can_edit_board(p_board uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(kanban_private.board_role(p_board) in ('owner','admin','member'), false);
$$;
create function kanban_private.can_manage_board(p_board uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(kanban_private.board_role(p_board) in ('owner','admin'), false);
$$;
create function kanban_private.task_board(p_task uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select board_id from public.tasks where id = p_task;
$$;
create function kanban_private.checklist_task(p_checklist uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select task_id from public.checklists where id = p_checklist;
$$;
create function kanban_private.can_read_task(p_task uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select kanban_private.can_read_board(kanban_private.task_board(p_task));
$$;
create function kanban_private.can_edit_task(p_task uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select kanban_private.can_edit_board(kanban_private.task_board(p_task));
$$;
create function kanban_private.can_read_profile(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user = auth.uid() or exists (
    select 1 from public.workspace_members mine
    join public.workspace_members other on other.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid() and other.user_id = p_user
  );
$$;

-- Campos de identidade e pai não podem ser reatribuídos por UPDATE.
-- Exclusões de Auth que aplicam SET NULL a autores permanecem válidas.
create function kanban_private.guard_identity() returns trigger
language plpgsql set search_path = '' as $$
declare k text;
begin
  foreach k in array tg_argv loop
    if (to_jsonb(new)->k) is distinct from (to_jsonb(old)->k) then
      if k in ('created_by','user_id','actor_id') and to_jsonb(new)->k = 'null'::jsonb then
        continue; -- RLS/grants impedem mudança direta; apenas FK de exclusão usa esse caminho.
      end if;
      raise exception 'Campo imutável: %', k using errcode = '23514';
    end if;
  end loop;
  return new;
end $$;
create function kanban_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create trigger profile_identity before update on public.profiles for each row execute function kanban_private.guard_identity('id','created_at');
create trigger workspace_identity before update on public.workspaces for each row execute function kanban_private.guard_identity('id','created_at');
create trigger workspace_member_identity before update on public.workspace_members for each row execute function kanban_private.guard_identity('id','workspace_id','user_id','joined_at');
create trigger board_identity before update on public.boards for each row execute function kanban_private.guard_identity('id','workspace_id','created_by','created_at');
create trigger board_member_identity before update on public.board_members for each row execute function kanban_private.guard_identity('id','board_id','user_id','created_at');
create trigger column_identity before update on public.board_columns for each row execute function kanban_private.guard_identity('id','board_id','created_at');
create trigger task_identity before update on public.tasks for each row execute function kanban_private.guard_identity('id','board_id','created_by','created_at');
create trigger label_identity before update on public.labels for each row execute function kanban_private.guard_identity('id','board_id');
create trigger checklist_identity before update on public.checklists for each row execute function kanban_private.guard_identity('id','task_id');
create trigger checklist_item_identity before update on public.checklist_items for each row execute function kanban_private.guard_identity('id','checklist_id');
create trigger comment_identity before update on public.comments for each row execute function kanban_private.guard_identity('id','task_id','user_id','created_at');

-- Proprietário do workspace: membro obrigatório, único e protegido contra remoção.
create function kanban_private.guard_workspace_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare wid uuid; uid uuid;
begin
  wid := case when tg_op = 'DELETE' then old.workspace_id else new.workspace_id end;
  select owner_id into uid from public.workspaces where id = wid;
  if tg_op = 'DELETE' then
    if uid = old.user_id then raise exception 'Transfira a propriedade antes de remover o owner' using errcode = '23514'; end if;
    return old;
  end if;
  if (new.role = 'owner') is distinct from (new.user_id = uid) then
    raise exception 'O papel owner deve corresponder ao proprietário do workspace' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger workspace_owner_guard before insert or update or delete on public.workspace_members
for each row execute function kanban_private.guard_workspace_owner();
create function kanban_private.validate_workspace_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare wid uuid;
begin
  wid := case when tg_table_name = 'workspaces' then (to_jsonb(new)->>'id')::uuid
    when tg_op = 'DELETE' then (to_jsonb(old)->>'workspace_id')::uuid else (to_jsonb(new)->>'workspace_id')::uuid end;
  if exists (select 1 from public.workspaces w where w.id = wid and not exists (
    select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = w.owner_id and m.role = 'owner'
  )) then raise exception 'Workspace sem membership válido do owner' using errcode = '23514'; end if;
  return null;
end $$;
create constraint trigger workspace_owner_consistency after insert or update on public.workspaces
  deferrable initially deferred for each row execute function kanban_private.validate_workspace_owner();
create constraint trigger workspace_member_owner_consistency after insert or update or delete on public.workspace_members
  deferrable initially deferred for each row execute function kanban_private.validate_workspace_owner();
create function kanban_private.initialize_workspace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspace_members(workspace_id,user_id,role) values (new.id,new.owner_id,'owner');
  return new;
end $$;
create trigger workspace_created after insert on public.workspaces for each row execute function kanban_private.initialize_workspace();

create function kanban_private.validate_relations() returns trigger
language plpgsql security definer set search_path = '' as $$
declare bid uuid; other_bid uuid; tid uuid; target_user uuid; file_board text;
begin
  if tg_table_name = 'board_members' then
    select workspace_id into bid from public.boards where id = new.board_id;
    if not exists (select 1 from public.workspace_members where workspace_id = bid and user_id = new.user_id) then
      raise exception 'O usuário precisa fazer parte do workspace' using errcode = '23514';
    end if;
  elsif tg_table_name = 'task_assignees' then
    bid := kanban_private.task_board(new.task_id); target_user := new.user_id;
  elsif tg_table_name = 'checklist_items' then
    if new.assigned_to is not null then
    tid := kanban_private.checklist_task(new.checklist_id); bid := kanban_private.task_board(tid); target_user := new.assigned_to;
    end if;
  elsif tg_table_name = 'task_labels' then
    bid := kanban_private.task_board(new.task_id);
    select board_id into other_bid from public.labels where id = new.label_id;
    if bid is distinct from other_bid then raise exception 'Label de outro board' using errcode = '23514'; end if;
  elsif tg_table_name = 'task_dependencies' then
    bid := kanban_private.task_board(new.task_id); other_bid := kanban_private.task_board(new.depends_on_task_id);
    if bid is distinct from other_bid or new.task_id = new.depends_on_task_id then
      raise exception 'Dependência inválida ou entre boards diferentes' using errcode = '23514';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('dependencies:' || bid::text, 0));
    if exists (
      with recursive chain(id) as (
        select new.depends_on_task_id
        union
        select d.depends_on_task_id from public.task_dependencies d join chain c on d.task_id = c.id where d.id <> new.id
      ) select 1 from chain where id = new.task_id
    ) then raise exception 'Dependência circular' using errcode = '23514'; end if;
  elsif tg_table_name = 'notifications' then
    if new.task_id is not null and new.board_id is distinct from kanban_private.task_board(new.task_id) then
      raise exception 'Notificação referencia task de outro board' using errcode = '23514';
    end if;
  elsif tg_table_name = 'attachments' then
    bid := kanban_private.task_board(new.task_id);
    if split_part(new.file_url,'/',1) <> bid::text or split_part(new.file_url,'/',2) <> new.task_id::text
      or array_length(string_to_array(new.file_url,'/'),1) <> 3
      or not exists (select 1 from storage.objects where bucket_id = 'task-attachments' and name = new.file_url and owner_id = new.user_id::text) then
      raise exception 'Arquivo precisa ser um objeto próprio no caminho da tarefa' using errcode = '23514';
    end if;
  elsif tg_table_name = 'profiles' then
    if new.avatar_url is not null and split_part(new.avatar_url,'/',1) <> new.id::text then
      raise exception 'Avatar precisa pertencer ao próprio usuário' using errcode = '23514';
    end if;
  end if;
  if target_user is not null and kanban_private.board_role_for_user(bid,target_user) is null then
    raise exception 'Responsável não tem acesso ao board' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger board_member_relations before insert or update on public.board_members for each row execute function kanban_private.validate_relations();
create trigger assignee_relations before insert or update on public.task_assignees for each row execute function kanban_private.validate_relations();
create trigger item_relations before insert or update on public.checklist_items for each row execute function kanban_private.validate_relations();
create trigger label_relations before insert or update on public.task_labels for each row execute function kanban_private.validate_relations();
create trigger dependency_relations before insert or update on public.task_dependencies for each row execute function kanban_private.validate_relations();
create trigger notification_relations before insert or update on public.notifications for each row execute function kanban_private.validate_relations();
create trigger attachment_relations before insert on public.attachments for each row execute function kanban_private.validate_relations();
create trigger avatar_relations before insert or update on public.profiles for each row execute function kanban_private.validate_relations();

-- Remover acesso de workspace também elimina memberships e responsabilidades antigas.
create function kanban_private.cleanup_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'workspace_members' then
    delete from public.board_members bm using public.boards b where bm.board_id = b.id and b.workspace_id = old.workspace_id and bm.user_id = old.user_id;
    delete from public.task_assignees a using public.tasks t, public.boards b where a.task_id = t.id and t.board_id = b.id and b.workspace_id = old.workspace_id and a.user_id = old.user_id;
    update public.checklist_items i set assigned_to = null from public.checklists c, public.tasks t, public.boards b
      where i.checklist_id = c.id and c.task_id = t.id and t.board_id = b.id and b.workspace_id = old.workspace_id and i.assigned_to = old.user_id;
  elsif kanban_private.board_role_for_user(old.board_id,old.user_id) is null then
    delete from public.task_assignees a using public.tasks t where a.task_id = t.id and t.board_id = old.board_id and a.user_id = old.user_id;
    update public.checklist_items i set assigned_to = null from public.checklists c, public.tasks t
      where i.checklist_id = c.id and c.task_id = t.id and t.board_id = old.board_id and i.assigned_to = old.user_id;
  end if;
  return old;
end $$;
create trigger workspace_member_removed after delete on public.workspace_members for each row execute function kanban_private.cleanup_membership();
create trigger board_member_removed after delete on public.board_members for each row execute function kanban_private.cleanup_membership();

create function kanban_private.initialize_board() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.board_members(board_id,user_id,role) values (new.id,new.created_by,'owner');
  insert into public.board_columns(board_id,name,color,position) values
    (new.id,'Ideias','#b49aff',1024),(new.id,'A fazer','#f5cb66',2048),
    (new.id,'Em andamento','#69dff1',3072),(new.id,'Concluído','#51dba6',4096);
  return new;
end $$;
create trigger board_created after insert on public.boards for each row execute function kanban_private.initialize_board();
create function kanban_private.initialize_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',new.raw_user_meta_data->>'full_name',''),120));
  insert into public.workspaces(name,owner_id) values('Meu workspace',new.id);
  return new;
end $$;
create trigger kanban_auth_user_created after insert on auth.users for each row execute function kanban_private.initialize_user();

-- Usuários Auth já existentes recebem profile e workspace vazio, sem fixtures.
insert into public.profiles(id,display_name)
  select id,left(coalesce(raw_user_meta_data->>'display_name',raw_user_meta_data->>'full_name',''),120) from auth.users;
insert into public.workspaces(name,owner_id)
  select 'Meu workspace',p.id from public.profiles p where not exists (select 1 from public.workspace_members m where m.user_id = p.id);
create trigger profiles_updated before update on public.profiles for each row execute function kanban_private.touch_updated_at();
create trigger workspaces_updated before update on public.workspaces for each row execute function kanban_private.touch_updated_at();
create trigger boards_updated before update on public.boards for each row execute function kanban_private.touch_updated_at();
create trigger board_columns_updated before update on public.board_columns for each row execute function kanban_private.touch_updated_at();
create trigger tasks_updated before update on public.tasks for each row execute function kanban_private.touch_updated_at();
create trigger comments_updated before update on public.comments for each row execute function kanban_private.touch_updated_at();
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon, authenticated;
grant select on public.workspaces to authenticated;
alter table public.workspace_members enable row level security;
revoke all on public.workspace_members from anon, authenticated;
grant select on public.workspace_members to authenticated;
alter table public.boards enable row level security;
revoke all on public.boards from anon, authenticated;
grant select on public.boards to authenticated;
alter table public.board_members enable row level security;
revoke all on public.board_members from anon, authenticated;
grant select on public.board_members to authenticated;
alter table public.board_columns enable row level security;
revoke all on public.board_columns from anon, authenticated;
grant select on public.board_columns to authenticated;
alter table public.tasks enable row level security;
revoke all on public.tasks from anon, authenticated;
grant select on public.tasks to authenticated;
alter table public.task_assignees enable row level security;
revoke all on public.task_assignees from anon, authenticated;
grant select on public.task_assignees to authenticated;
alter table public.labels enable row level security;
revoke all on public.labels from anon, authenticated;
grant select on public.labels to authenticated;
alter table public.task_labels enable row level security;
revoke all on public.task_labels from anon, authenticated;
grant select on public.task_labels to authenticated;
alter table public.checklists enable row level security;
revoke all on public.checklists from anon, authenticated;
grant select on public.checklists to authenticated;
alter table public.checklist_items enable row level security;
revoke all on public.checklist_items from anon, authenticated;
grant select on public.checklist_items to authenticated;
alter table public.comments enable row level security;
revoke all on public.comments from anon, authenticated;
grant select on public.comments to authenticated;
alter table public.attachments enable row level security;
revoke all on public.attachments from anon, authenticated;
grant select on public.attachments to authenticated;
alter table public.task_dependencies enable row level security;
revoke all on public.task_dependencies from anon, authenticated;
grant select on public.task_dependencies to authenticated;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
alter table public.activity_logs enable row level security;
revoke all on public.activity_logs from anon, authenticated;
grant select on public.activity_logs to authenticated;
alter table public.favorites enable row level security;
revoke all on public.favorites from anon, authenticated;
grant select on public.favorites to authenticated;

-- Grants de coluna impedem forjar autor, created_at, mover entidades de tenant ou
-- alterar conteúdo de notificações. RLS controla quem pode agir em cada linha.
grant update(display_name,username,avatar_url) on public.profiles to authenticated;
grant insert(name,description,owner_id), update(name,description), delete on public.workspaces to authenticated;
grant insert(workspace_id,user_id,role), update(role), delete on public.workspace_members to authenticated;
grant insert(workspace_id,name,description,icon,color), update(name,description,icon,color,archived), delete on public.boards to authenticated;
grant insert(board_id,user_id,role), update(role), delete on public.board_members to authenticated;
grant insert(board_id,name,position,color,wip_limit), update(name,position,color,wip_limit), delete on public.board_columns to authenticated;
grant insert(board_id,column_id,title,description,priority,position,due_date,start_date,estimated_minutes),
  update(column_id,title,description,priority,position,due_date,start_date,estimated_minutes,archived,completed_at), delete on public.tasks to authenticated;
grant insert, delete on public.task_assignees, public.task_labels to authenticated;
grant insert(board_id,name,color), update(name,color), delete on public.labels to authenticated;
grant insert(task_id,title,position), update(title,position), delete on public.checklists to authenticated;
grant insert(checklist_id,content,completed,position,assigned_to,due_date), update(content,completed,position,assigned_to,due_date), delete on public.checklist_items to authenticated;
grant insert(task_id,content), update(content), delete on public.comments to authenticated;
grant insert(task_id,file_name,file_url,file_type,file_size), delete on public.attachments to authenticated;
grant insert(task_id,depends_on_task_id), delete on public.task_dependencies to authenticated;
grant update(read), delete on public.notifications to authenticated;
grant insert(board_id), delete on public.favorites to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (kanban_private.can_read_profile(id));
create policy profiles_edit on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy workspaces_read on public.workspaces for select to authenticated using (owner_id = (select auth.uid()) or kanban_private.workspace_role(id) is not null);
create policy workspaces_create on public.workspaces for insert to authenticated with check (owner_id = (select auth.uid()));
create policy workspaces_edit on public.workspaces for update to authenticated using (kanban_private.can_manage_workspace(id)) with check (kanban_private.can_manage_workspace(id));
create policy workspaces_delete on public.workspaces for delete to authenticated using (kanban_private.workspace_role(id) = 'owner');
create policy workspace_members_read on public.workspace_members for select to authenticated using (kanban_private.workspace_role(workspace_id) is not null);
create policy workspace_members_add on public.workspace_members for insert to authenticated with check (kanban_private.can_manage_workspace(workspace_id) and role <> 'owner');
create policy workspace_members_edit on public.workspace_members for update to authenticated using (kanban_private.can_manage_workspace(workspace_id) and role <> 'owner') with check (kanban_private.can_manage_workspace(workspace_id) and role <> 'owner');
create policy workspace_members_delete on public.workspace_members for delete to authenticated using (kanban_private.can_manage_workspace(workspace_id) and role <> 'owner');
create policy boards_read on public.boards for select to authenticated using (kanban_private.can_manage_workspace(workspace_id) or kanban_private.can_read_board(id));
create policy boards_create on public.boards for insert to authenticated with check (created_by = (select auth.uid()) and kanban_private.can_manage_workspace(workspace_id));
create policy boards_edit on public.boards for update to authenticated using (kanban_private.can_manage_board(id)) with check (kanban_private.can_manage_board(id));
create policy boards_delete on public.boards for delete to authenticated using (kanban_private.can_manage_board(id));
create policy board_members_read on public.board_members for select to authenticated using (kanban_private.can_read_board(board_id));
create policy board_members_add on public.board_members for insert to authenticated with check (kanban_private.can_manage_board(board_id));
create policy board_members_edit on public.board_members for update to authenticated using (kanban_private.can_manage_board(board_id)) with check (kanban_private.can_manage_board(board_id));
create policy board_members_delete on public.board_members for delete to authenticated using (kanban_private.can_manage_board(board_id));
create policy columns_read on public.board_columns for select to authenticated using (kanban_private.can_read_board(board_id));
create policy columns_add on public.board_columns for insert to authenticated with check (kanban_private.can_manage_board(board_id));
create policy columns_edit on public.board_columns for update to authenticated using (kanban_private.can_manage_board(board_id)) with check (kanban_private.can_manage_board(board_id));
create policy columns_delete on public.board_columns for delete to authenticated using (kanban_private.can_manage_board(board_id));
create policy tasks_read on public.tasks for select to authenticated using (kanban_private.can_read_board(board_id));
create policy tasks_add on public.tasks for insert to authenticated with check (created_by = (select auth.uid()) and kanban_private.can_edit_board(board_id));
create policy tasks_edit on public.tasks for update to authenticated using (kanban_private.can_edit_board(board_id)) with check (kanban_private.can_edit_board(board_id));
create policy tasks_delete on public.tasks for delete to authenticated using (kanban_private.can_manage_board(board_id));
create policy labels_read on public.labels for select to authenticated using (kanban_private.can_read_board(board_id));
create policy labels_add on public.labels for insert to authenticated with check (kanban_private.can_edit_board(board_id));
create policy labels_edit on public.labels for update to authenticated using (kanban_private.can_edit_board(board_id)) with check (kanban_private.can_edit_board(board_id));
create policy labels_delete on public.labels for delete to authenticated using (kanban_private.can_edit_board(board_id));
create policy comments_read on public.comments for select to authenticated using (kanban_private.can_read_task(task_id));
create policy comments_add on public.comments for insert to authenticated with check (user_id = (select auth.uid()) and kanban_private.can_edit_task(task_id));
create policy comments_edit on public.comments for update to authenticated using (user_id = (select auth.uid()) and kanban_private.can_edit_task(task_id)) with check (user_id = (select auth.uid()) and kanban_private.can_edit_task(task_id));
create policy comments_delete on public.comments for delete to authenticated using (kanban_private.can_edit_task(task_id) and (user_id = (select auth.uid()) or kanban_private.can_manage_board(kanban_private.task_board(task_id))));
create policy attachments_read on public.attachments for select to authenticated using (kanban_private.can_read_task(task_id));
create policy attachments_add on public.attachments for insert to authenticated with check (user_id = (select auth.uid()) and kanban_private.can_edit_task(task_id));
create policy attachments_delete on public.attachments for delete to authenticated using (kanban_private.can_edit_task(task_id) and (user_id = (select auth.uid()) or kanban_private.can_manage_board(kanban_private.task_board(task_id))));
create policy dependencies_read on public.task_dependencies for select to authenticated using (kanban_private.can_read_task(task_id));
create policy dependencies_add on public.task_dependencies for insert to authenticated with check (kanban_private.can_edit_task(task_id) and kanban_private.can_read_task(depends_on_task_id));
create policy dependencies_delete on public.task_dependencies for delete to authenticated using (kanban_private.can_edit_task(task_id));
create policy notifications_read on public.notifications for select to authenticated using (user_id = (select auth.uid()) and (board_id is null or kanban_private.can_read_board(board_id)));
create policy notifications_mark on public.notifications for update to authenticated using (user_id = (select auth.uid()) and (board_id is null or kanban_private.can_read_board(board_id))) with check (user_id = (select auth.uid()) and (board_id is null or kanban_private.can_read_board(board_id)));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
create policy activity_read on public.activity_logs for select to authenticated using (kanban_private.workspace_role(workspace_id) is not null and case when board_id is null then kanban_private.can_manage_workspace(workspace_id) else kanban_private.can_read_board(board_id) end);
create policy favorites_read on public.favorites for select to authenticated using (user_id = (select auth.uid()) and kanban_private.can_read_board(board_id));
create policy favorites_add on public.favorites for insert to authenticated with check (user_id = (select auth.uid()) and kanban_private.can_read_board(board_id));
create policy favorites_delete on public.favorites for delete to authenticated using (user_id = (select auth.uid()));
create policy task_assignees_read on public.task_assignees for select to authenticated using (kanban_private.can_read_task(task_id));
create policy task_assignees_add on public.task_assignees for insert to authenticated with check (kanban_private.can_edit_task(task_id));
create policy task_assignees_delete on public.task_assignees for delete to authenticated using (kanban_private.can_edit_task(task_id));
create policy task_labels_read on public.task_labels for select to authenticated using (kanban_private.can_read_task(task_id));
create policy task_labels_add on public.task_labels for insert to authenticated with check (kanban_private.can_edit_task(task_id));
create policy task_labels_delete on public.task_labels for delete to authenticated using (kanban_private.can_edit_task(task_id));
create policy checklists_read on public.checklists for select to authenticated using (kanban_private.can_read_task(task_id));
create policy checklists_add on public.checklists for insert to authenticated with check (kanban_private.can_edit_task(task_id));
create policy checklists_edit on public.checklists for update to authenticated using (kanban_private.can_edit_task(task_id)) with check (kanban_private.can_edit_task(task_id));
create policy checklists_delete on public.checklists for delete to authenticated using (kanban_private.can_edit_task(task_id));
create policy checklist_items_read on public.checklist_items for select to authenticated using (kanban_private.can_read_task(kanban_private.checklist_task(checklist_id)));
create policy checklist_items_add on public.checklist_items for insert to authenticated with check (kanban_private.can_edit_task(kanban_private.checklist_task(checklist_id)));
create policy checklist_items_edit on public.checklist_items for update to authenticated using (kanban_private.can_edit_task(kanban_private.checklist_task(checklist_id))) with check (kanban_private.can_edit_task(kanban_private.checklist_task(checklist_id)));
create policy checklist_items_delete on public.checklist_items for delete to authenticated using (kanban_private.can_edit_task(kanban_private.checklist_task(checklist_id)));

-- Ordenação calculada no PostgreSQL, nunca por médias de floats do navegador.
-- Empates de chamadas SQL diretas são ordenados pelo UUID; RPCs serializam por board.
create function kanban_private.allocate_position(p_kind text, p_parent uuid, p_before uuid, p_after uuid, p_exclude uuid default null)
returns numeric language plpgsql set search_path = '' as $$
declare rel text; parent_col text; active_filter text; bid uuid; lo numeric; hi numeric; value numeric; found_before boolean; attempts integer := 0;
begin
  if p_kind = 'task' then
    rel := 'tasks'; parent_col := 'column_id'; active_filter := ' and not archived';
    select board_id into bid from public.board_columns where id = p_parent;
    if not kanban_private.can_edit_board(bid) then raise exception 'Sem permissão para ordenar tarefas' using errcode = '42501'; end if;
  elsif p_kind = 'column' then
    rel := 'board_columns'; parent_col := 'board_id'; active_filter := ''; bid := p_parent;
    if not kanban_private.can_manage_board(bid) then raise exception 'Sem permissão para ordenar colunas' using errcode = '42501'; end if;
  else raise exception 'Tipo de ordenação inválido' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ordering:' || bid::text,0));
  if p_exclude is not null and (p_before = p_exclude or p_after = p_exclude) then raise exception 'Vizinho não pode ser o item movido' using errcode = '22023'; end if;
  loop
    if p_before is null and p_after is null then
      execute format('select coalesce(max(position),0)+1024 from public.%I where %I=$1%s and ($2 is null or id<>$2)',rel,parent_col,active_filter) into value using p_parent,p_exclude;
      return value;
    end if;
    lo := null; hi := null;
    if p_before is not null then
      execute format('select position from public.%I where %I=$1 and id=$2%s and ($3 is null or id<>$3)',rel,parent_col,active_filter) into lo using p_parent,p_before,p_exclude;
      if lo is null then raise exception 'Vizinho anterior inválido ou mudou de coluna' using errcode = '40001'; end if;
    end if;
    if p_after is not null then
      execute format('select position from public.%I where %I=$1 and id=$2%s and ($3 is null or id<>$3)',rel,parent_col,active_filter) into hi using p_parent,p_after,p_exclude;
      if hi is null then raise exception 'Vizinho posterior inválido ou mudou de coluna' using errcode = '40001'; end if;
    end if;
    execute format('select exists(select 1 from public.%I where %I=$1%s and ($4 is null or id<>$4) and ($2 is null or position>$2) and ($3 is null or position<$3))',rel,parent_col,active_filter)
      into found_before using p_parent,lo,hi,p_exclude;
    if found_before or (lo is not null and hi is not null and lo > hi) then
      raise exception 'A ordem mudou. Atualize o board e tente novamente' using errcode = '40001';
    end if;
    value := case when lo is null then hi-1024 when hi is null then lo+1024 else (lo+hi)/2 end;
    if lo is null or hi is null or hi-lo > 0.000000000000000002 then return value; end if;
    if attempts > 0 then raise exception 'Não foi possível rebalancear posições' using errcode = '40001'; end if;
    execute format('with ranked as (select id,row_number() over(order by position,id)*1024 as new_pos from public.%I where %I=$1%s) update public.%I t set position=r.new_pos from ranked r where t.id=r.id',rel,parent_col,active_filter,rel) using p_parent;
    attempts := attempts+1;
  end loop;
end $$;
create function public.create_task(p_board_id uuid, p_column_id uuid, p_title text, p_priority public.task_priority default 'none')
returns setof public.tasks language plpgsql security invoker set search_path = '' as $$
declare result public.tasks; pos numeric;
begin
  if not kanban_private.can_edit_board(p_board_id) then raise exception 'Sem permissão para criar tarefa' using errcode = '42501'; end if;
  if not exists (select 1 from public.board_columns where id=p_column_id and board_id=p_board_id) then raise exception 'Coluna de outro board' using errcode = '23514'; end if;
  pos := kanban_private.allocate_position('task',p_column_id,null,null);
  insert into public.tasks(board_id,column_id,title,priority,position) values(p_board_id,p_column_id,btrim(p_title),p_priority,pos) returning * into result;
  return next result;
  return;
end $$;
create function public.move_task(p_task_id uuid, p_column_id uuid, p_before_id uuid default null, p_after_id uuid default null)
returns setof public.tasks language plpgsql security invoker set search_path = '' as $$
declare result public.tasks; bid uuid; pos numeric;
begin
  select board_id into bid from public.tasks where id=p_task_id;
  if bid is null or not kanban_private.can_edit_board(bid) then raise exception 'Sem permissão para mover tarefa' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ordering:' || bid::text,0));
  if not exists(select 1 from public.board_columns where id=p_column_id and board_id=bid) then raise exception 'Destino de outro board' using errcode = '23514'; end if;
  if exists(select 1 from public.tasks where id=p_task_id and archived) then raise exception 'Restaure a tarefa antes de mover' using errcode = '23514'; end if;
  pos := kanban_private.allocate_position('task',p_column_id,p_before_id,p_after_id,p_task_id);
  update public.tasks set column_id=p_column_id,position=pos where id=p_task_id returning * into result;
  if result.id is null then raise exception 'A tarefa não está mais disponível' using errcode='40001'; end if;
  return next result;
  return;
end $$;
create function public.create_column(p_board_id uuid,p_name text,p_color text default '#69dff1',p_wip_limit integer default null)
returns setof public.board_columns language plpgsql security invoker set search_path = '' as $$
declare result public.board_columns; pos numeric;
begin
  pos := kanban_private.allocate_position('column',p_board_id,null,null);
  insert into public.board_columns(board_id,name,color,wip_limit,position) values(p_board_id,btrim(p_name),p_color,p_wip_limit,pos) returning * into result;
  return next result;
  return;
end $$;
create function public.move_column(p_column_id uuid,p_before_id uuid default null,p_after_id uuid default null)
returns setof public.board_columns language plpgsql security invoker set search_path = '' as $$
declare result public.board_columns; bid uuid; pos numeric;
begin
  select board_id into bid from public.board_columns where id=p_column_id;
  if bid is null then raise exception 'Coluna indisponível' using errcode='42501'; end if;
  pos := kanban_private.allocate_position('column',bid,p_before_id,p_after_id,p_column_id);
  update public.board_columns set position=pos where id=p_column_id returning * into result;
  return next result;
  return;
end $$;
create function public.transfer_workspace_ownership(p_workspace_id uuid,p_new_owner_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare previous_owner uuid;
begin
  select owner_id into previous_owner from public.workspaces where id=p_workspace_id for update;
  if auth.uid() is null or previous_owner is distinct from auth.uid() then raise exception 'Somente o owner pode transferir propriedade' using errcode='42501'; end if;
  if not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=p_new_owner_id) then raise exception 'Novo owner precisa ser membro do workspace' using errcode='23514'; end if;
  if previous_owner = p_new_owner_id then return; end if;
  update public.workspaces set owner_id=p_new_owner_id where id=p_workspace_id;
  update public.workspace_members set role='admin' where workspace_id=p_workspace_id and user_id=previous_owner;
  update public.workspace_members set role='owner' where workspace_id=p_workspace_id and user_id=p_new_owner_id;
end $$;

-- Auditoria e notificações são criadas no banco. O cliente não recebe INSERT nesses recursos.
create function kanban_private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare item jsonb; bid uuid; tid uuid; wid uuid; entity_id uuid;
begin
  item := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  entity_id := (item->>'id')::uuid;
  if tg_table_name='workspaces' then wid:=entity_id;
  elsif tg_table_name='boards' then bid:=entity_id; wid:=(item->>'workspace_id')::uuid;
  elsif tg_table_name='tasks' then tid:=entity_id; bid:=(item->>'board_id')::uuid;
  else bid:=(item->>'board_id')::uuid; end if;
  if wid is null then select workspace_id into wid from public.boards where id=bid; end if;
  -- DELETE é auditado antes de apagar a linha; FKs SET NULL mantêm o histórico seguro.
  if wid is not null and exists(select 1 from public.workspaces where id=wid) then
    insert into public.activity_logs(workspace_id,board_id,task_id,user_id,action,metadata)
      values(wid,bid,tid,auth.uid(),tg_table_name||'.'||lower(tg_op),jsonb_build_object('entity_id',entity_id,'entity_type',tg_table_name));
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create function kanban_private.notify_task_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare bid uuid; task_title text; recipient uuid;
begin
  select board_id,title into bid,task_title from public.tasks where id=new.task_id;
  if tg_table_name='task_assignees' then
    recipient:=new.user_id;
    if recipient is distinct from auth.uid() and kanban_private.board_role_for_user(bid,recipient) is not null then
      insert into public.notifications(user_id,type,board_id,task_id,actor_id,content)
        values(recipient,'task_assigned',bid,new.task_id,auth.uid(),'Você foi atribuído à tarefa: '||left(task_title,300));
    end if;
  else
    insert into public.notifications(user_id,type,board_id,task_id,actor_id,content)
      select a.user_id,'task_comment',bid,new.task_id,auth.uid(),'Novo comentário em: '||left(task_title,300)
      from public.task_assignees a where a.task_id=new.task_id and a.user_id is distinct from auth.uid() and kanban_private.board_role_for_user(bid,a.user_id) is not null;
  end if;
  return new;
end $$;
create trigger assigned_notification after insert on public.task_assignees for each row execute function kanban_private.notify_task_event();
create trigger comment_notification after insert on public.comments for each row execute function kanban_private.notify_task_event();
create trigger workspaces_audit_after after insert or update on public.workspaces for each row execute function kanban_private.audit_change();
create trigger boards_audit_after after insert or update on public.boards for each row execute function kanban_private.audit_change();
create trigger boards_audit_delete before delete on public.boards for each row execute function kanban_private.audit_change();
create trigger board_columns_audit_after after insert or update on public.board_columns for each row execute function kanban_private.audit_change();
create trigger board_columns_audit_delete before delete on public.board_columns for each row execute function kanban_private.audit_change();
create trigger tasks_audit_after after insert or update on public.tasks for each row execute function kanban_private.audit_change();
create trigger tasks_audit_delete before delete on public.tasks for each row execute function kanban_private.audit_change();

-- Storage privado. avatar_url/file_url guardam object keys, não URLs públicas.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('avatars','avatars',false,5242880,array['image/jpeg','image/png','image/webp','image/avif']),
  ('task-attachments','task-attachments',false,10485760,null)
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function kanban_private.file_task(p_path text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare parts text[]; bid uuid; tid uuid;
begin
  parts:=string_to_array(p_path,'/');
  if array_length(parts,1) <> 3 or parts[1] !~ '^[0-9a-fA-F-]{36}$' or parts[2] !~ '^[0-9a-fA-F-]{36}$' or parts[3]='' then return null; end if;
  begin bid:=parts[1]::uuid; tid:=parts[2]::uuid; exception when invalid_text_representation then return null; end;
  if exists(select 1 from public.tasks where id=tid and board_id=bid) then return tid; end if;
  return null;
end $$;
create function kanban_private.can_read_avatar(p_path text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid;
begin
  if array_length(string_to_array(p_path,'/'),1) <> 2 then return false; end if;
  begin uid:=split_part(p_path,'/',1)::uuid; exception when invalid_text_representation then return false; end;
  return kanban_private.can_read_profile(uid);
end $$;
create policy kanban_avatars_read on storage.objects for select to authenticated using (bucket_id='avatars' and kanban_private.can_read_avatar(name));
create policy kanban_avatars_upload on storage.objects for insert to authenticated with check (bucket_id='avatars' and split_part(name,'/',1)=(select auth.uid())::text and array_length(string_to_array(name,'/'),1)=2 and owner_id=(select auth.uid())::text);
create policy kanban_avatars_delete on storage.objects for delete to authenticated using (bucket_id='avatars' and split_part(name,'/',1)=(select auth.uid())::text and owner_id=(select auth.uid())::text);
create policy kanban_attachments_read on storage.objects for select to authenticated using (bucket_id='task-attachments' and kanban_private.can_read_task(kanban_private.file_task(name)));
create policy kanban_attachments_upload on storage.objects for insert to authenticated with check (bucket_id='task-attachments' and owner_id=(select auth.uid())::text and kanban_private.can_edit_task(kanban_private.file_task(name)));
create policy kanban_attachments_delete on storage.objects for delete to authenticated using (bucket_id='task-attachments' and kanban_private.can_edit_task(kanban_private.file_task(name)) and (owner_id=(select auth.uid())::text or kanban_private.can_manage_board(kanban_private.task_board(kanban_private.file_task(name)))));

-- Realtime Broadcast privado com fanout para usuários ainda autorizados.
-- Só IDs são enviados. O cliente sempre relê dados sujeitos a RLS.
-- Não publicamos DELETE via Postgres Changes: esse evento não aplica RLS.
create function kanban_private.can_receive_topic(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare bid uuid;
begin
  if p_topic='notifications:'||auth.uid()::text then return true; end if;
  if p_topic !~ '^board:[0-9a-fA-F-]{36}:user:[0-9a-fA-F-]{36}$' or split_part(p_topic,':',4) <> auth.uid()::text then return false; end if;
  begin bid:=split_part(p_topic,':',2)::uuid; exception when invalid_text_representation then return false; end;
  return kanban_private.can_read_board(bid);
end $$;
create policy kanban_realtime_receive on realtime.messages for select to authenticated using (
  extension='broadcast' and topic=realtime.topic() and kanban_private.can_receive_topic(realtime.topic())
);
-- Nenhuma policy INSERT em realtime.messages é concedida pelo aplicativo.
create function kanban_private.broadcast_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare item jsonb; bid uuid; wid uuid; uid uuid; tid uuid; payload jsonb;
begin
  item:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  tid:=case when tg_table_name='tasks' then (item->>'id')::uuid else (item->>'task_id')::uuid end;
  bid:=case when tg_table_name in ('tasks','board_columns','notifications') then (item->>'board_id')::uuid else kanban_private.task_board(tid) end;
  payload:=jsonb_build_object('table',tg_table_name,'operation',tg_op,'id',item->>'id','board_id',bid,'task_id',tid);
  if tg_table_name='notifications' then
    uid:=(item->>'user_id')::uuid;
    if bid is null or kanban_private.board_role_for_user(bid,uid) is not null then perform realtime.send(payload,'data-change','notifications:'||uid::text,true); end if;
  elsif bid is not null then
    select workspace_id into wid from public.boards where id=bid;
    for uid in select user_id from public.workspace_members where workspace_id=wid loop
      if kanban_private.board_role_for_user(bid,uid) is not null then
        perform realtime.send(payload,'data-change','board:'||bid::text||':user:'||uid::text,true);
      end if;
    end loop;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger tasks_realtime after insert or update or delete on public.tasks for each row execute function kanban_private.broadcast_change();
create trigger columns_realtime after insert or update or delete on public.board_columns for each row execute function kanban_private.broadcast_change();
create trigger comments_realtime after insert or update or delete on public.comments for each row execute function kanban_private.broadcast_change();
create trigger notifications_realtime after insert or update or delete on public.notifications for each row execute function kanban_private.broadcast_change();

-- Revogação de acesso também dispara um evento de invalidação ao usuário removido,
-- sem conteúdo do board; o próximo SELECT será negado por RLS.
create function kanban_private.broadcast_membership_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare item jsonb; uid uuid;
begin
  item:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end; uid:=(item->>'user_id')::uuid;
  perform realtime.send(jsonb_build_object('table',tg_table_name,'operation',tg_op),'data-change','notifications:'||uid::text,true);
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger workspace_members_realtime after insert or update or delete on public.workspace_members for each row execute function kanban_private.broadcast_membership_change();
create trigger board_members_realtime after insert or update or delete on public.board_members for each row execute function kanban_private.broadcast_membership_change();

-- Retirar permissões padrão de execução. Somente helpers de policy e RPCs
-- explicitamente autorizados ficam disponíveis a authenticated.
revoke execute on all functions in schema kanban_private from public, anon, authenticated;
grant execute on function kanban_private.workspace_role(uuid), kanban_private.board_role(uuid),
  kanban_private.can_manage_workspace(uuid),kanban_private.can_read_board(uuid),kanban_private.can_edit_board(uuid),kanban_private.can_manage_board(uuid),
  kanban_private.task_board(uuid),kanban_private.checklist_task(uuid),kanban_private.can_read_task(uuid),kanban_private.can_edit_task(uuid),
  kanban_private.can_read_profile(uuid),kanban_private.file_task(text),kanban_private.can_read_avatar(text),kanban_private.can_receive_topic(text),
  kanban_private.allocate_position(text,uuid,uuid,uuid,uuid) to authenticated;
revoke execute on function public.create_task(uuid,uuid,text,public.task_priority),public.move_task(uuid,uuid,uuid,uuid),
  public.create_column(uuid,text,text,integer),public.move_column(uuid,uuid,uuid),public.transfer_workspace_ownership(uuid,uuid) from public,anon;
grant execute on function public.create_task(uuid,uuid,text,public.task_priority),public.move_task(uuid,uuid,uuid,uuid),
  public.create_column(uuid,text,text,integer),public.move_column(uuid,uuid,uuid),public.transfer_workspace_ownership(uuid,uuid) to authenticated;

comment on column public.tasks.position is 'Fractional NUMERIC(38,18). Use move_task com IDs vizinhos; espaçamento inicial 1024 e rebalanceamento raro, local à coluna.';
comment on column public.attachments.file_url is 'Object key em task-attachments; gerar signed URL de curta duração no Storage API.';
comment on column public.profiles.avatar_url is 'Object key privado em avatars: user_id/arquivo. Nunca gravar signed URL expirada.';
comment on schema kanban_private is 'Não adicionar aos schemas expostos da Data API. Helpers de policy e triggers internos.';
notify pgrst, 'reload schema';
commit;
