-- A criação de contas/memberships passa pela Edge Function com service_role.
-- Chamadas REST comuns não podem inserir membership diretamente.
begin;

drop policy if exists workspace_members_add on public.workspace_members;
revoke insert on public.workspace_members from anon, authenticated;

-- A promoção global de app_role fica exclusivamente a cargo de operações manuais no banco.
revoke all on function public.admin_set_user_role(uuid, public.app_role) from public, anon, authenticated;

-- Lookup eficiente do Auth fica restrito ao service_role usado pela Edge Function.
create or replace function public.workspace_find_auth_user_by_email(p_email text)
returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  return (
    select u.id from auth.users u
    where lower(u.email) = lower(btrim(p_email))
    order by u.created_at, u.id
    limit 1
  );
end;
$$;
revoke all on function public.workspace_find_auth_user_by_email(text) from public, anon, authenticated;
grant execute on function public.workspace_find_auth_user_by_email(text) to service_role;

notify pgrst, 'reload schema';
commit;
