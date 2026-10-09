-- ===========================================================================
-- SEED FOR THE FILE 15 TESTS
--
-- Run this, then tests/file_15_tests.sql.
--
-- Everything it makes is prefixed t15- or ...15@example.com, and the clean up
-- at the top removes exactly that and nothing else.
--
-- ONE published course, t15-course, shaped so every state the learning
-- pages have to draw exists in it at once:
--
--   Module 1  "Getting in"      3 lessons, 300 seconds each, and a module quiz
--     L1  finished by the learner, its check passed
--     L2  half watched, its check NOT passed. This is the resume target
--     L3  locked, because L2 is not complete
--   Module 2  "Describing"      1 lesson, 300 seconds, no module quiz
--     L4  locked
--
-- Two quizzes, both published:
--   the check on L2   3 questions, created by lms_create_quiz, so it carries
--                     the real defaults a check gets: 100 percent, 20 tries
--   the module quiz   3 questions, 70 percent, 3 tries
--
-- Three people:
--   learner15   has access, and the progress above
--   nobody15    no access at all
--   admin15     an administrator, for the functions that need one
-- ===========================================================================

-- --------------------------------------------------------------- clean up
delete from lms_quiz_attempts where user_id in
  (select id from auth.users where email like '%15@example.com');
delete from lms_lesson_progress where user_id in
  (select id from auth.users where email like '%15@example.com');
delete from lms_watch_buckets where user_id in
  (select id from auth.users where email like '%15@example.com');
delete from lms_entitlements where course_id in
  (select id from lms_courses where slug like 't15-%');
delete from lms_options where question_id in
  (select q.id from lms_questions q join lms_quizzes z on z.id = q.quiz_id
    where z.module_id in (select m.id from lms_modules m join lms_courses c on c.id = m.course_id where c.slug like 't15-%')
       or z.lesson_id in (select l.id from lms_lessons l join lms_modules m on m.id = l.module_id
                           join lms_courses c on c.id = m.course_id where c.slug like 't15-%'));
delete from lms_questions where quiz_id in
  (select z.id from lms_quizzes z
    where z.module_id in (select m.id from lms_modules m join lms_courses c on c.id = m.course_id where c.slug like 't15-%')
       or z.lesson_id in (select l.id from lms_lessons l join lms_modules m on m.id = l.module_id
                           join lms_courses c on c.id = m.course_id where c.slug like 't15-%'));
delete from lms_quizzes where
      module_id in (select m.id from lms_modules m join lms_courses c on c.id = m.course_id where c.slug like 't15-%')
   or lesson_id in (select l.id from lms_lessons l join lms_modules m on m.id = l.module_id
                     join lms_courses c on c.id = m.course_id where c.slug like 't15-%');
delete from lms_lessons where module_id in
  (select m.id from lms_modules m join lms_courses c on c.id = m.course_id where c.slug like 't15-%');
delete from lms_modules where course_id in
  (select id from lms_courses where slug like 't15-%');
delete from lms_courses where slug like 't15-%';
delete from lms_profiles where id in
  (select id from auth.users where email like '%15@example.com');
delete from auth.users where email like '%15@example.com';

-- The daily watch table only exists after file 15, and this seed has to run
-- BEFORE file 15 too, so the tests can be watched failing. Hence the guard.
do $$ begin
  if to_regclass('public.lms_watch_days') is not null then
    execute 'delete from lms_watch_days where user_id in
               (select id from auth.users where email like ''%15@example.com'')';
  end if;
end $$;

-- ----------------------------------------------------------- a programme
insert into programmes (slug, title, code, template_key, active)
select 't15-programme', 'T15 test programme', 'T15', 'default', true
 where not exists (select 1 from programmes where slug = 't15-programme');

-- ------------------------------------------------------------------ people
insert into auth.users (id, email, email_confirmed_at)
values (gen_random_uuid(), 'learner15@example.com', now()),
       (gen_random_uuid(), 'nobody15@example.com', now()),
       (gen_random_uuid(), 'admin15@example.com', now());

insert into lms_profiles (id, full_name, role)
select id,
       case when email like 'learner%' then 'Learner Fifteen'
            when email like 'nobody%'  then 'Nobody Fifteen'
            else 'Admin Fifteen' end,
       case when email like 'admin%' then 'admin'::lms_role else 'learner'::lms_role end
  from auth.users where email like '%15@example.com'
on conflict (id) do update
   set full_name = excluded.full_name, role = excluded.role;

-- --------------------------------------------------------------- the course
-- Paid, so access has to be granted rather than being free to everybody.
-- That is what lets the tests take access away again.
insert into lms_courses (slug, title, summary, tool, area, level, cover_code,
                         price_kobo, first_module_free, status, programme_id,
                         outcomes, audience, prerequisites)
values ('t15-course', 'T15 learning course',
        'A course shaped so every state the learning pages draw exists at once.',
        'STATA', 'Analysis', 'Beginner', 'T5', 1000000, false, 'draft',
        (select id from programmes where slug = 't15-programme'),
        array['Watch a lesson', 'Pass a check', 'Pass a module quiz'],
        array['Anybody testing file 15'], array['Nothing']);

insert into lms_modules (course_id, title, position)
select c.id, m.title, m.position
  from lms_courses c,
       (values ('Getting in', 1), ('Describing', 2)) as m(title, position)
 where c.slug = 't15-course';

-- 300 seconds each, 10 second buckets, so 30 buckets is a whole lesson and
-- the 90 percent mark is 27 buckets. Those are small round numbers on
-- purpose: a test that needs arithmetic to read is a test nobody checks.
insert into lms_lessons (module_id, title, position, type, video_provider, video_ref,
                         duration_seconds, bucket_seconds, coverage_percent)
select m.id, l.title, l.position, 'video', 'youtube', l.ref, 300, 10, 90
  from lms_modules m
  join lms_courses c on c.id = m.course_id
  join (values
        ('Getting in',  'L1 opening',    1, 't15-ref-1'),
        ('Getting in',  'L2 cleaning',   2, 't15-ref-2'),
        ('Getting in',  'L3 recoding',   3, 't15-ref-3'),
        ('Describing',  'L4 summaries',  1, 't15-ref-4')
       ) as l(modtitle, title, position, ref) on l.modtitle = m.title
 where c.slug = 't15-course';

-- ------------------------------------------------------------- the quizzes
-- Made with lms_create_quiz, as an administrator, so they carry the REAL
-- defaults rather than defaults this seed made up. The whole point of
-- items 3 and 4 is what those defaults do.
do $$
declare v_admin uuid; v_l2 uuid; v_m1 uuid; v_check uuid; v_quiz uuid; i integer;
begin
  select id into v_admin from auth.users where email = 'admin15@example.com';
  perform set_config('request.jwt.claim.sub', v_admin::text, false);

  select l.id into v_l2 from lms_lessons l
    join lms_modules m on m.id = l.module_id
    join lms_courses c on c.id = m.course_id
   where c.slug = 't15-course' and l.title = 'L2 cleaning';
  select m.id into v_m1 from lms_modules m
    join lms_courses c on c.id = m.course_id
   where c.slug = 't15-course' and m.title = 'Getting in';

  v_check := lms_create_quiz(v_l2, null, 'L2 check');
  v_quiz  := lms_create_quiz(null, v_m1, 'Module 1 quiz');

  for i in 1..3 loop
    insert into lms_questions (quiz_id, prompt, type, position, marks, explanation)
    values (v_check, 'Check question ' || i, 'single', i, 1,
            'Because that is how it works, explained in one sentence.');
    insert into lms_options (question_id, label, is_correct, position)
    select q.id, o.label, o.ok, o.position
      from lms_questions q,
           (values ('right', true, 1), ('wrong', false, 2)) as o(label, ok, position)
     where q.quiz_id = v_check and q.position = i;

    insert into lms_questions (quiz_id, prompt, type, position, marks, explanation)
    values (v_quiz, 'Quiz question ' || i, 'single', i, 1,
            'The module quiz explanation for question ' || i || '.');
    insert into lms_options (question_id, label, is_correct, position)
    select q.id, o.label, o.ok, o.position
      from lms_questions q,
           (values ('right', true, 1), ('wrong', false, 2)) as o(label, ok, position)
     where q.quiz_id = v_quiz and q.position = i;
  end loop;

  -- shuffle off, so a test can rely on the order it gets them in
  update lms_quizzes set status = 'published', shuffle = false
   where id in (v_check, v_quiz);

  perform set_config('request.jwt.claim.sub', '', false);
end $$;

-- -------------------------------------------------------------- publish it
do $$
declare v_admin uuid; v_course uuid; v_blockers text;
begin
  select id into v_admin from auth.users where email = 'admin15@example.com';
  select id into v_course from lms_courses where slug = 't15-course';
  perform set_config('request.jwt.claim.sub', v_admin::text, false);
  select string_agg(label, '; ') into v_blockers
    from lms_course_blockers(v_course) where not ok;
  if v_blockers is not null then
    raise exception 'The t15 course cannot be published: %', v_blockers;
  end if;
  perform lms_publish_course(v_course);
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

-- ------------------------------------------------------------- the learner
-- Access, then the progress described at the top of this file. Written as
-- the owner rather than through the functions, because the point is to set
-- a starting state, not to test how it was reached.
do $$
declare v_learner uuid; v_course uuid; v_l1 uuid; v_l2 uuid; i integer;
begin
  select id into v_learner from auth.users where email = 'learner15@example.com';
  select id into v_course from lms_courses where slug = 't15-course';

  insert into lms_entitlements (user_id, course_id, source, status)
  values (v_learner, v_course, 'manual', 'active');

  select l.id into v_l1 from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = v_course and l.title = 'L1 opening';
  select l.id into v_l2 from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = v_course and l.title = 'L2 cleaning';

  -- L1: finished, check passed, and the coverage kept the way file 11 keeps
  -- it for a finished lesson whose slices have been thrown away
  insert into lms_lesson_progress (user_id, lesson_id, completed, completed_at,
                                   check_passed, check_passed_at, final_coverage,
                                   last_position_seconds)
  values (v_learner, v_l1, true, now() - interval '2 days', true,
          now() - interval '2 days', 100.00, 300);

  -- L2: 15 of 30 buckets, so 50 percent, stopped at 150 seconds
  -- first_seen_at an hour ago, not now. lms_record_watch refuses more
  -- than nine slices a minute as script-like, so fifteen slices dated
  -- this instant would make every later test's recording be refused,
  -- and they would fail for a reason that has nothing to do with the
  -- thing being tested.
  for i in 0..14 loop
    insert into lms_watch_buckets (user_id, lesson_id, bucket_index, first_seen_at)
    values (v_learner, v_l2, i, now() - interval '1 hour') on conflict do nothing;
  end loop;
  insert into lms_lesson_progress (user_id, lesson_id, last_position_seconds)
  values (v_learner, v_l2, 150)
  on conflict (user_id, lesson_id) do update set last_position_seconds = 150;
end $$;

do $$ begin raise notice 'Seed for file 15 ready. Now run tests/file_15_tests.sql.'; end $$;
