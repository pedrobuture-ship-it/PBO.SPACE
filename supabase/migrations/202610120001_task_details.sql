-- Relações de detalhe: subtarefa é uma tarefa real, independente de checklist.
create table public.task_subtasks (
  parent_task_id uuid not null references public.tasks(id) on delete cascade,
  child_task_id uuid primary key references public.tasks(id) on delete cascade,
  position numeric(38,18) not null default 1024,
  created_at timestamptz not null default now(),
  constraint task_subtasks_distinct check (parent_task_id <> child_task_id)
);
create index task_subtasks_parent_order_idx on public.task_subtasks(parent_task_id,position,child_task_id);
alter table public.task_subtasks enable row level security;
revoke all on public.task_subtasks from anon, authenticated;
grant select, insert(parent_task_id,child_task_id,position), update(position), delete on public.task_subtasks to authenticated;
create policy subtasks_read on public.task_subtasks for select to authenticated using (kanban_private.can_read_task(parent_task_id) and kanban_private.can_read_task(child_task_id));
create policy subtasks_add on public.task_subtasks for insert to authenticated with check (kanban_private.can_edit_task(parent_task_id) and kanban_private.can_edit_task(child_task_id));
create policy subtasks_edit on public.task_subtasks for update to authenticated using (kanban_private.can_edit_task(parent_task_id)) with check (kanban_private.can_edit_task(parent_task_id));
create policy subtasks_delete on public.task_subtasks for delete to authenticated using (kanban_private.can_edit_task(parent_task_id));

create function kanban_private.validate_subtask() returns trigger language plpgsql security definer set search_path = '' as $$
declare bid uuid;
begin
  bid := kanban_private.task_board(new.parent_task_id);
  if bid is null or bid is distinct from kanban_private.task_board(new.child_task_id) then
    raise exception 'Subtarefa precisa pertencer ao mesmo quadro' using errcode='23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('subtasks:' || bid::text, 0));
  if exists (
    with recursive ancestors(id) as (
      select new.parent_task_id
      union
      select s.parent_task_id from public.task_subtasks s join ancestors a on s.child_task_id=a.id where s.child_task_id <> new.child_task_id
    ) select 1 from ancestors where id=new.child_task_id
  ) then raise exception 'Subtarefas circulares não são permitidas' using errcode='23514'; end if;
  return new;
end $$;
create trigger task_subtasks_validate before insert or update on public.task_subtasks for each row execute function kanban_private.validate_subtask();

create function public.create_subtask(p_parent_task_id uuid,p_title text) returns public.tasks
language plpgsql security invoker set search_path = '' as $$
declare parent_task public.tasks; child public.tasks;
begin
  select * into parent_task from public.tasks where id=p_parent_task_id;
  if parent_task.id is null or not kanban_private.can_edit_task(p_parent_task_id) then
    raise exception 'Sem acesso à tarefa' using errcode='42501';
  end if;
  select * into child from public.create_task(parent_task.board_id,parent_task.column_id,p_title,'none');
  insert into public.task_subtasks(parent_task_id,child_task_id) values(p_parent_task_id,child.id);
  return child;
end $$;
revoke all on function public.create_subtask(uuid,text) from public,anon;
grant execute on function public.create_subtask(uuid,text) to authenticated;

-- Referências estruturadas, para notificações futuras sem interpretar texto livre.
create table public.comment_mentions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key(comment_id,user_id)
);
create index comment_mentions_user_idx on public.comment_mentions(user_id,comment_id);
alter table public.comment_mentions enable row level security;
revoke all on public.comment_mentions from anon, authenticated;
grant select, insert(comment_id,user_id), delete on public.comment_mentions to authenticated;
create function kanban_private.mention_task(p_comment uuid) returns uuid language sql stable security definer set search_path = '' as $$
  select task_id from public.comments where id=p_comment
$$;
create function kanban_private.can_mention(p_comment uuid,p_user uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.comments c where c.id=p_comment and c.user_id=auth.uid() and kanban_private.can_edit_task(c.task_id)
    and kanban_private.board_role_for_user(kanban_private.task_board(c.task_id),p_user) is not null)
$$;
revoke all on function kanban_private.mention_task(uuid),kanban_private.can_mention(uuid,uuid) from public,anon;
grant execute on function kanban_private.mention_task(uuid),kanban_private.can_mention(uuid,uuid) to authenticated;
create policy mentions_read on public.comment_mentions for select to authenticated using (kanban_private.can_read_task(kanban_private.mention_task(comment_id)));
create policy mentions_add on public.comment_mentions for insert to authenticated with check (kanban_private.can_mention(comment_id,user_id));
create policy mentions_delete on public.comment_mentions for delete to authenticated using (
  exists(select 1 from public.comments c where c.id=comment_id and c.user_id=auth.uid() and kanban_private.can_edit_task(c.task_id))
);

create function public.create_comment_with_mentions(p_task_id uuid,p_content text,p_mentions jsonb default '[]'::jsonb) returns public.comments
language plpgsql security invoker set search_path = '' as $$
declare result public.comments;
begin
  if jsonb_typeof(p_mentions) <> 'array' then raise exception 'Menções inválidas' using errcode='23514'; end if;
  insert into public.comments(task_id,content) values(p_task_id,btrim(p_content)) returning * into result;
  insert into public.comment_mentions(comment_id,user_id)
    select result.id,mention.user_id::uuid from jsonb_array_elements_text(p_mentions) as mention(user_id) group by mention.user_id;
  return result;
end $$;
create function public.update_comment_with_mentions(p_comment_id uuid,p_content text,p_mentions jsonb default '[]'::jsonb) returns public.comments
language plpgsql security invoker set search_path = '' as $$
declare result public.comments;
begin
  if jsonb_typeof(p_mentions) <> 'array' then raise exception 'Menções inválidas' using errcode='23514'; end if;
  update public.comments set content=btrim(p_content) where id=p_comment_id returning * into result;
  if result.id is null then raise exception 'Sem permissão para editar comentário' using errcode='42501'; end if;
  delete from public.comment_mentions where comment_id=p_comment_id;
  insert into public.comment_mentions(comment_id,user_id)
    select result.id,mention.user_id::uuid from jsonb_array_elements_text(p_mentions) as mention(user_id) group by mention.user_id;
  return result;
end $$;
revoke all on function public.create_comment_with_mentions(uuid,text,jsonb),public.update_comment_with_mentions(uuid,text,jsonb) from public,anon;
grant execute on function public.create_comment_with_mentions(uuid,text,jsonb),public.update_comment_with_mentions(uuid,text,jsonb) to authenticated;

-- O histórico preserva campos alterados sem gravar todo o conteúdo da descrição.
create or replace function kanban_private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare item jsonb; bid uuid; tid uuid; wid uuid; entity_id uuid; changed jsonb := '{}'::jsonb; field text;
begin
  item := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  entity_id := (item->>'id')::uuid;
  if tg_table_name='workspaces' then wid:=entity_id;
  elsif tg_table_name='boards' then bid:=entity_id; wid:=(item->>'workspace_id')::uuid;
  elsif tg_table_name='tasks' then tid:=entity_id; bid:=(item->>'board_id')::uuid;
  else bid:=(item->>'board_id')::uuid; end if;
  if wid is null then select workspace_id into wid from public.boards where id=bid; end if;
  if tg_op='UPDATE' then
    for field in select jsonb_object_keys(to_jsonb(new)) loop
      if field not in ('updated_at','description') and to_jsonb(old)->field is distinct from to_jsonb(new)->field then
        changed := changed || jsonb_build_object(field,jsonb_build_object('from',to_jsonb(old)->field,'to',to_jsonb(new)->field));
      end if;
    end loop;
  end if;
  if wid is not null and exists(select 1 from public.workspaces where id=wid) and (tg_op <> 'UPDATE' or changed <> '{}'::jsonb or to_jsonb(old)->'description' is distinct from to_jsonb(new)->'description') then
    insert into public.activity_logs(workspace_id,board_id,task_id,user_id,action,metadata)
    values(wid,bid,tid,auth.uid(),tg_table_name||'.'||lower(tg_op),jsonb_build_object('entity_id',entity_id,'entity_type',tg_table_name,'changes',changed,'description_changed',tg_op='UPDATE' and to_jsonb(old)->'description' is distinct from to_jsonb(new)->'description'));
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

create function kanban_private.audit_task_relation() returns trigger language plpgsql security definer set search_path = '' as $$
declare item jsonb; tid uuid; bid uuid; wid uuid;
begin
  item:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  tid:=case when tg_table_name='checklist_items' then kanban_private.checklist_task((item->>'checklist_id')::uuid)
    when tg_table_name='checklists' then (item->>'task_id')::uuid
    when tg_table_name='task_subtasks' then (item->>'parent_task_id')::uuid
    when tg_table_name='comment_mentions' then kanban_private.mention_task((item->>'comment_id')::uuid)
    else (item->>'task_id')::uuid end;
  bid:=kanban_private.task_board(tid);
  select workspace_id into wid from public.boards where id=bid;
  if wid is not null then
    insert into public.activity_logs(workspace_id,board_id,task_id,user_id,action,metadata)
    values(wid,bid,tid,auth.uid(),tg_table_name||'.'||lower(tg_op),jsonb_build_object('entity_type',tg_table_name,'operation',tg_op));
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

do $$ declare relation text; begin
  foreach relation in array array['task_assignees','task_labels','checklists','checklist_items','comments','attachments','task_dependencies','task_subtasks'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function kanban_private.audit_task_relation()',relation||'_detail_audit',relation);
  end loop;
end $$;

-- Mesmo canal privado do quadro; o cliente invalida detalhes somente da tarefa aberta.
create function kanban_private.broadcast_task_relation() returns trigger language plpgsql security definer set search_path = '' as $$
declare item jsonb; tid uuid; bid uuid; wid uuid; uid uuid; payload jsonb;
begin
  item:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  tid:=case when tg_table_name='checklist_items' then kanban_private.checklist_task((item->>'checklist_id')::uuid)
    when tg_table_name='checklists' then (item->>'task_id')::uuid
    when tg_table_name='task_subtasks' then (item->>'parent_task_id')::uuid
    else (item->>'task_id')::uuid end;
  bid:=kanban_private.task_board(tid);
  if bid is not null then
    select workspace_id into wid from public.boards where id=bid;
    payload:=jsonb_build_object('table',tg_table_name,'operation',tg_op,'board_id',bid,'task_id',tid,
      'related_task_id',case when tg_table_name='task_dependencies' then item->>'depends_on_task_id' when tg_table_name='task_subtasks' then item->>'child_task_id' else null end);
    for uid in select user_id from public.workspace_members where workspace_id=wid loop
      if kanban_private.board_role_for_user(bid,uid) is not null then
        perform realtime.send(payload,'data-change','board:'||bid::text||':user:'||uid::text,true);
      end if;
    end loop;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
do $$ declare relation text; begin
  foreach relation in array array['task_assignees','task_labels','checklists','checklist_items','attachments','task_dependencies','task_subtasks'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function kanban_private.broadcast_task_relation()',relation||'_detail_realtime',relation);
  end loop;
end $$;

update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp','image/avif','application/pdf','text/plain'] where id='task-attachments';
