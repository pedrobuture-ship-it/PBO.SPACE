-- Cargos globais são manutenção do Supabase; a aplicação nunca os altera.
begin;

-- Remove qualquer grant de tabela/coluna legado que pudesse permitir app_role
-- ou disabled_at via PostgREST. A UI continua podendo editar os campos de perfil.
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke update (app_role, disabled_at) on public.profiles from anon, authenticated;
grant update (display_name, username, avatar_url) on public.profiles to authenticated;

-- Não há fluxo de aplicação para promover usuários. O cargo é ajustado pelo
-- proprietário do banco no Supabase, via SQL Editor/operador de banco.
drop function if exists public.admin_set_user_role(uuid, public.app_role);

notify pgrst, 'reload schema';
commit;
