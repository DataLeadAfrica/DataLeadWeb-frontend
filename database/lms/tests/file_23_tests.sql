-- Tests file 23. NOT for the Supabase editor: it makes accounts and
-- courses, acts as a learner through row level security, performs an
-- attack, and rolls everything back.
--
-- SECTION 1 IS THE ONE THAT MATTERS. It carries out the attack that
-- issued a real certificate number to a learner who watched one second
-- of each lesson, and requires it refused at every step. Section 2 is
-- the honest learner who skips the exam. SECTION 3 IS THE REGRESSION
-- THAT PAID FOR ITSELF: a learner who does everything properly must
-- still get their certificate, because fixing the exam requirement
-- without checking that would have locked everybody out.
--
-- EVERY PERMISSION TEST RUNS AS authenticated. Row level security does
-- not apply to a table's owner unless FORCE is set, and psql connects as
-- the owner, so a test that forgets "set local role" passes whatever the
-- rules say.

\set ON_ERROR_STOP on
begin;

create temporary table t23_out (n integer, label text, got text, want text) on commit drop;

create or replace function t23_say(p_label text, p_got text, p_want text)
returns void language plpgsql as $$
begin
  insert into t23_out values ((select coalesce(max(n), 0) + 1 from t23_out), p_label, p_got, p_want);
end $$;

create or replace function t23_be(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end $$;


-- CALLED THROUGH EXECUTE, so a database that has not had file 23 reports
-- a failed check instead of dying on a missing function. file_22_tests
-- had the same fault and it is the same fix: a test file's job is to say
-- what is wrong, not to stop at the first thing that is.
create or replace function t23_follows(p_prog uuid, p_title text)
returns text language plpgsql as $$
declare v_out boolean;
begin
  if to_regprocedure('public.lms_programme_title_follows(uuid, text)') is null then
    return 'no such function';
  end if;
  execute 'select lms_programme_title_follows($1, $2)' into v_out using p_prog, p_title;
  return coalesce(v_out::text, 'null');
exception when others then
  return 'error: ' || left(sqlerrm, 40);
end $$;

-- A published course with a programme, two video lessons and a published
-- exam with a big enough bank. Built as the owner, because the question
-- is what a LEARNER can do, not what a builder can.
insert into auth.users (id, email, email_confirmed_at) values
  ('23aa0000-0000-0000-0000-00000000000a', 'attack23@example.com', now()),
  ('23aa0000-0000-0000-0000-00000000000b', 'honest23@example.com', now()),
  ('23aa0000-0000-0000-0000-000000000009', 'admin23t@example.com', now())
on conflict (id) do nothing;
update lms_profiles set email_verified_at = now(), full_name = 'Attack Learner'
 where id = '23aa0000-0000-0000-0000-00000000000a';
update lms_profiles set email_verified_at = now(), full_name = 'Honest Learner'
 where id = '23aa0000-0000-0000-0000-00000000000b';
update lms_profiles set role = 'admin', email_verified_at = now(), full_name = 'An Admin'
 where id = '23aa0000-0000-0000-0000-000000000009';
insert into lms_entitlements (user_id, course_id, source) values
  ('23aa0000-0000-0000-0000-00000000000a', null, 'manual'),
  ('23aa0000-0000-0000-0000-00000000000b', null, 'manual');

insert into programmes (id, slug, title, code, template_key, active)
     values ('23dd0000-0000-0000-0000-00000000000a', 't23prog', 'Test 23 Programme', 'T23P', 'default', true)
on conflict (id) do nothing;
insert into lms_courses (id, slug, title, tool, area, level, summary, status, published_at, programme_id)
     values ('23cc0000-0000-0000-0000-00000000000a', 't23-course', 'Test 23 Course', 'STATA',
             'Stats', 'Beginner', 'x', 'published', now(), '23dd0000-0000-0000-0000-00000000000a')
on conflict (id) do nothing;
insert into lms_modules (id, course_id, title, position)
     values ('23ee0000-0000-0000-0000-00000000000a', '23cc0000-0000-0000-0000-00000000000a', 'Module one', 1)
on conflict (id) do nothing;
insert into lms_lessons (id, module_id, title, type, position, video_provider, video_ref,
                         duration_seconds, bucket_seconds, coverage_percent) values
  ('23ff0000-0000-0000-0000-00000000000a', '23ee0000-0000-0000-0000-00000000000a', 'Lesson one',
   'video', 1, 'youtube', 'l1', 100, 10, 92),
  ('23ff0000-0000-0000-0000-00000000000b', '23ee0000-0000-0000-0000-00000000000a', 'Lesson two',
   'video', 2, 'youtube', 'l2', 100, 10, 92)
on conflict (id) do nothing;

-- The exam: serve 1 of a bank of 2, because serve_count times
-- bank_multiple is the floor and lms_start_exam quietly returns nothing
-- at all when the bank is short of it.
insert into lms_quizzes (id, course_id, title, status, pass_percent, max_attempts,
                         serve_count, bank_multiple, time_limit_minutes)
     values ('23bb0000-0000-0000-0000-00000000000a', '23cc0000-0000-0000-0000-00000000000a',
             'Course exam', 'draft', 70, 2, 1, 1.5, 40)
on conflict (id) do nothing;
insert into lms_questions (id, quiz_id, prompt, position, marks) values
  ('23b10000-0000-0000-0000-00000000000a', '23bb0000-0000-0000-0000-00000000000a', 'Question one', 1, 1),
  ('23b10000-0000-0000-0000-00000000000b', '23bb0000-0000-0000-0000-00000000000a', 'Question two', 2, 1)
on conflict (id) do nothing;
insert into lms_options (question_id, label, is_correct, position) values
  ('23b10000-0000-0000-0000-00000000000a', 'right', true, 1),
  ('23b10000-0000-0000-0000-00000000000a', 'wrong', false, 2),
  ('23b10000-0000-0000-0000-00000000000b', 'right', true, 1),
  ('23b10000-0000-0000-0000-00000000000b', 'wrong', false, 2);
update lms_quizzes set status = 'published' where id = '23bb0000-0000-0000-0000-00000000000a';

-- ---------------------------------------------------------------------
-- 1. The attack, performed and refused
-- ---------------------------------------------------------------------
do $$
declare v_n integer := 0;
begin
  perform t23_be('23aa0000-0000-0000-0000-00000000000a');
  set local role authenticated;
  -- one bucket of each lesson, which is all the player needs to create
  -- the progress row, and the whole entry fee the attack ever needed
  perform lms_record_watch('23ff0000-0000-0000-0000-00000000000a', 0, 1);
  perform lms_record_watch('23ff0000-0000-0000-0000-00000000000b', 0, 1);
  reset role;
  perform t23_say('1a watching one second makes a progress row, as it always did',
    (select count(*)::text from lms_lesson_progress
      where user_id = '23aa0000-0000-0000-0000-00000000000a'), '2');
end $$;

do $$
declare v_n integer := 0;
begin
  perform t23_be('23aa0000-0000-0000-0000-00000000000a');
  set local role authenticated;
  update lms_lesson_progress set completed = true, completed_at = now(), check_passed = true
   where user_id = '23aa0000-0000-0000-0000-00000000000a';
  get diagnostics v_n = row_count;
  reset role;
  perform t23_say('1b a learner cannot mark their own lessons complete',
    'ALLOWED, ' || v_n || ' row(s)', 'refused');
exception when others then
  reset role;
  perform t23_say('1b a learner cannot mark their own lessons complete', 'refused', 'refused');
end $$;

do $$ begin
  perform t23_say('1c so nothing is marked complete',
    (select count(*)::text from lms_lesson_progress
      where user_id = '23aa0000-0000-0000-0000-00000000000a' and completed), '0');
end $$;

do $$
declare r record;
begin
  perform t23_be('23aa0000-0000-0000-0000-00000000000a');
  set local role authenticated;
  select * into r from lms_claim_course_certificate('23cc0000-0000-0000-0000-00000000000a');
  reset role;
  perform t23_say('1d and no certificate is issued',
    case when r.issued then 'ISSUED ' || coalesce(r.certificate_number, '') else 'refused' end,
    'refused');
exception when others then
  reset role;
  perform t23_say('1d and no certificate is issued', 'error: ' || left(sqlerrm, 40), 'refused');
end $$;

-- A DIRECT INSERT WAS ALWAYS REFUSED, and still is. Worth asserting
-- because it is the other half of why one second of watching mattered:
-- the row had to exist before it could be updated.
do $$ begin
  perform t23_be('23aa0000-0000-0000-0000-00000000000a');
  set local role authenticated;
  insert into lms_lesson_progress (user_id, lesson_id, completed, check_passed)
  values ('23aa0000-0000-0000-0000-00000000000a', '23ff0000-0000-0000-0000-00000000000a', true, true);
  reset role;
  perform t23_say('1e nor insert a finished one from nothing', 'ALLOWED', 'refused');
exception when others then
  reset role;
  perform t23_say('1e nor insert a finished one from nothing', 'refused', 'refused');
end $$;

-- ---------------------------------------------------------------------
-- 2. An honest learner who never opens the exam
-- ---------------------------------------------------------------------
-- FAULT B ON ITS OWN, and it caught an honest learner too. The claim
-- counted quizzes reached through lms_modules, which is module quizzes,
-- abolished by file 16, so the count was zero and the exam was never
-- required.
-- EVERY RESULT IS CAPTURED INTO A VARIABLE FIRST AND RECORDED AFTER
-- reset role. The results table belongs to the owner and authenticated
-- cannot write it, so a t23_say while still acting as the learner dies
-- with "permission denied for table t23_out". It is written at the top
-- of this file and I did it anyway, and because the handler then fired,
-- the second lesson was never finished and section 3 failed too with
-- "This exam cannot be started right now".
do $$
declare r record; i integer; v_one text; v_two text; v_claim text; v_why text;
begin
  perform t23_be('23aa0000-0000-0000-0000-00000000000b');
  set local role authenticated;
  for i in 0..9 loop
    perform lms_record_watch('23ff0000-0000-0000-0000-00000000000a', i, i * 10);
    perform lms_record_watch('23ff0000-0000-0000-0000-00000000000b', i, i * 10);
  end loop;
  select * into r from lms_complete_lesson('23ff0000-0000-0000-0000-00000000000a');
  v_one := case when r.completed then 'finished' else 'refused: ' || r.reason end;
  select * into r from lms_complete_lesson('23ff0000-0000-0000-0000-00000000000b');
  v_two := case when r.completed then 'finished' else 'refused: ' || r.reason end;
  select * into r from lms_claim_course_certificate('23cc0000-0000-0000-0000-00000000000a');
  v_claim := case when r.issued then 'ISSUED ' || coalesce(r.certificate_number, '') else 'refused' end;
  v_why := case when r.message like '%exam%' then 'mentions the exam' else r.message end;
  reset role;

  perform t23_say('2a an honest learner can finish the first lesson properly', v_one, 'finished');
  perform t23_say('2b and the second', v_two, 'finished');
  perform t23_say('2c but not claim a certificate without sitting the exam', v_claim, 'refused');
  perform t23_say('2d and the refusal says why', v_why, 'mentions the exam');
exception when others then
  reset role;
  perform t23_say('2a an honest learner can finish the first lesson properly',
    'error: ' || left(sqlerrm, 50), 'finished');
end $$;

-- ---------------------------------------------------------------------
-- 3. The same learner, having done everything. THE REGRESSION.
-- ---------------------------------------------------------------------
-- Fixing the exam requirement without this check would have made every
-- course certificate unobtainable, which is worse than the fault.
do $$
declare r record; v_att uuid; v_ans jsonb; v_sub record; v_passed text; v_got text;
begin
  perform t23_be('23aa0000-0000-0000-0000-00000000000b');
  set local role authenticated;
  -- lms_start_exam, not lms_start_quiz: the exam page calls that one,
  -- and lms_start_quiz does not handle a course owned quiz at all.
  select attempt_id into v_att from lms_start_exam('23bb0000-0000-0000-0000-00000000000a');
  reset role;
  perform t23_say('3a the exam starts',
    case when v_att is null then 'no attempt' else 'started' end, 'started');
  -- captured, then recorded after the role is given back, for the same
  -- reason as section 2

  -- THE ANSWER KEY IS READ AS THE OWNER. lms_options.is_correct never
  -- leaves the server, which is the point, so a learner cannot see which
  -- option is right. A test harness may look; a learner may not.
  select jsonb_object_agg(q.id::text, (
           select o.id::text from lms_options o
            where o.question_id = q.id and o.is_correct limit 1))
    into v_ans
    from lms_questions q
   where q.id = any(coalesce((select served_question_ids from lms_quiz_attempts
                               where id = v_att), array[]::uuid[]));

  perform t23_be('23aa0000-0000-0000-0000-00000000000b');
  set local role authenticated;
  select * into v_sub from lms_submit_quiz(v_att, v_ans);
  v_passed := coalesce(v_sub.passed::text, 'no result');
  select * into r from lms_claim_course_certificate('23cc0000-0000-0000-0000-00000000000a');
  v_got := case when r.issued then 'issued' else 'REFUSED: ' || left(r.message, 44) end;
  reset role;
  perform t23_say('3b and is passed', v_passed, 'true');
  perform t23_say('3c THEN the certificate is issued, so nobody is locked out', v_got, 'issued');
exception when others then
  reset role;
  perform t23_say('3c THEN the certificate is issued, so nobody is locked out',
    'error: ' || left(sqlerrm, 50), 'issued');
end $$;

-- ---------------------------------------------------------------------
-- 4. The watch record and the attempt log stay read only
-- ---------------------------------------------------------------------
do $$
declare v_tbl text; v_open text[] := '{}';
begin
  foreach v_tbl in array array['lms_lesson_progress', 'lms_watch_buckets', 'lms_quiz_attempts']
  loop
    if to_regclass('public.' || v_tbl) is not null
       and exists (select 1 from information_schema.role_table_grants g
                    where g.table_schema = 'public' and g.table_name = v_tbl
                      and g.grantee in ('anon', 'authenticated')
                      and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')) then
      v_open := v_open || v_tbl::text;
    end if;
  end loop;
  perform t23_say('4a no learner holds a write on the three progress tables',
    coalesce(array_to_string(v_open, ', '), ''), '');
  perform t23_say('4b and the progress record has no policy but a read one',
    (select count(*)::text from pg_policy
      where polrelid = to_regclass('public.lms_lesson_progress') and polcmd <> 'r'), '0');
end $$;

-- ---------------------------------------------------------------------
-- 5. The certificate title follows the course, until one is issued
-- ---------------------------------------------------------------------
do $$
declare v_c uuid; v_prog uuid;
begin
  perform t23_be('23aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  -- created with a scrappy first title, the way the Power BI course was
  v_c := lms_create_course('power-bi-t23', 'Stats', 'Power BI');
  reset role;
  select programme_id into v_prog from lms_courses where id = v_c;
  perform t23_say('5a at creation the certificate matches the title',
    (select pr.title from programmes pr where pr.id = v_prog), 'power-bi-t23');

  perform t23_be('23aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  perform lms_set_course_details(p_course => v_c, p_title => 'Power BI for Analysts',
                                 p_summary => 'A summary long enough to pass the checklist');
  reset role;
  perform t23_say('5b renaming before any certificate makes it follow',
    (select pr.title from programmes pr where pr.id = v_prog), 'Power BI for Analysts');

  -- now a certificate exists, so the words are in somebody's hands
  insert into participants (id, full_name, email)
       values ('23c10000-0000-0000-0000-00000000000a', 'Holder', 'holder23t@example.com')
  on conflict (id) do nothing;
  insert into certificates (certificate_number, participant_id, programme_id, completed_on)
       values ('T23P-2026-GEN-AAAAAA', '23c10000-0000-0000-0000-00000000000a', v_prog, current_date);

  perform t23_be('23aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  perform lms_set_course_details(p_course => v_c, p_title => 'Renamed After Issue',
                                 p_summary => 'A summary long enough to pass the checklist');
  reset role;
  perform t23_say('5c renaming after one exists does NOT change it',
    (select pr.title from programmes pr where pr.id = v_prog), 'Power BI for Analysts');
  perform t23_say('5d and the course itself still renames',
    (select title from lms_courses where id = v_c), 'Renamed After Issue');
end $$;

-- A REVOKED CERTIFICATE COUNTS. It was printed, somebody holds the
-- paper, and a revocation may yet be reversed.
do $$
declare v_prog uuid;
begin
  insert into programmes (id, slug, title, code, template_key, active)
       values ('23d10000-0000-0000-0000-00000000000a', 't23-rev', 'Frozen By A Revoked One',
               'T23REV', 'default', true)
  on conflict (id) do nothing;
  insert into lms_courses (id, slug, title, tool, area, level, status, programme_id)
       values ('23c20000-0000-0000-0000-00000000000a', 't23-rev-course', 'A New Name',
               'STATA', 'Stats', 'Beginner', 'draft', '23d10000-0000-0000-0000-00000000000a')
  on conflict (id) do nothing;
  insert into certificates (certificate_number, participant_id, programme_id, completed_on, revoked)
       values ('T23REV-2026-GEN-BBBBBB', '23c10000-0000-0000-0000-00000000000a',
               '23d10000-0000-0000-0000-00000000000a', current_date, true);
  perform t23_say('5e a revoked certificate still freezes the title',
    t23_follows('23d10000-0000-0000-0000-00000000000a', 'Should Not Apply'), 'false');
  perform t23_say('5f so the title is untouched',
    (select title from programmes where id = '23d10000-0000-0000-0000-00000000000a'),
    'Frozen By A Revoked One');
end $$;

-- A CERTIFICATION PROGRAMME IS NEVER TOUCHED. This is the one that
-- matters most: the Academy may move out of the way, never rewrite.
do $$ begin
  insert into programmes (id, slug, title, code, template_key, active)
       values ('23d20000-0000-0000-0000-00000000000a', 't23-boot',
               'A Bootcamp Nobody Points At', 'T23BOOT', 'default', true)
  on conflict (id) do nothing;
  perform t23_say('5g a programme no course or path points at is refused',
    t23_follows('23d20000-0000-0000-0000-00000000000a', 'Hijacked'), 'false');
  perform t23_say('5h and its title is exactly as it was',
    (select title from programmes where id = '23d20000-0000-0000-0000-00000000000a'),
    'A Bootcamp Nobody Points At');
  perform t23_say('5i an empty title is ignored rather than written',
    t23_follows('23d20000-0000-0000-0000-00000000000a', '   '), 'false');
end $$;

-- A PATH FOLLOWS THROUGH ITS CERTIFICATE NAME, not its name, because
-- that is the line printed on the certificate.
do $$
declare v_p uuid; v_prog uuid;
begin
  perform t23_be('23aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  v_p := lms_create_path('T23 Path', '');
  perform lms_set_path_details(p_path => v_p,
    p_certificate_name => 'Advanced Certificate in T23 Things');
  reset role;
  select programme_id into v_prog from lms_paths where id = v_p;
  perform t23_say('5j a path certificate name follows too',
    (select pr.title from programmes pr where pr.id = v_prog),
    'Advanced Certificate in T23 Things');
exception when others then
  reset role;
  perform t23_say('5j a path certificate name follows too', 'error: ' || left(sqlerrm, 44),
    'Advanced Certificate in T23 Things');
end $$;

-- ---------------------------------------------------------------------
-- 6. The helper, and who may reach it
-- ---------------------------------------------------------------------
do $$ begin
  perform t23_say('6a the helper exists',
    case when to_regprocedure('public.lms_programme_title_follows(uuid, text)') is null
         then 'missing' else 'yes' end, 'yes');
  -- GUARDED BY to_regprocedure FIRST. has_function_privilege RAISES on
  -- a function that does not exist, rather than answering false, so on a
  -- database without file 23 this killed the file instead of reporting.
  -- File 18's verify had the identical fault.
  perform t23_say('6b and no browser can reach it',
    case when to_regprocedure('public.lms_programme_title_follows(uuid, text)') is null
         then 'missing'
         when has_function_privilege('anon', 'lms_programme_title_follows(uuid, text)', 'EXECUTE')
           or has_function_privilege('authenticated', 'lms_programme_title_follows(uuid, text)', 'EXECUTE')
         then 'REACHABLE' else 'shut' end, 'shut');
  perform t23_say('6c both save functions ask it, not just the course one',
    (select case when c.src like '%lms_programme_title_follows%'
                  and p.src like '%lms_programme_title_follows%'
                 then 'both' else 'NOT BOTH' end
       from (select regexp_replace(pg_get_functiondef(pr.oid), '--[^' || chr(10) || ']*', '', 'g') as src
               from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
              where n.nspname = 'public' and pr.proname = 'lms_set_course_details') c,
            (select regexp_replace(pg_get_functiondef(pr.oid), '--[^' || chr(10) || ']*', '', 'g') as src
               from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
              where n.nspname = 'public' and pr.proname = 'lms_set_path_details') p),
    'both');
  perform t23_say('6d the builder is told what the certificate says',
    (select case when regexp_replace(pg_get_functiondef(pr.oid), '--[^' || chr(10) || ']*', '', 'g')
                      like '%certificate_title%' then 'yes' else 'NO' end
       from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
      where n.nspname = 'public' and pr.proname = 'lms_studio_course'), 'yes');
end $$;

-- ---------------------------------------------------------------------
-- 7. And nothing issued was touched by any of it
-- ---------------------------------------------------------------------
do $$ begin
  perform t23_say('7a the certificate issued in section 5 is still there, unrevoked',
    (select certificate_number || '/' || revoked::text from certificates
      where certificate_number = 'T23P-2026-GEN-AAAAAA'), 'T23P-2026-GEN-AAAAAA/false');
  perform t23_say('7b and the revoked one is still revoked',
    (select revoked::text from certificates where certificate_number = 'T23REV-2026-GEN-BBBBBB'),
    'true');
end $$;

-- ------------------------------------------------------------- results
\pset tuples_only off
\pset format aligned
select n as "#", label as "what was checked",
       case when got is not distinct from want then 'pass' else 'FAIL' end as "result",
       got as "got", want as "wanted"
  from t23_out order by n;

select case when count(*) = 0 then 'ALL PASS'
            else count(*) || ' FAILED' end as "summary"
  from t23_out where got is distinct from want;

rollback;
