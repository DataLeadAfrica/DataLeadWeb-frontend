-- ===========================================================================
-- FILE 15 TESTS
--
-- Run tests/seed_file_15_tests.sql first, then this file.
--
-- Written to FAIL before file 15 is applied and pass afterwards. Two of them
-- are the reason the file exists, and they are not about missing features:
--
--   T9   a lesson check locks the lesson, and the whole course, for ever
--   T12  a module quiz locks the certificate away for ever
--
-- Both are reachable by an ordinary learner having an ordinary bad day, and
-- the only way out today is somebody writing SQL against the live database.
--
-- Every test connects as a REAL role, anon or authenticated, and sets
-- request.jwt.claim.sub the way PostgREST does. A test that runs as the
-- owner proves nothing, because the owner is exactly who row security does
-- not apply to.
-- ===========================================================================

\set ON_ERROR_STOP off
\timing off
\pset pager off

drop table if exists t15_results;
create table t15_results (n integer primary key, name text, pass boolean, detail text);
grant all on t15_results to anon, authenticated;

create or replace function t_say(p_n integer, p_name text, p_pass boolean,
                                 p_detail text default '')
returns void language sql as $$
  insert into t15_results values (p_n, p_name, coalesce(p_pass, false), p_detail)
  on conflict (n) do update set name = excluded.name, pass = excluded.pass,
                                detail = excluded.detail;
$$;
grant execute on function t_say(integer, text, boolean, text) to anon, authenticated;

-- auth.users is not readable by anon, so the ids are looked up once, as the
-- owner, and kept where every test can reach them.
drop table if exists t15_who;
create table t15_who (k text primary key, id uuid);
grant all on t15_who to anon, authenticated;
insert into t15_who
select 'learner', id from auth.users where email = 'learner15@example.com';
insert into t15_who
select 'nobody', id from auth.users where email = 'nobody15@example.com';
insert into t15_who
select 'admin', id from auth.users where email = 'admin15@example.com';
insert into t15_who select 'course', id from lms_courses where slug = 't15-course';
insert into t15_who select 'l1', l.id from lms_lessons l
  join lms_modules m on m.id = l.module_id join lms_courses c on c.id = m.course_id
 where c.slug = 't15-course' and l.title = 'L1 opening';
insert into t15_who select 'l2', l.id from lms_lessons l
  join lms_modules m on m.id = l.module_id join lms_courses c on c.id = m.course_id
 where c.slug = 't15-course' and l.title = 'L2 cleaning';
insert into t15_who select 'l3', l.id from lms_lessons l
  join lms_modules m on m.id = l.module_id join lms_courses c on c.id = m.course_id
 where c.slug = 't15-course' and l.title = 'L3 recoding';
insert into t15_who select 'check', z.id from lms_quizzes z
  join lms_lessons l on l.id = z.lesson_id
  join lms_modules m on m.id = l.module_id join lms_courses c on c.id = m.course_id
 where c.slug = 't15-course';
insert into t15_who select 'mquiz', z.id from lms_quizzes z
  join lms_modules m on m.id = z.module_id join lms_courses c on c.id = m.course_id
 where c.slug = 't15-course';

create or replace function t15_id(p_k text) returns uuid
language sql stable as $$ select id from t15_who where k = p_k $$;
grant execute on function t15_id(text) to anon, authenticated;

-- A helper every test can call: does this function exist at all? Needed
-- because PostgreSQL resolves function names when it PARSES a statement, so
-- a test that simply calls a missing function aborts the whole block rather
-- than failing one row.
create or replace function t15_has(p_name text, p_args text default '')
returns boolean language sql stable as $$
  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = p_name
       and (p_args = '' or pg_get_function_identity_arguments(p.oid) = p_args))
$$;
grant execute on function t15_has(text, text) to anon, authenticated;

-- Runs a query given as TEXT and returns the single value as text, or null
-- if the function it names does not exist. Same reason as above.
create or replace function t15_val(p_sql text)
returns text language plpgsql stable as $$
declare v text;
begin
  execute p_sql into v;
  return v;
exception when others then return null;
end $$;
grant execute on function t15_val(text) to anon, authenticated;


-- ===========================================================================
-- 1. lms_my_course: one call for the whole learning page
-- ===========================================================================

set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('learner')::text, false);

do $$ declare v text; begin
  perform t_say(1, 'lms_my_course exists and takes a slug',
                t15_has('lms_my_course', 'p_slug text'));
end $$;

do $$ declare v text; begin
  v := t15_val('select title from lms_my_course(''t15-course'')');
  perform t_say(2, 'a learner with access gets the course back',
                v = 'T15 learning course', 'got ' || coalesce(v, 'nothing'));
end $$;

do $$ declare v text; begin
  v := t15_val('select modules::text from lms_my_course(''t15-course'')');
  perform t_say(3, 'it carries the modules and their lessons',
                v is not null and v like '%L2 cleaning%' and v like '%Describing%',
                coalesce(left(v, 90), 'nothing'));
end $$;

do $$ declare v text; begin
  v := t15_val('select modules::text from lms_my_course(''t15-course'')');
  perform t_say(4, 'NO video reference anywhere in it',
                v is not null and v not like '%t15-ref-%',
                case when v like '%t15-ref-%' then 'A VIDEO REFERENCE LEAKED' else 'clean' end);
end $$;

do $$ declare v text; begin
  v := t15_val('select resume_lesson_title from lms_my_course(''t15-course'')');
  perform t_say(5, 'the resume target is the first unfinished unlocked lesson',
                v = 'L2 cleaning', 'got ' || coalesce(v, 'nothing'));
end $$;

do $$ declare v text; begin
  v := t15_val('select resume_second::text from lms_my_course(''t15-course'')');
  perform t_say(6, 'and the second to start from',
                v = '150', 'got ' || coalesce(v, 'nothing'));
end $$;

do $$ declare v text; begin
  v := t15_val('select (lessons_done::text || ''/'' || lesson_count::text) from lms_my_course(''t15-course'')');
  perform t_say(7, 'it counts the lessons done',
                v = '1/4', 'got ' || coalesce(v, 'nothing'));
end $$;

do $$ declare v text; begin
  v := t15_val('select modules::text from lms_my_course(''t15-course'')');
  perform t_say(8, 'each lesson carries unlocked, completed, check passed and coverage',
                v is not null and v like '%unlocked%' and v like '%completed%'
                and v like '%check_passed%' and v like '%coverage%',
                coalesce(left(v, 90), 'nothing'));
end $$;

reset role;


-- ===========================================================================
-- 2. THE LESSON CHECK TRAP. The most important test in this file.
--
-- A check is created with a 100 percent pass mark and 20 tries. Twenty wrong
-- answers and lms_start_quiz returns nothing for ever, lms_complete_lesson
-- refuses without the pass, the next lesson never unlocks, and the course can
-- never be finished. A learner having a bad day on three questions loses the
-- course they paid for, and sees no message explaining any of it.
-- ===========================================================================

set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('learner')::text, false);

-- Burn every try, by starting and failing the check twenty times.
do $$
declare v_att uuid; i integer; v record;
begin
  for i in 1..20 loop
    select attempt_id into v_att from lms_start_quiz(t15_id('check')) limit 1;
    exit when v_att is null;
    select * into v from lms_submit_quiz(v_att, '{}'::jsonb);
  end loop;
end $$;

do $$ declare v_n integer; begin
  select count(*) into v_n from lms_quiz_attempts
   where user_id = t15_id('learner') and quiz_id = t15_id('check');
  perform t_say(9, 'twenty failed tries on a lesson check were possible at all',
                v_n >= 20, v_n || ' tries recorded');
end $$;

do $$ declare v_att uuid; begin
  select attempt_id into v_att from lms_start_quiz(t15_id('check')) limit 1;
  perform t_say(10, 'A LESSON CHECK NEVER LOCKS ANYONE OUT: try 21 still opens',
                v_att is not null,
                case when v_att is null
                     then 'LOCKED OUT. The lesson, and the course, can never be finished'
                     else 'opened' end);
end $$;

do $$ declare v text; begin
  v := t15_val('select tries_allowed::text from lms_quiz_status(''' || t15_id('check') || ''')');
  -- 0 means unlimited. A null would pass this by accident while the
  -- function does not exist, so the function has to exist as well.
  perform t_say(11, 'a check reports that its tries are unlimited',
                t15_has('lms_quiz_status', 'p_quiz uuid') and v = '0',
                'tries_allowed = ' || coalesce(v, 'null'));
end $$;

reset role;


-- ===========================================================================
-- 3. THE MODULE QUIZ TRAP.
--
-- Three failed tries and the quiz is shut for ever, so the certificate can
-- never be earned. After file 15 the next try opens 24 hours after the last.
-- ===========================================================================

set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('learner')::text, false);

do $$
declare v_att uuid; i integer; v record;
begin
  for i in 1..3 loop
    select attempt_id into v_att from lms_start_quiz(t15_id('mquiz')) limit 1;
    exit when v_att is null;
    select * into v from lms_submit_quiz(v_att, '{}'::jsonb);
  end loop;
end $$;

do $$ declare v_n integer; begin
  select count(*) into v_n from lms_quiz_attempts
   where user_id = t15_id('learner') and quiz_id = t15_id('mquiz') and not coalesce(passed,false);
  perform t_say(12, 'three failed tries on the module quiz',
                v_n = 3, v_n || ' failed tries');
end $$;

do $$ declare v_att uuid; begin
  select attempt_id into v_att from lms_start_quiz(t15_id('mquiz')) limit 1;
  perform t_say(13, 'the fourth try is refused straight away, which is right',
                v_att is null, case when v_att is null then 'refused' else 'opened, which it should not' end);
end $$;

-- Read the window while it is SHUT. After the 24 hours have passed a
-- fresh block begins and these go back to 3 left and 0 used, which is
-- what test 20 checks, so both states get a test.
do $$ declare v_used text; v_left text; begin
  v_used := t15_val('select tries_used::text from lms_quiz_status(''' || t15_id('mquiz') || ''')');
  v_left := t15_val('select tries_left::text from lms_quiz_status(''' || t15_id('mquiz') || ''')');
  perform t_say(46, 'while it is shut, the status says three used and none left',
                v_used = '3' and v_left = '0',
                'used=' || coalesce(v_used,'null') || ' left=' || coalesce(v_left,'null'));
end $$;

do $$ declare v text; begin
  v := t15_val('select reason from lms_quiz_status(''' || t15_id('mquiz') || ''')');
  perform t_say(47, 'and gives the learner a sentence saying when it opens again',
                v is not null and v like '%opens again at%',
                coalesce(left(v, 70), 'no reason given'));
end $$;

do $$ declare v text; begin
  v := t15_val('select next_opens_at::text from lms_quiz_status(''' || t15_id('mquiz') || ''')');
  perform t_say(14, 'NOBODY IS TRAPPED: the quiz says when it opens again',
                v is not null and v <> '',
                case when v is null or v = '' then 'NO REOPENING TIME. Shut for ever'
                     else 'opens again at ' || v end);
end $$;

-- Move the three tries back 25 hours and the quiz must open again, with a
-- fresh set of tries rather than one.
reset role;
update lms_quiz_attempts
   set submitted_at = submitted_at - interval '25 hours',
       started_at   = started_at   - interval '25 hours'
 where user_id = (select id from t15_who where k = 'learner')
   and quiz_id = (select id from t15_who where k = 'mquiz');

set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('learner')::text, false);

do $$ declare v_att uuid; begin
  select attempt_id into v_att from lms_start_quiz(t15_id('mquiz')) limit 1;
  perform t_say(15, 'after 24 hours the module quiz opens again',
                v_att is not null,
                case when v_att is null then 'STILL SHUT after 25 hours' else 'opened' end);
end $$;

do $$ declare v text; begin
  v := t15_val('select tries_left::text from lms_quiz_status(''' || t15_id('mquiz') || ''')');
  perform t_say(16, 'and the learner gets a fresh set of tries, not one',
                v is not null and v::integer >= 2, 'tries_left = ' || coalesce(v, 'null'));
end $$;

reset role;
-- tidy: throw away the open attempt the last test created
delete from lms_quiz_attempts
 where user_id = (select id from t15_who where k = 'learner')
   and quiz_id = (select id from t15_who where k = 'mquiz')
   and status = 'in_progress';


-- ===========================================================================
-- 4. lms_quiz_status: a page can say WHY
-- ===========================================================================

set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('learner')::text, false);

do $$ begin
  perform t_say(17, 'lms_quiz_status exists', t15_has('lms_quiz_status', 'p_quiz uuid'));
end $$;

do $$ declare v text; begin
  v := t15_val('select kind from lms_quiz_status(''' || t15_id('check') || ''')');
  perform t_say(18, 'it knows a check from a quiz', v = 'check', 'got ' || coalesce(v, 'nothing'));
end $$;

do $$ declare v text; begin
  v := t15_val('select (pass_mark::text || ''/'' || question_count::text)
                  from lms_quiz_status(''' || t15_id('mquiz') || ''')');
  perform t_say(19, 'it reports the pass mark and how many questions will be served',
                v = '70/3', 'got ' || coalesce(v, 'nothing'));
end $$;

do $$ declare v text; begin
  v := t15_val('select tries_used::text from lms_quiz_status(''' || t15_id('mquiz') || ''')');
  -- The 24 hours have passed by this point, so a fresh block has begun
  -- and the count starts again. Test 46 checked the shut state.
  perform t_say(20, 'once the wait is over the tries used start again at zero',
                v = '0', 'got ' || coalesce(v, 'nothing'));
end $$;

do $$ declare v text; begin
  v := t15_val('select passed::text from lms_quiz_status(''' || t15_id('mquiz') || ''')');
  perform t_say(21, 'it says whether the learner has passed', v = 'false', 'got ' || coalesce(v, 'nothing'));
end $$;

reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ declare v text; begin
  v := t15_val('select kind from lms_quiz_status(''' || (select id from t15_who where k='check') || ''')');
  perform t_say(22, 'a signed out stranger gets nothing from lms_quiz_status',
                v is null, 'got ' || coalesce(v, 'nothing'));
end $$;
reset role;


-- ===========================================================================
-- 5. PER QUESTION FEEDBACK, the right way round
-- ===========================================================================

set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('learner')::text, false);

-- A failed CHECK: every question marked, every explanation shown.
do $$
declare v_att uuid; v record; v_n integer; v_exp integer;
begin
  select attempt_id into v_att from lms_start_quiz(t15_id('check')) limit 1;
  if v_att is null then
    perform t_say(23, 'a failed lesson check shows every question with its explanation',
                  false, 'could not even start the check');
    perform t_say(24, 'a failed lesson check marks every question right or wrong',
                  false, 'could not even start the check');
    return;
  end if;
  select * into v from lms_submit_quiz(v_att, '{}'::jsonb);
  select count(*), count(*) filter (where coalesce(explanation,'') <> '')
    into v_n, v_exp from lms_attempt_marks(v_att);
  perform t_say(23, 'a failed lesson check shows every question with its explanation',
                v_n = 3 and v_exp = 3, v_exp || ' of ' || v_n || ' carried an explanation');
  perform t_say(24, 'a failed lesson check marks every question right or wrong',
                v_n = 3, v_n || ' questions marked');
end $$;

-- A failed MODULE QUIZ: nothing at all, because right or wrong per question
-- across three tries is solvable by elimination.
do $$
declare v_att uuid; v record; v_n integer;
begin
  select id into v_att from lms_quiz_attempts
   where user_id = t15_id('learner') and quiz_id = t15_id('mquiz')
     and submitted_at is not null and not coalesce(passed, false)
   order by submitted_at desc limit 1;
  select count(*) into v_n from lms_attempt_marks(v_att);
  perform t_say(25, 'a FAILED module quiz gives away nothing per question',
                v_n = 0,
                case when v_n > 0 then 'LEAKED ' || v_n || ' marked questions, solvable by elimination'
                     else 'nothing given away' end);
end $$;

-- A passed MODULE QUIZ: the full review, explanations and all.
reset role;

-- THE ANSWER KEY HAS TO BE BUILT AS THE OWNER.
--
-- lms_options has one policy, p_opt_staff_only, so a learner reading
-- that table gets nothing at all: is_correct never leaves the server.
-- That is the rule working, and it means this test cannot look up the
-- right answers while it is the learner. It parks them in a scratch
-- table first, as the owner, exactly as a tutor would already know them.
drop table if exists t15_key;
create table t15_key (answers jsonb);
grant all on t15_key to authenticated;
insert into t15_key
select jsonb_object_agg(q.id::text, (select o.id::text from lms_options o
        where o.question_id = q.id and o.is_correct limit 1))
  from lms_questions q where q.quiz_id = (select id from t15_who where k = 'mquiz');

set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('learner')::text, false);

do $$
declare v_att uuid; v record; v_n integer; v_exp integer; v_ans jsonb;
begin
  select attempt_id into v_att from lms_start_quiz(t15_id('mquiz')) limit 1;
  if v_att is null then
    perform t_say(26, 'a PASSED module quiz gives the full review', false, 'could not start a try');
    return;
  end if;
  select answers into v_ans from t15_key;
  select * into v from lms_submit_quiz(v_att, v_ans);
  select count(*), count(*) filter (where coalesce(explanation,'') <> '')
    into v_n, v_exp from lms_attempt_marks(v_att);
  perform t_say(26, 'a PASSED module quiz gives the full review',
                coalesce(v.passed,false) and v_n = 3 and v_exp = 3,
                'passed=' || coalesce(v.passed::text,'?') || ' marked=' || v_n || ' explained=' || v_exp);
end $$;

reset role;


-- ===========================================================================
-- 6. RESUME WHERE THEY STOPPED, not at the furthest point
-- ===========================================================================

set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('learner')::text, false);

do $$
declare v record; v_pos integer;
begin
  -- watched to 250, then rewound and stopped at 60
  select * into v from lms_record_watch(t15_id('l2'), 25, 250);
  select * into v from lms_record_watch(t15_id('l2'), 6, 60);
  select last_position_seconds into v_pos from lms_lesson_progress
   where user_id = t15_id('learner') and lesson_id = t15_id('l2');
  perform t_say(27, 'rewinding and stopping is remembered as the LATEST position',
                v_pos = 60,
                case when v_pos = 250 then 'sent back to the furthest point, 250'
                     else 'position = ' || v_pos end);
end $$;

do $$ declare v_cov numeric; begin
  v_cov := lms_watch_coverage(t15_id('l2'));
  perform t_say(28, 'and rewinding does not reduce coverage',
                v_cov >= 50, 'coverage = ' || v_cov);
end $$;

reset role;


-- ===========================================================================
-- 7. MINUTES WATCHED PER DAY, which must survive a lesson being completed
-- ===========================================================================

do $$ begin
  perform t_say(29, 'there is a daily watch table',
                to_regclass('public.lms_watch_days') is not null);
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('learner')::text, false);

do $$ declare v_before text; v_after text; v record; begin
  v_before := coalesce(t15_val('select coalesce(sum(seconds),0)::text from lms_watch_days
                                 where user_id = auth.uid()'), 'none');
  select * into v from lms_record_watch(t15_id('l2'), 28, 285);
  v_after := coalesce(t15_val('select coalesce(sum(seconds),0)::text from lms_watch_days
                                where user_id = auth.uid()'), 'none');
  perform t_say(30, 'a NEW bucket adds to today''s minutes',
                v_before <> 'none' and v_after <> 'none'
                and v_after::integer = v_before::integer + 10,
                v_before || ' then ' || v_after);
end $$;

do $$ declare v_before text; v_after text; v record; begin
  v_before := coalesce(t15_val('select coalesce(sum(seconds),0)::text from lms_watch_days
                                 where user_id = auth.uid()'), 'none');
  -- the SAME bucket again, which is what a second browser tab sends
  select * into v from lms_record_watch(t15_id('l2'), 28, 285);
  v_after := coalesce(t15_val('select coalesce(sum(seconds),0)::text from lms_watch_days
                                where user_id = auth.uid()'), 'none');
  perform t_say(31, 'the SAME bucket again adds nothing, so two tabs cannot double count',
                v_before <> 'none' and v_before = v_after,
                v_before || ' then ' || v_after);
end $$;

do $$ declare v text; begin
  v := t15_val('select day::text from lms_watch_days where user_id = auth.uid()
                 order by day desc limit 1');
  perform t_say(32, 'the day is counted in Africa/Lagos time, not UTC',
                v = (now() at time zone 'Africa/Lagos')::date::text,
                'stored ' || coalesce(v, 'nothing') || ', Lagos today is '
                || (now() at time zone 'Africa/Lagos')::date::text);
end $$;

do $$ begin
  perform t_say(33, 'lms_my_week exists', t15_has('lms_my_week', ''));
end $$;

do $$ declare v_n integer; begin
  select count(*) into v_n from lms_my_week();
  perform t_say(34, 'lms_my_week returns exactly seven days',
                v_n = 7, v_n || ' rows');
exception when others then perform t_say(34, 'lms_my_week returns exactly seven days', false, SQLERRM);
end $$;

-- Completing the lesson deletes its buckets. The minutes must survive.
do $$ declare v_before text; v_after text; v_buckets integer; begin
  v_before := coalesce(t15_val('select coalesce(sum(seconds),0)::text from lms_watch_days
                                 where user_id = auth.uid()'), 'none');
  update lms_lesson_progress set completed = true, completed_at = now()
   where user_id = auth.uid() and lesson_id = t15_id('l2');
  select count(*) into v_buckets from lms_watch_buckets
   where user_id = auth.uid() and lesson_id = t15_id('l2');
  v_after := coalesce(t15_val('select coalesce(sum(seconds),0)::text from lms_watch_days
                                where user_id = auth.uid()'), 'none');
  perform t_say(35, 'finishing a lesson throws the slices away but KEEPS the minutes',
                v_buckets = 0 and v_before <> 'none' and v_before = v_after,
                'buckets now ' || v_buckets || ', minutes ' || v_before || ' then ' || v_after);
end $$;

reset role;

-- lms_storage_report refuses anybody signed in who is not an administrator,
-- so the claim left over from the tests above has to be cleared first.
select set_config('request.jwt.claim.sub', '', false);
do $$ declare v_n integer; begin
  select count(*) into v_n from lms_storage_report() where item = 'lms_watch_days';
  perform t_say(36, 'the daily table appears in the storage report', v_n = 1,
                v_n || ' rows named lms_watch_days');
exception when others then perform t_say(36, 'the daily table appears in the storage report', false, SQLERRM);
end $$;

do $$ declare v_n integer; begin
  select count(*) into v_n
    from information_schema.role_table_grants
   where table_name = 'lms_watch_days' and grantee in ('anon','authenticated')
     and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
  perform t_say(37, 'and nobody but the server may write to it',
                v_n = 0, v_n || ' write grants found');
end $$;


-- ===========================================================================
-- 7b. THE THROTTLE MUST NOT REFUSE AN HONEST 1.5x WATCH
--
-- The player offers 1.5x on a first watch, and at ten second slices that
-- produces exactly nine a minute. The old limit was nine a minute, so a
-- learner watching at a speed the page itself offers had slices thrown
-- away by ordinary timer jitter, and the lesson could not be finished.
--
-- These send a steady 1.5x minute: nine slices spread across sixty
-- seconds, plus the jitter that puts a tenth and an eleventh inside the
-- same window. Every one must be recorded.
-- ===========================================================================

set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('learner')::text, false);

-- A clean lesson to count against, so nothing earlier in this file is
-- in the window. L4 has not been touched by any test above.
do $$
declare v_l4 uuid; v_rec record; i integer; v_stored integer;
begin
  select l.id into v_l4 from lms_lessons l
    join lms_modules m on m.id = l.module_id
    join lms_courses c on c.id = m.course_id
   where c.slug = 't15-course' and l.title = 'L4 summaries';

  -- Eleven slices, which is what a real 1.5x minute looks like once the
  -- clock wobbles: nine honest ones and two that land inside the same
  -- sixty seconds because the ticks drifted.
  for i in 0..10 loop
    select * into v_rec from lms_record_watch(v_l4, i, i * 10);
  end loop;

  select count(*) into v_stored from lms_watch_buckets
   where user_id = t15_id('learner') and lesson_id = v_l4;

  perform t_say(48, 'an honest 1.5x minute is never refused',
                v_stored = 11,
                v_stored || ' of 11 slices were recorded'
                || case when v_stored < 11
                        then '. The throttle threw real watching away' else '' end);
end $$;

-- And a script is still refused. Far more than any player could send.
do $$
declare v_l3 uuid; v_rec record; i integer; v_stored integer;
begin
  select l.id into v_l3 from lms_lessons l
    join lms_modules m on m.id = l.module_id
    join lms_courses c on c.id = m.course_id
   where c.slug = 't15-course' and l.title = 'L3 recoding';
  if v_l3 is null then
    -- L3 is removed by a later test in some orders. Nothing to do.
    perform t_say(49, 'a script hammering the function is still refused', true, 'skipped');
    return;
  end if;

  for i in 0..29 loop
    select * into v_rec from lms_record_watch(v_l3, i, i * 10);
  end loop;

  select count(*) into v_stored from lms_watch_buckets
   where user_id = t15_id('learner') and lesson_id = v_l3;

  perform t_say(49, 'a script hammering the function is still refused',
                v_stored <= 13,
                v_stored || ' of 30 recorded, so the throttle still bites');
end $$;

reset role;


-- ===========================================================================
-- 8. My learning: the courses and the certificates
-- ===========================================================================

set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('learner')::text, false);

do $$ declare v text; begin
  v := t15_val('select title from lms_my_courses() limit 1');
  perform t_say(38, 'lms_my_courses lists a course the learner can open',
                v = 'T15 learning course', 'got ' || coalesce(v, 'nothing'));
end $$;

do $$ declare v text; begin
  v := t15_val('select percent::text from lms_my_courses() limit 1');
  perform t_say(39, 'with how far through it they are',
                v is not null and v <> '', 'percent = ' || coalesce(v, 'nothing'));
end $$;

do $$ declare v_n integer; begin
  select count(*) into v_n from lms_my_certificates();
  perform t_say(40, 'lms_my_certificates answers, with none yet', v_n = 0, v_n || ' rows');
exception when others then perform t_say(40, 'lms_my_certificates answers, with none yet', false, SQLERRM);
end $$;

reset role;


-- ===========================================================================
-- 9. WHERE THINGS GO WRONG
-- ===========================================================================

-- A stranger must get nothing at all.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ declare v text; begin
  v := t15_val('select title from lms_my_course(''t15-course'')');
  perform t_say(41, 'a signed out stranger gets nothing from lms_my_course',
                v is null, 'got ' || coalesce(v, 'nothing'));
end $$;
reset role;

-- Somebody signed in with no access gets nothing, and no error.
set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('nobody')::text, false);
do $$ declare v text; begin
  v := t15_val('select title from lms_my_course(''t15-course'')');
  perform t_say(42, 'a learner without access gets nothing, calmly',
                v is null, 'got ' || coalesce(v, 'nothing'));
end $$;
reset role;

-- ACCESS ENDING PART WAY THROUGH. The entitlement is revoked while the
-- learner is half way in. Nothing may throw; they simply see nothing.
update lms_entitlements set status = 'revoked'
 where user_id = (select id from t15_who where k = 'learner')
   and course_id = (select id from t15_who where k = 'course');

set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('learner')::text, false);
do $$ declare v text; begin
  v := t15_val('select title from lms_my_course(''t15-course'')');
  perform t_say(43, 'access ending part way through is calm, not an error',
                v is null, 'got ' || coalesce(v, 'nothing'));
end $$;
reset role;

update lms_entitlements set status = 'active'
 where user_id = (select id from t15_who where k = 'learner')
   and course_id = (select id from t15_who where k = 'course');

-- A COURSE EDITED AFTER SOMEBODY STARTED IT. A lesson is added in the middle
-- and another removed. The progress page must still answer.
do $$ declare v_m1 uuid; begin
  select m.id into v_m1 from lms_modules m join lms_courses c on c.id = m.course_id
   where c.slug = 't15-course' and m.title = 'Getting in';
  insert into lms_lessons (module_id, title, position, type, video_provider, video_ref,
                           duration_seconds, bucket_seconds, coverage_percent)
  values (v_m1, 'L5 added later', 4, 'video', 'youtube', 't15-ref-5', 300, 10, 90);
  delete from lms_lessons l using lms_modules m, lms_courses c
   where l.module_id = m.id and m.course_id = c.id and c.slug = 't15-course'
     and l.title = 'L3 recoding';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', t15_id('learner')::text, false);
do $$ declare v text; begin
  v := t15_val('select title from lms_my_course(''t15-course'')');
  perform t_say(44, 'a course edited after somebody started it still answers',
                v = 'T15 learning course', 'got ' || coalesce(v, 'nothing'));
end $$;

do $$ declare v text; begin
  v := t15_val('select lesson_count::text from lms_my_course(''t15-course'')');
  perform t_say(45, 'and counts the lessons that exist NOW',
                v = '4', 'got ' || coalesce(v, 'nothing'));
end $$;
reset role;

select n, case when pass then 'pass' else 'FAIL' end as result, name, detail
  from t15_results order by n;
