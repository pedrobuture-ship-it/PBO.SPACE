-- Papéis globais continuam independentes: somente membership do workspace/board concede acesso.
create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  role public.member_role not null check (role <> 'owner'),
  token text not null unique check (token ~ '^[0-9a-f]{32}$'), -- hash MD5 de um segredo aleatório de dois UUIDs; nunca o segredo bruto
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (accepted_at is null or revoked_at is null)
);
create unique index invitations_pending_email_idx on public.workspace_invitations(workspace_id,email) where accepted_at is null and revoked_at is null;
create index invitations_workspace_created_idx on public.workspace_invitations(workspace_id,created_at desc);
alter table public.workspace_invitations enable row level security;
revoke all on public.workspace_invitations from anon,authenticated;
grant select(id,workspace_id,email,role,invited_by,expires_at,accepted_at,revoked_at,created_at) on public.workspace_invitations to authenticated;
create policy invitations_manage_read on public.workspace_invitations for select to authenticated using (kanban_private.can_manage_workspace(workspace_id));

-- Owner pode gerir admins; admin pode gerir somente member/viewer. O owner nunca é editado pela tabela.
create function kanban_private.can_manage_workspace_member(p_workspace uuid,p_role public.member_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when p_role='owner' then false
    when kanban_private.workspace_role(p_workspace)='owner' then true
    when kanban_private.workspace_role(p_workspace)='admin' then p_role in ('member','viewer')
    else false end
$$;
create function kanban_private.can_manage_board_member(p_board uuid,p_role public.member_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when p_role='owner' then false
    when exists(select 1 from public.boards b where b.id=p_board and kanban_private.workspace_role(b.workspace_id)='owner') then true
    when exists(select 1 from public.board_members m where m.board_id=p_board and m.user_id=auth.uid() and m.role='owner') then true
    when kanban_private.board_role(p_board)='admin' then p_role in ('member','viewer')
    else false end
$$;
revoke all on function kanban_private.can_manage_workspace_member(uuid,public.member_role),kanban_private.can_manage_board_member(uuid,public.member_role) from public,anon;
grant execute on function kanban_private.can_manage_workspace_member(uuid,public.member_role),kanban_private.can_manage_board_member(uuid,public.member_role) to authenticated;
drop policy workspace_members_add on public.workspace_members;
drop policy workspace_members_edit on public.workspace_members;
drop policy workspace_members_delete on public.workspace_members;
create policy workspace_members_add on public.workspace_members for insert to authenticated with check (kanban_private.can_manage_workspace_member(workspace_id,role));
create policy workspace_members_edit on public.workspace_members for update to authenticated using (kanban_private.can_manage_workspace_member(workspace_id,role)) with check (kanban_private.can_manage_workspace_member(workspace_id,role));
create policy workspace_members_delete on public.workspace_members for delete to authenticated using (kanban_private.can_manage_workspace_member(workspace_id,role));

-- Normaliza owners preexistentes antes da restrição de unicidade.
do $$ declare b record; keeper uuid; begin
  for b in select id,workspace_id from public.boards loop
    select id into keeper from public.board_members where board_id=b.id and role='owner' order by created_at,id limit 1;
    if keeper is not null then
      update public.board_members set role='admin' where board_id=b.id and role='owner' and id<>keeper;
    else
      select bm.id into keeper from public.board_members bm join public.workspace_members wm on wm.workspace_id=b.workspace_id and wm.user_id=bm.user_id
        where bm.board_id=b.id order by bm.created_at,bm.id limit 1;
      if keeper is not null then update public.board_members set role='owner' where id=keeper;
      else insert into public.board_members(board_id,user_id,role) select b.id,w.owner_id,'owner' from public.workspaces w where w.id=b.workspace_id; end if;
    end if;
  end loop;
end $$;
create unique index board_single_owner_idx on public.board_members(board_id) where role='owner';
create or replace function kanban_private.board_role_for_user(p_board uuid,p_user uuid)
returns public.member_role language sql stable security definer set search_path = '' as $$
  select case
    when wm.role='owner' then 'owner'::public.member_role
    when bm.role='owner' then 'owner'::public.member_role
    when wm.role='admin' then 'admin'::public.member_role
    when wm.role='viewer' then 'viewer'::public.member_role
    else bm.role end
  from public.boards b join public.workspace_members wm on wm.workspace_id=b.workspace_id and wm.user_id=p_user
  left join public.board_members bm on bm.board_id=b.id and bm.user_id=p_user where b.id=p_board;
$$;
drop policy board_members_add on public.board_members;
drop policy board_members_edit on public.board_members;
drop policy board_members_delete on public.board_members;
create policy board_members_add on public.board_members for insert to authenticated with check (kanban_private.can_manage_board_member(board_id,role));
create policy board_members_edit on public.board_members for update to authenticated using (kanban_private.can_manage_board_member(board_id,role)) with check (kanban_private.can_manage_board_member(board_id,role));
create policy board_members_delete on public.board_members for delete to authenticated using (kanban_private.can_manage_board_member(board_id,role));

create function public.transfer_board_ownership(p_board_id uuid,p_new_owner_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare wid uuid; previous_owner uuid; workspace_owner uuid;
begin
  select workspace_id into wid from public.boards where id=p_board_id for update;
  if wid is null then raise exception 'Board indisponível' using errcode='42501'; end if;
  select user_id into previous_owner from public.board_members where board_id=p_board_id and role='owner' for update;
  select owner_id into workspace_owner from public.workspaces where id=wid;
  if auth.uid() is null or (auth.uid() is distinct from previous_owner and auth.uid() is distinct from workspace_owner) then
    raise exception 'Somente o owner pode transferir o board' using errcode='42501';
  end if;
  if not exists(select 1 from public.workspace_members where workspace_id=wid and user_id=p_new_owner_id and role<>'viewer') then
    raise exception 'Novo owner deve ser membro elegível do workspace' using errcode='23514';
  end if;
  if previous_owner=p_new_owner_id then return; end if;
  update public.board_members set role='admin' where board_id=p_board_id and role='owner';
  insert into public.board_members(board_id,user_id,role) values(p_board_id,p_new_owner_id,'owner')
    on conflict (board_id,user_id) do update set role='owner';
end $$;
revoke all on function public.transfer_board_ownership(uuid,uuid) from public,anon;
grant execute on function public.transfer_board_ownership(uuid,uuid) to authenticated;

-- Email somente por RPC validado; auth.users nunca é concedido diretamente ao cliente.
create function public.workspace_member_directory(p_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if kanban_private.workspace_role(p_workspace_id) is null then raise exception 'Sem acesso ao workspace' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'role',m.role,'joined_at',m.joined_at,
    'display_name',p.display_name,'username',p.username,'avatar_url',p.avatar_url,'email',u.email) order by m.joined_at,m.id)
    from public.workspace_members m join public.profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id
    where m.workspace_id=p_workspace_id),'[]'::jsonb);
end $$;
create function public.board_member_directory(p_board_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not kanban_private.can_read_board(p_board_id) then raise exception 'Sem acesso ao board' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',bm.id,'user_id',wm.user_id,
    'role',case when wm.role='owner' then 'owner' when bm.role='owner' then 'owner' when wm.role='admin' then 'admin' when wm.role='viewer' then 'viewer' else bm.role end,
    'workspace_role',wm.role,'explicit_role',bm.role,'joined_at',bm.created_at,
    'display_name',p.display_name,'username',p.username,'avatar_url',p.avatar_url,'email',u.email) order by p.display_name,wm.user_id)
    from public.boards b join public.workspace_members wm on wm.workspace_id=b.workspace_id
    left join public.board_members bm on bm.board_id=b.id and bm.user_id=wm.user_id
    join public.profiles p on p.id=wm.user_id join auth.users u on u.id=wm.user_id
    where b.id=p_board_id and (wm.role in ('owner','admin') or bm.id is not null)),'[]'::jsonb);
end $$;
revoke all on function public.workspace_member_directory(uuid),public.board_member_directory(uuid) from public,anon;
grant execute on function public.workspace_member_directory(uuid),public.board_member_directory(uuid) to authenticated;

create function public.create_workspace_invitation(p_workspace_id uuid,p_email text,p_role public.member_role) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare normalized text; secret text; invitation public.workspace_invitations;
begin
  if p_role='owner' or not kanban_private.can_manage_workspace_member(p_workspace_id,p_role) then
    raise exception 'Sem permissão para convidar com este papel' using errcode='42501';
  end if;
  normalized:=lower(btrim(p_email));
  if normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail inválido' using errcode='23514'; end if;
  if exists(select 1 from auth.users u join public.workspace_members wm on wm.user_id=u.id where wm.workspace_id=p_workspace_id and lower(u.email)=normalized) then
    raise exception 'Este usuário já pertence ao workspace' using errcode='23514';
  end if;
  update public.workspace_invitations set revoked_at=now() where workspace_id=p_workspace_id and email=normalized and accepted_at is null and revoked_at is null;
  secret:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into public.workspace_invitations(workspace_id,email,role,token,invited_by,expires_at)
    values(p_workspace_id,normalized,p_role,md5(secret),auth.uid(),now()+interval '7 days') returning * into invitation;
  return jsonb_build_object('id',invitation.id,'email',normalized,'role',p_role,'expires_at',invitation.expires_at,'secret',secret);
end $$;
create function public.revoke_workspace_invitation(p_invitation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare item public.workspace_invitations;
begin
  select * into item from public.workspace_invitations where id=p_invitation_id for update;
  if item.id is null or not kanban_private.can_manage_workspace_member(item.workspace_id,item.role) then raise exception 'Sem permissão' using errcode='42501'; end if;
  update public.workspace_invitations set revoked_at=now() where id=p_invitation_id and accepted_at is null;
end $$;
create function public.lookup_workspace_invitation(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare item public.workspace_invitations; name text;
begin
  if p_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status','invalid'); end if;
  select * into item from public.workspace_invitations where token=md5(p_token);
  if item.id is null then return jsonb_build_object('status','invalid'); end if;
  select w.name into name from public.workspaces w where w.id=item.workspace_id;
  return jsonb_build_object('status',case when item.accepted_at is not null then 'accepted' when item.revoked_at is not null then 'revoked'
    when item.expires_at<=now() then 'expired' else 'pending' end,'workspace_name',name,'email',item.email,'role',item.role,'expires_at',item.expires_at);
end $$;
create function public.accept_workspace_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare item public.workspace_invitations; account_email text; confirmed timestamptz;
begin
  if auth.uid() is null or not kanban_private.account_active() then raise exception 'Entre com uma conta ativa' using errcode='42501'; end if;
  if p_token !~ '^[0-9a-f]{64}$' then raise exception 'Convite inválido' using errcode='23514'; end if;
  select * into item from public.workspace_invitations where token=md5(p_token) for update;
  if item.id is null or item.accepted_at is not null or item.revoked_at is not null or item.expires_at<=now() then
    raise exception 'Convite inválido ou expirado' using errcode='23514';
  end if;
  select lower(email),email_confirmed_at into account_email,confirmed from auth.users where id=auth.uid();
  if account_email is distinct from item.email or confirmed is null then
    raise exception 'Confirme o e-mail convidado antes de aceitar' using errcode='42501';
  end if;
  insert into public.workspace_members(workspace_id,user_id,role) values(item.workspace_id,auth.uid(),item.role)
    on conflict (workspace_id,user_id) do nothing;
  update public.workspace_invitations set accepted_at=now() where id=item.id;
  return item.workspace_id;
end $$;
revoke all on function public.create_workspace_invitation(uuid,text,public.member_role),public.revoke_workspace_invitation(uuid),
  public.lookup_workspace_invitation(text),public.accept_workspace_invitation(text) from public,anon;
grant execute on function public.create_workspace_invitation(uuid,text,public.member_role),public.revoke_workspace_invitation(uuid),
  public.accept_workspace_invitation(text) to authenticated;
grant execute on function public.lookup_workspace_invitation(text) to anon,authenticated;
