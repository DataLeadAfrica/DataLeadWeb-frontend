-- =====================================================================
-- 10  ROLES AND HOW ACCESS IS GRANTED          (version 2, 6 October 2026)
--
-- One sentence covers both routes: your rights follow from whether your
-- CONFIRMED email is on a list.
--
--   on the facilitator list          -> you can build courses
--   enrolled on a bootcamp           -> every course is free to you
--
-- Both are checked on every sign in, and both work in reverse. Taken
-- off the list, or marked withdrawn, and the access goes. The list is
-- always the truth, so nobody has to remember a second step when
-- somebody leaves.
--
-- Nothing in this file can promote anyone to administrator. That is
-- deliberate. See BREAK GLASS at the bottom.
--
-- Safe to run twice. If anything is missing it stops at step 0 and
-- tells you what, before changing a single thing.
--
-- WHAT CHANGED IN VERSION 2, after an outside review:
--   Step 5   a returning bootcamp student is no longer locked out. The
--            expiry date on their grant is now renewed, extended or
--            cleared instead of being left at its old value.
--   Step 5b  a nightly sweep, so access changes without waiting for
--            somebody to sign in again.
--   Step 7b  guard triggers. A facilitator can build, but cannot
--            publish, change a price, delete, or touch anything that is
--            already live.
--   Step 8   importing questions no longer deletes the old ones. They
--            are retired, so a learner halfway through an attempt is
--            still marked against questions that exist.
--   Step 9b  table permissions tightened: nobody holds TRUNCATE,
--            REFERENCES or TRIGGER, and a visitor who is not signed in
--            cannot write at all.
-- =====================================================================


-- =====================================================================
-- STEP 0  Check this database is the one this file was written for.
--         Nothing is changed until every check below has passed.
-- =====================================================================
do $$
declare
  v_missing text[] := '{}';
  v_t text; v_c text; v_f text;
begin
  -- tables we rely on
  foreach v_t in array array[
    'lms_profiles','lms_courses','lms_modules','lms_lessons','lms_quizzes',
    'lms_questions','lms_options','lms_entitlements','lms_admin_actions',
    'lms_paths','participants','participant_enrolments']
  loop
    if not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = v_t) then
      v_missing := v_missing || ('table ' || v_t);
    end if;
  end loop;

  -- columns we read or write by name
  foreach v_c in array array[
    'lms_profiles.role','lms_profiles.participant_id',
    'lms_entitlements.user_id','lms_entitlements.course_id','lms_entitlements.source',
    'lms_entitlements.status','lms_entitlements.expires_at',
    'lms_courses.status','lms_courses.published_at','lms_courses.price_kobo',
    'lms_paths.status','lms_quizzes.status','lms_quizzes.lesson_id','lms_quizzes.module_id',
    'lms_questions.active','lms_questions.position','lms_questions.quiz_id',
    'lms_modules.course_id','lms_lessons.module_id','lms_options.question_id',
    'participant_enrolments.participant_id','participant_enrolments.status',
    'participant_enrolments.ends_on',
    'lms_admin_actions.actor_id','lms_admin_actions.action',
    'lms_admin_actions.subject_type','lms_admin_actions.subject_id',
    'lms_admin_actions.detail']
  loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = split_part(v_c, '.', 1)
                      and column_name = split_part(v_c, '.', 2)) then
      v_missing := v_missing || ('column ' || v_c);
    end if;
  end loop;

  -- functions from 05 that this file calls
  foreach v_f in array array['lms_my_role','lms_is_admin','lms_link_participant',
                             'lms_grant_free_courses']
  loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = v_f) then
      v_missing := v_missing || ('function ' || v_f || '()');
    end if;
  end loop;

  foreach v_t in array array['lms_role','lms_status'] loop
    if not exists (select 1 from pg_type where typname = v_t) then
      v_missing := v_missing || ('type ' || v_t);
    end if;
  end loop;

  if array_length(v_missing, 1) is not null then
    raise exception E'This database is not ready for file 10. Missing:\n  %\n\nRun files 01 to 07 first. Nothing has been changed.',
      array_to_string(v_missing, E'\n  ');
  end if;

  raise notice 'Step 0: everything file 10 needs is present.';
end $$;


-- =====================================================================
-- STEP 0b  Two small columns, added only if they are not already there.
--
-- When bootcamp access closes we mark the row revoked rather than
-- deleting it, so there is always a record of what somebody held and
-- why it ended. That needs somewhere to write the when and the why.
-- =====================================================================
alter table lms_entitlements add column if not exists revoked_at timestamptz;
alter table lms_entitlements add column if not exists revoke_reason text;


-- =====================================================================
-- STEP 1  Rename the role.
--
-- "uploader" was too narrow: these people build courses, they do not
-- just upload videos.
--
-- Renaming a label is not free. PostgreSQL keeps policies, views and
-- check constraints as parsed structures, so they follow the rename on
-- their own. Function bodies it keeps as plain text, so any function
-- written with 'uploader' in it stops working the moment the label is
-- gone. On this database that function is lms_is_staff, which the
-- policies that decide who may see courses, modules and lessons all
-- call, so leaving it broken would make the catalogue unreadable.
-- Step 2 finds and repairs every such function, whichever they are.
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
              where t.typname = 'lms_role' and e.enumlabel = 'uploader') then
    alter type lms_role rename value 'uploader' to 'facilitator';
    raise notice 'Step 1: role renamed from uploader to facilitator.';
  else
    raise notice 'Step 1: already renamed, nothing to do.';
  end if;
end $$;


-- =====================================================================
-- STEP 2  Repair every function left holding the old label.
-- =====================================================================
do $$
declare r record; v_def text; v_stale text;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and p.prosrc like '%''uploader''%'
     order by p.proname
  loop
    v_def := replace(pg_get_functiondef(r.oid), '''uploader''', '''facilitator''');
    execute v_def;
    raise notice 'Step 2: repaired %()', r.proname;
  end loop;

  -- do not leave a half repaired database behind
  select string_agg(p.proname, ', ' order by p.proname) into v_stale
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.prosrc like '%''uploader''%';

  if v_stale is not null then
    raise exception 'Step 2 could not repair: %. Stop and ask before going further.', v_stale;
  end if;
  raise notice 'Step 2: no function still refers to the old label.';
end $$;


-- =====================================================================
-- STEP 3  The list of facilitators.
--
-- An email address, not an account. Somebody can be appointed before
-- they have ever signed up, and the appointment waits for them.
-- =====================================================================
create table if not exists lms_facilitators (
  email_norm text primary key,
  full_name  text not null default '',
  note       text not null default '',
  added_by   uuid references auth.users(id) on delete set null,
  added_at   timestamptz not null default now()
);

alter table lms_facilitators enable row level security;

-- Only the administrator. A learner must not be able to read this
-- either: the list is a roll of staff email addresses.
drop policy if exists p_fac_admin on lms_facilitators;
create policy p_fac_admin on lms_facilitators
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());


-- =====================================================================
-- STEP 4  Who counts as staff.
-- =====================================================================
create or replace function lms_is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select lms_my_role() in ('admin', 'facilitator')
$$;

-- May build and edit course material. Same answer as lms_is_staff
-- today, but kept separate so the two can part company later without
-- a hunt through every policy.
create or replace function lms_can_edit()
returns boolean
language sql stable security definer set search_path = public as $$
  select lms_my_role() in ('admin', 'facilitator')
$$;


-- =====================================================================
-- STEP 5  The sign in check.
--
-- Call this once after a successful sign in, and again whenever an
-- Academy page opens. It writes nothing when nothing has changed, so
-- calling it often is cheap.
--
-- The bootcamp part has three directions, not two. Version 1 handled
-- granting and revoking but not RENEWING, and that locked out returning
-- students: somebody who finished cohort one held a grant whose expiry
-- had passed, and because a grant already existed the code did nothing,
-- while the one-live-grant index stopped a replacement being inserted.
-- They were told "nothing has changed" and had no access. The same
-- happened when a cohort's end date was extended.
-- =====================================================================
create or replace function lms_sync_my_access()
returns table (role text, bootcamp boolean, changed boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text; v_confirmed timestamptz;
  v_role lms_role; v_new lms_role;
  v_part uuid; v_enrolled boolean := false; v_ends date; v_open boolean := false;
  v_exp timestamptz; v_had boolean; v_was timestamptz;
  v_changed boolean := false; v_msg text := '';
begin
  if v_uid is null then return; end if;

  select u.email, u.email_confirmed_at into v_email, v_confirmed
    from auth.users u where u.id = v_uid;

  select p.role into v_role from lms_profiles p where p.id = v_uid;
  v_role := coalesce(v_role, 'learner'::lms_role);

  -- An unproven address grants nothing. This is the whole reason email
  -- confirmation is switched on.
  if v_confirmed is null then
    return query select v_role::text, false, false,
      'Confirm your email address to unlock your access.';
    return;
  end if;

  v_email := lower(btrim(coalesce(v_email, '')));

  -- ---------- facilitator, both directions ----------
  -- An administrator is never demoted by this.
  if v_role <> 'admin' then
    if exists (select 1 from lms_facilitators f where f.email_norm = v_email) then
      v_new := 'facilitator';
    else
      v_new := 'learner';
    end if;
    if v_new <> v_role then
      update lms_profiles set role = v_new where id = v_uid;
      v_changed := true;
      v_msg := case when v_new = 'facilitator'
                    then 'You now have facilitator access.'
                    else 'Your facilitator access has been removed.' end;
      v_role := v_new;
    end if;
  end if;

  -- ---------- bootcamp: grant, renew or revoke ----------
  perform lms_link_participant(v_uid, v_email);
  select p.participant_id into v_part from lms_profiles p where p.id = v_uid;

  if v_part is not null then
    -- count(*) > 0, never a bare true: an aggregate query returns a row
    -- even when nothing matched, so a literal here would hand the whole
    -- catalogue to anybody who merely appears on the participant table.
    select count(*) > 0,
           bool_or(e.ends_on is null),
           max(e.ends_on)
      into v_enrolled, v_open, v_ends
      from participant_enrolments e
     where e.participant_id = v_part and e.status = 'active';
  end if;
  v_enrolled := coalesce(v_enrolled, false);

  -- an enrolment with no end date means access does not expire, even if
  -- another enrolment alongside it does
  if coalesce(v_open, false) then v_ends := null; end if;
  v_exp := case when v_ends is null then null else (v_ends + 1)::timestamptz end;

  select true, e.expires_at into v_had, v_was
    from lms_entitlements e
   where e.user_id = v_uid and e.course_id is null
     and e.source = 'roster' and e.status = 'active'
   limit 1;
  v_had := coalesce(v_had, false);

  if v_enrolled and not v_had then
    insert into lms_entitlements (user_id, course_id, source, expires_at)
    values (v_uid, null, 'roster', v_exp)
    on conflict do nothing;
    v_changed := true;
    v_msg := btrim(v_msg || ' Your bootcamp access is open, so every course is free to you.');

  elsif v_enrolled and v_had then
    -- RENEW. This is the branch version 1 was missing. It covers a new
    -- cohort, an extended cohort, and an enrolment that has become open
    -- ended, and it writes nothing when the date already agrees.
    if v_was is distinct from v_exp then
      update lms_entitlements
         set expires_at = v_exp
       where user_id = v_uid and course_id is null
         and source = 'roster' and status = 'active';
      v_changed := true;
      v_msg := btrim(v_msg || ' Your bootcamp access has been renewed.');
    end if;

  elsif not v_enrolled and v_had then
    update lms_entitlements
       set status = 'revoked', revoked_at = now(),
           revoke_reason = 'no active bootcamp enrolment'
     where user_id = v_uid and course_id is null
       and source = 'roster' and status = 'active';
    v_changed := true;
    v_msg := btrim(v_msg || ' Your bootcamp access has ended.');
  end if;

  -- catch any free course published since this person last signed in
  perform lms_grant_free_courses(v_uid);

  return query select v_role::text, v_enrolled, v_changed,
    coalesce(nullif(v_msg, ''), 'Nothing has changed since you were last here.');
end $$;


-- =====================================================================
-- STEP 5b  The nightly sweep.
--
-- Supabase keeps people signed in for a long time, so waiting for the
-- next sign in is not good enough: a withdrawn student would keep free
-- access for weeks. This does the same three-way decision for everybody
-- at once, and needs nobody to be signed in.
--
-- Safe to run by hand at any time:   select * from lms_nightly_access_sweep();
-- =====================================================================
create or replace function lms_nightly_access_sweep()
returns table (granted integer, renewed integer, revoked integer, looked_at integer)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_g integer := 0; v_r integer := 0; v_x integer := 0; v_n integer := 0;
  v_ends date; v_open boolean; v_enrolled boolean; v_exp timestamptz;
  v_had boolean; v_was timestamptz;
begin
  for r in
    select p.id as uid, p.participant_id
      from lms_profiles p
     where p.participant_id is not null
        or exists (select 1 from lms_entitlements e
                    where e.user_id = p.id and e.course_id is null
                      and e.source = 'roster' and e.status = 'active')
  loop
    v_n := v_n + 1;
    v_enrolled := false; v_open := false; v_ends := null;

    if r.participant_id is not null then
      select count(*) > 0, bool_or(e.ends_on is null), max(e.ends_on)
        into v_enrolled, v_open, v_ends
        from participant_enrolments e
       where e.participant_id = r.participant_id and e.status = 'active';
    end if;
    v_enrolled := coalesce(v_enrolled, false);
    if coalesce(v_open, false) then v_ends := null; end if;
    v_exp := case when v_ends is null then null else (v_ends + 1)::timestamptz end;

    v_had := false; v_was := null;
    select true, e.expires_at into v_had, v_was
      from lms_entitlements e
     where e.user_id = r.uid and e.course_id is null
       and e.source = 'roster' and e.status = 'active'
     limit 1;
    v_had := coalesce(v_had, false);

    if v_enrolled and not v_had then
      insert into lms_entitlements (user_id, course_id, source, expires_at)
      values (r.uid, null, 'roster', v_exp) on conflict do nothing;
      v_g := v_g + 1;
    elsif v_enrolled and v_had and v_was is distinct from v_exp then
      update lms_entitlements set expires_at = v_exp
       where user_id = r.uid and course_id is null
         and source = 'roster' and status = 'active';
      v_r := v_r + 1;
    elsif not v_enrolled and v_had then
      update lms_entitlements
         set status = 'revoked', revoked_at = now(),
             revoke_reason = 'no active bootcamp enrolment (nightly sweep)'
       where user_id = r.uid and course_id is null
         and source = 'roster' and status = 'active';
      v_x := v_x + 1;
    end if;
  end loop;

  insert into lms_admin_actions (actor_id, action, subject_type, detail)
  values (null, 'nightly_access_sweep', 'system',
          jsonb_build_object('granted', v_g, 'renewed', v_r, 'revoked', v_x, 'looked_at', v_n));

  return query select v_g, v_r, v_x, v_n;
end $$;

revoke all on function lms_nightly_access_sweep() from public, anon, authenticated;

-- Reports whether the nightly job is scheduled. This lives in a function
-- because a plain query cannot mention cron.job on a database where
-- pg_cron is not installed: the query would fail to parse.
create or replace function lms_nightly_job_status()
returns text language plpgsql stable security definer set search_path = public as $$
declare v_n integer;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return 'pg_cron is not installed, so there is no nightly job';
  end if;
  execute 'select count(*) from cron.job where jobname = ''lms-nightly-access''' into v_n;
  if v_n > 0 then return 'scheduled'; end if;
  return 'pg_cron is installed but the job is missing';
end $$;

-- Schedule it, but only if pg_cron is installed. If it is not, this
-- prints a notice and changes nothing: the function above still works
-- when run by hand.
do $$
declare v_has boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_has;
  if not v_has then
    raise notice 'Step 5b: pg_cron is NOT installed on this database, so no nightly job was created. The sweep function exists and can be run by hand. To schedule it, turn on pg_cron under Database, Extensions, then run this file again.';
  else
    begin
      execute $c$ select cron.unschedule('lms-nightly-access') $c$;
    exception when others then null;   -- there was no job to remove
    end;
    execute $c$ select cron.schedule('lms-nightly-access', '17 2 * * *',
                                     'select lms_nightly_access_sweep()') $c$;
    raise notice 'Step 5b: nightly sweep scheduled for 02:17 every day.';
  end if;
end $$;


-- =====================================================================
-- STEP 6  Appointing and removing a facilitator. Administrator only.
-- =====================================================================
create or replace function lms_add_facilitator(p_email text, p_name text default '', p_note text default '')
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare v_norm text := lower(btrim(coalesce(p_email,''))); v_uid uuid;
begin
  if not lms_is_admin() then
    return query select false, 'Only the administrator can add a facilitator.'; return;
  end if;
  if v_norm !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return query select false, 'That does not look like an email address.'; return;
  end if;

  insert into lms_facilitators (email_norm, full_name, note, added_by)
  values (v_norm, coalesce(p_name,''), coalesce(p_note,''), auth.uid())
  on conflict (email_norm) do update
    set full_name = excluded.full_name, note = excluded.note;

  -- if they already have a confirmed account, apply it now rather than
  -- leaving them to sign out and back in
  select id into v_uid from auth.users
   where lower(btrim(email)) = v_norm and email_confirmed_at is not null;
  if v_uid is not null then
    update lms_profiles set role = 'facilitator' where id = v_uid and role <> 'admin';
  end if;

  insert into lms_admin_actions (actor_id, action, subject_type, detail)
  values (auth.uid(), 'add_facilitator', 'email', jsonb_build_object('email', v_norm));

  return query select true,
    case when v_uid is null
      then 'Added. They will have facilitator access the first time they sign in.'
      else 'Added. Their access is active now.' end;
end $$;

create or replace function lms_remove_facilitator(p_email text)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare v_norm text := lower(btrim(coalesce(p_email,''))); v_uid uuid;
begin
  if not lms_is_admin() then
    return query select false, 'Only the administrator can remove a facilitator.'; return;
  end if;

  delete from lms_facilitators where email_norm = v_norm;
  if not found then
    return query select false, 'That email is not on the list.'; return;
  end if;

  select id into v_uid from auth.users where lower(btrim(email)) = v_norm;
  if v_uid is not null then
    update lms_profiles set role = 'learner' where id = v_uid and role = 'facilitator';
  end if;

  insert into lms_admin_actions (actor_id, action, subject_type, detail)
  values (auth.uid(), 'remove_facilitator', 'email', jsonb_build_object('email', v_norm));

  return query select true, 'Removed. They can no longer build courses.';
end $$;


-- =====================================================================
-- STEP 7  What a facilitator may touch.
--
-- They build course material. Publishing stays with the administrator.
-- =====================================================================
drop policy if exists p_courses_admin_all on lms_courses;
drop policy if exists p_courses_edit on lms_courses;
create policy p_courses_edit on lms_courses
  for all to authenticated using (lms_can_edit()) with check (lms_can_edit());

drop policy if exists p_modules_admin on lms_modules;
drop policy if exists p_modules_edit on lms_modules;
create policy p_modules_edit on lms_modules
  for all to authenticated using (lms_can_edit()) with check (lms_can_edit());

drop policy if exists p_lessons_admin on lms_lessons;
drop policy if exists p_lessons_uploader on lms_lessons;
drop policy if exists p_lessons_edit on lms_lessons;
create policy p_lessons_edit on lms_lessons
  for all to authenticated using (lms_can_edit()) with check (lms_can_edit());

drop policy if exists p_quiz_admin on lms_quizzes;
drop policy if exists p_quiz_edit on lms_quizzes;
create policy p_quiz_edit on lms_quizzes
  for all to authenticated using (lms_can_edit()) with check (lms_can_edit());

drop policy if exists p_q_admin on lms_questions;
drop policy if exists p_q_edit on lms_questions;
create policy p_q_edit on lms_questions
  for all to authenticated using (lms_can_edit()) with check (lms_can_edit());

-- Facilitators write the questions, so they have to see which answer is
-- right. This stays shut to everyone else: a learner reading this table
-- would be reading the answer key.
drop policy if exists p_opt_admin_only on lms_options;
drop policy if exists p_opt_staff_only on lms_options;
create policy p_opt_staff_only on lms_options
  for all to authenticated using (lms_can_edit()) with check (lms_can_edit());

-- lms_paths is deliberately NOT opened to facilitators here. Learning
-- paths group whole courses, which is an editorial decision rather than
-- course building. The guard in step 7b covers the table anyway, so if
-- you later decide facilitators should build draft paths, adding the
-- policy is all it takes and publishing still stays with you.


-- =====================================================================
-- STEP 7b  The guards.
--
-- A policy decides which ROWS you may touch. It cannot say "you may
-- change this column but not that one", and it cannot say "only while
-- this row is still a draft". Those are the two rules that matter most
-- here, so they are triggers instead.
--
-- Rules for anybody signed in who is not the administrator:
--   no deleting
--   no creating something already published
--   no changing status, published_at or price_kobo
--   no editing anything that is already published
--   no touching a module, lesson, question or option whose course is
--   already published
--
-- A session with nobody signed in is trusted: that is the Supabase SQL
-- editor, which is yours, and the nightly sweep.
-- =====================================================================

-- small helpers so each guard reads in one line
create or replace function lms_course_status_of_module(p_module uuid)
returns lms_status language sql stable security definer set search_path = public as $$
  select c.status from lms_modules m join lms_courses c on c.id = m.course_id where m.id = p_module
$$;

create or replace function lms_course_status_of_lesson(p_lesson uuid)
returns lms_status language sql stable security definer set search_path = public as $$
  select c.status
    from lms_lessons l join lms_modules m on m.id = l.module_id
    join lms_courses c on c.id = m.course_id
   where l.id = p_lesson
$$;

create or replace function lms_course_status_of_quiz(p_quiz uuid)
returns lms_status language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.status from lms_quizzes q
       join lms_lessons l on l.id = q.lesson_id
       join lms_modules m on m.id = l.module_id
       join lms_courses c on c.id = m.course_id
      where q.id = p_quiz),
    (select c.status from lms_quizzes q
       join lms_modules m on m.id = q.module_id
       join lms_courses c on c.id = m.course_id
      where q.id = p_quiz))
$$;

-- ---------------- courses ----------------
create or replace function lms_guard_course() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or lms_is_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Only the administrator can delete a course.';
  elsif tg_op = 'INSERT' then
    if new.status = 'published' then raise exception 'New courses start as drafts.'; end if;
  else
    if old.status = 'published' then
      raise exception 'This course is live. Ask the administrator to unpublish it before editing.';
    end if;
    if new.status is distinct from old.status or new.published_at is distinct from old.published_at
       or new.price_kobo is distinct from old.price_kobo then
      raise exception 'Only the administrator can publish a course or change its price.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists t_guard_course on lms_courses;
create trigger t_guard_course before insert or update or delete on lms_courses
  for each row execute function lms_guard_course();

-- ---------------- paths ----------------
create or replace function lms_guard_path() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or lms_is_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Only the administrator can delete a learning path.';
  elsif tg_op = 'INSERT' then
    if new.status = 'published' then raise exception 'New learning paths start as drafts.'; end if;
  else
    if old.status = 'published' then
      raise exception 'This learning path is live. Ask the administrator to unpublish it first.';
    end if;
    if new.status is distinct from old.status then
      raise exception 'Only the administrator can publish a learning path.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists t_guard_path on lms_paths;
create trigger t_guard_path before insert or update or delete on lms_paths
  for each row execute function lms_guard_path();

-- ---------------- quizzes ----------------
create or replace function lms_guard_quiz() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or lms_is_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Only the administrator can delete a set of questions.';
  elsif tg_op = 'INSERT' then
    if new.status = 'published' then raise exception 'A new set of questions starts as a draft.'; end if;
    if lms_course_status_of_quiz(new.id) = 'published' then
      raise exception 'That course is live. Ask the administrator to unpublish it first.';
    end if;
  else
    if old.status = 'published' then
      raise exception 'These questions are live. Ask the administrator to unpublish them before editing.';
    end if;
    if new.status is distinct from old.status then
      raise exception 'Only the administrator can publish a set of questions.';
    end if;
    if lms_course_status_of_quiz(old.id) = 'published' then
      raise exception 'That course is live. Ask the administrator to unpublish it first.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists t_guard_quiz on lms_quizzes;
create trigger t_guard_quiz before insert or update or delete on lms_quizzes
  for each row execute function lms_guard_quiz();

-- ---------------- modules, lessons, questions, options ----------------
create or replace function lms_guard_module() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_course uuid := case when tg_op = 'DELETE' then old.course_id else new.course_id end;
begin
  if auth.uid() is null or lms_is_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if (select status from lms_courses where id = v_course) = 'published' then
    raise exception 'That course is live. Ask the administrator to unpublish it before changing its modules.';
  end if;
  if tg_op = 'UPDATE' and old.course_id is distinct from new.course_id
     and (select status from lms_courses where id = old.course_id) = 'published' then
    raise exception 'That course is live. Ask the administrator to unpublish it first.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists t_guard_module on lms_modules;
create trigger t_guard_module before insert or update or delete on lms_modules
  for each row execute function lms_guard_module();

create or replace function lms_guard_lesson() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_module uuid := case when tg_op = 'DELETE' then old.module_id else new.module_id end;
begin
  if auth.uid() is null or lms_is_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if lms_course_status_of_module(v_module) = 'published' then
    raise exception 'That course is live. Ask the administrator to unpublish it before changing its lessons.';
  end if;
  if tg_op = 'UPDATE' and old.module_id is distinct from new.module_id
     and lms_course_status_of_module(old.module_id) = 'published' then
    raise exception 'That course is live. Ask the administrator to unpublish it first.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists t_guard_lesson on lms_lessons;
create trigger t_guard_lesson before insert or update or delete on lms_lessons
  for each row execute function lms_guard_lesson();

create or replace function lms_guard_question() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_quiz uuid := case when tg_op = 'DELETE' then old.quiz_id else new.quiz_id end;
begin
  if auth.uid() is null or lms_is_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if lms_course_status_of_quiz(v_quiz) = 'published' then
    raise exception 'That course is live. Ask the administrator to unpublish it before changing its questions.';
  end if;
  if (select status from lms_quizzes where id = v_quiz) = 'published' then
    raise exception 'These questions are live. Only the administrator can change them.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists t_guard_question on lms_questions;
create trigger t_guard_question before insert or update or delete on lms_questions
  for each row execute function lms_guard_question();

create or replace function lms_guard_option() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_q uuid := case when tg_op = 'DELETE' then old.question_id else new.question_id end;
  v_quiz uuid;
begin
  if auth.uid() is null or lms_is_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  select quiz_id into v_quiz from lms_questions where id = v_q;
  if lms_course_status_of_quiz(v_quiz) = 'published' then
    raise exception 'That course is live. Ask the administrator to unpublish it before changing its answers.';
  end if;
  if (select status from lms_quizzes where id = v_quiz) = 'published' then
    raise exception 'These questions are live. Only the administrator can change them.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists t_guard_option on lms_options;
create trigger t_guard_option before insert or update or delete on lms_options
  for each row execute function lms_guard_option();


-- =====================================================================
-- STEP 8  Writing questions.
--
-- lms_create_quiz and lms_import_questions come from 07_quizzes.sql.
-- This file only rewrites them if they look exactly as expected; if 07
-- has since changed their shape, replacing them blindly would either
-- fail outright or leave two versions behind. So it checks first.
--
-- The import no longer DELETES the old questions. Deleting them broke
-- two things: a learner halfway through an attempt had their frozen
-- question ids point at rows that no longer existed, so they were
-- marked out of nothing and told they had passed; and every past
-- attempt lost the questions it was marked against. Old questions are
-- now retired with active = false, which lms_start_quiz already skips,
-- and new ones are numbered above the highest position in use so they
-- cannot collide with the retired ones.
-- =====================================================================
do $$
declare
  v_args text; v_ret text; v_exists boolean;
begin
  select pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid)
    into v_args, v_ret
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'lms_create_quiz' limit 1;
  v_exists := v_args is not null;

  if v_exists and (v_args <> 'p_lesson uuid, p_module uuid, p_title text' or v_ret <> 'uuid') then
    raise notice 'Step 8: SKIPPED lms_create_quiz. Yours is (%) returning %, not the shape this file expects. Facilitators will not be able to create a set of questions until that is sorted. Send me 07_quizzes.sql.', v_args, v_ret;
  else
    execute $f$
      create or replace function lms_create_quiz(p_lesson uuid, p_module uuid, p_title text default '')
      returns uuid
      language plpgsql security definer set search_path = public as $body$
      declare v_id uuid;
      begin
        if not lms_can_edit() then raise exception 'Only staff can add questions.'; end if;
        if (p_lesson is null) = (p_module is null) then
          raise exception 'A set of questions belongs to either a lesson or a module, not both.';
        end if;
        insert into lms_quizzes (lesson_id, module_id, title, pass_percent, max_attempts,
                                 retake_after_minutes, shuffle, status)
        values (p_lesson, p_module,
                coalesce(nullif(btrim(p_title),''), case when p_lesson is not null
                         then 'Check what you remember' else 'Module quiz' end),
                case when p_lesson is not null then 100 else 70 end,
                case when p_lesson is not null then 20  else 3  end,
                0, true, 'draft')
        returning id into v_id;
        return v_id;
      end $body$;
    $f$;
    grant execute on function lms_create_quiz(uuid,uuid,text) to authenticated;
    raise notice 'Step 8: lms_create_quiz now accepts a facilitator.';
  end if;

  select pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid)
    into v_args, v_ret
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'lms_import_questions' limit 1;
  v_exists := v_args is not null;

  if v_exists and (v_args <> 'p_quiz uuid, p_items jsonb'
                   or v_ret <> 'TABLE(imported integer, message text)') then
    raise notice 'Step 8: SKIPPED lms_import_questions. Yours is (%) returning %, not the shape this file expects. Send me 07_quizzes.sql.', v_args, v_ret;
  else
    execute $f$
      create or replace function lms_import_questions(p_quiz uuid, p_items jsonb)
      returns table (imported integer, message text)
      language plpgsql security definer set search_path = public as $body$
      declare
        it jsonb; op jsonb; v_q uuid; v_pos integer := 0; v_opos integer;
        v_status lms_status; v_base integer; v_retired integer := 0;
      begin
        select status into v_status from lms_quizzes where id = p_quiz;
        if v_status is null then
          return query select 0, 'That set of questions does not exist.'; return;
        end if;

        -- a live set of questions is the administrator's to change
        if v_status = 'published' and not lms_is_admin() then
          return query select 0,
            'These questions are live. Ask the administrator to change them, or unpublish them first.';
          return;
        end if;
        if not lms_can_edit() then
          return query select 0, 'Only staff can import questions.'; return;
        end if;
        if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
          return query select 0, 'Nothing to import.'; return;
        end if;

        -- RETIRE, never delete. Frozen attempts still point at real rows.
        update lms_questions set active = false where quiz_id = p_quiz and active;
        v_retired := coalesce((select count(*) from lms_questions
                                where quiz_id = p_quiz and not active), 0);

        -- position is unique per quiz, so number the new ones above
        -- everything already there, retired rows included
        select coalesce(max(position), 0) into v_base
          from lms_questions where quiz_id = p_quiz;

        for it in select * from jsonb_array_elements(p_items) loop
          v_pos := v_pos + 1;
          insert into lms_questions (quiz_id, prompt, type, position, marks, explanation, active)
          values (p_quiz, coalesce(it ->> 'prompt',''),
                  coalesce(nullif(it ->> 'type',''),'single')::lms_question_type,
                  v_base + v_pos, greatest(1, coalesce((it ->> 'marks')::int, 1)),
                  coalesce(it ->> 'explanation',''), true)
          returning id into v_q;
          v_opos := 0;
          for op in select * from jsonb_array_elements(coalesce(it -> 'options','[]'::jsonb)) loop
            v_opos := v_opos + 1;
            insert into lms_options (question_id, label, is_correct, position)
            values (v_q, coalesce(op ->> 'label',''),
                    coalesce((op ->> 'correct')::boolean, false), v_opos);
          end loop;
        end loop;

        insert into lms_admin_actions (actor_id, action, subject_type, subject_id, detail)
        values (auth.uid(), 'import_questions', 'quiz', p_quiz,
                jsonb_build_object('imported', v_pos, 'retired', v_retired));
        return query select v_pos,
          v_pos || ' question(s) imported. ' || v_retired
          || ' older question(s) kept but retired, so part-finished attempts still work.';
      end $body$;
    $f$;
    grant execute on function lms_import_questions(uuid,jsonb) to authenticated;
    raise notice 'Step 8: lms_import_questions now retires instead of deleting.';
  end if;
end $$;


-- =====================================================================
-- STEP 9  Permissions on the new objects.
-- =====================================================================
grant select, insert, update, delete on lms_facilitators to authenticated;
grant execute on function lms_sync_my_access(), lms_can_edit(), lms_is_staff() to authenticated;
grant execute on function lms_add_facilitator(text,text,text),
                         lms_remove_facilitator(text) to authenticated;
grant execute on function lms_course_status_of_module(uuid),
                         lms_course_status_of_lesson(uuid),
                         lms_course_status_of_quiz(uuid) to authenticated;
revoke all on function lms_nightly_job_status() from public, anon, authenticated;


-- =====================================================================
-- STEP 9b  Tidy the table permissions.
--
-- Supabase grants every privilege on every new table in the public
-- schema to anon and authenticated, and relies entirely on row level
-- security to hold the line. That is mostly fine, but three of those
-- privileges are not wanted by anybody, and TRUNCATE in particular is
-- never filtered by row level security at all.
--
-- So, on the Academy tables only:
--   nobody gets TRUNCATE, REFERENCES or TRIGGER
--   a visitor who is not signed in gets no INSERT, UPDATE or DELETE
--   everything else is left alone
--
-- The default privileges for the whole public schema are deliberately
-- NOT changed, because the certification system shares that schema.
-- The cost of that choice is that a NEW lms_ table will arrive with the
-- wide default again, so run lms_tidy_table_privileges() after adding
-- one.
-- =====================================================================
create or replace function lms_tidy_table_privileges()
returns table (tables_tidied integer)
language plpgsql security definer set search_path = public as $$
declare r record; v_n integer := 0;
begin
  for r in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','v')
       and c.relname like 'lms\_%'
     order by c.relname
  loop
    -- a view records TRUNCATE too, even though it means nothing there
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', r.relname);
    execute format('revoke insert, update, delete on public.%I from anon', r.relname);
    v_n := v_n + 1;
  end loop;
  return query select v_n;
end $$;

revoke all on function lms_tidy_table_privileges() from public, anon, authenticated;

do $$
declare v_n integer;
begin
  select tables_tidied into v_n from lms_tidy_table_privileges();
  raise notice 'Step 9b: tightened permissions on % Academy tables and views.', v_n;
end $$;


-- =====================================================================
-- WHICH POLICIES LET A VISITOR WHO IS NOT SIGNED IN SEE ANYTHING,
-- and why each is safe. All of these are SELECT only, and after step 9b
-- anon holds no write privilege on any Academy table at all.
--
--   p_courses_public    a published course is a shop window. Draft
--                       courses are hidden by the same policy.
--   p_modules_public    module titles of a published course: the
--                       syllabus, which is meant to be read before
--                       buying.
--   p_lessons_public    lesson titles of a published course, for the
--                       same reason. The video reference is useless
--                       without lms_lesson_is_open saying yes, and
--                       completion needs server recorded watching.
--   p_paths_public       a published learning path is a shop window too.
--   p_pathc_public      which courses sit in a path, and in what order.
--                       Nothing but two ids and a number.
--   p_settings_public   the landing page words and the welcome video.
--                       Written for the public by definition.
--
-- Everything that could identify a person or give away an answer is
-- shut to anon with no policy at all: profiles, entitlements, orders,
-- progress, watch buckets, attempts, the audit log, the facilitator
-- list, and lms_options, which holds the answer key.
-- =====================================================================


-- =====================================================================
-- BREAK GLASS: making the first administrator, or recovering if the
-- only one is lost. This cannot be done from inside the app on purpose.
-- Run it here in the Supabase SQL editor, where only you can reach it:
--
--   update lms_profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'you@dataleadafrica.com');
-- =====================================================================
