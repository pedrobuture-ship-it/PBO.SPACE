-- Handcrafted Digital Workspace · schema inicial
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text,
  color text not null default '#d3ed77' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

create table public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#d3ed77',
  position numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  column_id uuid not null references public.board_columns(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  description text,
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  due_date date,
  position numeric not null default 0,
  assignee_id uuid references auth.users(id) on delete set null,
  labels text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  board_id uuid references public.boards(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index boards_owner_idx on public.boards(owner_id);
create index board_columns_board_position_idx on public.board_columns(board_id, position);
create index tasks_board_column_position_idx on public.tasks(board_id, column_id, position);
create index comments_task_created_idx on public.comments(task_id, created_at);
create index attachments_task_idx on public.attachments(task_id);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.handle_new_board() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.board_members(board_id, user_id, role) values (new.id, new.owner_id, 'owner');
  insert into public.board_columns(board_id, name, color, position) values
    (new.id, 'Ideias', '#c9b9f6', 0),
    (new.id, 'A fazer', '#efa881', 1),
    (new.id, 'Em andamento', '#9ec9e7', 2),
    (new.id, 'Concluído', '#d3ed77', 3);
  return new;
end;
$$;
create trigger on_board_created after insert on public.boards for each row execute function public.handle_new_board();

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger on_task_updated before update on public.tasks for each row execute function public.touch_updated_at();

create function public.has_board_access(target_board_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.boards b where b.id = target_board_id and b.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.board_members m where m.board_id = target_board_id and m.user_id = (select auth.uid())
  );
$$;

create function public.owns_board(target_board_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.boards b where b.id = target_board_id and b.owner_id = (select auth.uid()));
$$;

create function public.has_task_access(target_task_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tasks t where t.id = target_task_id and public.has_board_access(t.board_id));
$$;

create function public.task_matches_board() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.board_columns c where c.id = new.column_id and c.board_id = new.board_id) then
    raise exception 'A coluna precisa pertencer ao mesmo board da tarefa';
  end if;
  return new;
end;
$$;
create trigger task_board_consistency before insert or update on public.tasks for each row execute function public.task_matches_board();

create function public.attachment_path_matches_task() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.tasks t
    where t.id = new.task_id
      and new.storage_path like t.board_id::text || '/' || t.id::text || '/%'
  ) then
    raise exception 'O arquivo precisa estar no diretório do board e da tarefa';
  end if;
  return new;
end;
$$;
create trigger attachment_path_consistency before insert or update on public.attachments for each row execute function public.attachment_path_matches_task();

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.board_columns enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.notifications enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy boards_select on public.boards for select to authenticated using (public.has_board_access(id));
create policy boards_insert on public.boards for insert to authenticated with check (owner_id = (select auth.uid()));
create policy boards_update on public.boards for update to authenticated using (public.owns_board(id)) with check (public.owns_board(id));
create policy boards_delete on public.boards for delete to authenticated using (public.owns_board(id));

create policy members_select on public.board_members for select to authenticated using (public.has_board_access(board_id));
create policy members_insert on public.board_members for insert to authenticated with check (public.owns_board(board_id));
create policy members_update on public.board_members for update to authenticated using (public.owns_board(board_id)) with check (public.owns_board(board_id));
create policy members_delete on public.board_members for delete to authenticated using (public.owns_board(board_id));

create policy columns_select on public.board_columns for select to authenticated using (public.has_board_access(board_id));
create policy columns_insert on public.board_columns for insert to authenticated with check (public.has_board_access(board_id));
create policy columns_update on public.board_columns for update to authenticated using (public.has_board_access(board_id)) with check (public.has_board_access(board_id));
create policy columns_delete on public.board_columns for delete to authenticated using (public.has_board_access(board_id));

create policy tasks_select on public.tasks for select to authenticated using (public.has_board_access(board_id));
create policy tasks_insert on public.tasks for insert to authenticated with check (public.has_board_access(board_id));
create policy tasks_update on public.tasks for update to authenticated using (public.has_board_access(board_id)) with check (public.has_board_access(board_id));
create policy tasks_delete on public.tasks for delete to authenticated using (public.has_board_access(board_id));

create policy comments_select on public.comments for select to authenticated using (public.has_task_access(task_id));
create policy comments_insert on public.comments for insert to authenticated with check (author_id = (select auth.uid()) and public.has_task_access(task_id));
create policy comments_update on public.comments for update to authenticated using (author_id = (select auth.uid()) and public.has_task_access(task_id)) with check (author_id = (select auth.uid()) and public.has_task_access(task_id));
create policy comments_delete on public.comments for delete to authenticated using (author_id = (select auth.uid()) and public.has_task_access(task_id));

create policy attachments_select on public.attachments for select to authenticated using (public.has_task_access(task_id));
create policy attachments_insert on public.attachments for insert to authenticated with check (uploaded_by = (select auth.uid()) and public.has_task_access(task_id));
create policy attachments_delete on public.attachments for delete to authenticated using (uploaded_by = (select auth.uid()));

create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit) values ('task-attachments', 'task-attachments', false, 10485760);
create policy task_files_read on storage.objects for select to authenticated using (
  bucket_id = 'task-attachments' and exists (
    select 1 from public.boards b where b.id::text = split_part(name, '/', 1) and public.has_board_access(b.id)
  )
);
create policy task_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'task-attachments' and exists (
    select 1 from public.boards b where b.id::text = split_part(name, '/', 1) and public.has_board_access(b.id)
  )
);
create policy task_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'task-attachments' and owner_id = (select auth.uid())::text
);

alter publication supabase_realtime add table public.tasks, public.board_columns, public.comments, public.notifications;
