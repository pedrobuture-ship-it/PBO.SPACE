-- Alterações de membros via RPC autorizada: controla workspace_role e profile.display_name.
begin;

-- O papel global app_role não faz parte desta API. Atualizações do membership passam pela RPC.
revoke update on public.workspace_members from anon, authenticated;
drop policy if exists workspace_members_edit on public.workspace_members;

-- Workspace admin não pode remover outro admin; owner pode remover membros e admins.
drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members for delete to authenticated
using (
  role <> 'owner' and (
    kanban_private.workspace_role(workspace_id) = 'owner'
    or (kanban_private.workspace_role(workspace_id) = 'admin' and role in ('member','viewer'))
  )
);

create or replace function public.workspace_update_member(
  p_workspace_id uuid,
  p_member_user_id uuid,
  p_display_name text default null,
  p_workspace_role public.member_role default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.member_role;
  v_target_role public.member_role;
  v_owner uuid;
  v_old_name text;
  v_new_name text;
  v_role_changed boolean;
  v_name_changed boolean;
  v_actor_name text;
  v_target_name text;
  v_summary text;
begin
  if v_actor is null or not kanban_private.account_active() then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  v_actor_role := kanban_private.workspace_role_for_user(p_workspace_id, v_actor);
  if v_actor_role is null or v_actor_role not in ('owner','admin') then
    raise exception 'Você não possui permissão para editar membros' using errcode = '42501';
  end if;
  if p_display_name is null and p_workspace_role is null then
    raise exception 'Nenhuma alteração informada' using errcode = '22023';
  end if;
  if p_display_name is not null and char_length(btrim(p_display_name)) not between 2 and 120 then
    raise exception 'Nome inválido' using errcode = '22023';
  end if;
  if p_workspace_role = 'owner' then
    raise exception 'Transfira a propriedade pelo fluxo específico' using errcode = '42501';
  end if;

  select w.owner_id into v_owner from public.workspaces w where w.id = p_workspace_id for update;
  if v_owner is null then raise exception 'Workspace não encontrado' using errcode = 'P0002'; end if;
  if p_member_user_id = v_owner then
    raise exception 'A propriedade deve ser transferida pelo fluxo específico' using errcode = '42501';
  end if;
  select m.role, p.display_name into v_target_role, v_old_name
  from public.workspace_members m join public.profiles p on p.id = m.user_id
  where m.workspace_id = p_workspace_id and m.user_id = p_member_user_id for update of m,p;
  if v_target_role is null then raise exception 'Membro não encontrado' using errcode = 'P0002'; end if;
  if v_actor_role = 'admin' and (v_target_role not in ('member','viewer') or (p_workspace_role is not null and p_workspace_role not in ('member','viewer'))) then
    raise exception 'Workspace admin pode gerenciar somente membros e visualizadores' using errcode = '42501';
  end if;

  v_new_name := coalesce(btrim(p_display_name), v_old_name);
  v_role_changed := p_workspace_role is not null and p_workspace_role is distinct from v_target_role;
  v_name_changed := p_display_name is not null and v_new_name is distinct from v_old_name;
  if v_role_changed then
    update public.workspace_members set role = p_workspace_role
    where workspace_id = p_workspace_id and user_id = p_member_user_id;
  end if;
  if v_name_changed then
    update public.profiles set display_name = v_new_name where id = p_member_user_id;
  end if;
  if v_role_changed or v_name_changed then
    select display_name into v_actor_name from public.profiles where id = v_actor;
    select display_name into v_target_name from public.profiles where id = p_member_user_id;
    v_summary := case
      when v_role_changed and v_name_changed then format('%s alterou o nome de %s e o cargo de %s para %s do workspace.', v_actor_name, v_old_name, case v_target_role when 'admin' then 'Admin' when 'member' then 'Membro' else 'Visualizador' end, case p_workspace_role when 'admin' then 'Admin' when 'member' then 'Membro' else 'Visualizador' end)
      when v_role_changed then format('%s alterou %s de %s para %s do workspace.', v_actor_name, v_target_name, case v_target_role when 'admin' then 'Admin' when 'member' then 'Membro' else 'Visualizador' end, case p_workspace_role when 'admin' then 'Admin' when 'member' then 'Membro' else 'Visualizador' end)
      else format('%s atualizou o nome de %s no workspace.', v_actor_name, v_old_name)
    end;
    insert into public.activity_logs(workspace_id,user_id,action,metadata)
    values (p_workspace_id,v_actor,'workspace_member_updated',jsonb_build_object(
      'summary',v_summary,'member_user_id',p_member_user_id,'old_role',v_target_role,
      'new_role',case when v_role_changed then p_workspace_role else v_target_role end,
      'old_display_name',v_old_name,'new_display_name',v_target_name,
      'role_changed',v_role_changed,'display_name_changed',v_name_changed
    ));
  end if;
  return jsonb_build_object('user_id',p_member_user_id,'display_name',v_target_name,'role',case when v_role_changed then p_workspace_role else v_target_role end,'changed',v_role_changed or v_name_changed);
end;
$$;

revoke all on function public.workspace_update_member(uuid,uuid,text,public.member_role) from public, anon;
grant execute on function public.workspace_update_member(uuid,uuid,text,public.member_role) to authenticated;
notify pgrst, 'reload schema';
commit;
