-- GENERATED. Do not edit.
--
-- Made by scripts/lms/make-editor-sql.mjs from the file named below.
-- The comments between the function bodies are removed. Every body is
-- byte for byte what that file holds, and a test checks it.
--
-- Paste THIS one into the Supabase SQL Editor.
--
-- source: database/lms/21_execute_privileges.sql
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

revoke execute on function lms_link_participant(uuid, text) from public, anon, authenticated;

revoke execute on function lms_grant_free_courses(uuid) from public, anon, authenticated;

revoke execute on function lms_storage_report() from public, anon, authenticated;

revoke execute on function lms_set_lesson_chapters(uuid, text) from public, anon, authenticated;

revoke execute on function lms_claim_bootcamp_access() from public, anon, authenticated;

revoke execute on function lms_course_blockers(uuid) from public, anon, authenticated;

revoke execute on function lms_course_progress(uuid) from public, anon, authenticated;

revoke execute on function lms_course_status_of_lesson(uuid) from public, anon, authenticated;

revoke execute on function lms_course_status_of_module(uuid) from public, anon, authenticated;

revoke execute on function lms_course_status_of_quiz(uuid) from public, anon, authenticated;

revoke execute on function lms_import_questions(uuid, jsonb) from public, anon, authenticated;

revoke execute on function lms_is_lesson_unlocked(uuid) from public, anon, authenticated;

revoke execute on function lms_quiz_kind(uuid) from public, anon, authenticated;

revoke execute on function lms_watch_coverage(uuid) from public, anon, authenticated;

revoke execute on function lms_has_course_access(uuid) from public, anon;

revoke execute on function lms_complete_lesson(uuid) from public, anon;

revoke execute on function lms_record_watch(uuid, integer, integer) from public, anon;

revoke execute on function lms_start_quiz(uuid) from public, anon;

revoke execute on function lms_submit_quiz(uuid, jsonb) from public, anon;

revoke execute on function lms_sync_my_access() from public, anon;

revoke execute on function lms_add_facilitator(text, text, text) from public, anon;
revoke execute on function lms_remove_facilitator(text) from public, anon;

grant execute on function lms_has_course_access(uuid) to authenticated;
grant execute on function lms_complete_lesson(uuid) to authenticated;
grant execute on function lms_record_watch(uuid, integer, integer) to authenticated;
grant execute on function lms_start_quiz(uuid) to authenticated;
grant execute on function lms_submit_quiz(uuid, jsonb) to authenticated;
grant execute on function lms_sync_my_access() to authenticated;
grant execute on function lms_add_facilitator(text, text, text) to authenticated;
grant execute on function lms_remove_facilitator(text) to authenticated;

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
