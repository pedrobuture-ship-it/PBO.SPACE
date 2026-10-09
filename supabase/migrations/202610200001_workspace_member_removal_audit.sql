-- Registra remoções de membership sem apagar a identidade global ou o histórico colaborativo.
begin;

-- Somente owner remove admins; admin remove apenas membros/visualizadores.
-- A linha do owner nunca é removível pela ação comum de membership.
drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members for delete to authenticated
using (
  role <> 'owner' and (
    kanban_private.workspace_role(workspace_id) = 'owner'
    or (kanban_private.workspace_role(workspace_id) = 'admin' and role in ('member','viewer'))
  )
);

create or replace function kanban_private.audit_workspace_member_removal()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  actor_name text;
  member_name text;
  workspace_name text;
begin
  -- Remoções operacionais sem JWT (ex.: manutenção) não inventam um ator.
  if actor_id is null then return old; end if;
  select display_name into actor_name from public.profiles where id = actor_id;
  select display_name into member_name from public.profiles where id = old.user_id;
  select name into workspace_name from public.workspaces where id = old.workspace_id;
  -- Ao excluir o workspace, sua FK remove memberships em cascata. Esse evento
  -- não é remoção individual e não pode gerar log ligado a workspace inexistente.
  if workspace_name is null then return old; end if;
  insert into public.activity_logs(workspace_id,user_id,action,metadata)
  values (
    old.workspace_id,
    actor_id,
    'workspace_member_removed',
    jsonb_build_object(
      'summary', format('%s removeu %s do workspace %s.', coalesce(nullif(actor_name,''),'Um administrador'), coalesce(nullif(member_name,''),'um membro'), coalesce(workspace_name,'workspace')),
      'member_user_id', old.user_id,
      'member_name', member_name,
      'member_role', old.role
    )
  );
  return old;
end;
$$;

drop trigger if exists workspace_member_removal_audit on public.workspace_members;
create trigger workspace_member_removal_audit
after delete on public.workspace_members
for each row execute function kanban_private.audit_workspace_member_removal();

revoke all on function kanban_private.audit_workspace_member_removal() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
