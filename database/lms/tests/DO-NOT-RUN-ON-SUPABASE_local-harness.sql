create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists extensions;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(), email text unique,
  encrypted_password text, email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
-- Supabase default privileges: new tables in public grant everything to these roles.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
-- certification tables, columns copied from the snapshot
create table if not exists participants (
  id uuid primary key default gen_random_uuid(), full_name text not null, email text,
  email_norm text, phone text, created_at timestamptz not null default now());
create table if not exists programmes (
  id uuid primary key default gen_random_uuid(), slug text not null, title text not null,
  code text not null, duration_text text, tools text[], course_url text,
  template_key text not null default 'default', active boolean not null default true,
  created_at timestamptz not null default now());
create table if not exists participant_enrolments (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id),
  programme_id uuid not null references programmes(id),
  cohort text not null default 'default', status text not null default 'active',
  starts_on date, ends_on date, created_at timestamptz not null default now());
create table if not exists certificates (
  id uuid primary key default gen_random_uuid(), certificate_number text not null,
  participant_id uuid not null references participants(id),
  programme_id uuid not null references programmes(id), completed_on date not null,
  issued_at timestamptz not null default now(), issued_by text,
  revoked boolean not null default false, revoked_reason text,
  created_at timestamptz not null default now(), module_id uuid);
