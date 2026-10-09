-- A Home lê quadros e indicadores separadamente para isolar falhas sem alterar permissões.
begin;

create or replace function public.home_boards(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not kanban_private.account_active() or
     kanban_private.workspace_role_for_user(p_workspace_id, auth.uid()) is null then
    raise exception 'Workspace indisponível' using errcode = '42501';
  end if;

  return (
    with accessible as (
      select b.id, b.workspace_id, b.name, b.description, b.icon, b.color,
             b.created_at, b.updated_at,
             kanban_private.board_role_for_user(b.id, auth.uid()) as access_role
      from public.boards b
      where b.workspace_id = p_workspace_id and not b.archived
    ), visible_boards as (
      select * from accessible where access_role is not null
    ), task_totals as (
      select t.board_id, count(*) as total,
             count(*) filter (where t.completed_at is not null) as completed
      from public.tasks t join visible_boards b on b.id = t.board_id
      where not t.archived group by t.board_id
    ), effective_members as (
      select b.id as board_id, p.id as user_id, p.display_name, p.avatar_url,
             row_number() over (partition by b.id order by wm.joined_at, p.id) as member_rank
      from visible_boards b
      join public.workspace_members wm on wm.workspace_id = b.workspace_id
      left join public.board_members bm on bm.board_id = b.id and bm.user_id = wm.user_id
      join public.profiles p on p.id = wm.user_id
      where wm.role in ('owner','admin') or bm.user_id is not null
    ), member_totals as (
      select board_id, count(*) as total,
             coalesce(jsonb_agg(jsonb_build_object('id', user_id, 'name', display_name,
               'avatar_url', avatar_url) order by member_rank)
               filter (where member_rank <= 3), '[]'::jsonb) as people
      from effective_members group by board_id
    ), last_events as (
      select a.board_id, max(a.created_at) as happened_at
      from public.activity_logs a join visible_boards b on b.id = a.board_id
      group by a.board_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'workspace_id', b.workspace_id, 'name', b.name,
      'description', b.description, 'icon', b.icon, 'color', b.color,
      'created_at', b.created_at, 'updated_at', b.updated_at,
      'access_role', b.access_role, 'task_count', coalesce(tt.total, 0),
      'completed_count', coalesce(tt.completed, 0),
      'member_count', coalesce(mt.total, 0),
      'members', coalesce(mt.people, '[]'::jsonb),
      'last_activity', coalesce(le.happened_at, b.updated_at),
      'favorite', f.board_id is not null
    ) order by coalesce(le.happened_at, b.updated_at) desc, b.id), '[]'::jsonb)
    from visible_boards b
    left join task_totals tt on tt.board_id = b.id
    left join member_totals mt on mt.board_id = b.id
    left join last_events le on le.board_id = b.id
    left join public.favorites f on f.board_id = b.id and f.user_id = auth.uid()
  );
end;
$$;

create or replace function public.home_metrics(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not kanban_private.account_active() or
     kanban_private.workspace_role_for_user(p_workspace_id, auth.uid()) is null then
    raise exception 'Workspace indisponível' using errcode = '42501';
  end if;

  return (
    with accessible as (
      select b.id, kanban_private.board_role_for_user(b.id, auth.uid()) as access_role
      from public.boards b
      where b.workspace_id = p_workspace_id and not b.archived
    ), visible_boards as (
      select id from accessible where access_role is not null
    ), my_tasks as (
      select t.due_date, t.completed_at
      from public.task_assignees ta
      join public.tasks t on t.id = ta.task_id
      join visible_boards b on b.id = t.board_id
      where ta.user_id = auth.uid() and not t.archived
    )
    select jsonb_build_object(
      'active_boards', (select count(*) from visible_boards),
      'my_tasks', count(*) filter (where completed_at is null),
      'due_soon', count(*) filter (where completed_at is null and due_date >= now()
        and due_date < now() + interval '7 days'),
      'overdue', count(*) filter (where completed_at is null and due_date < now()),
      'completed_recently', count(*) filter (where completed_at >= now() - interval '7 days')
    ) from my_tasks
  );
end;
$$;

revoke all on function public.home_boards(uuid), public.home_metrics(uuid) from public, anon;
grant execute on function public.home_boards(uuid), public.home_metrics(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
