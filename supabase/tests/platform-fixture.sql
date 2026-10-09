-- Somente para PostgreSQL isolado de testes. NÃO executar no projeto Supabase.
-- Reproduz os namespaces de plataforma necessários para verificar a migração/RLS.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create table auth.users(id uuid primary key, email text unique, raw_user_meta_data jsonb not null default '{}', email_confirmed_at timestamptz, created_at timestamptz not null default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
grant execute on function auth.role() to authenticated,anon,service_role;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,metadata jsonb default '{}',unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
create schema realtime;
create table realtime.messages(id bigint generated always as identity primary key,topic text,extension text,payload jsonb,event text,private boolean);
alter table realtime.messages enable row level security;
grant usage on schema realtime to authenticated;
grant select,insert on realtime.messages to authenticated;
create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic',true) $$;
create function realtime.send(payload jsonb,event text,topic text,private boolean default true) returns void language sql security definer set search_path='' as $$ insert into realtime.messages(topic,extension,payload,event,private) values(topic,'broadcast',payload,event,private) $$;
grant execute on function realtime.topic() to authenticated;
revoke execute on function realtime.send(jsonb,text,text,boolean) from public,anon,authenticated;
