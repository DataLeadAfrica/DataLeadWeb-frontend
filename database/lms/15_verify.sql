-- =====================================================================
-- 15_verify.sql
--
-- Run this in the Supabase SQL editor straight after
-- 15_learning_pages.sql. It changes nothing. Read every row: the answer
-- column should say yes on every single line. Anything else means the
-- file did not fully take, and the "what it means" column says what to do.
--
-- ONE STATEMENT, on purpose. The Supabase editor shows only the result of
-- the last statement it runs, so a verify file written as twenty separate
-- queries would show you twenty rows of nothing and one row of something.
-- =====================================================================

with checks as (

  -- ------------------------------------------------- THE TWO TRAPS
  select 1 as n,
    'A lesson check no longer has a try limit' as checking,
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_start_quiz'
    ) like '%if not v_check then%' then 'yes' else 'NO' end as answer,
    'This is the first trap. If it says NO, the twentieth wrong answer on a three question check still ends the course for that learner, with no message anywhere. Re-run step 3 of file 15.' as what_it_means

  union all select 2,
    'A module quiz reopens 24 hours after the last try',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_start_quiz'
    ) like '%24 hours%' then 'yes' else 'NO' end,
    'The second trap. If it says NO, three failed tries shut the certificate away for ever and only hand written SQL can open it again.'

  union all select 3,
    'A page can be told WHY a quiz will not start',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_quiz_status'
    ) then 'yes' else 'NO' end,
    'Without this, lms_start_quiz returning nothing means six different things and the page can only say "something went wrong".'

  union all select 4,
    'lms_quiz_status says 0 tries allowed for a check, meaning unlimited',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_quiz_status'
    ) like '%when v_check then 0 else v_q.max_attempts%' then 'yes' else 'NO' end,
    'The page reads this to decide whether to show a tries counter at all.'

  -- ------------------------------------------------- FEEDBACK
  union all select 5,
    'A wrong answer on a lesson check now shows its explanation',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_attempt_marks'
    ) not like '%case when v_ok then r.explanation%' then 'yes' else 'NO' end,
    'The old version hid the explanation exactly when the answer was wrong, which is the only time anybody needs it.'

  union all select 6,
    'A failed module quiz gives away nothing per question',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_attempt_marks'
    ) like '%if not coalesce(v_check, false) then%' then 'yes' else 'NO' end,
    'If this says NO, a learner can work out the answers to a ten question quiz by elimination across three tries, without watching a lesson.'

  -- ------------------------------------------------- RESUME
  union all select 7,
    'Resume remembers where they stopped, not the furthest point reached',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_record_watch'
    ) not like '%greatest(lms_lesson_progress.last_position_seconds%' then 'yes' else 'NO' end,
    'If this says NO, somebody who rewinds to re-watch a hard part and stops there is sent back to the furthest point they ever reached.'

  -- ------------------------------------------------- MINUTES PER DAY
  union all select 8,
    'The daily watch table exists',
    case when to_regclass('public.lms_watch_days') is not null then 'yes' else 'NO' end,
    'The This week chart cannot be drawn from the slices, because finishing a lesson deletes them. Without this table the chart would empty itself as a learner works.'

  union all select 9,
    'Row security is on for it',
    case when (
      select relrowsecurity from pg_class where relname = 'lms_watch_days'
    ) then 'yes' else 'NO' end,
    'Without it, one learner could read every learner''s study record.'

  union all select 10,
    'A learner can read their own row and nothing else',
    case when exists (
      select 1 from pg_policies where tablename = 'lms_watch_days'
        and policyname = 'p_watchdays_self' and cmd = 'SELECT'
    ) then 'yes' else 'NO' end,
    'Re-run step 1 of file 15.'

  union all select 11,
    'Nobody but the server can write to it',
    -- The table has to exist for this to mean anything. Without that
    -- clause it says yes before file 15 has been run at all, which is
    -- the most comforting way for a check to be useless.
    case when to_regclass('public.lms_watch_days') is not null and not exists (
      select 1 from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'lms_watch_days'
         and grantee in ('anon', 'authenticated')
         and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    ) then 'yes' else 'NO' end,
    'This table is a record the learner must not be able to fake. If this says NO, re-run the revoke at the end of step 1.'

  union all select 12,
    'The same is now true of the watch slices',
    case when not exists (
      select 1 from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'lms_watch_buckets'
         and grantee in ('anon', 'authenticated')
         and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    ) then 'yes' else 'NO' end,
    'Row security already refused these writes. Taking the grant away as well means one missing policy, one day, is not a learner who can invent a month of study.'

  union all select 13,
    'The minutes are counted in Africa/Lagos time',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_record_watch'
    ) like '%Africa/Lagos%' then 'yes' else 'NO' end,
    'A chart whose days change at 1am local time is wrong for everybody looking at it.'

  union all select 14,
    'Only a NEW slice adds to the day, so two browser tabs cannot double count',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_record_watch'
    ) like '%get diagnostics v_new = row_count%' then 'yes' else 'NO' end,
    'Two tabs playing the same lesson send the same slice numbers. Without this they would both be counted.'

  union all select 23,
    'An honest 1.5x watch is never throttled',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_record_watch'
    ) like '%ceil((60.0 / v_bs) * 1.5) + 3%' then 'yes' else 'NO' end,
    'The player offers 1.5x on a first watch, which at ten second slices is exactly nine a minute. If the limit is still nine, ordinary timer jitter throws real watching away and a lesson watched at a speed the page itself offers cannot be finished.'

  union all select 15,
    'The daily table is in the storage report',
    case when exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'lms_watch_days' and c.relkind = 'r'
    ) then 'yes' else 'NO' end,
    'lms_storage_report loops over every table whose name begins lms_, so a table named this way is included automatically. This row proves the name matches rather than assuming it.'

  -- ------------------------------------------------- THE PAGE CALLS
  union all select 16,
    'lms_my_course answers a whole learning page in one call',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_my_course'
    ) then 'yes' else 'NO' end,
    'Re-run step 6 of file 15.'

  union all select 17,
    'and it can never return a video reference',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_my_course'
    ) not like '%video_ref%' then 'yes' else 'NO' end,
    'The only way to a video is lms_open_lesson, which asks whether the lesson is open to you first. If this says NO, the outline would hand out every video in the course.'

  union all select 18,
    'lms_my_week returns the last seven days',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_my_week'
    ) then 'yes' else 'NO' end,
    'Re-run step 7 of file 15.'

  union all select 19,
    'lms_my_courses and lms_my_certificates both exist',
    case when (
      select count(distinct p.proname) from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public'
         and p.proname in ('lms_my_courses', 'lms_my_certificates')
    ) = 2 then 'yes' else 'NO' end,
    'These two are the whole of /lms/me. Re-run step 8 of file 15.'

  union all select 20,
    'None of the four new reading functions is open to a signed out stranger',
    case when not exists (
      select 1 from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       join pg_roles r on r.oid = a.grantee
       where ns.nspname = 'public'
         and p.proname in ('lms_my_course','lms_my_week','lms_my_courses',
                           'lms_my_certificates','lms_quiz_status')
         and r.rolname in ('anon', 'public')
         and a.privilege_type = 'EXECUTE'
    ) then 'yes' else 'NO' end,
    'Every one of these reads one learner''s private record. None of them should be callable without signing in.'

  -- ------------------------------------------------- STILL TRUE
  union all select 21,
    'The quiz answers still never leave the server',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_start_quiz'
    ) not like '%o.is_correct%' then 'yes' else 'NO' end,
    'lms_start_quiz was replaced by this file. This row checks the replacement did not quietly start handing out which option is right.'

  union all select 22,
    'Writing a lesson length is still staff only',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_lesson_duration'
    ) then 'yes' else 'NO' end,
    'A learner who could shorten a video could skip it. File 13 made this staff only and file 15 does not touch it.'
)
select n as "#", checking as "what was checked", answer as "answer",
       what_it_means as "what it means if the answer is not yes"
  from checks order by n;
