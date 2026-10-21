-- Undoes file 21. PASTE 21_undo_EDITOR.sql, NOT THIS ONE.
--
-- IT REFUSES UNLESS YOU SAY YOU MEAN IT, like the undos for 19 and 20,
-- because what it puts back is three live faults and not a preference.
--
-- Running this hands back to every visitor, signed in or out:
--
--   lms_link_participant, which joins an account to a certification
--   record by email address and asks nothing about who is calling. This
--   is the one the review used, as a plain learner, to join an account to
--   somebody else's unlinked record.
--
--   lms_grant_free_courses, which grants free courses to any account id
--   it is given.
--
--   lms_storage_report, which reads row counts and sizes for anybody.
--
-- It also reopens lms_set_lesson_chapters, letting one facilitator
-- rewrite the chapter list of another published course. Note that file
-- 20 shuts that one too, so undoing 21 alone leaves it shut unless file
-- 20 has also been undone. Live has all four shut by hand, so running
-- this on live would undo work done there by hand as well as work done
-- by these files.
--
-- WHAT IT DOES NOT DO. It does not put back the PUBLIC grant on the
-- eight signed in functions, and it does not take away the explicit
-- grants to authenticated that file 21 added. Both are deliberate.
-- PUBLIC on a function that reads auth.uid() was never useful to
-- anybody, and removing the explicit grants would break the Academy for
-- signed in learners, which is the opposite of what an undo is for.
-- lms_sync_my_access in particular had no grant of its own before file
-- 21 and would stop working for everybody.

do $$
begin
  if coalesce(current_setting('lms.undo_21_force', true), '') <> 'yes, I mean it' then
    raise exception
      'This undo hands three security definer functions back to every visitor, '
      'including one that joins an account to somebody certification record by '
      'email and checks nothing about who asked. If you mean it, paste this line '
      'at the top of this file, above the begin, and run the whole thing in one '
      'go, ending that line with a semicolon: '
      'select set_config(''lms.undo_21_force'', ''yes, I mean it'', false)';
  end if;
end $$;

begin;

-- the three that were open, and the chapter saver
grant execute on function lms_link_participant(uuid, text) to anon, authenticated;
grant execute on function lms_grant_free_courses(uuid) to anon, authenticated;
grant execute on function lms_storage_report() to anon, authenticated;
grant execute on function lms_set_lesson_chapters(uuid, text) to authenticated;

-- and the ten others that nothing calls
grant execute on function lms_claim_bootcamp_access() to anon, authenticated;
grant execute on function lms_course_blockers(uuid) to anon, authenticated;
grant execute on function lms_course_progress(uuid) to anon, authenticated;
grant execute on function lms_course_status_of_lesson(uuid) to anon, authenticated;
grant execute on function lms_course_status_of_module(uuid) to anon, authenticated;
grant execute on function lms_course_status_of_quiz(uuid) to anon, authenticated;
grant execute on function lms_import_questions(uuid, jsonb) to anon, authenticated;
grant execute on function lms_is_lesson_unlocked(uuid) to anon, authenticated;
grant execute on function lms_quiz_kind(uuid) to anon, authenticated;
grant execute on function lms_watch_coverage(uuid) to anon, authenticated;

-- and anon gets the eight signed in ones back
grant execute on function lms_has_course_access(uuid) to anon;
grant execute on function lms_complete_lesson(uuid) to anon;
grant execute on function lms_record_watch(uuid, integer, integer) to anon;
grant execute on function lms_start_quiz(uuid) to anon;
grant execute on function lms_submit_quiz(uuid, jsonb) to anon;
grant execute on function lms_sync_my_access() to anon;
grant execute on function lms_add_facilitator(text, text, text) to anon;
grant execute on function lms_remove_facilitator(text) to anon;

do $$ begin
  raise notice 'File 21 undone. Three security definer functions that check '
               'nothing about their caller are reachable by every visitor again, '
               'and 21_verify.sql will now say NO on rows 1, 3, 4, 8 and 11. '
               'Re-run 21_execute_privileges.sql to shut them.';
end $$;

commit;
