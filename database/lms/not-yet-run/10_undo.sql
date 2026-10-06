-- =====================================================================
-- UNDO file 10. Only if something has gone wrong.
--
-- This puts the database back to how 01-07 left it. Afterwards, re-run
-- 05_functions.sql, 06_policies.sql and 07_quizzes.sql so the handful
-- of functions file 10 rewrote go back to their original wording.
-- =====================================================================

-- put the role name back, and the function bodies with it
do $$
declare r record; v_stale text;
begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
              where t.typname = 'lms_role' and e.enumlabel = 'facilitator') then
    -- functions first, or they break the moment the label changes
    alter type lms_role rename value 'facilitator' to 'uploader';
    for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.prokind = 'f'
                and p.prosrc like '%''facilitator''%' order by p.proname
    loop
      execute replace(pg_get_functiondef(r.oid), '''facilitator''', '''uploader''');
      raise notice 'put %() back', r.proname;
    end loop;
    raise notice 'role name put back to uploader.';
  end if;
end $$;

-- anyone the list had promoted goes back to being a learner
update lms_profiles set role = 'learner' where role = 'uploader';

-- the policies have to go first: they depend on lms_can_edit()
drop policy if exists p_courses_edit on lms_courses;
create policy p_courses_admin_all on lms_courses
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());
drop policy if exists p_modules_edit on lms_modules;
create policy p_modules_admin on lms_modules
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());
drop policy if exists p_lessons_edit on lms_lessons;
create policy p_lessons_admin on lms_lessons
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());
drop policy if exists p_quiz_edit on lms_quizzes;
create policy p_quiz_admin on lms_quizzes
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());
drop policy if exists p_q_edit on lms_questions;
create policy p_q_admin on lms_questions
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());
drop policy if exists p_opt_staff_only on lms_options;
create policy p_opt_admin_only on lms_options
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());

-- lms_is_staff, lms_can_edit, lms_create_quiz and lms_import_questions
-- are left in place deliberately: dropping any of them would break 06 or
-- 07. Re-running 05, 06 and 07 restores their original wording.

-- now that no policy points at them, the new functions can go
drop function if exists lms_sync_my_access();
drop function if exists lms_add_facilitator(text,text,text);
drop function if exists lms_remove_facilitator(text);
drop table if exists lms_facilitators;

-- lms_can_edit() is deliberately LEFT IN PLACE. The two question-writing
-- functions from 07 still call it, so dropping it here would break them
-- until 07 was re-run. The sweep above has already put its wording back
-- to the old role name, so it now means exactly what lms_is_staff means,
-- and no policy points at it any more.
