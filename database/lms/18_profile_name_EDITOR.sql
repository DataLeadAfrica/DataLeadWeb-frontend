-- GENERATED. Do not edit.
--
-- Made by scripts/lms/make-editor-sql.mjs from the file named below.
-- The comments between the function bodies are removed. Every body is
-- byte for byte what that file holds, and a test checks it.
--
-- Paste THIS one into the Supabase SQL Editor.
--
-- source: database/lms/18_profile_name.sql
begin;

do $$
declare v_missing text[] := '{}';
begin
  if to_regclass('public.lms_profiles') is null then
    v_missing := v_missing || 'lms_profiles (file 01)'::text;
  end if;
  if not exists (select 1 from pg_policies
                  where tablename = 'lms_profiles' and policyname = 'p_profiles_self_write') then
    v_missing := v_missing || 'the profiles self-write policy (file 06)'::text;
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'lms_my_role') then
    v_missing := v_missing || 'lms_my_role (file 10)'::text;
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'lms_studio_overview') then
    v_missing := v_missing || 'lms_studio_overview (file 17)'::text;
  end if;
  if array_length(v_missing, 1) is not null then
    raise exception 'File 18 cannot run yet. Missing: %', array_to_string(v_missing, ', ');
  end if;
  raise notice 'Step 0: files 01 to 17 are in place.';
end $$;

create or replace function lms_set_my_name(p_name text)
returns text
language plpgsql security definer set search_path to 'public' as $function$
declare v_name text;
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in to change your name.'
      using errcode = '42501';
  end if;

  -- Collapse the runs of spaces as well as trimming, so "Ada   Lovelace"
  -- is stored the way it will be read back.
  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));

  if v_name = '' then
    raise exception 'Please type your name.' using errcode = '22023';
  end if;
  if length(v_name) > 80 then
    raise exception 'That name is too long. Please use 80 characters or fewer.'
      using errcode = '22001';
  end if;
  -- No angle brackets, so a name can never be mistaken for markup by
  -- anything that later shows it.
  if v_name ~ '[<>]' then
    raise exception 'A name cannot contain the characters < or >.'
      using errcode = '22023';
  end if;

  update lms_profiles set full_name = v_name, updated_at = now()
   where id = auth.uid();

  if not found then
    raise exception 'There is no profile for this account yet. Please sign out and in again.'
      using errcode = 'P0002';
  end if;

  return v_name;
end $function$;

revoke all on function lms_set_my_name(text) from public, anon;
grant execute on function lms_set_my_name(text) to authenticated;

do $$
declare v_had boolean;
begin
  select has_table_privilege('authenticated', 'lms_profiles', 'UPDATE') into v_had;

  -- Table-wide UPDATE goes. anon never had any business with it either.
  revoke update on lms_profiles from authenticated;
  revoke update on lms_profiles from anon;

  -- And back only these two. full_name is the point of this file. phone
  -- is the person's own and was already theirs to set.
  --
  -- participant_id is NOT here, which is the whole point: that column is
  -- how a profile is joined to a certification record, and only
  -- lms_link_participant may set it, on a proven email address.
  --
  -- role is not here either. It was protected by the policy's
  -- "role = lms_my_role()" check alone. Now it is protected by privilege
  -- as well, so neither has to hold on its own.
  --
  -- linked_at, created_at and updated_at are bookkeeping. A person
  -- editing their own timestamps is not a hole on its own, but there is
  -- no reason for it either.
  grant update (full_name, phone) on lms_profiles to authenticated;

  raise notice 'Step 2: table-wide UPDATE on lms_profiles revoked (it was %), '
               'and UPDATE granted on full_name and phone only.',
               case when v_had then 'held' else 'not held' end;
end $$;

do $$
declare v_cols text;
begin
  select string_agg(column_name, ', ' order by column_name) into v_cols
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'lms_profiles'
     and grantee = 'authenticated' and privilege_type = 'UPDATE';
  raise notice 'Step 3: a signed in person may now write these columns of their own profile: %',
               coalesce(v_cols, 'none');
  raise notice 'Step 3: lms_set_my_name is granted to signed in callers only.';
end $$;

commit;
