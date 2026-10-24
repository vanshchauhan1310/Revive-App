-- Minimal stand-ins for the Supabase-managed schemas so migrations can run on plain
-- Postgres (PGlite) in tests. Mirrors how Supabase resolves auth.uid() from JWT claims.
create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists storage;
set search_path = public, extensions;  -- Supabase default

do $$ begin
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
exception when duplicate_object then null; end $$;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         current_setting('request.jwt.claims', true)::jsonb->>'sub'), '')::uuid
$$;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
