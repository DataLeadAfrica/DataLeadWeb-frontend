-- =====================================================================
-- 10  ROLES AND HOW ACCESS IS GRANTED
--
-- One sentence covers both routes: your rights follow from whether your
-- CONFIRMED email is on a list.
--
--   on the facilitator list          -> you can build courses
--   enrolled on a bootcamp           -> every course is free to you
--
-- Both are checked on every sign in, and both work in reverse. Taken
-- off the list, or marked withdrawn, and the access goes at the next
-- sign in. The list is always the truth, so nobody has to remember a
-- second step when somebody leaves.
--
-- Nothing in this file can promote anyone to administrator. That is
-- deliberate. See BREAK GLASS at the bottom.
--
-- Safe to run twice. If anything is missing it stops at step 0 and
-- tells you what, before changing a single thing.
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
    'participants','participant_enrolments']
  loop
    if not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = v_t) then
      v_missing := v_missing || ('table ' || v_t);
    end if;
  end loop;

  -- columns we write to by name
  foreach v_c in array array[
    'lms_profiles.role','lms_profiles.participant_id',
    'lms_entitlements.user_id','lms_entitlements.course_id','lms_entitlements.source',
    'lms_entitlements.status','lms_entitlements.expires_at',
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

  if not exists (select 1 from pg_type where typname = 'lms_role') then
    v_missing := v_missing || 'type lms_role';
  end if;

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
-- gone -- including lms_lesson_is_open, which decides whether anyone
-- can open a lesson at all. Step 2 repairs those.
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
-- Call this once, straight after a successful sign in. It grants what
-- the lists say and takes back what they no longer say, then returns
-- one plain sentence the interface can show.
-- =====================================================================
create or replace function lms_sync_my_access()
returns table (role text, bootcamp boolean, changed boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text; v_confirmed timestamptz;
  v_role lms_role; v_new lms_role;
  v_part uuid; v_enrolled boolean := false; v_ends date; v_open boolean := false;
  v_had boolean; v_changed boolean := false; v_msg text := '';
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

  -- ---------- bootcamp, both directions ----------
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

  select exists (select 1 from lms_entitlements e
                  where e.user_id = v_uid and e.course_id is null
                    and e.source = 'roster' and e.status = 'active') into v_had;

  if v_enrolled and not v_had then
    insert into lms_entitlements (user_id, course_id, source, expires_at)
    values (v_uid, null, 'roster',
            case when v_ends is null then null else (v_ends + 1)::timestamptz end)
    on conflict do nothing;
    v_changed := true;
    v_msg := btrim(v_msg || ' Your bootcamp access is open, so every course is free to you.');

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
-- They build course material. Publishing stays with the administrator,
-- so nothing reaches a learner without a second pair of eyes.
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


-- =====================================================================
-- STEP 8  Let a facilitator, not only an administrator, write questions.
--
-- These two functions come from 07_quizzes.sql. This file only rewrites
-- them if they look exactly as expected; if 07 has since changed their
-- shape, replacing them blindly would either fail outright or leave two
-- versions of the same function behind. So it checks first, and says so
-- rather than guessing.
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
      declare it jsonb; op jsonb; v_q uuid; v_pos integer := 0; v_opos integer;
      begin
        if not lms_can_edit() then
          return query select 0, 'Only staff can import questions.'; return;
        end if;
        if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
          return query select 0, 'Nothing to import.'; return;
        end if;

        delete from lms_questions where quiz_id = p_quiz;

        for it in select * from jsonb_array_elements(p_items) loop
          v_pos := v_pos + 1;
          insert into lms_questions (quiz_id, prompt, type, position, marks, explanation)
          values (p_quiz, coalesce(it ->> 'prompt',''),
                  coalesce(nullif(it ->> 'type',''),'single')::lms_question_type,
                  v_pos, greatest(1, coalesce((it ->> 'marks')::int, 1)),
                  coalesce(it ->> 'explanation',''))
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
        values (auth.uid(), 'import_questions', 'quiz', p_quiz, jsonb_build_object('count', v_pos));
        return query select v_pos, v_pos || ' question(s) imported.';
      end $body$;
    $f$;
    grant execute on function lms_import_questions(uuid,jsonb) to authenticated;
    raise notice 'Step 8: lms_import_questions now accepts a facilitator.';
  end if;
end $$;


-- =====================================================================
-- STEP 9  Permissions.
-- =====================================================================
grant select, insert, update, delete on lms_facilitators to authenticated;
grant execute on function lms_sync_my_access(), lms_can_edit(), lms_is_staff() to authenticated;
grant execute on function lms_add_facilitator(text,text,text),
                         lms_remove_facilitator(text) to authenticated;


-- =====================================================================
-- BREAK GLASS: making the first administrator, or recovering if the
-- only one is lost. This cannot be done from inside the app on purpose.
-- Run it here in the Supabase SQL editor, where only you can reach it:
--
--   update lms_profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'you@dataleadafrica.com');
-- =====================================================================
