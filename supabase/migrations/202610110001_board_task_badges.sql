-- Contadores compactos dos cards, calculados sem N+1 e limitados ao board autorizado.
begin;
create function public.board_task_badges(p_board_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or not kanban_private.account_active() or
     not kanban_private.can_read_board(p_board_id) then
    raise exception 'Quadro indisponível' using errcode = '42501';
  end if;
  with visible_tasks as (
    select id from public.tasks where board_id = p_board_id and not archived
  ), checklist_counts as (
    select c.task_id,
      count(ci.id) as total,
      count(ci.id) filter (where ci.completed) as done
    from public.checklists c
    join visible_tasks t on t.id = c.task_id
    left join public.checklist_items ci on ci.checklist_id = c.id
    group by c.task_id
  ), comment_counts as (
    select c.task_id, count(*) as total from public.comments c
    join visible_tasks t on t.id = c.task_id group by c.task_id
  ), attachment_counts as (
    select a.task_id, count(*) as total from public.attachments a
    join visible_tasks t on t.id = a.task_id group by a.task_id
  )
  select coalesce(jsonb_object_agg(t.id, jsonb_build_object(
    'checklist_total', coalesce(cl.total, 0),
    'checklist_done', coalesce(cl.done, 0),
    'comments', coalesce(co.total, 0),
    'attachments', coalesce(at.total, 0)
  )), '{}'::jsonb) into result
  from visible_tasks t
  left join checklist_counts cl on cl.task_id = t.id
  left join comment_counts co on co.task_id = t.id
  left join attachment_counts at on at.task_id = t.id;
  return result;
end;
$$;
revoke all on function public.board_task_badges(uuid) from public, anon;
grant execute on function public.board_task_badges(uuid) to authenticated;
commit;
