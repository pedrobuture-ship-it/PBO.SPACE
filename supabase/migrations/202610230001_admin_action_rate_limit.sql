-- Limite transacional das operações administrativas sensíveis das Edge Functions.
begin;

create table kanban_private.admin_action_quota (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  window_start bigint not null,
  attempts integer not null check (attempts > 0),
  primary key (actor_id, action, window_start)
);
create index admin_action_quota_window_idx on kanban_private.admin_action_quota (window_start);
alter table kanban_private.admin_action_quota enable row level security;
revoke all on kanban_private.admin_action_quota from public, anon, authenticated;

create function public.consume_admin_action_quota(
  p_actor_id uuid, p_action text, p_limit integer, p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_window bigint; v_attempts integer;
begin
  if p_actor_id is null or p_action not in ('workspace-create-member', 'admin-reset-user-password')
    or p_limit not between 1 and 100 or p_window_seconds not between 60 and 86400 then
    raise exception 'Invalid quota parameters' using errcode = '22023';
  end if;
  v_window := floor(extract(epoch from clock_timestamp()) / p_window_seconds)::bigint;
  insert into kanban_private.admin_action_quota(actor_id, action, window_start, attempts)
  values (p_actor_id, p_action, v_window, 1)
  on conflict (actor_id, action, window_start)
  do update set attempts = kanban_private.admin_action_quota.attempts + 1
  returning attempts into v_attempts;
  return v_attempts <= p_limit;
end $$;

revoke all on function public.consume_admin_action_quota(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_admin_action_quota(uuid,text,integer,integer) to service_role;

commit;
