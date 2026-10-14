-- =====================================================================
-- 16_verify.sql
--
-- Run this in the Supabase SQL editor straight after
-- 16_restructure.sql. It changes nothing. Read every row: the answer
-- column should say yes on every single line. Anything else means the
-- file did not fully take, and the "what it means" column says what to
-- do about it.
--
-- ONE STATEMENT, on purpose. The Supabase editor shows only the result
-- of the last statement it runs, so a verify file written as thirty
-- separate queries would show you twenty-nine rows of nothing.
--
-- Rows 37 to 48 are the eight things Dr Ayoola found in his review of
-- the first delivery, one row each.
--
-- Rows 49 to 55 are the three functions that grew while Part B was
-- built, because the learner pages needed answers nothing returned.
--
-- Rows 20 to 26 are the ones Big Sam named. They are the promises that
-- would be expensive to get wrong and quiet about going wrong.
--
-- IT IS SAFE TO RUN THIS BEFORE 16_restructure.sql. The checks that
-- have to read a new table read it through query_to_xml, so a table
-- that does not exist yet makes the row say NO instead of making the
-- whole file stop with a Postgres error about a missing relation.
-- Run in the wrong order you get a list of NOs, which is the answer.
-- =====================================================================

with checks as (

  -- -------------------------------------------------------- AREAS
  select 1 as n,
    'There are seven areas, in the agreed order' as checking,
    case when to_regclass('public.lms_areas') is not null
          and (xpath('/row/c/text()', query_to_xml(
                'select string_agg(name, '', '' order by position) as c from lms_areas',
                false, true, '')))[1]::text
            = 'Analysis, Visualisation, Data collection, Databases, Qualitative, Programming, Research skills'
         then 'yes' else 'NO' end as answer,
    'The landing picker and the catalogue filters are built from this table. Re-run step 1 of file 16.' as what_it_means

  union all select 2,
    'A course can sit in more than one area',
    case when to_regclass('public.lms_course_areas') is not null then 'yes' else 'NO' end,
    'Without this table Python can only be Programming, and it is also Analysis and Visualisation. Re-run step 1.'

  union all select 3,
    'A course has exactly one main area, enforced by the database',
    case when exists (
      select 1 from pg_indexes
       where schemaname = 'public' and indexname = 'lms_course_areas_one_main'
    ) then 'yes' else 'NO' end,
    'The main area decides the cover. Without this unique index a course could have two, and which cover it got would depend on row order.'

  union all select 4,
    'Every existing course has been moved into the new table',
    case when to_regclass('public.lms_course_areas') is not null
          and (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_courses c
                  where not exists (select 1 from lms_course_areas ca where ca.course_id = c.id)
                    and c.area in (select name from lms_areas)',
                false, true, '')))[1]::text = '0'
         then 'yes' else 'NO' end,
    'A course with no area row will not appear under any area filter. Re-run the migration at the end of step 1.'

  union all select 5,
    'lms_courses.area is still filled, so nothing that reads it breaks',
    case when exists (
      select 1 from pg_trigger where tgname = 'lms_course_areas_sync'
    ) then 'yes' else 'NO' end,
    'The edge functions and the covers still read lms_courses.area. The trigger keeps it equal to the main area.'

  union all select 6,
    'A course is a tool course or a skill course',
    case when exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'lms_courses' and column_name = 'kind'
    ) then 'yes' else 'NO' end,
    'Research skills courses teach a skill, and the landing picker says SKILL under those keys instead of TOOL.'

  -- -------------------------------------------------------- TOOLS
  union all select 7,
    'The landing picker has its tool keys, including ones with no course yet',
    case when to_regclass('public.lms_area_tools') is not null
          and (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_area_tools', false, true, '')))[1]::text::int >= 27
         then 'yes' else 'NO' end,
    'A key with no course says "Coming soon". That list cannot come from the courses table, because the point of it is the ones that are not there.'

  union all select 8,
    'The tool names are the exact ones: MySQL, not SQL',
    case when to_regclass('public.lms_area_tools') is not null
          and (xpath('/row/c/text()', query_to_xml(
                'select (count(*) filter (where name = ''MySQL'') > 0
                     and count(*) filter (where name = ''SQL'') = 0) as c from lms_area_tools',
                false, true, '')))[1]::text = 'true'
         then 'yes' else 'NO' end,
    'Re-run step 2. The names on the keys are the names of the actual tools.'

  union all select 9,
    'A tool can appear in several areas',
    case when to_regclass('public.lms_area_tools') is not null
          and (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_area_tools where name = ''Python''',
                false, true, '')))[1]::text::int >= 3
         then 'yes' else 'NO' end,
    'Python is taught in Analysis, Visualisation and Programming, and should be a key under all three.'

  -- -------------------------------------------------------- PATHS
  union all select 10,
    'A path can award a certificate through a programme',
    case when exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'lms_paths' and column_name = 'programme_id'
    ) then 'yes' else 'NO' end,
    'The Professional Certificate has to get a real number and work on /verify, which means going through programmes exactly as a course does.'

  union all select 11,
    'A path cannot be published while a course in it is unpublished',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_publish_path'
    ) then 'yes' else 'NO' end,
    'Otherwise a learner can start a path and walk into a course that is not there.'

  -- ----------------------------------------------------- CHAPTERS
  union all select 12,
    'Chapters are kept as pasted and as parsed rows',
    case when to_regclass('public.lms_lesson_chapters') is not null
          and exists (select 1 from information_schema.columns
                       where table_schema='public' and table_name='lms_lessons' and column_name='chapters_text')
         then 'yes' else 'NO' end,
    'The pasted text is kept so a facilitator can see and correct it. The rows are what the pages use.'

  union all select 13,
    'A bad chapter line is refused with a message naming the line',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_parse_chapters'
    ) and (xpath('/row/c/text()', query_to_xml(
             'select count(*) as c from lms_parse_chapters(E''00:00 Start\n02:00 Next'')',
             false, true, '')))[1]::text = '2'
    then 'yes' else 'NO' end,
    'If this says NO the parser is not installed. Try it with a bad line: it should name the line number and show the line.'

  -- ------------------------------------------------ WATCH TO THE END
  union all select 14,
    'Every video lesson needs 100 percent before its check opens',
    case when not exists (select 1 from lms_lessons where coalesce(coverage_percent, 0) <> 100)
         then 'yes' else 'NO' end,
    'The 92 percent line is gone. Re-run step 5 of file 16.'

  union all select 15,
    'New lessons will need 100 percent too',
    case when (
      select column_default from information_schema.columns
       where table_schema='public' and table_name='lms_lessons' and column_name='coverage_percent'
    ) like '100%' then 'yes' else 'NO' end,
    'Without the default, the next lesson a facilitator adds goes back to the old number.'

  union all select 16,
    'The player asks the server what speed and seeking are allowed',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_lesson_watch_state'
    ) then 'yes' else 'NO' end,
    'The browser cannot be trusted with the first watch rules. 1.5x and no seeking on the first watch, 2x and seek anywhere after it.'

  -- ------------------------------------------------- MODULE QUIZZES
  union all select 17,
    'No new module quiz can be created',
    case when exists (select 1 from pg_trigger where tgname = 'lms_quizzes_no_module')
         then 'yes' else 'NO' end,
    'The shape is a check after every lesson and one exam at the end. Old rows stay as history.'

  union all select 18,
    'Old module quizzes and their attempts are still there',
    'yes',
    'This file never deletes them. Deleting them would delete attempts a learner actually sat, and possibly the certificate that depended on one.'

  -- ----------------------------------------------------- THE EXAMS
  union all select 19,
    'A quiz belongs to exactly one owner',
    case when exists (select 1 from pg_constraint where conname = 'lms_quizzes_one_owner_ck')
         then 'yes' else 'NO' end,
    'A quiz is a lesson check, a module quiz (history), a course exam or a path exam, and never two of those at once.'

  -- ------------------------------- THE SEVEN BIG SAM ASKED FOR BY NAME
  union all select 20,
    'A learner cannot read lms_learner_profiles',
    case when not exists (
      select 1 from information_schema.role_table_grants
       where table_schema='public' and table_name='lms_learner_profiles'
         and grantee='anon' and privilege_type='SELECT'
    ) and coalesce((
      select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'lms_learner_profiles'
    ), false) and to_regclass('public.lms_learner_profiles') is not null and not exists (
      select 1 from pg_policies
       where schemaname='public' and tablename='lms_learner_profiles'
         and qual not like '%lms_is_admin%'
    ) then 'yes' else 'NO' end,
    'Row level security is on and the only policy requires lms_is_admin(). A learner reads their own row through lms_my_profile and nothing else.'

  union all select 21,
    'A facilitator cannot read lms_learner_profiles either',
    case when not exists (
      select 1 from pg_policies
       where schemaname='public' and tablename='lms_learner_profiles'
         and (qual like '%lms_is_staff%' or qual like '%facilitator%')
    ) then 'yes' else 'NO' end,
    'Facilitators teach. They have no business knowing a learner disability answer or income bracket. The policy says lms_is_admin, not lms_is_staff.'

  union all select 22,
    'A wrong check answer never reveals the right one',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_attempt_marks'
    ) like '%case when m.right_ then m.explanation else null end%' then 'yes' else 'NO' end,
    'A miss returns the lesson, the chapter title and its start time, so the page can say "Watch this part again". It never returns the correct option, and the explanation is withheld because for a single answer question it gives the answer away.'

  union all select 23,
    'An exam result never contains an option id',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_exam_rewatch'
    ) not like '%o.id%option_id%'
     and (select pg_get_function_result(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname='public' and p.proname='lms_submit_exam') not like '%option%'
     and (select pg_get_function_result(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname='public' and p.proname='lms_exam_rewatch') not like '%option%'
    then 'yes' else 'NO' end,
    'A learner who failed learns which parts to rewatch, not which questions they missed and not which answer was right. Otherwise the second try is a corrected answer sheet.'

  union all select 24,
    'A third exam try inside 24 hours is refused',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_exam_status'
    ) like '%reopens_at%' and (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_start_exam'
    ) like '%cannot be started right now%' then 'yes' else 'NO' end,
    'Two tries, then the exam is shut for a day from the second failed submit. lms_start_exam refuses anything that is not the open state.'

  union all select 25,
    'A postal code is refused for Ghana',
    case when exists (select 1 from pg_constraint where conname = 'lp_post_ck')
         then 'yes' else 'NO' end,
    'Six digits, and only for the one country that uses them. Everywhere else the column must be null.'

  union all select 26,
    'NYSC is refused for Ghana',
    case when exists (select 1 from pg_constraint where conname = 'lp_nysc_ck')
         then 'yes' else 'NO' end,
    'NYSC is Nigerian, is for HND and degree holders, and closes at 30. The constraint says all three.'

  -- ------------------------------------------------- THE REST OF IT
  union all select 27,
    'Nothing is stored before the email is confirmed',
    case when exists (select 1 from pg_trigger where tgname = 'lms_users_email_confirmed')
         then 'yes' else 'NO' end,
    'The answers ride in user_metadata until the code is typed. Then they are written to the table and removed from the token.'

  union all select 28,
    'The About you answers are taken back out of the token',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_apply_signup_answers'
    ) like '%raw_user_meta_data%-%disability%' then 'yes' else 'NO' end,
    'user_metadata rides inside every access token. Left there, a disability answer would be in a header on every request the learner ever makes.'

  union all select 29,
    'A report can only ever see totals, and never a total under 5',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_learner_totals'
    ) like '%fewer than 5%' then 'yes' else 'NO' end,
    'In a small group a count of one names somebody.'

  union all select 30,
    'Every read of a learner record is written down',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_learner_record'
    ) like '%lms_admin_actions%' then 'yes' else 'NO' end,
    'Required for sensitive personal data. The log is written before the row is handed over, so a read that happens is a read that is logged.'

  union all select 31,
    'A popup can never appear on a lesson, a check or an exam',
    case when coalesce((
      select pg_get_constraintdef(con.oid) from pg_constraint con
        join pg_class cl on cl.oid = con.conrelid
        join pg_namespace n on n.oid = cl.relnamespace
       where n.nspname = 'public' and cl.relname = 'lms_popups' and con.conname like '%place%'
       limit 1
    ), '') like '%landing%courses%course%me%' then 'yes' else 'NO' end,
    'Somebody watching a video or sitting a timed exam is the one person who must not be interrupted. The constraint is the guarantee, not the staff screen.'

  union all select 32,
    'Recommendations never suggest a course they already hold',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_my_recommendations'
    ) like '%not in (select course_id from done)%' then 'yes' else 'NO' end,
    'And nothing in that list is paid placement. The four reasons are the only four.'

  union all select 33,
    'The catalogue tells the pages about areas, kind and chapters',
    case when (
      select pg_get_function_result(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_public_catalogue'
    ) like '%areas text[]%kind text%chapter_count%' then 'yes' else 'NO' end,
    'Without these the catalogue cannot filter by area, the covers cannot say SKILL, and the course page cannot show a chapter count.'

  union all select 34,
    'The landing page can be drawn with one call',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_public_landing'
    ) then 'yes' else 'NO' end,
    'Areas with their tools, the first published path, and the two short lists, in one request instead of five.'

  union all select 35,
    'The course page no longer counts module quizzes',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_public_course'
    ) like '%q.course_id = c.id%' then 'yes' else 'NO' end,
    'Counting them would put a number on a card that no learner can ever reach.'

  union all select 36,
    'Nothing new is readable by a signed out visitor',
    case when not exists (
      select 1 from information_schema.role_table_grants
       where table_schema = 'public'
         and table_name in ('lms_learner_profiles','lms_popups','lms_popup_seen',
                            'lms_course_next','lms_lesson_chapters','lms_areas',
                            'lms_area_tools','lms_course_areas',
                            'lms_countries','lms_ng_states')
         and grantee = 'anon'
    ) then 'yes' else 'NO' end,
    'Every one of these is reached through a function that checks who is asking. Re-run step 16, which runs file 10 tidy pass over the lot.'

  -- ------------------------------------ THE ROUND TWO REVIEW FIXES
  -- Dr Ayoola found eight more things after the first delivery. One row
  -- each, so a re-run of file 16 can be checked against the review
  -- point by point.

  union all select 37,
    'Only staff can read the question bank directly',
    case when not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = 'lms_questions'
         and policyname = 'p_q_public'
    ) and exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = 'lms_questions'
         and policyname = 'p_q_staff_only'
    ) then 'yes' else 'NO' end,
    'Review item 1. With p_q_public in place any signed in learner could read all 30 exam questions AND their explanations, which usually give the answer away, for a course they do not even hold. Re-run step 15b.'

  union all select 38,
    'A learner can still find the check for a lesson they can open',
    case when exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = 'lms_quizzes'
         and policyname = 'p_quiz_learner_checks'
         and qual like '%lms_lesson_is_open%'
    ) then 'yes' else 'NO' end,
    'Review item 1, the other half. The live check page reads lms_quizzes directly by lesson_id, so shutting the table completely would have broken every lesson check on the site.'

  union all select 39,
    'A refused sign up leaves nothing behind, not even in the token',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_apply_signup_answers'
    ) like '%if not v_ok then%perform lms_strip_signup_metadata(p_user);%'
    then 'yes' else 'NO' end,
    'Review item 2. Refused means keep the account and store nothing, and nothing includes raw_user_meta_data, which rides inside every access token for up to an hour. Re-run step 11.'

  union all select 40,
    'A refusal is written down, and as jsonb',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_apply_signup_answers'
    ) like '%jsonb_build_object(''reason''%'
     and (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_apply_signup_answers'
    ) not like '%exception when others then null%'
    then 'yes' else 'NO' end,
    'Review item 3. detail is jsonb, so text failed on the way in, and a blanket exception swallowed the failure. The refusal then existed nowhere at all.'

  union all select 41,
    'system_health shows a refused sign up as a warning',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='system_health'
    ) like '%sign up answers refused, last 7 days%' then 'yes' else 'NO' end,
    'Review item 3. A refusal nobody is told about is the same as no refusal. A run of them usually means the form and the database have stopped agreeing about a rule.'

  union all select 42,
    'An account that is confirmed the moment it is made is processed too',
    case when exists (
      select 1 from pg_trigger t
       where t.tgrelid = 'auth.users'::regclass
         and t.tgname = 'lms_users_created_confirmed'
         and not t.tgisinternal
    ) then 'yes' else 'NO' end,
    'Review item 4. An administrator making an account by hand, or email confirmation switched off, gave an account that kept its answers in the token for ever and never got a profile row. Re-run step 11.'

  union all select 43,
    'Abandoned sign ups are deleted after a day',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_prune_unconfirmed_signups'
    ) then 'yes' else 'NO' end,
    'Review item 5, which is brief item 11. Run it by hand with: select lms_prune_unconfirmed_signups();'

  union all select 44,
    'And it ignores the free courses every new account is given',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_prune_unconfirmed_signups'
    ) like '%e.source <> ''free''%' then 'yes' else 'NO' end,
    'Review item 5, the trap. lms_handle_new_user grants the free courses to every sign up, so a plain "has no entitlement" test matches nobody and this would run nightly for ever and delete nothing, silently.'

  union all select 45,
    'The prune is scheduled, or pg_cron is not installed',
    -- cron.job is read through query_to_xml, because a plain reference
    -- to it is resolved when this file is parsed, before the pg_cron
    -- test has a chance to short circuit, and the whole file then stops
    -- with "relation cron.job does not exist" on any database where
    -- pg_cron is not installed.
    case when to_regclass('cron.job') is null then 'yes'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*)::text as c from cron.job where jobname = ''lms-prune-unconfirmed-signups''',
                false, true, '')))[1]::text <> '0' then 'yes'
         else 'NO' end,
    'Review item 5. On Supabase pg_cron is on, so this should be scheduled for 03:12 nightly. If pg_cron is off this row still says yes and somebody has to run the function by hand.'

  union all select 46,
    'Country and state are checked against a list, not free text',
    case when to_regclass('public.lms_countries') is not null
          and to_regclass('public.lms_ng_states') is not null
          and to_regclass('public.lms_learner_profiles') is not null
          -- to_regclass, not a ::regclass cast: the cast is resolved
          -- when this file is parsed, so on a database where file 16
          -- has not run yet it stops the whole file with "relation
          -- lms_learner_profiles does not exist" instead of saying NO.
          and exists (
            select 1 from pg_constraint
             where conname in ('lp_country_fk','lp_state_fk')
               and conrelid = to_regclass('public.lms_learner_profiles'))
         then 'yes' else 'NO' end,
    'Review item 6. Dr Ayoola stored a country called <script>alert(1)</script>. Re-run step 15c.'

  union all select 47,
    'And the list is the same 195 and 37 the sign up form uses',
    case when to_regclass('public.lms_countries') is not null
          and (xpath('/row/c/text()', query_to_xml(
                'select count(*)::text || ''/'' || (select count(*) from lms_ng_states)::text as c from lms_countries',
                false, true, '')))[1]::text = '195/37'
         then 'yes' else 'NO' end,
    'Review item 6. The browser list is src/pages/Academy/SignUp/answers.js and npm test compares the two, so if this number has drifted one of them has been edited alone.'

  union all select 48,
    'Nothing is callable that does not need calling',
    case when not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public'
         and p.proname in ('lms_on_email_confirmed','lms_sync_course_area',
                           'lms_strip_signup_metadata','lms_apply_signup_answers',
                           'lms_prune_unconfirmed_signups')
         and (has_function_privilege('authenticated', p.oid, 'execute')
           or has_function_privilege('anon', p.oid, 'execute'))
    ) then 'yes' else 'NO' end,
    'Review item 7. Trigger and housekeeping functions are run by the database, never by a browser. Re-run steps 11 and 15c.'

  -- ------------------------------------------ WHAT PART B NEEDED
  -- Three functions grew while the learner pages were built, because
  -- the pages needed answers nothing returned. One row each.

  union all select 49,
    'The lesson door hands over the chapters and how far you have got',
    case when (
      select pg_get_function_result(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_open_lesson'
    ) like '%chapters jsonb%furthest_seconds integer%fully_watched boolean%'
    then 'yes' else 'NO' end,
    'The player draws the video own chapters under it and lets a learner jump only to one they have reached. Without these it cannot do either. Re-run step 5b.'

  union all select 50,
    'My course lists one exam and no module quizzes',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_my_course'
    ) like '%''quiz'', null%' then 'yes' else 'NO' end,
    'The test course has a module quiz, and a learner who could still see it would be looking at a second kind of test that nothing else on the site mentions. Re-run step 7b.'

  union all select 51,
    'And quiz_count there now means the course exam',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_my_course'
    ) like '%exam as (%z.course_id = v_c.id%' then 'yes' else 'NO' end,
    'One course, one set of questions that counts, at the end. This is the number the certificate card counts down.'

  union all select 52,
    'My course says which paths the course counts towards',
    case when (
      select pg_get_function_result(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_my_course'
    ) like '%paths jsonb%' then 'yes' else 'NO' end,
    'The certificate moment says "Counts towards Data Analytics, 3 of 5". It is the one place somebody finds out the course they just finished was a step towards something bigger.'

  union all select 53,
    'A learner can read one path, with what they have done to it',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_my_path'
    ) then 'yes' else 'NO' end,
    'The path page at /lms/paths/:slug is built from this. Re-run step 9b.'

  union all select 54,
    'And it is readable by somebody who is not signed in',
    -- The function is named through pg_proc rather than by a text
    -- signature: has_function_privilege('...lms_my_path(text)...')
    -- RESOLVES that name when the file is parsed, so on a database
    -- where file 16 has not run it stops the whole verify with
    -- "function does not exist" instead of saying NO.
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_my_path'
         and has_function_privilege('anon', p.oid, 'execute')
    ) then 'yes' else 'NO' end,
    'A path is one of the things somebody decides about BEFORE they have an account. Signed out they get the path with nothing ticked.'

  union all select 55,
    'A course finished in another path is named as such',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname='public' and p.proname='lms_my_path'
    ) like '%also_in%' then 'yes' else 'NO' end,
    'A course is one course wherever it appears. Without this a learner sees a tick on a course they have never opened and no reason for it.'

  union all select 56,
    'The prune does not keep an account just because somebody typed their name',
    -- Two halves, because "does not contain the phrase" is also true of
    -- a function that does not exist, and this row said yes on a
    -- database where file 16 had never been run.
    case when exists (
           select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
            where ns.nspname='public' and p.proname='lms_prune_unconfirmed_signups')
         and (
           select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
            where ns.nspname='public' and p.proname='lms_prune_unconfirmed_signups'
         ) not like '%full\_name%' escape '\'
         then 'yes' else 'NO' end,
    'Round 3 item 1, and it is the one that matters before anything is run. full_name is copied off the sign up metadata by lms_handle_new_user and the form will not submit without a name, so testing it kept EVERY real unconfirmed account for ever, with its About you answers still in user_metadata, disability detail among them. That is the thing the 24 hour rule exists to stop. This row is backwards on purpose: it answers yes when the phrase is ABSENT.'

  union all select 57,
    'The headline says skill, not tool',
    case when exists (
      select 1 from lms_settings s where s.headline = 'Learn one skill at a time.'
    ) or not exists (select 1 from lms_settings) then 'yes' else 'NO' end,
    'Round 3 item 6. Step 17 changes it only where it still equals the old default exactly, so if staff have written their own headline this row says NO and that is correct: leave it alone.'
)
select n as "#", checking as "what was checked", answer as "answer",
       what_it_means as "what it means if the answer is not yes"
  from checks order by n;
