-- GENERATED. Do not edit.
--
-- Made by scripts/lms/make-editor-sql.mjs from the file named below.
-- The comments between the function bodies are removed. Every body is
-- byte for byte what that file holds, and a test checks it.
--
-- Paste THIS one into the Supabase SQL Editor.
--
-- source: database/lms/21_undo.sql
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

grant execute on function lms_link_participant(uuid, text) to anon, authenticated;
grant execute on function lms_grant_free_courses(uuid) to anon, authenticated;
grant execute on function lms_storage_report() to anon, authenticated;
grant execute on function lms_set_lesson_chapters(uuid, text) to authenticated;

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
