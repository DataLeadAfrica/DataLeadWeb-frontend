-- =====================================================================
-- FILE 21. Who may execute what.
--
-- PASTE 21_execute_privileges_EDITOR.sql, NOT THIS ONE. The two hold the
-- same statements and a test keeps them in step. The plain English is in
-- docs/lms/PHASE-6D-PLAIN.md, and 21_verify.sql checks the result.
--
-- WHAT THIS IS FOR. A function in Postgres is executable by PUBLIC from
-- the moment it is created. Supabase gives anon and authenticated usage
-- of the public schema, so on a fresh build of files 01 to 20 anon can
-- execute 47 of our own lms_* functions, 144 of which are security
-- definer. Most of them do nothing useful to a stranger. Three did:
--
--   lms_link_participant(p_user, p_email) is security definer, does not
--   check its caller, and joins an account to a certification record by
--   email. The review called it as a plain learner and was joined to
--   somebody else's unlinked record.
--
--   lms_grant_free_courses(p_user) grants free courses to any user id.
--
--   lms_storage_report() lets a signed out visitor read table sizes and
--   row counts.
--
-- Live already has these three revoked by hand, and file 20 shut
-- lms_set_lesson_chapters the same way. This file makes all four
-- permanent in the repository, so a database rebuilt from these files
-- lands where live already is instead of reopening them, and takes the
-- same care with everything else that nothing calls.
--
-- WHAT THIS FILE DELIBERATELY DOES NOT DO. There is no sweep. Nothing
-- here says "revoke from every function in the schema except a list".
-- Every function is named, one statement each, and only functions
-- called lms_* that files 01 to 20 create. Four reasons, every one of
-- them found by trying it rather than by reasoning about it:
--
--   1. FIVE lms_* FUNCTIONS ARE CALLED INSIDE 36 ROW LEVEL SECURITY
--      POLICIES, across 27 tables. A policy runs its functions as the
--      querying role, so revoking one of these takes the Academy down.
--      Revoking lms_is_admin from authenticated alone was enough to
--      stop a learner reading their own profile. They are listed in the
--      allow list below and nothing here touches them.
--
--   2. THE CERTIFICATION SYSTEM CALLS FUNCTIONS THAT ARE NOT IN THIS
--      REPOSITORY AT ALL. The certificate console, the staff portal,
--      the participant portal and the blog call staff_login,
--      participant_dashboard, module_start_attempt, get_readership and
--      a dozen more as anon, with their own token logins rather than
--      Supabase auth. Most exist only on live, so no local test would
--      notice them breaking. A sweep would have hit every one of them.
--      Nothing here names a function that is not lms_*.
--
--   3. lms_faq_is_valid IS USED IN A CHECK CONSTRAINT. A constraint is
--      evaluated as the querying role, exactly like a policy. With it
--      revoked, a facilitator editing their own course got "permission
--      denied for function lms_faq_is_valid". It takes a jsonb and
--      returns a boolean, reads nothing and grants nothing, so there was
--      never anything to gain by shutting it. It is left alone.
--
--   4. lms_my_path IS CALLED BY A SIGNED OUT PAGE. Reading the code
--      suggested otherwise. Loading every signed out page in a real
--      browser with the network log open showed /lms/paths/:slug calling
--      it with no session, which is how it earned its place below.
--
-- The five token guarded mailer and health functions, mail_fetch_pending,
-- mail_mark_sent, mail_ping, mailer_token_ok and system_health, are not
-- lms_* and are not touched. The Google Apps Script mailer reaches them
-- unauthenticated and proves itself with a token instead.
--
-- =====================================================================
-- THE WRITTEN ALLOW LIST: the 26 lms_* functions anon may execute after
-- this file has run. 21_verify.sql holds the same list and fails if
-- anything else appears, and file_21_tests.sql asserts the identical
-- list, with a node test keeping the two copies in step.
--
--   Policy helpers, called inside 36 policies (5)
--     lms_can_edit, lms_is_admin, lms_is_staff, lms_lesson_is_open,
--     lms_my_role
--
--   Called by a page with no session (5)
--     lms_live_popup, lms_my_path, lms_public_catalogue,
--     lms_public_course, lms_public_landing
--
--   Used in a CHECK constraint, so evaluated as the querying role (1)
--     lms_faq_is_valid
--
--   Trigger functions (15). Execute on a trigger function does nothing
--   for a browser: a trigger fires through the trigger mechanism and not
--   through a grant. Left alone deliberately, because revoking them buys
--   nothing and the risk is not worth it.
--     lms_check_question_chapter, lms_guard_course, lms_guard_lesson,
--     lms_guard_module, lms_guard_option, lms_guard_path,
--     lms_guard_question, lms_guard_question_not_served,
--     lms_guard_quiz, lms_guard_quiz_not_empty, lms_handle_new_user,
--     lms_no_new_module_quiz, lms_progress_keep_coverage,
--     lms_progress_tidy_up, lms_touch
-- =====================================================================

-- -------------------------------------------------------------- step 0
-- Files 01 to 20 first. This one only takes privileges away, so running
-- it early would not break anything, but it would silently miss the
-- functions that do not exist yet and report success.
do $$
declare v_missing text[] := '{}';
begin
  if to_regprocedure('public.lms_link_participant(uuid, text)') is null then
    v_missing := v_missing || 'lms_link_participant (file 05)'::text;
  end if;
  if to_regprocedure('public.lms_grant_free_courses(uuid)') is null then
    v_missing := v_missing || 'lms_grant_free_courses (file 10)'::text;
  end if;
  if to_regprocedure('public.lms_storage_report()') is null then
    v_missing := v_missing || 'lms_storage_report (file 11)'::text;
  end if;
  if to_regprocedure('public.lms_set_lesson_chapters(uuid, text)') is null then
    v_missing := v_missing || 'lms_set_lesson_chapters (file 16)'::text;
  end if;
  if to_regprocedure('public.lms_add_facilitator(text, text, text)') is null then
    v_missing := v_missing || 'lms_add_facilitator (file 10)'::text;
  end if;
  if to_regprocedure('public.lms_sync_my_access()') is null then
    v_missing := v_missing || 'lms_sync_my_access (file 10, changed by file 19)'::text;
  end if;
  if array_length(v_missing, 1) is not null then
    raise exception 'File 21 cannot run yet. Missing: %', array_to_string(v_missing, ', ');
  end if;
  raise notice 'Step 0: files 01 to 20 are in place.';
end $$;

-- -------------------------------------------------------------- step 1
-- NOBODY SIGNED IN OR OUT MAY CALL THESE. Nothing in src/, api/ or
-- scripts/ calls any of them. Each line says who does reach it: either a
-- security definer function, which calls it as its own owner and so
-- needs no grant of its own, or nothing at all.
--
-- "public" is named first in every one. Revoking from anon and
-- authenticated alone leaves the PUBLIC grant standing and
-- has_function_privilege still answers yes, which is how the same
-- mistake was made in file 20 and found by a test that disagreed with
-- the code.

-- Joins an account to a certification record by email, security
-- definer, and checks nothing about its caller. THE WORST OF THE THREE.
-- Reached by: lms_claim_bootcamp_access, lms_claim_course_certificate,
-- lms_handle_new_user, lms_sync_my_access, all security definer.
revoke execute on function lms_link_participant(uuid, text) from public, anon, authenticated;

-- Grants free courses to any user id it is handed.
-- Reached by: lms_handle_new_user, lms_sync_my_access.
revoke execute on function lms_grant_free_courses(uuid) from public, anon, authenticated;

-- Table sizes and row counts, which a signed out visitor could read.
-- Reached by: system_health, which is token guarded and security
-- definer, so the mailer's health call keeps working.
revoke execute on function lms_storage_report() from public, anon, authenticated;

-- Rewrites the chapter list of any lesson, asking only whether the
-- caller is staff and never whether the lesson is theirs. File 20
-- already revoked this and live has it revoked by hand. Repeated here so
-- this file is a complete statement of the position on its own, and
-- because a revoke is idempotent.
-- Reached by: lms_save_lesson, which does check ownership.
revoke execute on function lms_set_lesson_chapters(uuid, text) from public, anon, authenticated;

-- A learner claiming bootcamp access. Nothing calls it, in the database
-- or in the pages. IF THIS IS MEANT TO BE WIRED UP LATER, grant it back
-- to authenticated at that point. It is shut now because an unused
-- security definer function that takes no argument and grants access is
-- exactly the shape worth shutting while it is unused.
revoke execute on function lms_claim_bootcamp_access() from public, anon, authenticated;

-- Reached by: nothing. A staff report on what is stopping a course being
-- published, superseded by lms_publish_checks in file 17.
revoke execute on function lms_course_blockers(uuid) from public, anon, authenticated;

-- Reached by: lms_staff_learners.
revoke execute on function lms_course_progress(uuid) from public, anon, authenticated;

-- Reached by: nothing.
revoke execute on function lms_course_status_of_lesson(uuid) from public, anon, authenticated;

-- Reached by: lms_guard_lesson, lms_set_lesson_duration.
revoke execute on function lms_course_status_of_module(uuid) from public, anon, authenticated;

-- Reached by: lms_guard_option, lms_guard_question, lms_guard_quiz.
revoke execute on function lms_course_status_of_quiz(uuid) from public, anon, authenticated;

-- Writes a whole set of questions into a quiz. The control room uses
-- lms_paste_questions instead, and nothing calls this one.
revoke execute on function lms_import_questions(uuid, jsonb) from public, anon, authenticated;

-- Reached by: lms_complete_lesson.
revoke execute on function lms_is_lesson_unlocked(uuid) from public, anon, authenticated;

-- Reached by: nothing.
revoke execute on function lms_quiz_kind(uuid) from public, anon, authenticated;

-- Reached by: lms_complete_lesson, lms_lesson_watch_state.
revoke execute on function lms_watch_coverage(uuid) from public, anon, authenticated;

-- -------------------------------------------------------------- step 2
-- SIGNED IN ONLY. The pages do call these, but never without a session,
-- so anon has no business holding them. authenticated keeps them.
--
-- "never without a session" is not a reading of the code. Every signed
-- out page was loaded in a real browser with the network log open, and
-- the calls each page made were recorded: the landing page, the
-- catalogue, a course page with its buy card showing on a PAID course,
-- which is the only state in which the access question is ever asked,
-- sign in, sign up, a path page and the certificate checker. None of the
-- eight below appeared. lms_my_path did, which is why it is in the allow
-- list and not here.

-- Does this person already hold this course. The Course page asks only
-- when somebody is signed in AND the course costs money, and the
-- browser run confirmed it stays silent otherwise.
revoke execute on function lms_has_course_access(uuid) from public, anon;

-- A learner marking a lesson done.
revoke execute on function lms_complete_lesson(uuid) from public, anon;

-- A learner's watch position.
revoke execute on function lms_record_watch(uuid, integer, integer) from public, anon;

-- Starting a check or an exam.
revoke execute on function lms_start_quiz(uuid) from public, anon;

-- Sending the answers in.
revoke execute on function lms_submit_quiz(uuid, jsonb) from public, anon;

-- Working out what a person has access to. Called on sign in and by
-- lms_confirm_email_check, and meaningless without a session because it
-- reads auth.uid().
revoke execute on function lms_sync_my_access() from public, anon;

-- Appointing and removing a facilitator. studio.ts calls both, and both
-- ask lms_is_admin() inside, so authenticated keeps them and the check
-- stays where it belongs. They were found by grepping for the control
-- room's own call wrapper rather than for .rpc, which had missed 59
-- function names and would have taken the control room down.
revoke execute on function lms_add_facilitator(text, text, text) from public, anon;
revoke execute on function lms_remove_facilitator(text) from public, anon;

-- AND THE GRANT IS MADE EXPLICIT, which is not tidying up.
--
-- lms_sync_my_access had NO grant of its own. Every role that could run
-- it was running it through PUBLIC, so revoking PUBLIC above took it
-- away from signed in learners as well, and academy.ts calls it on
-- every single sign in. The revoke alone would have broken the Academy
-- for everybody while looking, in the file, exactly like the seven
-- harmless lines above it. 21_verify row 4 is what caught it, by asking
-- whether authenticated still HAS each of these rather than only
-- whether anon has lost them.
--
-- So each of the eight is granted back to authenticated by name. Seven
-- of them already held it and the statement changes nothing for those,
-- which is the point: the file no longer depends on which earlier file
-- happened to grant what.
grant execute on function lms_has_course_access(uuid) to authenticated;
grant execute on function lms_complete_lesson(uuid) to authenticated;
grant execute on function lms_record_watch(uuid, integer, integer) to authenticated;
grant execute on function lms_start_quiz(uuid) to authenticated;
grant execute on function lms_submit_quiz(uuid, jsonb) to authenticated;
grant execute on function lms_sync_my_access() to authenticated;
grant execute on function lms_add_facilitator(text, text, text) to authenticated;
grant execute on function lms_remove_facilitator(text) to authenticated;

-- -------------------------------------------------------------- step 3
-- What this leaves behind, said out loud, so a run that did nothing is
-- not mistaken for a run that worked.
do $$
declare v_anon integer; v_total integer;
begin
  select count(*) into v_total from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'lms\_%';
  select count(*) into v_anon from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'lms\_%'
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  raise notice 'File 21 done. Of % lms_ functions, anon may now execute %. '
               'It should be 26: five policy helpers, five signed out page '
               'functions, one CHECK constraint validator and fifteen trigger '
               'functions. Run 21_verify.sql, which names them.', v_total, v_anon;
end $$;
