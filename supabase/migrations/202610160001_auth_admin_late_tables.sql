-- Completa as policies restritivas quando Auth/admin (migration 09) foi aplicada depois.
begin;

do $$
declare relation_name text;
begin
  foreach relation_name in array array['task_subtasks','comment_mentions','workspace_invitations'] loop
    if to_regclass('public.' || relation_name) is not null and not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname='public' and tablename=relation_name and policyname='account_active'
    ) then
      execute format(
        'create policy account_active on public.%I as restrictive for all to authenticated using (kanban_private.account_active()) with check (kanban_private.account_active())',
        relation_name
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
