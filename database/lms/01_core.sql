-- =====================================================================
-- 001  CORE: who people are
--
-- Everything the Academy knows about a person hangs off one row in
-- lms_profiles, which in turn hangs off Supabase's own auth.users.
--
-- auth.users holds the email and the password. We never store or see
-- the password ourselves; Supabase hashes it and checks it at sign in.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- roles
do $$
begin
  if not exists (select 1 from pg_type where typname = 'lms_role') then
    create type lms_role as enum ('learner', 'uploader', 'admin');
  end if;
end $$;

-- ---------------------------------------------------------------- profiles
create table if not exists lms_profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text not null default '',
  phone          text,
  role           lms_role not null default 'learner',
  -- the bridge to the existing certification system. Set only when a
  -- VERIFIED email matches a participant, never on a typed address.
  participant_id uuid references participants(id) on delete set null,
  linked_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists lms_profiles_participant_uniq
  on lms_profiles(participant_id) where participant_id is not null;
create index if not exists lms_profiles_role_idx on lms_profiles(role);

-- ---------------------------------------------------------------- audit
create table if not exists lms_admin_actions (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users(id) on delete set null,
  action       text not null,
  subject_type text,
  subject_id   uuid,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists lms_admin_actions_time_idx
  on lms_admin_actions(created_at desc);

-- ---------------------------------------------------------------- helpers
-- Used by nearly every policy. SECURITY DEFINER so that reading a
-- person's own role does not itself need a policy, which would loop.
create or replace function lms_my_role()
returns lms_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from lms_profiles where id = auth.uid()), 'learner')
$$;

create or replace function lms_is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select lms_my_role() = 'admin'
$$;

-- an uploader may edit lesson videos, nothing else
create or replace function lms_is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select lms_my_role() in ('admin', 'uploader')
$$;

create or replace function lms_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists lms_profiles_touch on lms_profiles;
create trigger lms_profiles_touch before update on lms_profiles
  for each row execute function lms_touch();
