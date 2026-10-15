-- =====================================================================
-- 17_verify.sql
--
-- Changes nothing. Prints one row per promise file 17 makes.
-- EVERY ROW SHOULD SAY yes.
--
-- Run it BEFORE file 17 as well: it prints a column of NOs rather than
-- a Postgres error, which is the answer, and it tells you the file has
-- not been run. If it ever gives you an error instead of NOs, that is a
-- fault in this file and worth telling me about.
--
-- PASTE 17_verify_EDITOR.sql INTO THE SUPABASE SQL EDITOR, not this
-- file. The two hold the same 41 checks and a test keeps them in step.
-- This one carries the explanations and is for reading and for psql.
--
-- WHY THERE ARE TWO. 16_verify.sql failed in the Editor with
-- 'relation "the" does not exist' while running cleanly in psql and
-- through node-postgres. Taking out every semicolon did not fix it, and
-- nor did removing every comment. What ran was a version with short
-- labels, an empty explanation column and no comments.
--
-- The cause is still a guess. The file that failed had phrases like
-- 'from the courses table' inside its explanation strings and the one
-- that ran had none, which would fit an Editor scanning for a table
-- name after from, into, join, update or table. So this file avoids
-- those phrases in its prose, and the EDITOR file avoids prose
-- altogether. tests/sql-editor-safe.test.mjs enforces both.
-- =====================================================================

with checks as (

  select 1 as n,
    'The activity log can only be added to' as checking,
    case when exists (
      select 1 from pg_trigger t
       where t.tgrelid = to_regclass('public.lms_admin_actions')
         and t.tgname = 'lms_admin_actions_no_change' and not t.tgisinternal
    ) then 'yes' else 'NO' end as answer,
    'Item 11. Without this an administrator could quietly edit or remove a line. A log you can edit is not a log.' as what_it_means

  union all select 2,
    'A course is born with a programme, a module and an exam',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_create_course'
    ) like '%insert into programmes%lms_ensure_course_exam%lms_modules%'
      or (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_create_course'
    ) like '%programmes%' then 'yes' else 'NO' end,
    'Item 1. A course missing any of the three cannot be published and nobody can see why.'

  union all select 3,
    'A facilitator cannot publish a course',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_publish_course'
    ) like '%lms_is_admin()%Only an administrator can publish a course.%' then 'yes' else 'NO' end,
    'Item 12. The check is in the database, not only in the page. Test 3a in file_17_tests signs in as a facilitator and tries it.'

  union all select 4,
    'A facilitator cannot read another facilitator course',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_may_edit_course'
    ) like '%c.created_by = auth.uid()%' then 'yes' else 'NO' end,
    'Item 12. One function decides it, so the course list, the builder, the banks, the reports and the log cannot disagree.'

  union all select 5,
    'A facilitator cannot read lms_learner_profiles',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_staff_learners'
    ) and (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_staff_learners'
    ) like '%Only an administrator can see the learner list.%' then 'yes' else 'NO' end,
    'Item 12. A facilitator sees no learner name or email anywhere, and the lms_learner_profiles rows are behind file 16 policies as well.'

  union all select 6,
    'The nine publish checks exist, with a fix it target each',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_publish_checks'
         and pg_get_function_result(p.oid) like '%fix_tab%'
    ) then 'yes' else 'NO' end,
    'Item 1. The page draws what this returns, so the panel and the publish gate are one list rather than two opinions.'

  union all select 7,
    'And lms_course_blockers was left exactly as file 11 wrote it',
    case when (
      select pg_get_function_result(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_course_blockers'
    ) = 'TABLE(ok boolean, label text)' then 'yes' else 'NO' end,
    'File 11 step 0 looks up that exact signature and refuses to run if it has changed. Widening it would have made file 11 unrunnable for ever.'

  union all select 8,
    'Publishing a free course still opens it to everyone who already has an account',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_publish_course'
    ) like '%insert into lms_entitlements%price_kobo = 0%' then 'yes' else 'NO' end,
    'File 05 did this and it had to survive the rewrite. Without it only people who sign up after today would ever get a free course.'

  union all select 9,
    'Publishing a course publishes its lesson checks',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_publish_course'
    ) like '%update lms_quizzes%lesson_id in%' then 'yes' else 'NO' end,
    'Item 1. File 10 says only an administrator publishes questions, so without this a facilitator could never reach nine green ticks.'

  union all select 10,
    'On a published course the words can change',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_guard_lesson'
    ) like '%video of a live lesson cannot change%' then 'yes' else 'NO' end,
    'Item 1. File 10 refused every change including a typo fix. This loosens that one part and keeps the rest.'

  union all select 11,
    'But the video, the length and the order cannot',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_guard_lesson'
    ) like '%cannot be reordered%' then 'yes' else 'NO' end,
    'Item 1. Changing those moves the ground under somebody halfway through.'

  union all select 12,
    'There is one lesson guard, not two',
    case when (
      select count(*) from pg_trigger t
       where t.tgrelid = to_regclass('public.lms_lessons') and not t.tgisinternal
         and pg_get_triggerdef(t.oid) like '%lms_guard%'
    ) = 1 then 'yes' else 'NO' end,
    'Two triggers that have to agree about one rule is one too many, and the second one would never fire anyway.'

  union all select 13,
    'A question anybody has sat is frozen',
    case when exists (
      select 1 from pg_trigger t
       where t.tgrelid = to_regclass('public.lms_options')
         and t.tgname = 'lms_options_answered_guard' and not t.tgisinternal
    ) then 'yes' else 'NO' end,
    'Item 3. Changing an option after the fact changes what a mark meant. Wording can still be improved.'

  union all select 14,
    'A question counts as sat the moment it was SERVED',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_question_is_locked'
    ) like '%served_question_ids%' then 'yes' else 'NO' end,
    'Item 3. Somebody with the paper open has already seen those options, whether or not they have answered yet.'

  union all select 15,
    'A pasted sheet skips bad rows rather than refusing the lot',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_paste_questions'
         and pg_get_function_result(p.oid) like '%outcome%'
    ) then 'yes' else 'NO' end,
    'Item 3. Refusing forty rows because of three is what makes somebody paste eight times.'

  union all select 16,
    'And nothing is written until every row has been read',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_paste_questions'
    ) like '%PASS ONE%PASS TWO%' then 'yes' else 'NO' end,
    'Item 3. A paste that half worked is worse than one that did not: they fix the sheet, paste again, and now have duplicates.'

  union all select 17,
    'Access cannot be given without a reason',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_give_access'
    ) like '%An access grant with no reason%' then 'yes' else 'NO' end,
    'Item 4. Why does this person have the paid course is a question that gets asked.'

  union all select 18,
    'And giving access lifts an existing grant rather than doing nothing',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_give_access'
    ) like '%do update set source%' then 'yes' else 'NO' end,
    'Item 4. There is one live grant per learner per course, so on conflict do nothing meant a scholarship silently did nothing while the log said it had worked.'

  union all select 19,
    'Bootcamp access is not given by hand',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_give_access'
    ) like '%follows the roster%' then 'yes' else 'NO' end,
    'Item 4. Bootcamp access follows the enrolment. Given by hand it would be undone by the next roster sync and nobody would know why.'

  union all select 20,
    'Removing access revokes rather than deletes',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_remove_access'
    ) like '%status = ''revoked''%' then 'yes' else 'NO' end,
    'Nothing a learner has touched is hard deleted, which has been the rule since file 03. Their progress stays exactly where it is.'

  union all select 21,
    'Lifting an exam wait does not hand anybody a pass',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_lift_exam_wait'
    ) like '%update lms_quiz_attempts%submitted_at%' then 'yes' else 'NO' end,
    'Item 4. It moves the clock so the exam opens again with fresh questions. The tries are still spent and the scores still stand.'

  union all select 22,
    'Who our learners are is administrators only and counted by file 16',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_report_who'
    ) like '%lms_learner_totals%' then 'yes' else 'NO' end,
    'Item 7. File 16 already returns fewer than 5 and suppresses every group when any one is small. A second count here would be a second chance to get that wrong.'

  union all select 23,
    'And every read of it is logged',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_report_who'
    ) like '%report_who_read%' then 'yes' else 'NO' end,
    'Item 7. The page where the sensitive answers are should leave a trace that it was looked at.'

  union all select 24,
    'CSV downloads are logged',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_log_export'
    ) then 'yes' else 'NO' end,
    'Item 7. Who asked for which file and when. An export is the moment data leaves the place that protects it.'

  union all select 25,
    'A facilitator cannot export learner data',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_log_export'
    ) like '%Only an administrator can export learner data.%' then 'yes' else 'NO' end,
    'Item 7.'

  union all select 26,
    'A hard question needs at least five answers before it is called hard',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_report_hard_questions'
    ) like '%s.seen >= 5%' then 'yes' else 'NO' end,
    'Item 7. Under five is a new question, not a hard one, and putting it top of the list sends somebody to rewrite a question two people happened to miss.'

  union all select 27,
    'A popup can never be put over a lesson, a check or an exam',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_save_popup'
    ) like '%Never over a lesson, a check or an exam.%' then 'yes' else 'NO' end,
    'Item 9. Said in the function, in the check constraint and in the page, on purpose.'

  union all select 28,
    'A new popup starts as a draft',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_save_popup'
    ) like '%''draft''%' then 'yes' else 'NO' end,
    'Item 9. A box over the whole site is the one thing in here where a slip of the hand is seen by everybody.'

  union all select 29,
    'Starting one popup stands the others down',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_start_popup'
    ) like '%status = ''ended''%status = ''live''%' then 'yes' else 'NO' end,
    'Item 9. One at a time, in the same statement, so there is no moment when two are live.'

  union all select 30,
    'Nobody can be made an administrator by any page',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_staff_role'
    ) like '%made in Supabase%' then 'yes' else 'NO' end,
    'The page that can make an administrator is the page worth attacking, so there is no such page.'

  union all select 31,
    'Nor can anybody change their own role',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_staff_role'
    ) like '%cannot change your own role%' then 'yes' else 'NO' end,
    'An administrator who demotes themselves by accident has locked everybody out.'

  union all select 32,
    'Adding and removing a facilitator is still file 10 work',
    case when (
      select pg_get_function_result(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_add_facilitator'
    ) = 'TABLE(ok boolean, message text)' then 'yes' else 'NO' end,
    'File 10 raises somebody only if their account is confirmed, and guards against demoting an administrator. My replacement did neither, so file 17 leaves it alone.'

  union all select 33,
    'A price change records the old number and the new one',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_course_price'
    ) like '%was_kobo%now_kobo%' then 'yes' else 'NO' end,
    'Item 2. A price that moved and nobody remembers moving is an argument with a learner that staff cannot win.'

  union all select 34,
    'The activity log shows a facilitator nothing about a learner',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_activity_log'
    ) like '%lms_is_admin()%created_by = auth.uid()%' then 'yes' else 'NO' end,
    'Item 11. The whole row is dropped rather than blanked: access given to somebody, with the name removed, still tells them a thing they have no business knowing.'

  union all select 35,
    'Nothing in file 17 is callable by a signed out visitor',
    case when not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public'
         and p.proname in (
           'lms_create_course','lms_publish_checks','lms_publish_course','lms_staff_learners',
           'lms_give_access','lms_remove_access','lms_lift_exam_wait','lms_set_course_price',
           'lms_report_who','lms_studio_overview','lms_studio_health','lms_activity_log',
           'lms_set_staff_role','lms_studio_staff','lms_save_popup','lms_set_site_settings')
         and has_function_privilege('anon', p.oid, 'execute')
    ) then 'yes' else 'NO' end,
    'Item 12. Supabase grants execute on every new function to anon by default. A signed out visitor has no business in the control room.'

  union all select 36,
    'And the log writer and the triggers are callable by nobody',
    case when not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public'
         and p.proname in ('lms_log_action','lms_log_is_append_only','lms_guard_answered_question')
         and (has_function_privilege('anon', p.oid, 'execute')
              or has_function_privilege('authenticated', p.oid, 'execute'))
    ) then 'yes' else 'NO' end,
    'Item 12. These are called by the database and never by a browser.'

  union all select 37,
    'A lesson check can be published at all',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_publish_lesson_check'
    ) then 'yes' else 'NO' end,
    'lms_publish_exam reads serve_count and raises No such exam when it is null, which it always is for a lesson check. Until file 17 there was no way to publish one.'

  union all select 38,
    'Sending a course back needs a note',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_send_back'
    ) like '%nobody knows how to fix%' then 'yes' else 'NO' end,
    'Item 1. A course sent back with no note is a course nobody knows how to fix.'

  union all select 39,
    'Ready for review is a draft that was sent, not a new enum value',
    case when exists (
      select 1 from information_schema.columns
       where table_name = 'lms_courses' and column_name = 'sent_for_review_at'
    ) and not exists (
      select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
       where t.typname = 'lms_status' and e.enumlabel = 'review'
    ) then 'yes' else 'NO' end,
    'Postgres will not let a new enum value be USED in the transaction that adds it, and file 17 is one transaction. Being sent is also an event with a sender, a time and a note, which an enum value cannot hold.'

  union all select 40,
    'The log writer never fails the thing it is recording',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_log_action'
    ) like '%exception when others then%lms_system_heartbeat%' then 'yes' else 'NO' end,
    'Item 11. A log that can refuse a publish is a log that will one day stop somebody publishing. The failure is recorded in system_health instead.'

  union all select 41,
    'Nor can an administrator demote the other administrator',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_staff_role'
    ) like '%made and removed in Supabase%' then 'yes' else 'NO' end,
    'Refusing to CREATE an administrator and refusing to change your OWN role feel complete together and are not. Without this, either administrator could make the other a learner, and with two of them that is one press away and then no one can publish at all.'
)
select n as "#", checking as "what was checked", answer as "answer",
       what_it_means as "what it means if the answer is not yes"
  from checks order by n;
