-- GENERATED. Do not edit.
--
-- Made by scripts/lms/make-editor-sql.mjs from the file named below.
-- The comments between the function bodies are removed. Every body is
-- byte for byte what that file holds, and a test checks it.
--
-- Paste THIS one into the Supabase SQL Editor.
--
-- source: database/lms/26_table_writes.sql
do $$
declare v_missing text[] := '{}';
begin
  if to_regprocedure('public.lms_may_edit_course(uuid)') is null then
    v_missing := v_missing || 'lms_may_edit_course (file 10)'::text;
  end if;
  if to_regprocedure('public.lms_can_edit()') is null then
    v_missing := v_missing || 'lms_can_edit (file 10)'::text;
  end if;
  if to_regclass('public.lms_lesson_chapters') is null then
    v_missing := v_missing || 'lms_lesson_chapters (file 16)'::text;
  end if;
  if to_regclass('public.lms_module_badges') is null then
    v_missing := v_missing || 'lms_module_badges (file 24)'::text;
  end if;
  if array_length(v_missing, 1) is not null then
    raise exception 'File 26 cannot run yet. Missing: %', array_to_string(v_missing, ', ');
  end if;
  raise notice 'Step 0: files 01 to 24 are in place.';
end $$;

create or replace function lms_may_edit_quiz(p_quiz uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select lms_is_admin()
      or exists (
           select 1 from lms_quizzes q
            where q.id = p_quiz and q.course_id is not null
              and lms_may_edit_course(q.course_id))
      or exists (
           select 1 from lms_quizzes q
             join lms_modules m on m.id = q.module_id
            where q.id = p_quiz and lms_may_edit_course(m.course_id))
      or exists (
           select 1 from lms_quizzes q
             join lms_lessons l on l.id = q.lesson_id
             join lms_modules m on m.id = l.module_id
            where q.id = p_quiz and lms_may_edit_course(m.course_id))
$$;

revoke execute on function lms_may_edit_quiz(uuid) from public, anon;
grant execute on function lms_may_edit_quiz(uuid) to authenticated;

drop policy if exists p_courses_edit               on lms_courses;
drop policy if exists p_lessons_edit               on lms_lessons;
drop policy if exists p_modules_edit               on lms_modules;
drop policy if exists p_quiz_edit                  on lms_quizzes;
drop policy if exists p_q_edit                     on lms_questions;
drop policy if exists p_opt_staff_only             on lms_options;
drop policy if exists p_lms_lesson_chapters_write  on lms_lesson_chapters;
drop policy if exists p_lms_areas_write            on lms_areas;
drop policy if exists p_lms_area_tools_write       on lms_area_tools;
drop policy if exists p_lms_course_areas_write     on lms_course_areas;
drop policy if exists p_lms_course_next_write      on lms_course_next;
drop policy if exists p_lms_countries_write        on lms_countries;
drop policy if exists p_lms_ng_states_write        on lms_ng_states;
drop policy if exists p_pop_staff                  on lms_popups;

revoke insert, update, delete on lms_courses          from public, anon, authenticated;
revoke insert, update, delete on lms_lessons          from public, anon, authenticated;
revoke insert, update, delete on lms_modules          from public, anon, authenticated;
revoke insert, update, delete on lms_quizzes          from public, anon, authenticated;
revoke insert, update, delete on lms_questions        from public, anon, authenticated;
revoke insert, update, delete on lms_options          from public, anon, authenticated;
revoke insert, update, delete on lms_lesson_chapters  from public, anon, authenticated;
revoke insert, update, delete on lms_areas            from public, anon, authenticated;
revoke insert, update, delete on lms_area_tools       from public, anon, authenticated;
revoke insert, update, delete on lms_course_areas     from public, anon, authenticated;
revoke insert, update, delete on lms_course_next      from public, anon, authenticated;
revoke insert, update, delete on lms_countries        from public, anon, authenticated;
revoke insert, update, delete on lms_ng_states        from public, anon, authenticated;
revoke insert, update, delete on lms_popups           from public, anon, authenticated;

drop policy if exists p_q_staff_only on lms_questions;
drop policy if exists p_q_staff_read on lms_questions;
create policy p_q_staff_read on lms_questions
  for select to authenticated
  using (lms_may_edit_quiz(quiz_id));

drop policy if exists p_opt_staff_read on lms_options;
create policy p_opt_staff_read on lms_options
  for select to authenticated
  using (exists (select 1 from lms_questions qq
                  where qq.id = lms_options.question_id
                    and lms_may_edit_quiz(qq.quiz_id)));

drop policy if exists p_pop_staff_read on lms_popups;
create policy p_pop_staff_read on lms_popups
  for select to authenticated
  using (lms_is_staff());

drop policy if exists p_ent_admin      on lms_entitlements;
drop policy if exists p_fac_admin      on lms_facilitators;
drop policy if exists p_lp_admin_only  on lms_learner_profiles;
drop policy if exists p_pathc_admin    on lms_path_courses;
drop policy if exists p_paths_admin    on lms_paths;
drop policy if exists p_settings_admin on lms_settings;

revoke insert, update, delete on lms_entitlements     from public, anon, authenticated;
revoke insert, update, delete on lms_facilitators     from public, anon, authenticated;
revoke insert, update, delete on lms_learner_profiles from public, anon, authenticated;
revoke insert, update, delete on lms_path_courses     from public, anon, authenticated;
revoke insert, update, delete on lms_paths            from public, anon, authenticated;
revoke insert, update, delete on lms_settings         from public, anon, authenticated;

revoke select on lms_learner_profiles from public, anon, authenticated;

do $$
declare v_pol integer; v_grant integer;
begin
  select count(*) into v_pol
    from pg_policy p join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and p.polcmd <> 'r'
     and c.relname in ('lms_courses','lms_lessons','lms_modules','lms_quizzes',
                       'lms_questions','lms_options','lms_lesson_chapters','lms_areas',
                       'lms_area_tools','lms_course_areas','lms_course_next',
                       'lms_countries','lms_ng_states','lms_popups');

  select count(*) into v_grant
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('lms_courses','lms_lessons','lms_modules','lms_quizzes',
                        'lms_questions','lms_options','lms_lesson_chapters','lms_areas',
                        'lms_area_tools','lms_course_areas','lms_course_next',
                        'lms_countries','lms_ng_states','lms_popups')
     and grantee in ('anon','authenticated','PUBLIC')
     and privilege_type in ('INSERT','UPDATE','DELETE');

  raise notice '--------------------------------------------------------';
  raise notice 'File 26 is in.';
  raise notice '  Write policies left on those 14 tables: %', v_pol;
  raise notice '  Write grants left to anon, authenticated or public: %', v_grant;
  raise notice '  Both should read 0.';
  raise notice '  Every write now goes through a function that asks';
  raise notice '  lms_may_edit_course or lms_is_admin, and logs it.';
  raise notice '  A facilitator reads the answer key only for courses';
  raise notice '  they may edit. Administrators still read every one.';
  raise notice '  Learners and visitors are exactly where they were: 0.';
  raise notice '  The learner record with the sensitive field is now';
  raise notice '  reachable ONLY through lms_learner_record, which logs';
  raise notice '  every read, one learner at a time.';
  raise notice '  Run 26_verify_EDITOR.sql next. Nine rows, all yes.';
  raise notice '--------------------------------------------------------';
end $$;
