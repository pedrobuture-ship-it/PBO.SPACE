-- Analytics agregada com escopo de acesso validado e histórico de fluxo a partir da instalação.
begin;

create table if not exists kanban_private.analytics_config (
  config_key text primary key,
  started_at timestamptz not null
);
insert into kanban_private.analytics_config(config_key, started_at)
values ('task_status_history_started_at', clock_timestamp())
on conflict (config_key) do nothing;

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  column_id uuid not null references public.board_columns(id) on delete cascade,
  entered_at timestamptz not null,
  exited_at timestamptz,
  is_baseline boolean not null default false,
  check (exited_at is null or exited_at >= entered_at)
);
create index task_status_history_flow_idx on public.task_status_history(board_id, entered_at, exited_at, column_id);
create index task_status_history_task_open_idx on public.task_status_history(task_id) where exited_at is null;
alter table public.task_status_history enable row level security;
revoke all on public.task_status_history from anon, authenticated;
grant select on public.task_status_history to authenticated;
create policy task_status_history_read on public.task_status_history for select to authenticated
  using (kanban_private.can_read_board(board_id));

-- Estado inicial conhecido: a posição atual vira a linha de base. Duração anterior não é inferida.
insert into public.task_status_history(task_id, board_id, column_id, entered_at, is_baseline)
select t.id, t.board_id, t.column_id, c.started_at, true
from public.tasks t cross join kanban_private.analytics_config c
where c.config_key = 'task_status_history_started_at' and not t.archived;

create or replace function kanban_private.track_task_status_history()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := clock_timestamp();
begin
  if tg_op = 'INSERT' then
    if not new.archived then
      insert into public.task_status_history(task_id, board_id, column_id, entered_at)
      values (new.id, new.board_id, new.column_id, new.created_at);
    end if;
    return new;
  end if;

  if (new.column_id is distinct from old.column_id or new.archived is distinct from old.archived) then
    update public.task_status_history
      set exited_at = v_now
      where task_id = old.id and exited_at is null;
    if not new.archived then
      insert into public.task_status_history(task_id, board_id, column_id, entered_at)
      values (new.id, new.board_id, new.column_id, v_now);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function kanban_private.track_task_status_history() from public, anon, authenticated;
drop trigger if exists tasks_status_history_after on public.tasks;
create trigger tasks_status_history_after after insert or update of column_id, archived on public.tasks
for each row execute function kanban_private.track_task_status_history();

create index if not exists tasks_analytics_created_idx on public.tasks(board_id, created_at) where not archived;
create index if not exists tasks_analytics_completed_idx on public.tasks(board_id, completed_at) where completed_at is not null and not archived;
create index if not exists task_assignees_analytics_user_idx on public.task_assignees(user_id, task_id);
create index if not exists task_labels_analytics_label_idx on public.task_labels(label_id, task_id);

create or replace function public.dashboard_analytics(
  p_workspace_id uuid,
  p_board_id uuid default null,
  p_from timestamptz default (now() - interval '30 days'),
  p_to timestamptz default now(),
  p_assignee_id uuid default null,
  p_priority public.task_priority default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_history_start timestamptz;
begin
  if v_uid is null or not kanban_private.account_active() or
     kanban_private.workspace_role_for_user(p_workspace_id, v_uid) is null then
    raise exception 'Workspace indisponível' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '366 days' then
    raise exception 'Período inválido' using errcode = '22023';
  end if;
  if p_board_id is not null and not exists (
    select 1 from public.boards b where b.id = p_board_id and b.workspace_id = p_workspace_id
      and not b.archived and kanban_private.board_role_for_user(b.id, v_uid) is not null
  ) then
    raise exception 'Quadro indisponível' using errcode = '42501';
  end if;
  select started_at into v_history_start from kanban_private.analytics_config where config_key = 'task_status_history_started_at';

  return (
    with visible_boards as (
      select b.id, b.name from public.boards b
      where b.workspace_id = p_workspace_id and not b.archived
        and (p_board_id is null or b.id = p_board_id)
        and kanban_private.board_role_for_user(b.id, v_uid) is not null
    ), scoped as (
      select t.*, b.name as board_name
      from public.tasks t join visible_boards b on b.id = t.board_id
      where not t.archived and (p_priority is null or t.priority = p_priority)
        and (p_assignee_id is null or exists (select 1 from public.task_assignees ta where ta.task_id=t.id and ta.user_id=p_assignee_id))
    ), event_scope as (
      select * from scoped where created_at < p_to and (completed_at is null or completed_at < p_to)
    ), daily as (
      select d::date as day,
        (select count(*) from scoped s where s.created_at >= d and s.created_at < d + interval '1 day') as created,
        (select count(*) from scoped s where s.completed_at >= d and s.completed_at < d + interval '1 day') as completed
      from generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 microsecond'), interval '1 day') d
    ), by_status as (
      select c.id, c.name, c.color, c.position, count(s.id)::bigint as value
      from visible_boards b join public.board_columns c on c.board_id=b.id
      left join scoped s on s.column_id=c.id
      group by c.id, c.name, c.color, c.position
    ), by_priority as (
      select p.value as name, count(s.id)::bigint as value
      from unnest(enum_range(null::public.task_priority)) p(value)
      left join scoped s on s.priority=p.value
      group by p.value
    ), created_completed as (
      select d.day, d.created, d.completed from daily d
    ), completed_durations as (
      select extract(epoch from (completed_at-created_at))/3600.0 as hours
      from scoped where completed_at is not null and completed_at >= p_from and completed_at < p_to
    ), workload as (
      select p.id, coalesce(nullif(p.display_name,''),p.username,'Membro') as name,
        count(distinct s.id)::bigint as open_tasks
      from scoped s join public.task_assignees ta on ta.task_id=s.id
      join public.profiles p on p.id=ta.user_id
      where s.completed_at is null group by p.id,p.display_name,p.username order by open_tasks desc limit 20
    ), overdue_users as (
      select p.id, coalesce(nullif(p.display_name,''),p.username,'Membro') as name,
        count(distinct s.id)::bigint as overdue
      from scoped s join public.task_assignees ta on ta.task_id=s.id
      join public.profiles p on p.id=ta.user_id
      where s.completed_at is null and s.due_date < now()
      group by p.id,p.display_name,p.username order by overdue desc limit 20
    ), by_label as (
      select l.id, l.name, l.color, count(distinct s.id)::bigint as value
      from scoped s join public.task_labels tl on tl.task_id=s.id join public.labels l on l.id=tl.label_id
      group by l.id,l.name,l.color order by value desc limit 12
    ), throughput as (
      select date_trunc('week',completed_at)::date as week, count(*)::bigint as value
      from scoped where completed_at >= p_from and completed_at < p_to
      group by date_trunc('week',completed_at)
    ), column_time as (
      select c.id, c.name, c.color,
        avg(extract(epoch from (least(coalesce(h.exited_at,now()),p_to) - h.entered_at))/3600.0)::numeric as avg_hours,
        count(h.id)::bigint as observations
      from visible_boards b join public.board_columns c on c.board_id=b.id
      left join public.task_status_history h on h.column_id=c.id and h.entered_at >= p_from and h.entered_at < p_to
        and h.entered_at >= v_history_start and (p_assignee_id is null or exists (select 1 from public.task_assignees ta join public.tasks t on t.id=ta.task_id where t.id=h.task_id and ta.user_id=p_assignee_id))
        and (p_priority is null or exists (select 1 from public.tasks t where t.id=h.task_id and t.priority=p_priority))
      group by c.id,c.name,c.color,c.position order by c.position
    ), cfd_days as (
      select d::date as day from generate_series(date_trunc('day',p_from),date_trunc('day',p_to-interval '1 microsecond'),interval '1 day') d
    ), cfd as (
      select cd.day,c.id as column_id,c.name as column_name,c.color,
        count(h.id)::bigint as value
      from cfd_days cd cross join visible_boards b join public.board_columns c on c.board_id=b.id
      left join public.task_status_history h on h.column_id=c.id
        and h.entered_at < cd.day + interval '1 day'
        and (h.exited_at is null or h.exited_at >= cd.day + interval '1 day')
        and h.entered_at >= v_history_start
        and (p_assignee_id is null or exists (select 1 from public.task_assignees ta where ta.task_id=h.task_id and ta.user_id=p_assignee_id))
        and (p_priority is null or exists (select 1 from public.tasks t where t.id=h.task_id and t.priority=p_priority))
      group by cd.day,c.id,c.name,c.color
    ), summary as (
      select count(*)::bigint as total,
        count(*) filter (where completed_at is null)::bigint as in_progress,
        count(*) filter (where completed_at is not null)::bigint as completed_total,
        count(*) filter (where completed_at is not null and completed_at >= p_from and completed_at < p_to)::bigint as completed,
        count(*) filter (where completed_at is null and due_date < now())::bigint as overdue,
        count(*) filter (where created_at >= p_from and created_at < p_to)::bigint as created_in_period
      from scoped
    ), previous_period as (
      select count(*) filter (where created_at >= p_from-(p_to-p_from) and created_at < p_from)::bigint as created,
        count(*) filter (where completed_at >= p_from-(p_to-p_from) and completed_at < p_from)::bigint as completed
      from scoped
    )
    select jsonb_build_object(
      'summary', jsonb_build_object('total',summary.total,'in_progress',summary.in_progress,'completed',summary.completed,'completed_total',summary.completed_total,
        'overdue',summary.overdue,'created_in_period',summary.created_in_period,
        'completion_rate',case when summary.total=0 then null else round(100.0*summary.completed_total/summary.total,1) end,
        'avg_completion_hours',(select round(avg(hours)::numeric,1) from completed_durations),
        'previous_created',previous_period.created,'previous_completed',previous_period.completed),
      'boards',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) from visible_boards),
      'status',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'color',color,'value',value) order by position),'[]'::jsonb) from by_status),
      'priority',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'value',value) order by case name when 'urgent' then 1 when 'high' then 2 when 'medium' then 3 when 'low' then 4 else 5 end),'[]'::jsonb) from by_priority),
      'trend',(select coalesce(jsonb_agg(jsonb_build_object('date',day,'created',created,'completed',completed) order by day),'[]'::jsonb) from created_completed),
      'workload',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'value',open_tasks) order by open_tasks desc),'[]'::jsonb) from workload),
      'overdue_by_assignee',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'value',overdue) order by overdue desc),'[]'::jsonb) from overdue_users),
      'throughput',(select coalesce(jsonb_agg(jsonb_build_object('week',week,'value',value) order by week),'[]'::jsonb) from throughput),
      'column_time',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'color',color,'avg_hours',avg_hours,'observations',observations) order by observations desc),'[]'::jsonb) from column_time),
      'labels',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'color',color,'value',value) order by value desc),'[]'::jsonb) from by_label),
      'cumulative_flow',(select coalesce(jsonb_agg(jsonb_build_object('date',day,'column_id',column_id,'name',column_name,'color',color,'value',value) order by day,column_name),'[]'::jsonb) from cfd),
      'history_started_at',v_history_start,
      'cumulative_flow_available',(v_history_start is not null and p_from >= v_history_start and p_to-p_from >= interval '6 days')
    ) from summary cross join previous_period
  );
end;
$$;
revoke all on function public.dashboard_analytics(uuid,uuid,timestamptz,timestamptz,uuid,public.task_priority) from public, anon;
grant execute on function public.dashboard_analytics(uuid,uuid,timestamptz,timestamptz,uuid,public.task_priority) to authenticated;
notify pgrst, 'reload schema';
commit;
