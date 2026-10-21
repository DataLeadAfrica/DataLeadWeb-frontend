-- Checks file 21. Changes nothing. Safe to run before it as well as
-- after: it prints a column of NOs rather than an error, which is the
-- answer.
--
-- PASTE 21_verify_EDITOR.sql, NOT THIS ONE. The two hold the same checks
-- and a test keeps them in step. The explanations for each numbered row
-- live in docs/lms/PHASE-6D-PLAIN.md.
--
-- ROWS 1 AND 8 ARE THE ONES THAT MATTER. Row 1 is the three holes Dr
-- Ayoola found. Row 8 is the allow list, and it is the row that will
-- still be working a year from now, because it fails on anything new
-- rather than on a fixed list of old mistakes.
--
-- ROWS 5, 6, 7 AND 9 EXIST TO CATCH AN OVERZEALOUS FIX. Each one names
-- something that MUST stay reachable, and each was a real near miss
-- while this file was being written. If a later hand reaches for a sweep
-- over the whole schema, these four rows are what say no.
--
-- Everything is asked through to_regprocedure, never a literal
-- ::regprocedure cast, because a literal cast is constant folded while
-- the statement is planned and raises on a database that does not have
-- the function yet.

with
-- THE ALLOW LIST. file_21_tests.sql holds the identical list and a node
-- test keeps the two copies in step, so neither can drift quietly.
allowed as (
  select unnest(array[
    -- called inside 36 row level security policies, across 27 tables
    'lms_can_edit', 'lms_is_admin', 'lms_is_staff', 'lms_lesson_is_open',
    'lms_my_role',
    -- called by a page with no session, confirmed in a real browser
    'lms_live_popup', 'lms_my_path', 'lms_public_catalogue',
    'lms_public_course', 'lms_public_landing',
    -- used in a CHECK constraint, so evaluated as the querying role
    'lms_faq_is_valid',
    -- trigger functions, where a grant is not how they are reached
    'lms_check_question_chapter', 'lms_guard_course', 'lms_guard_lesson',
    'lms_guard_module', 'lms_guard_option', 'lms_guard_path',
    'lms_guard_question', 'lms_guard_question_not_served',
    'lms_guard_quiz', 'lms_guard_quiz_not_empty', 'lms_handle_new_user',
    'lms_no_new_module_quiz', 'lms_progress_keep_coverage',
    'lms_progress_tidy_up', 'lms_touch'
  ]) as proname
),
shut_to_all as (
  select unnest(array[
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
  ]) as sig
),
signed_in_only as (
  select unnest(array[
    'lms_has_course_access(uuid)',
    'lms_complete_lesson(uuid)',
    'lms_record_watch(uuid, integer, integer)',
    'lms_start_quiz(uuid)',
    'lms_submit_quiz(uuid, jsonb)',
    'lms_sync_my_access()',
    'lms_add_facilitator(text, text, text)',
    'lms_remove_facilitator(text)'
  ]) as sig
),
takes_a_person as (
  select unnest(array[
    'lms_add_facilitator(text, text, text)',
    'lms_give_access(uuid, uuid, text, lms_grant_source, timestamp with time zone)',
    'lms_learner_record(uuid)',
    'lms_lift_exam_wait(uuid, uuid)',
    'lms_link_certification_record(uuid, uuid, text)',
    'lms_remove_access(uuid, uuid, text)',
    'lms_remove_facilitator(text)',
    'lms_set_staff_role(uuid, lms_role)'
  ]) as sig
),
no_caller_check as (
  select unnest(array[
    'lms_apply_signup_answers(uuid)',
    'lms_grant_free_courses(uuid)',
    'lms_link_participant(uuid, text)',
    'lms_strip_signup_metadata(uuid)'
  ]) as sig
),
checks as (

  select 1 as n,
    'The three that were open to anybody are shut' as checking,
    case when (
      select count(*) from (values
        ('lms_link_participant(uuid, text)'),
        ('lms_grant_free_courses(uuid)'),
        ('lms_storage_report()')) as t(sig)
       where to_regprocedure('public.' || sig) is null
          or has_function_privilege('anon', sig, 'EXECUTE')
          or has_function_privilege('authenticated', sig, 'EXECUTE')
    ) = 0 then 'yes' else 'NO' end as answer,
    'THE REASON THIS FILE EXISTS. The first joins an account to somebody certification record by email and checks nothing about who asked. The second hands free courses to any account id. The third reads row counts and sizes for a signed out visitor. Live has all three shut by hand already, so a NO here means a rebuild has reopened what was closed.' as what_it_means

  union all select 2,
    'And the chapter saver is still shut to everybody',
    case when to_regprocedure('public.lms_set_lesson_chapters(uuid, text)') is null then 'NO'
         when not has_function_privilege('anon', 'lms_set_lesson_chapters(uuid, text)', 'EXECUTE')
          and not has_function_privilege('authenticated', 'lms_set_lesson_chapters(uuid, text)', 'EXECUTE')
         then 'yes' else 'NO' end,
    'The same question 19_verify row 18 asks, repeated here because this is the file that makes it permanent. It asks whether the caller is staff and never whether the lesson is theirs, so one facilitator could rewrite the chapters of another published course. Only lms_save_lesson should reach it, and that one does check ownership.'

  union all select 3,
    'Nothing signed in or out can call the fourteen that nothing calls',
    case when (select count(*) from shut_to_all
                where to_regprocedure('public.' || sig) is null
                   or has_function_privilege('anon', sig, 'EXECUTE')
                   or has_function_privilege('authenticated', sig, 'EXECUTE')) = 0
         then 'yes' else 'NO' end,
    'Nothing in the pages or the scripts calls any of these fourteen. Each is reached either by a security definer function, which calls it as its own owner and so needs no grant, or by nothing at all. A NO means at least one is still callable by hand.'

  union all select 4,
    'The eight a learner needs are shut to the signed out, and only those',
    case when (select count(*) from signed_in_only
                where to_regprocedure('public.' || sig) is null
                   or has_function_privilege('anon', sig, 'EXECUTE')
                   or not has_function_privilege('authenticated', sig, 'EXECUTE')) = 0
         then 'yes' else 'NO' end,
    'These are called by the pages, but never by a page without a session. Every signed out page was loaded in a real browser with the network log open and none of the eight was asked for. A NO means either anon still holds one, or the fix went too far and a signed in learner has lost one they need.'

  union all select 5,
    'THE FIVE POLICY HELPERS ARE UNTOUCHED, as they must be',
    case when (
      select count(*) from (values
        ('lms_can_edit()'), ('lms_is_admin()'), ('lms_is_staff()'),
        ('lms_lesson_is_open(uuid)'), ('lms_my_role()')) as t(sig)
       where to_regprocedure('public.' || sig) is null
          or not has_function_privilege('anon', sig, 'EXECUTE')
          or not has_function_privilege('authenticated', sig, 'EXECUTE')
    ) = 0 then 'yes' else 'NO' end,
    'A GUARD AGAINST AN OVERZEALOUS FIX, NOT AGAINST AN ATTACKER. These five are named inside 36 row level security policies across 27 tables, and a policy runs its functions as whoever is querying. Revoking lms_is_admin alone was enough to stop a learner reading their own profile. A NO here means the Academy is down for everybody, not that something is exposed.'

  union all select 6,
    'And so are the five a signed out page really does call',
    case when (
      select count(*) from (values
        ('lms_live_popup(text)'), ('lms_my_path(text)'), ('lms_public_catalogue()'),
        ('lms_public_course(text)'), ('lms_public_landing()')) as t(sig)
       where to_regprocedure('public.' || sig) is null
          or not has_function_privilege('anon', sig, 'EXECUTE')
    ) = 0 then 'yes' else 'NO' end,
    'The other guard against going too far. lms_my_path is the one worth knowing about: reading the code suggested a session was always needed, and a real browser showed the path page asking for it with no session at all. A NO here means the catalogue, a course page or a path page is broken for visitors.'

  union all select 7,
    'The FAQ validator is untouched, because a CHECK constraint uses it',
    case when to_regprocedure('public.lms_faq_is_valid(jsonb)') is null then 'NO'
         when has_function_privilege('authenticated', 'lms_faq_is_valid(jsonb)', 'EXECUTE')
         then 'yes' else 'NO' end,
    'The third guard. A CHECK constraint is evaluated as whoever is querying, exactly like a policy, and lms_courses has one that calls this. With it revoked, a facilitator editing their own course was told permission denied. It accepts a jsonb and answers true or false, reaching no data at all, so there was never anything to gain by shutting it.'

  union all select 8,
    'NOTHING OUTSIDE THE ALLOW LIST IS EXECUTABLE BY A VISITOR',
    case when (
      select count(*) from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like 'lms\_%'
         and has_function_privilege('anon', p.oid, 'EXECUTE')
         and p.proname not in (select proname from allowed)
    ) = 0 then 'yes' else 'NO' end,
    'THE ROW THAT KEEPS WORKING. The others check a list of known mistakes. This one fails on anything new, so a function added next year and left with its default grant is caught here without anybody remembering to add a check. The detail column names whatever it found.'

  union all select 9,
    'The certification system was not touched',
    case when (
      select count(*) from (values
        ('mail_fetch_pending(text, integer)'), ('mail_mark_sent(text, uuid[])'),
        ('mail_ping(text)'), ('mailer_token_ok(text)'), ('system_health(text)')) as t(sig)
       where to_regprocedure('public.' || sig) is not null
         and not has_function_privilege('anon', sig, 'EXECUTE')
    ) = 0 then 'yes' else 'NO' end,
    'The fourth guard. The mailer is a Google Apps Script with no account of its own: it arrives as a visitor and proves itself with a token instead. The staff console, the participant portal and the blog work the same way, and most of their functions are not in this repository, so no local test would notice them breaking. A NO means a sweep has caught something it should not have.'

  union all select 10,
    'Every function that takes a person asks whether you are an administrator',
    case when (select count(*) from takes_a_person
                where to_regprocedure('public.' || sig) is null
                   or has_function_privilege('anon', sig, 'EXECUTE')
                   or (select count(*) from pg_proc p
                        join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public'
                         and p.oid = to_regprocedure('public.' || sig)
                         and regexp_replace(pg_get_functiondef(p.oid),
                               '--[^' || chr(10) || ']*', '', 'g') like '%lms_is_admin()%') = 0
              ) = 0 then 'yes' else 'NO' end,
    'These eight are security definer, they each accept an account id or an email address, and a browser can reach all eight. Every one of them asks lms_is_admin() before it does anything. A NO means one of them will act on whatever person it is handed, for whoever asked.'

  union all select 11,
    'And the four that ask nothing cannot be reached at all',
    case when (select count(*) from no_caller_check
                where to_regprocedure('public.' || sig) is null
                   or has_function_privilege('anon', sig, 'EXECUTE')
                   or has_function_privilege('authenticated', sig, 'EXECUTE')) = 0
         then 'yes' else 'NO' end,
    'The other side of row 10. These four accept an account id and check nothing about who is asking, which is exactly why no browser may reach them. Two are reached by the new account trigger and two by the access sync, all security definer. A NO here is the same fault as row 1.'
)
select n as "#", checking as "what was checked", answer as "answer",
       what_it_means as "what it means if the answer is not yes"
  from checks order by n;

-- AND THE NAMES, when row 8 says NO. Separate because a verify file's
-- job is a column of yes, and a list belongs underneath it rather than
-- squeezed into a cell.
select p.proname as "executable by a visitor and not on the allow list"
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'lms\_%'
   and has_function_privilege('anon', p.oid, 'EXECUTE')
   and p.proname not in (
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
     ])
   )
 order by 1;
