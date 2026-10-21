-- Tests file 21. NOT for the Supabase editor: it makes accounts, acts as
-- a visitor and as a learner through row level security, reads through
-- every policy that depends on a helper function, and rolls everything
-- back.
--
-- WHAT THIS FILE IS ABOUT. A function is executable by PUBLIC from the
-- moment it is created, so a fresh build of files 01 to 20 left 47 of
-- our own lms_* functions callable by a signed out visitor. Three of
-- them mattered, and the worst joined an account to somebody else's
-- certification record by email address while checking nothing about
-- who was asking.
--
-- SECTION 1 IS THE ONE THAT MATTERS: it performs the actual attack, as
-- a plain learner through row level security, and shows it refused.
--
-- SECTIONS 4 TO 7 ARE THE OPPOSITE TEST. Each one proves something is
-- STILL reachable that a tidier sweep would have broken, and each was a
-- real near miss while file 21 was written. They are the reason this
-- file is longer than the fix.
--
-- EVERY PERMISSION TEST RUNS AS anon OR authenticated. Row level
-- security does not apply to a table's owner unless FORCE is set, and
-- psql connects as the owner, so a test that forgets "set local role"
-- passes whatever the grants say. Results are captured BEFORE reset
-- role, because neither role can write the results table.

\set ON_ERROR_STOP on
begin;

create temporary table t21_out (n integer, label text, got text, want text) on commit drop;

create or replace function t21_say(p_label text, p_got text, p_want text)
returns void language plpgsql as $$
begin
  insert into t21_out values ((select coalesce(max(n), 0) + 1 from t21_out), p_label, p_got, p_want);
end $$;

create or replace function t21_be(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end $$;

-- --------------------------------------------------------------- setup
insert into auth.users (id, email, email_confirmed_at, created_at) values
  ('21aa0000-0000-0000-0000-000000000001', 'learner21@example.com', now(), now()),
  ('21aa0000-0000-0000-0000-000000000002', 'facil21@example.com',   now(), now()),
  ('21aa0000-0000-0000-0000-000000000009', 'admin21@example.com',   now(), now())
on conflict (id) do nothing;

update lms_profiles set role = 'admin', email_verified_at = now()
 where id = '21aa0000-0000-0000-0000-000000000009';
update lms_profiles set role = 'facilitator', email_verified_at = now()
 where id = '21aa0000-0000-0000-0000-000000000002';
update lms_profiles set email_verified_at = now()
 where id = '21aa0000-0000-0000-0000-000000000001';

-- An unlinked certification record belonging to somebody else, which is
-- what the attack in section 1 reaches for. email, NOT email_norm: a
-- trigger derives the normalised form and a row inserted with it set
-- directly comes back with it null and matches nobody.
insert into participants (id, full_name, email)
     values ('21bb0000-0000-0000-0000-00000000000a', 'Somebody Else', 'somebodyelse21@example.com')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 1. The attack, performed and refused
-- ---------------------------------------------------------------------
do $$ begin
  perform t21_be('21aa0000-0000-0000-0000-000000000001');
  set local role authenticated;
  perform lms_link_participant('21aa0000-0000-0000-0000-000000000001',
                               'somebodyelse21@example.com');
  reset role;
  perform t21_say('1a a learner cannot join themselves to another record',
    'ALLOWED, and the record was taken', 'refused');
exception when others then
  reset role;
  perform t21_say('1a a learner cannot join themselves to another record',
    'refused', 'refused');
end $$;

do $$ begin
  perform t21_be(null);
  set local role anon;
  perform lms_link_participant('21aa0000-0000-0000-0000-000000000001',
                               'somebodyelse21@example.com');
  reset role;
  perform t21_say('1b nor can a signed out visitor', 'ALLOWED', 'refused');
exception when others then
  reset role;
  perform t21_say('1b nor can a signed out visitor', 'refused', 'refused');
end $$;

-- and the record really is still unclaimed, checked as the owner. The
-- join lives on lms_profiles.participant_id, not on the participant
-- row, so this asks whether any account now points at it.
do $$ begin
  perform t21_say('1c the record is still joined to nobody',
    coalesce((select string_agg(id::text, ', ') from lms_profiles
               where participant_id = '21bb0000-0000-0000-0000-00000000000a'), 'nobody'),
    'nobody');
end $$;

do $$ begin
  perform t21_be('21aa0000-0000-0000-0000-000000000001');
  set local role authenticated;
  perform lms_grant_free_courses('21aa0000-0000-0000-0000-000000000001');
  reset role;
  perform t21_say('1d a learner cannot grant themselves free courses', 'ALLOWED', 'refused');
exception when others then
  reset role;
  perform t21_say('1d a learner cannot grant themselves free courses', 'refused', 'refused');
end $$;

do $$ begin
  perform t21_be(null);
  set local role anon;
  perform lms_storage_report();
  reset role;
  perform t21_say('1e a visitor cannot read the row counts and sizes', 'ALLOWED', 'refused');
exception when others then
  reset role;
  perform t21_say('1e a visitor cannot read the row counts and sizes', 'refused', 'refused');
end $$;

do $$ begin
  perform t21_be('21aa0000-0000-0000-0000-000000000002');
  set local role authenticated;
  perform lms_set_lesson_chapters('21cc0000-0000-0000-0000-00000000000c', '0:00 Start');
  reset role;
  perform t21_say('1f a facilitator cannot rewrite chapters directly', 'ALLOWED', 'refused');
exception when others then
  reset role;
  perform t21_say('1f a facilitator cannot rewrite chapters directly', 'refused', 'refused');
end $$;

-- ---------------------------------------------------------------------
-- 2. The fourteen that nothing calls are reachable by nobody
-- ---------------------------------------------------------------------
do $$
declare
  v_sig  text;
  v_open text[] := '{}';
begin
  foreach v_sig in array array[
    'lms_link_participant(uuid, text)',
    'lms_grant_free_courses(uuid)',
    'lms_storage_report()',
    'lms_set_lesson_chapters(uuid, text)',
    'lms_claim_bootcamp_access()',
    'lms_course_blockers(uuid)',
    'lms_course_progress(uuid)',
    'lms_course_status_of_lesson(uuid)',
    'lms_course_status_of_module(uuid)',
    'lms_course_status_of_quiz(uuid)',
    'lms_import_questions(uuid, jsonb)',
    'lms_is_lesson_unlocked(uuid)',
    'lms_quiz_kind(uuid)',
    'lms_watch_coverage(uuid)'
  ]
  loop
    if to_regprocedure('public.' || v_sig) is null then
      v_open := v_open || (v_sig || ' MISSING')::text;
    elsif has_function_privilege('anon', v_sig, 'EXECUTE')
       or has_function_privilege('authenticated', v_sig, 'EXECUTE') then
      v_open := v_open || v_sig::text;
    end if;
  end loop;
  perform t21_say('2a none of the fourteen is executable by anon or a learner',
    coalesce(array_to_string(v_open, ', '), ''), '');
end $$;

-- ---------------------------------------------------------------------
-- 3. The eight a learner needs: shut to anon, open to authenticated
-- ---------------------------------------------------------------------
-- THE SECOND HALF IS THE HALF THAT CAUGHT A REAL FAULT.
-- lms_sync_my_access had no grant of its own and was reachable only
-- through PUBLIC, so revoking PUBLIC took it from signed in learners
-- too, and academy.ts calls it on every sign in. Asking only "has anon
-- lost it" would have passed while the Academy was broken.
do $$
declare
  v_sig    text;
  v_anon   text[] := '{}';
  v_missing text[] := '{}';
begin
  foreach v_sig in array array[
    'lms_has_course_access(uuid)',
    'lms_complete_lesson(uuid)',
    'lms_record_watch(uuid, integer, integer)',
    'lms_start_quiz(uuid)',
    'lms_submit_quiz(uuid, jsonb)',
    'lms_sync_my_access()',
    'lms_add_facilitator(text, text, text)',
    'lms_remove_facilitator(text)'
  ]
  loop
    if to_regprocedure('public.' || v_sig) is null then
      v_missing := v_missing || (v_sig || ' MISSING')::text;
    else
      if has_function_privilege('anon', v_sig, 'EXECUTE') then
        v_anon := v_anon || v_sig::text;
      end if;
      if not has_function_privilege('authenticated', v_sig, 'EXECUTE') then
        v_missing := v_missing || v_sig::text;
      end if;
    end if;
  end loop;
  perform t21_say('3a anon holds none of the eight',
    coalesce(array_to_string(v_anon, ', '), ''), '');
  perform t21_say('3b but a signed in learner holds all eight',
    coalesce(array_to_string(v_missing, ', '), ''), '');
end $$;

-- ---------------------------------------------------------------------
-- 4. TRAP ONE: the policy helpers, and a read through every policy
-- ---------------------------------------------------------------------
-- Five lms_* functions are named inside 36 policies across 27 tables. A
-- policy runs its functions as the querying role, so revoking one stops
-- a learner reading their own profile. The tables are found by looking
-- at the policies rather than from a list in this file, so a policy
-- added later is covered without anybody remembering to come back here.
do $$
declare
  v_sig  text;
  v_lost text[] := '{}';
begin
  foreach v_sig in array array[
    'lms_can_edit()', 'lms_is_admin()', 'lms_is_staff()',
    'lms_lesson_is_open(uuid)', 'lms_my_role()'
  ]
  loop
    if to_regprocedure('public.' || v_sig) is null then
      v_lost := v_lost || (v_sig || ' MISSING')::text;
    elsif not has_function_privilege('anon', v_sig, 'EXECUTE')
       or not has_function_privilege('authenticated', v_sig, 'EXECUTE') then
      v_lost := v_lost || v_sig::text;
    end if;
  end loop;
  perform t21_say('4a all five policy helpers are still executable by both roles',
    coalesce(array_to_string(v_lost, ', '), ''), '');
end $$;

do $$
declare
  v_tbl    text;
  v_broke  text[] := '{}';
  v_n      integer := 0;
begin
  for v_tbl in
    select distinct p.polrelid::regclass::text
      from pg_policy p
      join pg_proc h on h.proname in ('lms_can_edit', 'lms_is_admin', 'lms_is_staff',
                                      'lms_lesson_is_open', 'lms_my_role')
       and coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
           coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
           like '%' || h.proname || '(%'
      join pg_namespace hn on hn.oid = h.pronamespace and hn.nspname = 'public'
     order by 1
  loop
    v_n := v_n + 1;
    -- ONLY A DENIAL NAMING A FUNCTION COUNTS.
    --
    -- "permission denied for table lms_area_tools" as anon is the right
    -- answer and has nothing to do with this file: several of these
    -- tables have no SELECT grant for a visitor at all, which is how
    -- they were before file 21 and how they should stay. A policy that
    -- simply matches no rows returns a count of zero rather than an
    -- error. The fault this section exists to catch has one signature,
    -- "permission denied for function", and that is what is collected.
    begin
      perform t21_be(null);
      set local role anon;
      execute format('select count(*) from %s', v_tbl);
      reset role;
    exception when others then
      reset role;
      if sqlerrm like '%permission denied for function%' then
        v_broke := v_broke || (v_tbl || ' as anon: ' || sqlerrm)::text;
      end if;
    end;

    begin
      perform t21_be('21aa0000-0000-0000-0000-000000000001');
      set local role authenticated;
      execute format('select count(*) from %s', v_tbl);
      reset role;
    exception when others then
      reset role;
      if sqlerrm like '%permission denied for function%' then
        v_broke := v_broke || (v_tbl || ' as a learner: ' || sqlerrm)::text;
      end if;
    end;
  end loop;

  perform t21_say('4b every table with a helper-backed policy has policies to read through',
    case when v_n >= 20 then 'yes, ' || v_n || ' tables' else 'only ' || v_n end,
    'yes, ' || v_n || ' tables');
  perform t21_say('4c and a read through each one works as anon and as a learner',
    coalesce(array_to_string(v_broke, ' | '), ''), '');
end $$;

-- ---------------------------------------------------------------------
-- 5. TRAP TWO: the certification system and the mailer are untouched
-- ---------------------------------------------------------------------
-- The mailer is a Google Apps Script with no account: it arrives as a
-- visitor and proves itself with a token. The staff console, the
-- participant portal and the blog work the same way, and most of their
-- functions exist only on live, so nothing here would notice them
-- breaking. Whatever of them this database has must still be reachable.
do $$
declare
  v_sig  text;
  v_lost text[] := '{}';
begin
  foreach v_sig in array array[
    'mail_fetch_pending(text, integer)', 'mail_mark_sent(text, uuid[])',
    'mail_ping(text)', 'mailer_token_ok(text)', 'system_health(text)',
    'verify_certificate(text)', 'request_sign_in_code(text)'
  ]
  loop
    if to_regprocedure('public.' || v_sig) is not null
       and not has_function_privilege('anon', v_sig, 'EXECUTE') then
      v_lost := v_lost || v_sig::text;
    end if;
  end loop;
  perform t21_say('5a nothing the mailer or the certification pages call has been shut',
    coalesce(array_to_string(v_lost, ', '), ''), '');
end $$;

-- ---------------------------------------------------------------------
-- 6. TRAP THREE: the FAQ validator, used by a CHECK constraint
-- ---------------------------------------------------------------------
-- A CHECK constraint is evaluated as the querying role, exactly like a
-- policy. lms_courses has one that calls lms_faq_is_valid, so revoking
-- it told a facilitator editing their own course "permission denied for
-- function lms_faq_is_valid". It accepts a jsonb and answers true or
-- false, reaching no data, so shutting it was never worth anything.
do $$
declare v_c uuid;
begin
  perform t21_be('21aa0000-0000-0000-0000-000000000002');
  set local role authenticated;
  v_c := lms_create_course('FAQ constraint course', 'STATA');
  update lms_courses set faq = '[{"question":"Is this one?","answer":"It is."}]'::jsonb
   where id = v_c;
  reset role;
  perform t21_say('6a a facilitator can still write a course FAQ directly', 'allowed', 'allowed');
exception when others then
  reset role;
  perform t21_say('6a a facilitator can still write a course FAQ directly',
    'refused: ' || sqlerrm, 'allowed');
end $$;

-- ---------------------------------------------------------------------
-- 7. TRAP FOUR: the functions a page with no session really does call
-- ---------------------------------------------------------------------
-- lms_my_path is the one worth knowing about. Reading the code suggested
-- a session was always needed. Loading every signed out page in a real
-- browser with the network log open showed the path page asking for it
-- with no session at all.
do $$
declare
  v_sig  text;
  v_lost text[] := '{}';
begin
  foreach v_sig in array array[
    'lms_live_popup(text)', 'lms_my_path(text)', 'lms_public_catalogue()',
    'lms_public_course(text)', 'lms_public_landing()'
  ]
  loop
    if to_regprocedure('public.' || v_sig) is null then
      v_lost := v_lost || (v_sig || ' MISSING')::text;
    elsif not has_function_privilege('anon', v_sig, 'EXECUTE') then
      v_lost := v_lost || v_sig::text;
    end if;
  end loop;
  perform t21_say('7a a visitor can still reach all five signed out page functions',
    coalesce(array_to_string(v_lost, ', '), ''), '');
end $$;

do $$ begin
  perform t21_be(null);
  set local role anon;
  perform lms_public_catalogue();
  perform lms_my_path('nothing-by-this-slug');
  reset role;
  perform t21_say('7b and really calling two of them as a visitor works', 'worked', 'worked');
exception when others then
  reset role;
  perform t21_say('7b and really calling two of them as a visitor works',
    'refused: ' || sqlerrm, 'worked');
end $$;

-- ---------------------------------------------------------------------
-- 8. The allow list, which fails on anything new
-- ---------------------------------------------------------------------
-- THE CHECK THAT WILL STILL BE WORKING IN A YEAR. Everything above
-- checks a list of known mistakes. This one fails on a function added
-- later and left with its default grant, with nobody having to remember
-- to come back and add a test.
--
-- 21_verify.sql holds the identical list and a node test keeps the two
-- copies in step, so neither can drift quietly.
do $$
declare v_extra text[];
begin
  select coalesce(array_agg(p.proname order by p.proname), '{}')
    into v_extra
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'lms\_%'
     and has_function_privilege('anon', p.oid, 'EXECUTE')
     and p.proname <> all (array[
       'lms_can_edit', 'lms_is_admin', 'lms_is_staff', 'lms_lesson_is_open',
       'lms_my_role', 'lms_live_popup', 'lms_my_path', 'lms_public_catalogue',
       'lms_public_course', 'lms_public_landing', 'lms_faq_is_valid',
       'lms_check_question_chapter', 'lms_guard_course', 'lms_guard_lesson',
       'lms_guard_module', 'lms_guard_option', 'lms_guard_path',
       'lms_guard_question', 'lms_guard_question_not_served',
       'lms_guard_quiz', 'lms_guard_quiz_not_empty', 'lms_handle_new_user',
       'lms_no_new_module_quiz', 'lms_progress_keep_coverage',
       'lms_progress_tidy_up', 'lms_touch'
     ]);
  perform t21_say('8a no lms_ function outside the allow list is executable by a visitor',
    coalesce(array_to_string(v_extra, ', '), ''), '');
end $$;

-- AND THE LIST IS NOT LONGER THAN IT SHOULD BE EITHER. A list that
-- names a function nobody granted would pass check 8a for the wrong
-- reason, and would quietly excuse a real grant later.
do $$
declare v_unused text[];
begin
  select coalesce(array_agg(nm order by nm), '{}') into v_unused from (
    select unnest(array[
      'lms_can_edit', 'lms_is_admin', 'lms_is_staff', 'lms_lesson_is_open',
      'lms_my_role', 'lms_live_popup', 'lms_my_path', 'lms_public_catalogue',
      'lms_public_course', 'lms_public_landing', 'lms_faq_is_valid',
      'lms_check_question_chapter', 'lms_guard_course', 'lms_guard_lesson',
      'lms_guard_module', 'lms_guard_option', 'lms_guard_path',
      'lms_guard_question', 'lms_guard_question_not_served',
      'lms_guard_quiz', 'lms_guard_quiz_not_empty', 'lms_handle_new_user',
      'lms_no_new_module_quiz', 'lms_progress_keep_coverage',
      'lms_progress_tidy_up', 'lms_touch'
    ]) as nm
  ) l
   where not exists (
     select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = l.nm
        and has_function_privilege('anon', p.oid, 'EXECUTE')
   );
  perform t21_say('8b and every name on the allow list is really granted',
    coalesce(array_to_string(v_unused, ', '), ''), '');
end $$;

-- ---------------------------------------------------------------------
-- 9. Item 3: every definer function that takes a person
-- ---------------------------------------------------------------------
-- Twelve security definer lms_* functions accept an account id or an
-- email address. Eight can be reached by a signed in browser and every
-- one of those asks lms_is_admin() first. The other four check nothing
-- about their caller, which is exactly why no browser may reach them.
do $$
declare
  v_sig    text;
  v_noask  text[] := '{}';
  v_open   text[] := '{}';
begin
  foreach v_sig in array array[
    'lms_add_facilitator(text, text, text)',
    'lms_give_access(uuid, uuid, text, lms_grant_source, timestamp with time zone)',
    'lms_learner_record(uuid)',
    'lms_lift_exam_wait(uuid, uuid)',
    'lms_link_certification_record(uuid, uuid, text)',
    'lms_remove_access(uuid, uuid, text)',
    'lms_remove_facilitator(text)',
    'lms_set_staff_role(uuid, lms_role)'
  ]
  loop
    if to_regprocedure('public.' || v_sig) is null then
      v_noask := v_noask || (v_sig || ' MISSING')::text;
    else
      if has_function_privilege('anon', v_sig, 'EXECUTE') then
        v_open := v_open || v_sig::text;
      end if;
      if (select count(*) from pg_proc p
           where p.oid = to_regprocedure('public.' || v_sig)
             and regexp_replace(pg_get_functiondef(p.oid),
                   '--[^' || chr(10) || ']*', '', 'g') like '%lms_is_admin()%') = 0 then
        v_noask := v_noask || v_sig::text;
      end if;
    end if;
  end loop;
  perform t21_say('9a every reachable function that takes a person asks lms_is_admin',
    coalesce(array_to_string(v_noask, ', '), ''), '');
  perform t21_say('9b and none of them is reachable by a visitor',
    coalesce(array_to_string(v_open, ', '), ''), '');
end $$;

do $$
declare
  v_sig  text;
  v_open text[] := '{}';
begin
  foreach v_sig in array array[
    'lms_apply_signup_answers(uuid)', 'lms_grant_free_courses(uuid)',
    'lms_link_participant(uuid, text)', 'lms_strip_signup_metadata(uuid)'
  ]
  loop
    if to_regprocedure('public.' || v_sig) is null then
      v_open := v_open || (v_sig || ' MISSING')::text;
    elsif has_function_privilege('anon', v_sig, 'EXECUTE')
       or has_function_privilege('authenticated', v_sig, 'EXECUTE') then
      v_open := v_open || v_sig::text;
    end if;
  end loop;
  perform t21_say('9c the four that ask nothing are reachable by nobody',
    coalesce(array_to_string(v_open, ', '), ''), '');
end $$;

-- ------------------------------------------------------------- results
\pset tuples_only off
\pset format aligned
select n as "#", label as "what was checked",
       case when got is not distinct from want then 'pass' else 'FAIL' end as "result",
       got as "got", want as "wanted"
  from t21_out order by n;

select case when count(*) = 0 then 'ALL PASS'
            else count(*) || ' FAILED' end as "summary"
  from t21_out where got is distinct from want;

rollback;
