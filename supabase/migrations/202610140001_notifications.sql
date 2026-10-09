-- Evolução incremental da inbox existente. Somente triggers/RPCs privados geram notificações.
begin;
do $$ begin
  if to_regclass('public.comment_mentions') is null then
    raise exception 'Aplique 202610120001_task_details.sql antes de 202610140001_notifications.sql';
  end if;
  if to_regclass('public.workspace_invitations') is null then
    raise exception 'Aplique 202610130001_members_invitations.sql antes de 202610140001_notifications.sql';
  end if;
end $$;
alter table public.notifications add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.notifications add column if not exists dedupe_key text unique;
update public.notifications set type='comment' where type='task_comment';
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'task_assigned','mention','comment','due_date_changed','task_overdue','board_invite',
  'workspace_invite','role_changed','task_completed','task_moved'
));
create index if not exists notifications_user_created_idx on public.notifications(user_id,created_at desc,id desc);
create index if not exists notifications_workspace_idx on public.notifications(workspace_id) where workspace_id is not null;
update public.notifications n set workspace_id=b.workspace_id from public.boards b where n.board_id=b.id and n.workspace_id is null;

create or replace function kanban_private.validate_notification_workspace() returns trigger
language plpgsql security definer set search_path = '' as $$
declare wid uuid;
begin
  if new.board_id is not null and new.workspace_id is not null then
    select workspace_id into wid from public.boards where id=new.board_id;
    if wid is distinct from new.workspace_id then raise exception 'Notificação de outro workspace' using errcode='23514'; end if;
  end if;
  return new;
end $$;
drop trigger if exists notification_workspace_guard on public.notifications;
create trigger notification_workspace_guard before insert or update on public.notifications
for each row execute function kanban_private.validate_notification_workspace();

-- O destinatário pode ver o nome/avatar do ator mesmo antes de aceitar um convite.
drop policy if exists profiles_notification_actor on public.profiles;
create policy profiles_notification_actor on public.profiles for select to authenticated using (
  exists(select 1 from public.notifications n where n.user_id=(select auth.uid()) and n.actor_id=profiles.id)
);

create or replace function kanban_private.emit_notification(p_user uuid,p_type text,p_board uuid,p_task uuid,
  p_workspace uuid,p_actor uuid,p_content text,p_key text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_user is not distinct from p_actor or not exists(select 1 from public.profiles p where p.id=p_user and p.disabled_at is null) then return; end if;
  if p_board is not null and kanban_private.board_role_for_user(p_board,p_user) is null then return; end if;
  if p_type not in ('workspace_invite','role_changed') and p_board is null then return; end if;
  insert into public.notifications(user_id,type,board_id,task_id,workspace_id,actor_id,content,dedupe_key)
    values(p_user,p_type,p_board,p_task,p_workspace,p_actor,left(p_content,2000),p_key)
    on conflict (dedupe_key) do nothing;
end $$;
revoke execute on function kanban_private.emit_notification(uuid,text,uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;

drop trigger if exists assigned_notification on public.task_assignees;
drop trigger if exists comment_notification on public.comments;
drop function if exists kanban_private.notify_task_event();

create or replace function kanban_private.notify_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare item public.tasks; wid uuid;
begin
  select * into item from public.tasks where id=new.task_id;
  select workspace_id into wid from public.boards where id=item.board_id;
  perform kanban_private.emit_notification(new.user_id,'task_assigned',item.board_id,item.id,wid,auth.uid(),
    'Você foi atribuído à tarefa: '||left(item.title,300),
    'assignment:'||item.id::text||':'||new.user_id::text||':'||txid_current()::text);
  return new;
end $$;
create trigger assigned_notification after insert on public.task_assignees
for each row execute function kanban_private.notify_assignment();

create or replace function kanban_private.notify_mention() returns trigger
language plpgsql security definer set search_path = '' as $$
declare tid uuid; bid uuid; wid uuid; title text;
begin
  select c.task_id,t.board_id,t.title into tid,bid,title from public.comments c join public.tasks t on t.id=c.task_id where c.id=new.comment_id;
  select workspace_id into wid from public.boards where id=bid;
  delete from public.notifications where user_id=new.user_id and dedupe_key='comment:'||new.comment_id::text||':'||new.user_id::text;
  perform kanban_private.emit_notification(new.user_id,'mention',bid,tid,wid,auth.uid(),
    'Você foi mencionado em: '||left(title,300),'mention:'||new.comment_id::text||':'||new.user_id::text);
  return new;
end $$;
drop trigger if exists comment_mentions_notification on public.comment_mentions;
create trigger comment_mentions_notification after insert on public.comment_mentions
for each row execute function kanban_private.notify_mention();

-- Deferred: quando um comentário é criado junto às menções, os mencionados não recebem também "comment".
create or replace function kanban_private.notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare item public.tasks; wid uuid; recipient uuid;
begin
  select * into item from public.tasks where id=new.task_id;
  select workspace_id into wid from public.boards where id=item.board_id;
  for recipient in
    select user_id from public.task_assignees where task_id=new.task_id
    union select item.created_by where item.created_by is not null
  loop
    if not exists(select 1 from public.comment_mentions m where m.comment_id=new.id and m.user_id=recipient) then
      perform kanban_private.emit_notification(recipient,'comment',item.board_id,item.id,wid,new.user_id,
        'Novo comentário em: '||left(item.title,300),'comment:'||new.id::text||':'||recipient::text);
    end if;
  end loop;
  return new;
end $$;
create constraint trigger comment_notification after insert on public.comments
  deferrable initially deferred for each row execute function kanban_private.notify_comment();

create or replace function kanban_private.notify_task_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare wid uuid; recipient uuid; column_name text; event_id text;
begin
  if new.due_date is not distinct from old.due_date and new.completed_at is not distinct from old.completed_at
    and new.column_id is not distinct from old.column_id then return new; end if;
  select workspace_id into wid from public.boards where id=new.board_id;
  select name into column_name from public.board_columns where id=new.column_id;
  event_id:=new.id::text||':'||txid_current()::text||':'||new.updated_at::text;
  for recipient in
    select user_id from public.task_assignees where task_id=new.id
    union select new.created_by where new.created_by is not null
  loop
    if new.due_date is distinct from old.due_date then
      perform kanban_private.emit_notification(recipient,'due_date_changed',new.board_id,new.id,wid,auth.uid(),
        'Prazo alterado em: '||left(new.title,300),event_id||':due:'||recipient::text);
    end if;
    if new.completed_at is not null and old.completed_at is null then
      perform kanban_private.emit_notification(recipient,'task_completed',new.board_id,new.id,wid,auth.uid(),
        'Tarefa concluída: '||left(new.title,300),event_id||':completed:'||recipient::text);
    end if;
    if new.column_id is distinct from old.column_id then
      perform kanban_private.emit_notification(recipient,'task_moved',new.board_id,new.id,wid,auth.uid(),
        'Tarefa movida para '||coalesce(column_name,'outra coluna')||': '||left(new.title,300),event_id||':moved:'||recipient::text);
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists task_changes_notification on public.tasks;
create trigger task_changes_notification after update of due_date,completed_at,column_id on public.tasks
for each row execute function kanban_private.notify_task_changes();

create or replace function kanban_private.notify_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare bid uuid; wid uuid; name text; recipient uuid; new_role public.member_role;
begin
  if tg_table_name='board_members' then
    bid:=new.board_id; recipient:=new.user_id; new_role:=new.role;
    select b.workspace_id,b.name into wid,name from public.boards b where b.id=bid;
    if tg_op='INSERT' then
      perform kanban_private.emit_notification(recipient,'board_invite',bid,null,wid,auth.uid(),
        'Você recebeu acesso ao board: '||left(name,300),'board-invite:'||new.id::text);
    elsif new.role is distinct from old.role then
      perform kanban_private.emit_notification(recipient,'role_changed',bid,null,wid,auth.uid(),
        'Seu papel no board '||left(name,300)||' mudou para '||new.role::text,
        'board-role:'||new.id::text||':'||txid_current()::text);
    end if;
  else
    wid:=new.workspace_id; recipient:=new.user_id; new_role:=new.role;
    select w.name into name from public.workspaces w where w.id=wid;
    if tg_op='UPDATE' and new.role is distinct from old.role then
      perform kanban_private.emit_notification(recipient,'role_changed',null,null,wid,auth.uid(),
        'Seu papel no workspace '||left(name,300)||' mudou para '||new.role::text,
        'workspace-role:'||new.id::text||':'||txid_current()::text);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists board_members_notification on public.board_members;
create trigger board_members_notification after insert or update of role on public.board_members
for each row execute function kanban_private.notify_membership();
drop trigger if exists workspace_members_notification on public.workspace_members;
create trigger workspace_members_notification after update of role on public.workspace_members
for each row execute function kanban_private.notify_membership();

-- O convite de workspace é oferecido por RPC (sem acesso direto a INSERT na tabela).
create or replace function public.create_workspace_invitation(p_workspace_id uuid,p_email text,p_role public.member_role) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare normalized text; secret text; invitation public.workspace_invitations; recipient uuid; workspace_name text;
begin
  if p_role='owner' or not kanban_private.can_manage_workspace_member(p_workspace_id,p_role) then
    raise exception 'Sem permissão para convidar com este papel' using errcode='42501'; end if;
  normalized:=lower(btrim(p_email));
  if normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail inválido' using errcode='23514'; end if;
  if exists(select 1 from auth.users u join public.workspace_members wm on wm.user_id=u.id where wm.workspace_id=p_workspace_id and lower(u.email)=normalized) then
    raise exception 'Este usuário já pertence ao workspace' using errcode='23514'; end if;
  delete from public.notifications n using public.workspace_invitations previous
    where n.dedupe_key='workspace-invite:'||previous.id::text and previous.workspace_id=p_workspace_id
      and previous.email=normalized and previous.accepted_at is null and previous.revoked_at is null;
  update public.workspace_invitations set revoked_at=now() where workspace_id=p_workspace_id and email=normalized and accepted_at is null and revoked_at is null;
  secret:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into public.workspace_invitations(workspace_id,email,role,token,invited_by,expires_at)
    values(p_workspace_id,normalized,p_role,md5(secret),auth.uid(),now()+interval '7 days') returning * into invitation;
  select id into recipient from auth.users where lower(email)=normalized;
  select name into workspace_name from public.workspaces where id=p_workspace_id;
  perform kanban_private.emit_notification(recipient,'workspace_invite',null,null,p_workspace_id,auth.uid(),
    'Você foi convidado para o workspace: '||left(workspace_name,300),'workspace-invite:'||invitation.id::text);
  return jsonb_build_object('id',invitation.id,'email',normalized,'role',p_role,'expires_at',invitation.expires_at,'secret',secret);
end $$;

-- Idempotente: executar diariamente via Supabase Cron/pg_cron depois de habilitar o scheduler.
create table if not exists kanban_private.overdue_deliveries (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  due_date timestamptz not null,
  created_at timestamptz not null default now(),
  primary key(task_id,user_id,due_date)
);
revoke all on kanban_private.overdue_deliveries from public,anon,authenticated;
create or replace function public.process_overdue_notifications(p_limit integer default 500) returns integer
language plpgsql security definer set search_path = '' as $$
declare item record; recipient uuid; inserted_count integer:=0; rows_inserted integer;
begin
  if p_limit<1 or p_limit>5000 then raise exception 'Limite inválido' using errcode='23514'; end if;
  for item in select t.id,t.board_id,t.title,t.due_date,t.created_by,b.workspace_id from public.tasks t
    join public.boards b on b.id=t.board_id where t.due_date<now() and t.completed_at is null and not t.archived and not b.archived
    and exists (
      select 1 from (
        select a.user_id from public.task_assignees a where a.task_id=t.id
        union select t.created_by where t.created_by is not null
      ) recipients join public.profiles p on p.id=recipients.user_id and p.disabled_at is null
      where kanban_private.board_role_for_user(t.board_id,recipients.user_id) is not null
      and not exists(select 1 from kanban_private.overdue_deliveries d
        where d.task_id=t.id and d.user_id=recipients.user_id and d.due_date=t.due_date)
    )
    order by t.due_date,t.id limit p_limit
  loop
    for recipient in select user_id from public.task_assignees where task_id=item.id
      union select item.created_by where item.created_by is not null
    loop
      if kanban_private.board_role_for_user(item.board_id,recipient) is not null
        and exists(select 1 from public.profiles p where p.id=recipient and p.disabled_at is null) then
        insert into kanban_private.overdue_deliveries(task_id,user_id,due_date) values(item.id,recipient,item.due_date)
          on conflict do nothing;
        get diagnostics rows_inserted = row_count;
        if rows_inserted=1 then
          perform kanban_private.emit_notification(recipient,'task_overdue',item.board_id,item.id,item.workspace_id,null,
            'Tarefa atrasada: '||left(item.title,300),'overdue:'||item.id::text||':'||item.due_date::text||':'||recipient::text);
          inserted_count:=inserted_count+1;
        end if;
      end if;
    end loop;
  end loop;
  return inserted_count;
end $$;
revoke all on function public.process_overdue_notifications(integer) from public,anon,authenticated;
commit;
