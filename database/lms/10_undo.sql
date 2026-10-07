-- =====================================================================
-- UNDO file 10 (version 2). Only if something has gone wrong.
--
-- This puts the database back to how 01 to 07 left it. Afterwards,
-- re-run 05_functions.sql, 06_policies.sql and 07_quizzes.sql so the
-- handful of functions file 10 rewrote go back to their original
-- wording.
--
-- One thing is deliberately NOT undone: the table permissions tightened
-- in step 9b. Putting TRUNCATE back into the hands of a visitor who is
-- not signed in would be restoring a flaw, so it is left alone. There is
-- a commented block at the very bottom if you truly want it back.
-- =====================================================================

-- ---------------- the nightly job ----------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute $c$ select cron.unschedule('lms-nightly-access') $c$;
      raise notice 'nightly job unscheduled.';
    exception when others then
      raise notice 'there was no nightly job to unschedule.';
    end;
  end if;
end $$;

drop function if exists lms_nightly_access_sweep();
drop function if exists lms_nightly_job_status();

-- ---------------- the guards ----------------
drop trigger if exists t_guard_course   on lms_courses;
drop trigger if exists t_guard_path     on lms_paths;
drop trigger if exists t_guard_quiz     on lms_quizzes;
drop trigger if exists t_guard_module   on lms_modules;
drop trigger if exists t_guard_lesson   on lms_lessons;
drop trigger if exists t_guard_question on lms_questions;
drop trigger if exists t_guard_option   on lms_options;

drop function if exists lms_guard_course();
drop function if exists lms_guard_path();
drop function if exists lms_guard_quiz();
drop function if exists lms_guard_module();
drop function if exists lms_guard_lesson();
drop function if exists lms_guard_question();
drop function if exists lms_guard_option();

-- ---------------- the role name, and the function bodies with it ------
do $$
declare r record;
begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
              where t.typname = 'lms_role' and e.enumlabel = 'facilitator') then
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

-- ---------------- course tables back to administrator only ------------
-- The policies have to go before the functions they depend on.
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

-- ---------------- the facilitator list and its functions --------------
-- lms_is_staff, lms_can_edit, lms_create_quiz, lms_import_questions and
-- the three lms_course_status_of_* helpers are left in place on purpose:
-- dropping any of them would break 06 or 07, or the functions that call
-- them, until those files were re-run. The sweep above has already put
-- lms_can_edit's wording back to the old role name, so it now means
-- exactly what lms_is_staff means, and no policy points at it any more.
drop function if exists lms_sync_my_access();
drop function if exists lms_add_facilitator(text,text,text);
drop function if exists lms_remove_facilitator(text);
drop table if exists lms_facilitators;

-- =====================================================================
-- Afterwards, re-run in this order:  05_functions.sql, 06_policies.sql,
-- 07_quizzes.sql. That restores lms_import_questions to the version
-- that deletes questions rather than retiring them, so if the reason you
-- are undoing is unrelated to the import, consider leaving step 8's
-- version in place.
-- =====================================================================

-- =====================================================================
-- NOT RUN. Only uncomment this if you really want the wide Supabase
-- default permissions back, including TRUNCATE for a visitor who is not
-- signed in. Row level security never filters TRUNCATE, which is why
-- step 9b took it away.
--
-- do $$
-- declare r record;
-- begin
--   for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--             where n.nspname = 'public' and c.relkind in ('r','v') and c.relname like 'lms\_%'
--   loop
--     execute format('grant all on public.%I to anon, authenticated', r.relname);
--   end loop;
-- end $$;
-- =====================================================================

drop function if exists lms_tidy_table_privileges();
