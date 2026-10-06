-- =====================================================================
-- 006  LOCKING IT DOWN
--
-- Every table has row level security on. The default is that nobody can
-- do anything; each policy below opens one specific door.
--
-- The rules that matter most:
--   * nobody can write their own entitlement, so nobody can give
--     themselves a paid course
--   * lms_options holds which answer is right, and is readable by
--     NOBODY except an admin. Learners receive questions through a
--     function that leaves that column out entirely
--   * nobody can write a watch bucket directly, only the function can
-- =====================================================================

alter table lms_profiles        enable row level security;
alter table lms_admin_actions   enable row level security;
alter table lms_courses         enable row level security;
alter table lms_modules         enable row level security;
alter table lms_lessons         enable row level security;
alter table lms_paths           enable row level security;
alter table lms_path_courses    enable row level security;
alter table lms_settings        enable row level security;
alter table lms_entitlements    enable row level security;
alter table lms_orders          enable row level security;
alter table lms_payment_events  enable row level security;
alter table lms_lesson_progress enable row level security;
alter table lms_watch_buckets   enable row level security;
alter table lms_quizzes         enable row level security;
alter table lms_questions       enable row level security;
alter table lms_options         enable row level security;
alter table lms_quiz_attempts   enable row level security;

-- ---------------------------------------------------------------- profiles
drop policy if exists p_profiles_self_read on lms_profiles;
create policy p_profiles_self_read on lms_profiles
  for select to authenticated using (id = auth.uid() or lms_is_admin());

drop policy if exists p_profiles_self_write on lms_profiles;
create policy p_profiles_self_write on lms_profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = lms_my_role());   -- cannot promote yourself

drop policy if exists p_profiles_admin_write on lms_profiles;
create policy p_profiles_admin_write on lms_profiles
  for update to authenticated using (lms_is_admin()) with check (lms_is_admin());

-- ---------------------------------------------------------------- audit
drop policy if exists p_audit_admin on lms_admin_actions;
create policy p_audit_admin on lms_admin_actions
  for select to authenticated using (lms_is_admin());

-- ---------------------------------------------------------------- catalogue
drop policy if exists p_courses_public on lms_courses;
create policy p_courses_public on lms_courses
  for select to anon, authenticated using (status = 'published' or lms_is_staff());

drop policy if exists p_courses_admin_all on lms_courses;
create policy p_courses_admin_all on lms_courses
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());

drop policy if exists p_modules_public on lms_modules;
create policy p_modules_public on lms_modules
  for select to anon, authenticated using (
    lms_is_staff() or exists (
      select 1 from lms_courses c where c.id = course_id and c.status = 'published'));

drop policy if exists p_modules_admin on lms_modules;
create policy p_modules_admin on lms_modules
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());

-- Lesson rows are visible so the syllabus can be shown, but the video
-- reference is only useful to someone who can open it, and the player
-- checks lms_lesson_is_open before it will play anything.
drop policy if exists p_lessons_public on lms_lessons;
create policy p_lessons_public on lms_lessons
  for select to anon, authenticated using (
    lms_is_staff() or exists (
      select 1 from lms_modules m join lms_courses c on c.id = m.course_id
       where m.id = module_id and c.status = 'published'));

drop policy if exists p_lessons_admin on lms_lessons;
create policy p_lessons_admin on lms_lessons
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());

-- an uploader may change ONLY the video fields, nothing else
drop policy if exists p_lessons_uploader on lms_lessons;
create policy p_lessons_uploader on lms_lessons
  for update to authenticated
  using (lms_my_role() = 'uploader')
  with check (lms_my_role() = 'uploader');

drop policy if exists p_paths_public on lms_paths;
create policy p_paths_public on lms_paths
  for select to anon, authenticated using (status = 'published' or lms_is_admin());
drop policy if exists p_paths_admin on lms_paths;
create policy p_paths_admin on lms_paths
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());

drop policy if exists p_pathc_public on lms_path_courses;
create policy p_pathc_public on lms_path_courses
  for select to anon, authenticated using (true);
drop policy if exists p_pathc_admin on lms_path_courses;
create policy p_pathc_admin on lms_path_courses
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());

drop policy if exists p_settings_public on lms_settings;
create policy p_settings_public on lms_settings
  for select to anon, authenticated using (true);
drop policy if exists p_settings_admin on lms_settings;
create policy p_settings_admin on lms_settings
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());

-- ---------------------------------------------------------------- access
-- Read your own. Write NOTHING. Grants come from functions only.
drop policy if exists p_ent_self on lms_entitlements;
create policy p_ent_self on lms_entitlements
  for select to authenticated using (user_id = auth.uid() or lms_is_admin());

drop policy if exists p_ent_admin on lms_entitlements;
create policy p_ent_admin on lms_entitlements
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());

drop policy if exists p_orders_self on lms_orders;
create policy p_orders_self on lms_orders
  for select to authenticated using (user_id = auth.uid() or lms_is_admin());

-- no policy at all on lms_payment_events: only the webhook, which runs
-- as the service role, ever touches it

-- ---------------------------------------------------------------- progress
drop policy if exists p_prog_self on lms_lesson_progress;
create policy p_prog_self on lms_lesson_progress
  for select to authenticated using (user_id = auth.uid() or lms_is_admin());

drop policy if exists p_prog_self_write on lms_lesson_progress;
create policy p_prog_self_write on lms_lesson_progress
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- read your own watch record, but never write one: only lms_record_watch
drop policy if exists p_buckets_self on lms_watch_buckets;
create policy p_buckets_self on lms_watch_buckets
  for select to authenticated using (user_id = auth.uid() or lms_is_admin());

-- ---------------------------------------------------------------- quizzes
drop policy if exists p_quiz_public on lms_quizzes;
create policy p_quiz_public on lms_quizzes
  for select to authenticated using (status = 'published' or lms_is_admin());
drop policy if exists p_quiz_admin on lms_quizzes;
create policy p_quiz_admin on lms_quizzes
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());

-- Questions are readable, because the prompt is not a secret.
drop policy if exists p_q_public on lms_questions;
create policy p_q_public on lms_questions
  for select to authenticated using (lms_is_admin() or exists (
    select 1 from lms_quizzes z where z.id = quiz_id and z.status = 'published'));
drop policy if exists p_q_admin on lms_questions;
create policy p_q_admin on lms_questions
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());

-- THE IMPORTANT ONE. lms_options carries is_correct. Admins only.
-- Everyone else gets questions through lms_start_quiz, which never
-- returns that column.
drop policy if exists p_opt_admin_only on lms_options;
create policy p_opt_admin_only on lms_options
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());

drop policy if exists p_att_self on lms_quiz_attempts;
create policy p_att_self on lms_quiz_attempts
  for select to authenticated using (user_id = auth.uid() or lms_is_admin());

-- ---------------------------------------------------------------- grants
grant select on lms_courses, lms_modules, lms_lessons, lms_paths,
                lms_path_courses, lms_settings, lms_course_cards to anon, authenticated;
grant select on lms_profiles, lms_entitlements, lms_orders, lms_lesson_progress,
                lms_watch_buckets, lms_quizzes, lms_questions, lms_quiz_attempts,
                lms_admin_actions to authenticated;
grant insert, update, delete on lms_courses, lms_modules, lms_lessons, lms_paths,
                lms_path_courses, lms_quizzes, lms_questions, lms_options,
                lms_entitlements to authenticated;
grant update on lms_settings, lms_profiles, lms_lesson_progress to authenticated;
grant select on lms_options to authenticated;   -- still blocked by the policy above

grant execute on function lms_has_course_access(uuid), lms_lesson_is_open(uuid),
  lms_is_lesson_unlocked(uuid), lms_watch_coverage(uuid), lms_record_watch(uuid,integer,integer),
  lms_complete_lesson(uuid), lms_start_quiz(uuid), lms_submit_quiz(uuid,jsonb),
  lms_claim_bootcamp_access(), lms_course_progress(uuid), lms_course_blockers(uuid),
  lms_publish_course(uuid), lms_unpublish_course(uuid), lms_my_role(), lms_is_admin(), lms_is_staff()
  to authenticated;
grant execute on function lms_course_blockers(uuid) to anon;

-- ---------------------------------------------------------------- sign up hook
drop trigger if exists lms_on_auth_user_created on auth.users;
create trigger lms_on_auth_user_created
  after insert on auth.users
  for each row execute function lms_handle_new_user();
