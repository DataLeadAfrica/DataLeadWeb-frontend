-- Tests file 20. NOT for the Supabase editor.
--
-- THE TEST THAT WOULD HAVE CAUGHT THE FAULT. Section 2 builds a course
-- the way a facilitator builds one, from lms_create_course to nine of
-- nine publish checks, and inserts NOTHING by hand. Every row it makes
-- is made by the function the builder calls.
--
-- That is the whole point. My 6B tests built their course from a
-- fixture that already had lesson checks in it, so the path a
-- facilitator actually walks was never run end to end. The result was
-- that nothing in the control room created a lesson check, the
-- Questions page rendered its editor with an empty string, and no
-- course could be published at all. A test that starts from a fixture
-- can only ever prove things about the fixture.
--
-- If a future change breaks that path again, this file fails at the
-- step that broke, and the publish checks printed at the end say which
-- of the nine is not satisfied.

\set ON_ERROR_STOP on
begin;

create temporary table t20_out (n integer, label text, got text, want text) on commit drop;

create or replace function t20_say(p_label text, p_got text, p_want text)
returns void language plpgsql as $$
begin
  insert into t20_out values ((select coalesce(max(n), 0) + 1 from t20_out), p_label, p_got, p_want);
end $$;

-- --------------------------------------------------------------- setup
-- A facilitator and an administrator. The facilitator builds; only an
-- administrator may publish, which is file 17's rule and still holds.
insert into auth.users (id, email, email_confirmed_at, created_at) values
  ('20bb0000-0000-0000-0000-000000000001', 'builder20@example.com', now(), now() - interval '40 days'),
  ('20bb0000-0000-0000-0000-000000000009', 'admin20@example.com',   now(), now() - interval '40 days')
on conflict (id) do nothing;

update lms_profiles set role = 'facilitator', email_verified_at = now()
 where id = '20bb0000-0000-0000-0000-000000000001';
update lms_profiles set role = 'admin', email_verified_at = now()
 where id = '20bb0000-0000-0000-0000-000000000009';

-- ---------------------------------------------------------------------
-- 1. A video lesson is born with its check
-- ---------------------------------------------------------------------
do $$
declare v_c uuid; v_m uuid; v_l uuid; v_q uuid; v_r uuid; v_n integer;
begin
  perform set_config('request.jwt.claim.sub', '20bb0000-0000-0000-0000-000000000001', true);

  v_c := lms_create_course('Check At Birth', 'Analysis', 'Python', 'Beginner');
  v_m := lms_add_module(v_c, 'Module one');
  v_l := lms_save_lesson(null, v_m, 'A video lesson', '', 'video', 'abc123', 600, '');

  select q.id into v_q from lms_quizzes q where q.lesson_id = v_l;
  perform t20_say('1a a video lesson is made with a check already on it',
    case when v_q is null then 'no check' else 'has a check' end, 'has a check');

  -- The values file 10 uses, so a check made here and one made by
  -- lms_create_quiz are the same thing.
  perform t20_say('1b with the agreed settings',
    (select q.title || ' ' || q.pass_percent || ' ' || q.max_attempts || ' ' ||
            q.retake_after_minutes || ' ' || q.shuffle::text || ' ' || q.status
       from lms_quizzes q where q.id = v_q),
    'Check what you remember 100 20 0 true draft');

  -- One owner only, which the table's own rule requires.
  perform t20_say('1c and it belongs to the lesson and nothing else',
    (select (q.lesson_id is not null)::text || ' ' || (q.module_id is null)::text || ' ' ||
            (q.course_id is null)::text || ' ' || (q.path_id is null)::text
       from lms_quizzes q where q.id = v_q),
    'true true true true');

  -- A READING LESSON GETS NONE. Check 7 is about video lessons, and a
  -- check on a reading lesson would be a row nobody looks at.
  v_r := lms_save_lesson(null, v_m, 'A reading lesson', '', 'reading', null, null, null);
  perform t20_say('1d a lesson that is not a video gets no check',
    (select count(*) from lms_quizzes q where q.lesson_id = v_r)::text, '0');

  -- CHANGED TO VIDEO LATER, which is the case an ensure function hung
  -- off the Questions page would miss.
  perform lms_save_lesson(v_r, null, null, null, 'video', 'def456', 300, null);
  perform t20_say('1e and gets one when it becomes a video',
    (select count(*) from lms_quizzes q where q.lesson_id = v_r)::text, '1');

  -- Saving again does not make a second.
  perform lms_save_lesson(v_l, null, 'A video lesson, retitled', null, null, null, null, null);
  select count(*) into v_n from lms_quizzes q where q.lesson_id = v_l;
  perform t20_say('1f and saving a lesson again does not make another', v_n::text, '1');
end $$;

-- ---------------------------------------------------------------------
-- 2. A whole course, built the way the builder builds one
-- ---------------------------------------------------------------------
-- NOTHING IS INSERTED BY HAND IN THIS SECTION. Every row comes from a
-- function the control room calls, in the order a facilitator meets
-- them. That is what makes it worth having.
do $$
declare
  v_c uuid; v_m uuid; v_l uuid; v_check uuid; v_exam uuid;
  v_fails text; v_passes integer; v_i integer;
begin
  perform set_config('request.jwt.claim.sub', '20bb0000-0000-0000-0000-000000000001', true);

  -- 1. Make the course.
  v_c := lms_create_course('The Real Path', 'Analysis', 'Python', 'Beginner');

  -- 2. Fill in the details tab.
  perform lms_set_course_details(
    v_c,
    'The Real Path',
    'A short description of what this course is for, long enough to be a real one.',
    'Beginner'::lms_level,
    'Python',
    array['Clean a messy spreadsheet', 'Join two tables', 'Make a chart worth showing'],
    array['Anybody who works with data'],
    array['No prior coding'],
    null, null);

  -- 3. A module and a video lesson. The check arrives with the lesson.
  v_m := lms_add_module(v_c, 'Getting started');
  v_l := lms_save_lesson(null, v_m, 'The first video', 'What this covers',
                         'video', 'dQw4w9WgXcQ', 540, '');

  select q.id into v_check from lms_quizzes q where q.lesson_id = v_l;

  -- 4. A question in the lesson check. THIS IS THE STEP THAT WAS
  --    IMPOSSIBLE: the page had no quiz id to give, so it sent an empty
  --    string and Postgres answered "invalid input syntax for type
  --    uuid".
  perform lms_save_question(
    v_check, null,
    'Which of these is a spreadsheet column?',
    'A column runs down the page.',
    jsonb_build_array(
      jsonb_build_object('label', 'A column', 'is_correct', true),
      jsonb_build_object('label', 'A kettle', 'is_correct', false)),
    v_l, null);

  -- 5. The exam, and enough questions for check 9.
  --
  -- THIRTY, not a round ten. lms_ensure_course_exam makes an exam that
  -- serves 20 questions with a bank multiple of 1.5, and check 9 reads
  -- that rule off the exam row rather than having a number typed into
  -- it. So the bank it wants is ceil(20 * 1.5). Writing ten here and
  -- expecting a pass would be testing my arithmetic rather than the
  -- course.
  v_exam := lms_ensure_course_exam(v_c);
  for v_i in 1..30 loop
    perform lms_save_question(
      v_exam, null,
      'Exam question number ' || v_i || ', which needs a real prompt to be saved.',
      'Because that is the answer.',
      jsonb_build_array(
        jsonb_build_object('label', 'The right one', 'is_correct', true),
        jsonb_build_object('label', 'The wrong one', 'is_correct', false)),
      null, null);
  end loop;

  -- 6. What do the nine checks say now?
  select string_agg(n::text || ' ' || label, '; ' order by n) into v_fails
    from lms_publish_checks(v_c) where not passes;
  select count(*) into v_passes from lms_publish_checks(v_c) where passes;

  perform t20_say('2a a course built only through the builder passes every publish check',
    coalesce(v_fails, 'none fail'), 'none fail');
  perform t20_say('2b which is nine of them', v_passes::text, '9');

  -- 7. And an administrator can actually put it live.
  perform set_config('request.jwt.claim.sub', '20bb0000-0000-0000-0000-000000000009', true);
  declare
    r record;
  begin
    select * into r from lms_publish_course(v_c);
    perform t20_say('2c and an administrator can publish it',
      case when r.published then 'published' else 'refused: ' || coalesce(r.message, '') end,
      'published');
  end;

  perform t20_say('2d so the course is live',
    (select status::text from lms_courses where id = v_c), 'published');

  -- 8. Publishing publishes the lesson checks, which is file 17's rule.
  perform t20_say('2e and the lesson check went live with it',
    (select status::text from lms_quizzes where id = v_check), 'published');
end $$;

-- ---------------------------------------------------------------------
-- 3. The sweep, and running file 20 twice
-- ---------------------------------------------------------------------
do $$
declare v_without integer;
begin
  select count(*) into v_without
    from lms_lessons l
    join lms_modules m on m.id = l.module_id
    join lms_courses c on c.id = m.course_id
   where l.type = 'video' and c.status <> 'archived'
     and not exists (select 1 from lms_quizzes q where q.lesson_id = l.id);
  perform t20_say('3a no video lesson anywhere is left without a check',
    v_without::text, '0');
end $$;

-- ---------------------------------------------------------------------
-- 4. lms_create_quiz is no longer a way into somebody else course
-- ---------------------------------------------------------------------
do $$
declare
  v_other uuid; v_m uuid; v_l uuid; r_write text; r_grant text;
begin
  -- A course belonging to the ADMINISTRATOR, which the facilitator has
  -- no business writing into.
  perform set_config('request.jwt.claim.sub', '20bb0000-0000-0000-0000-000000000009', true);
  v_other := lms_create_course('Not Yours', 'Analysis', 'R', 'Beginner');
  v_m := lms_add_module(v_other, 'Module one');
  v_l := lms_save_lesson(null, v_m, 'Their lesson', '', 'reading', null, null, null);

  perform set_config('request.jwt.claim.sub', '20bb0000-0000-0000-0000-000000000001', true);
  begin
    perform lms_create_quiz(v_l, null, 'Sneaked in');
    r_write := 'allowed';
  exception when others then r_write := 'refused';
  end;
  perform t20_say('4a a facilitator cannot add questions to somebody else lesson',
    r_write, 'refused');

  r_grant := case when has_function_privilege('authenticated', 'lms_create_quiz(uuid, uuid, text)', 'EXECUTE')
                  then 'granted' else 'not granted' end;
  perform t20_say('4b and nothing signed in is granted it at all, since nothing calls it',
    r_grant, 'not granted');
end $$;

-- ------------------------------------------------------------- results
\pset tuples_only off
\pset format aligned
select n as "#", label as "what was checked",
       case when got is not distinct from want then 'pass' else 'FAIL' end as "result",
       got as "got", want as "wanted"
  from t20_out order by n;

select case when count(*) = 0 then 'ALL PASS'
            else count(*) || ' FAILED' end as "summary"
  from t20_out where got is distinct from want;

rollback;
