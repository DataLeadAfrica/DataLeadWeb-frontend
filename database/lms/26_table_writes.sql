-- =====================================================================
-- FILE 26. A facilitator could edit courses that are not theirs.
--
-- PASTE 26_table_writes_EDITOR.sql, NOT THIS ONE. The two hold the same
-- statements and a test keeps them in step. The plain English is in
-- docs/lms/PHASE-6F-PLAIN.md and 26_verify.sql checks the result.
--
-- THE FAULT. The ownership rule lives in the functions and the table
-- policies go around it.
--
--   lms_can_edit()        is "are you staff", nothing more.
--   lms_may_edit_course() is the real rule: an administrator, or the
--                         facilitator who created that course.
--
-- Six tables carry an ALL policy using the first one, and eight more
-- carry an ALL policy using lms_is_staff(), which is the same thing by
-- another name. So any facilitator could write any course's rows
-- directly, whatever the functions would have said.
--
-- MEASURED, not feared. As a facilitator who owned no course, through
-- row level security, on a database built from 01 to 24:
--
--   the title of a lesson in somebody else's LIVE course was changed,
--   "delete from lms_lesson_chapters where true" removed every chapter
--   of every course, live ones included, and
--   the answer key of another course's exam was readable, is_correct
--   and all.
--
-- Some guards did hold. A live course's summary and a live exam's
-- answers were refused. But a draft course belonging to somebody else
-- has no such guard, and nor do the chapters.
--
-- LEARNERS WERE NEVER THE PROBLEM. A learner reads 0 questions and 0
-- options, and so does a visitor, before this file and after it. This
-- is a staff to staff hole.
--
-- WHY TAKING THE WRITE AWAY IS SAFE, which was checked rather than
-- assumed, because the lesson of file 21 is that a sweep built on a
-- guess breaks the site twice over.
--
--   NOTHING IN THE BROWSER WRITES THESE TABLES. Every .from("...") in
--   src was read along with the method chained onto it, not matched
--   against one grep pattern. Nine direct writes exist in the whole
--   site and all nine are to posts, post_events and the blog's own
--   profiles. There is no .from() with a computed name anywhere, and no
--   raw fetch at the REST surface, so there is no path a scan of
--   literals could have missed.
--
--   EVERY FUNCTION THAT WRITES THEM IS SECURITY DEFINER. Thirty two
--   functions write these fourteen tables and all thirty two run as
--   their owner, so none of them notices this file. A security invoker
--   one would have broken, and there are none.
--
--   THE SIX TABLES THE SITE READS DIRECTLY are lms_path_courses,
--   lms_paths, lms_popups, lms_profiles, lms_quizzes and lms_settings.
--   Their SELECT is untouched here.
--
-- THE TRAP THIS FILE HAD TO AVOID. Two of the policies being dropped
-- are ALL policies that were also the only thing granting staff a READ:
-- lms_options and lms_popups have no SELECT policy of their own.
-- Dropping those two without putting a read back would have taken the
-- questions screen and the popups screen down for everybody, including
-- administrators. Step 4 puts both back. Every other table in the list
-- has a SELECT policy that names lms_is_staff() itself, so staff keep
-- their read without anything being done.
--
-- WHAT IS DELIBERATELY NOT IN HERE. lms_profiles keeps its self write,
-- which is limited by column grants, and a learner still cannot set
-- email_verified_at. lms_popup_seen keeps its own row insert, which is
-- harmless. Both were asked about and both are left exactly as they
-- are. The tables whose only write policy is lms_is_admin() are also
-- left alone: that is a different question, it is in the verify file's
-- allow list with a reason, and it is a decision rather than an
-- oversight.
-- =====================================================================

-- -------------------------------------------------------------- step 0
-- Files 01 to 24 first.
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

-- -------------------------------------------------------------- step 1
-- The rule the narrowed reads ask.
--
-- A QUESTION BELONGS TO A COURSE BY ONE OF THREE ROUTES, because a quiz
-- can be the course exam, a lesson check, or an old module quiz that
-- file 16 stopped anybody making but did not delete. All three are
-- asked, so a facilitator keeps the questions they really own.
--
-- A PATH EXAM BELONGS TO NOBODY IN PARTICULAR. It is administrators
-- only everywhere else, so lms_is_admin() at the top covers it and no
-- facilitator reaches one.
--
-- SECURITY DEFINER, so it reads lms_quizzes as its owner. A policy that
-- asked the table through the querying role would recurse into the very
-- policy being evaluated.
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

-- IT IS USED INSIDE A POLICY, so the roles the policy applies to must be
-- able to execute it. A policy helper that authenticated cannot run
-- answers "permission denied" to an ordinary read, which is the file 21
-- lesson about the function sitting inside a CHECK constraint, arriving
-- again in a different shape. PUBLIC and anon are still taken off.
revoke execute on function lms_may_edit_quiz(uuid) from public, anon;
grant execute on function lms_may_edit_quiz(uuid) to authenticated;

-- -------------------------------------------------------------- step 2
-- The write policies go.
--
-- Named one at a time rather than swept out of pg_policy, so that this
-- file says exactly what it changes and a policy somebody adds later is
-- not removed by a statement written before it existed.
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

-- -------------------------------------------------------------- step 3
-- And so do the privileges that were behind them.
--
-- BOTH HALVES, exactly as file 23 needed both. A policy dropped while
-- the privilege stands is one re-granted policy away from being back,
-- and a privilege revoked while the policy stands is the same thing in
-- reverse. PUBLIC is named as well as anon and authenticated, because a
-- grant to PUBLIC is held by every role at once and is the one a check
-- written against two role names would miss.
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

-- -------------------------------------------------------------- step 4
-- The two reads that were riding on a write policy, put back narrowed.
--
-- lms_options and lms_popups had no SELECT policy of their own: the ALL
-- policy dropped above was the only thing letting staff read them. Put
-- back as read only, and for the answer key, put back narrower than it
-- was.

-- THE ANSWER KEY, for the courses a person may actually edit.
--
-- A facilitator has no reason to read another course's answers, and
-- before this they could read every one. An administrator still reads
-- all of them, which is what lms_is_admin() inside lms_may_edit_quiz
-- gives.
--
-- THE LEARNER POSITION DOES NOT MOVE. A learner and a visitor read 0
-- questions and 0 options before this file and after it, because
-- neither policy names them and a table with row level security on and
-- no policy for your role returns nothing. is_correct still never
-- leaves the server for a learner: lms_start_quiz and lms_start_exam do
-- not select it.
-- DROPPED BEFORE EACH CREATE, all three of them, because there is no
-- "create policy if not exists" and this file has to be safe to run a
-- second time. The first version of it was not, and the second run
-- stopped on "policy already exists".
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

-- THE POPUPS SCREEN READS THIS TABLE DIRECTLY, which is why the read
-- has to come back rather than simply go. Staff only, and read only:
-- every change to a popup goes through lms_save_popup, lms_start_popup
-- or lms_stop_popup, all three of which run as their owner.
drop policy if exists p_pop_staff_read on lms_popups;
create policy p_pop_staff_read on lms_popups
  for select to authenticated
  using (lms_is_staff());

-- -------------------------------------------------------------- step 5
-- The six that answer only to lms_is_admin().
--
-- ADDED AFTER THE FIRST VERSION, because the allow list in the verify
-- file called these "a separate question" and two of them were not.
--
-- lms_learner_profiles WAS A DATA PROTECTION HOLE. The rule is that
-- only administrators read disability_detail, ONE LEARNER AT A TIME
-- through lms_learner_record, and that every read is logged in
-- lms_admin_actions. Measured: an administrator read EVERY row at once,
-- directly, disability_detail included, with nothing logged. The first
-- clause held and the other two did not. Under the Nigeria Data
-- Protection Act 2023 those two are the clauses that matter.
--
-- lms_entitlements CONTRADICTED A RULE WE SET. Writes to entitlements
-- are server side only, and an administrator granted a learner course
-- access directly from the browser.
--
-- The other four are the same shape and lower stakes: writing them
-- directly skips the function that records who did it.
--
-- SAFE FOR THE SAME REASONS. Fifteen functions write these six and all
-- fifteen are security definer. The site reads lms_paths,
-- lms_path_courses and lms_settings directly and writes none of them,
-- and all three keep a SELECT policy of their own.
--
-- THE READ TRAP, AGAIN, ON TWO OF THEM. lms_facilitators and
-- lms_learner_profiles have no SELECT policy of their own, so dropping
-- the ALL policy takes the direct read with it. For lms_facilitators
-- that is simply correct: nothing reads it directly, the Staff screen
-- goes through a function. For lms_learner_profiles it is the point of
-- the exercise, and the grant is taken away as well so that the logged
-- route is not merely the sensible way in but the only one.
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

-- THE SENSITIVE ONE, SHUT COMPLETELY. Nothing reads this record as the
-- person asking: no policy references it, no security invoker function
-- reads it, and no view is built on it, all three of which were checked
-- rather than assumed. lms_learner_record and lms_my_profile are
-- security definer and read it as the owner, so they are untouched, and
-- lms_learner_record is the one that writes the log.
revoke select on lms_learner_profiles from public, anon, authenticated;

-- -------------------------------------------------------------- step 6
-- What changed.
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
