-- Undoes file 26. REFUSES unless you say you mean it.
--
-- PASTE 26_undo_EDITOR.sql, NOT THIS ONE.
--
-- WHAT UNDOING THIS PUTS BACK IS A MEASURED HOLE, which is the
-- strongest reason any of these undos has had. With file 26 undone, any
-- facilitator can again write any course's rows directly, whatever the
-- functions would have said: the title of a lesson in somebody else's
-- live course, every chapter of every course in one statement, and the
-- answer key of an exam that is nothing to do with them.
--
-- WHAT IT KEEPS. Nothing of anybody's work is touched by this file in
-- either direction. It moves policies and privileges and nothing else,
-- so no course, lesson, question or badge changes when it runs.
--
-- IT PUTS THE POLICIES BACK AS THEY WERE AT FILE 24, read out of a
-- database at that version rather than typed from memory, because a
-- hand copied policy is how you restore something subtly different from
-- what you had.

do $$
begin
  if coalesce(current_setting('lms.undo_26_force', true), '') <> 'yes, I mean it' then
    raise exception
      'This undo puts back a hole that was measured, not feared: a facilitator who owns no '
      'course could change a lesson in somebody else''s live course, empty every chapter of '
      'every course in one statement, and read another course''s answer key. If you mean it, '
      'paste this line at the top of this file and run the whole thing in one go, ending that '
      'line with a semicolon: '
      'select set_config(''lms.undo_26_force'', ''yes, I mean it'', false)';
  end if;
  raise notice 'Undo 26: going ahead.';
end $$;

-- ------------------------------------------------------------- step 1
-- The narrowed reads go, and the helper with them.
drop policy if exists p_q_staff_read   on lms_questions;
drop policy if exists p_opt_staff_read on lms_options;
drop policy if exists p_pop_staff_read on lms_popups;
drop function if exists lms_may_edit_quiz(uuid);

-- ------------------------------------------------------------- step 2
-- The privileges come back.
grant insert, update, delete on lms_courses          to authenticated;
grant insert, update, delete on lms_lessons          to authenticated;
grant insert, update, delete on lms_modules          to authenticated;
grant insert, update, delete on lms_quizzes          to authenticated;
grant insert, update, delete on lms_questions        to authenticated;
grant insert, update, delete on lms_options          to authenticated;
grant insert, update, delete on lms_lesson_chapters  to authenticated;
grant insert, update, delete on lms_areas            to authenticated;
grant insert, update, delete on lms_area_tools       to authenticated;
grant insert, update, delete on lms_course_areas     to authenticated;
grant insert, update, delete on lms_course_next      to authenticated;
grant insert, update, delete on lms_countries        to authenticated;
grant insert, update, delete on lms_ng_states        to authenticated;
grant insert, update, delete on lms_popups           to authenticated;

-- ------------------------------------------------------------- step 3
-- And the policies, exactly as file 24 left them.

drop policy if exists p_lms_area_tools_write on lms_area_tools;
create policy p_lms_area_tools_write on lms_area_tools
  for all to authenticated
  using (lms_is_staff())
  with check (lms_is_staff());

drop policy if exists p_lms_areas_write on lms_areas;
create policy p_lms_areas_write on lms_areas
  for all to authenticated
  using (lms_is_staff())
  with check (lms_is_staff());

drop policy if exists p_lms_countries_write on lms_countries;
create policy p_lms_countries_write on lms_countries
  for all to authenticated
  using (lms_is_staff())
  with check (lms_is_staff());

drop policy if exists p_lms_course_areas_write on lms_course_areas;
create policy p_lms_course_areas_write on lms_course_areas
  for all to authenticated
  using (lms_is_staff())
  with check (lms_is_staff());

drop policy if exists p_lms_course_next_write on lms_course_next;
create policy p_lms_course_next_write on lms_course_next
  for all to authenticated
  using (lms_is_staff())
  with check (lms_is_staff());

drop policy if exists p_courses_edit on lms_courses;
create policy p_courses_edit on lms_courses
  for all to authenticated
  using (lms_can_edit())
  with check (lms_can_edit());

drop policy if exists p_lms_lesson_chapters_write on lms_lesson_chapters;
create policy p_lms_lesson_chapters_write on lms_lesson_chapters
  for all to authenticated
  using (lms_is_staff())
  with check (lms_is_staff());

drop policy if exists p_lessons_edit on lms_lessons;
create policy p_lessons_edit on lms_lessons
  for all to authenticated
  using (lms_can_edit())
  with check (lms_can_edit());

drop policy if exists p_modules_edit on lms_modules;
create policy p_modules_edit on lms_modules
  for all to authenticated
  using (lms_can_edit())
  with check (lms_can_edit());

drop policy if exists p_lms_ng_states_write on lms_ng_states;
create policy p_lms_ng_states_write on lms_ng_states
  for all to authenticated
  using (lms_is_staff())
  with check (lms_is_staff());

drop policy if exists p_opt_staff_only on lms_options;
create policy p_opt_staff_only on lms_options
  for all to authenticated
  using (lms_can_edit())
  with check (lms_can_edit());

drop policy if exists p_pop_staff on lms_popups;
create policy p_pop_staff on lms_popups
  for all to authenticated
  using (lms_is_staff())
  with check (lms_is_staff());

drop policy if exists p_q_edit on lms_questions;
create policy p_q_edit on lms_questions
  for all to authenticated
  using (lms_can_edit())
  with check (lms_can_edit());

drop policy if exists p_q_staff_only on lms_questions;
create policy p_q_staff_only on lms_questions
  for select to authenticated
  using (lms_is_staff());

drop policy if exists p_quiz_edit on lms_quizzes;
create policy p_quiz_edit on lms_quizzes
  for all to authenticated
  using (lms_can_edit())
  with check (lms_can_edit());

-- ------------------------------------------------------------- step 4
-- What is left.
do $$ begin
  raise notice '--------------------------------------------------------';
  raise notice 'File 26 is undone.';
  raise notice '  A facilitator can again write any course directly.';
  raise notice '  The answer key of every exam is readable by any';
  raise notice '  member of staff, for courses that are not theirs.';
  raise notice '  Nothing anybody made has been changed by this file.';
  raise notice '  26_verify.sql now says NO on rows 1 to 6 and 8, and';
  raise notice '  yes on row 7. That is correct and is the hole back.';
  raise notice '--------------------------------------------------------';
end $$;
