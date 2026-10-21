-- LOCAL TEST HARNESS ONLY. NEVER RUN THIS ON SUPABASE.
--
-- It makes staff, makes learners, builds a course, sits an exam and
-- tries every refusal file 17 promises. Everything is rolled back at the
-- end, but it WRITES while it runs, which is why it is not for the SQL
-- editor.
--
--   psql -d <db> -f database/lms/tests/file_17_tests.sql
--
-- Run it on a database that has files 01 to 17.
--
-- WHAT THIS FILE IS FOR, and it is not the same job as 17_verify.sql.
-- The verify file asks "is the machinery there": does the function
-- exist, does the policy say what it should. This file asks "does the
-- machinery do anything": it signs in AS a facilitator and tries to
-- publish, AS a learner and tries to read an exam question. A promise
-- about permissions that has never been tried by somebody who should be
-- refused is a promise nobody has checked.

\set ON_ERROR_STOP on
\pset pager off
begin;

create temporary table t17_out (n serial, label text, got text, want text) on commit drop;

create or replace function t17_say(p_label text, p_got text, p_want text)
returns void language plpgsql as $$
begin insert into t17_out (label, got, want) values (p_label, p_got, p_want); end $$;

/** Become somebody, for the rest of the transaction. */
create or replace function t17_be(p_user uuid)
returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true); end $$;

-- SETTING THE JWT CLAIM IS NOT THE SAME AS BEING A LEARNER, and two
-- checks in this file were quietly proving nothing until that was
-- noticed.
--
-- psql connects as postgres, which owns these tables. Row level
-- security does not apply to a table's owner unless the table is set to
-- FORCE it, and none of ours are. So a test that sets the claim and
-- then reads lms_questions reads EVERY row, policies or no policies.
-- One such check returned 0 and looked like a pass, because the table
-- it read happened to be empty. The other returned 32 and caught it.
--
-- The fix is "set local role authenticated" around anything testing a
-- POLICY rather than a function. Inside that, the policies are the only
-- thing standing between the caller and the table, which is the
-- situation a browser is actually in.
\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------
-- The cast: two facilitators, one administrator, two learners
-- ---------------------------------------------------------------------
do $$
declare
  v_fac1  uuid := 'a7000000-0000-0000-0000-000000000001';
  v_fac2  uuid := 'a7000000-0000-0000-0000-000000000002';
  v_admin uuid := 'a7000000-0000-0000-0000-000000000003';
  v_lrn1  uuid := 'a7000000-0000-0000-0000-000000000004';
begin
  insert into auth.users (id, email, email_confirmed_at, created_at) values
    (v_fac1,  'fac1@t17.invalid',  now(), now() - interval '40 days'),
    (v_fac2,  'fac2@t17.invalid',  now(), now() - interval '40 days'),
    (v_admin, 'admin@t17.invalid', now(), now() - interval '40 days'),
    (v_lrn1,  'lrn1@t17.invalid',  now(), now() - interval '10 days')
  on conflict (id) do nothing;

  update lms_profiles set role = 'facilitator' where id in (v_fac1, v_fac2);
  update lms_profiles set role = 'admin'       where id = v_admin;
end $$;


-- =====================================================================
-- 1. A COURSE IS BORN WITH EVERYTHING IT NEEDS (item 1)
-- =====================================================================
do $$
declare v_c uuid; v_n integer;
begin
  perform t17_be('a7000000-0000-0000-0000-000000000001');
  v_c := lms_create_course('Pandas for M and E', 'Analysis', 'Python', 'Beginner');

  perform t17_say('1a a new course is a draft',
    lms_course_state(v_c), 'draft');

  perform t17_say('1b it gets a programme, so a certificate can be issued',
    (select case when programme_id is null then 'none' else 'yes' end
       from lms_courses where id = v_c), 'yes');

  select count(*) into v_n from lms_modules where course_id = v_c;
  perform t17_say('1c it gets module 1, so the builder does not open on a dead end',
    v_n::text, '1');

  select count(*) into v_n from lms_quizzes where course_id = v_c;
  perform t17_say('1d it gets exactly one course exam', v_n::text, '1');

  perform t17_say('1e and that exam is a draft, because its bank is empty',
    (select status::text from lms_quizzes where course_id = v_c), 'draft');

  perform t17_say('1f the slug came from the title',
    (select slug from lms_courses where id = v_c), 'pandas-for-m-and-e');
exception when others then
  perform t17_say('1a a new course is a draft', 'refused: ' || sqlerrm, 'draft');
end $$;


-- =====================================================================
-- 2. ONE FACILITATOR CANNOT TOUCH ANOTHER'S COURSE (item 12)
-- =====================================================================
do $$
declare v_c uuid;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';

  -- fac2 is a facilitator, and a perfectly good one. It is not theirs.
  perform t17_be('a7000000-0000-0000-0000-000000000002');

  perform t17_say('2a a facilitator may not edit a course they did not build',
    lms_may_edit_course(v_c)::text, 'false');

  begin
    perform * from lms_publish_checks(v_c);
    perform t17_say('2b nor read its publish checks', 'allowed', 'refused');
  exception when others then
    perform t17_say('2b nor read its publish checks', 'refused', 'refused');
  end;

  begin
    perform lms_set_course_details(v_c, p_summary => 'I was never here');
    perform t17_say('2c nor change its words', 'allowed', 'refused');
  exception when others then
    perform t17_say('2c nor change its words', 'refused', 'refused');
  end;

  -- and the one that matters: the owner still can
  perform t17_be('a7000000-0000-0000-0000-000000000001');
  perform t17_say('2d but the facilitator who built it still can',
    lms_may_edit_course(v_c)::text, 'true');
end $$;


-- =====================================================================
-- 3. A FACILITATOR CANNOT PUBLISH (item 12)
-- =====================================================================
do $$
declare v_c uuid; v_ok boolean; v_msg text;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';

  perform t17_be('a7000000-0000-0000-0000-000000000001');
  select published, message into v_ok, v_msg from lms_publish_course(v_c);
  perform t17_say('3a a facilitator cannot publish, and is told why',
    v_ok::text || ' / ' || v_msg,
    'false / Only an administrator can publish a course.');

  -- An administrator cannot publish it either, yet, because it is not
  -- ready. That is the nine checks doing their job rather than the role.
  perform t17_be('a7000000-0000-0000-0000-000000000003');
  select published into v_ok from lms_publish_course(v_c);
  perform t17_say('3b nor can an administrator, while checks still fail',
    v_ok::text, 'false');

  -- Named rather than counted. A number here would pass for the wrong
  -- reason the first time somebody adds a tenth check.
  perform t17_say('3c and the checks name exactly what is missing',
    (select string_agg(b.label, '; ' order by b.n) from lms_publish_checks(v_c) b where not b.passes),
    'Has a short description; Has at least one lesson; '
    || 'Has at least three things a learner will be able to do; '
    || 'The course exam has enough questions');
end $$;


-- =====================================================================
-- 4. THE NINE CHECKS GO GREEN AS THE COURSE IS BUILT (item 1)
-- =====================================================================
do $$
declare
  v_c uuid; v_m uuid; v_l uuid; v_q uuid; v_exam uuid; v_i integer;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';
  perform t17_be('a7000000-0000-0000-0000-000000000001');

  perform lms_set_course_details(v_c,
    p_summary  => 'Clean a messy spreadsheet with pandas, step by step.',
    p_outcomes => array['Load a CSV','Clean a column','Group and count']);

  select id into v_m from lms_modules where course_id = v_c;
  insert into lms_lessons (module_id, title, type, position, video_provider, video_ref,
                           duration_seconds, coverage_percent)
  values (v_m, 'Loading a CSV', 'video', 1, 'youtube', 'dQw22Ab0', 360, 100)
  returning id into v_l;

  -- Its lesson check. File 10's guard refuses a set of questions that
  -- is born published, which is right: it would be a live check with
  -- nothing in it. So it starts as a draft, gets its question, and is
  -- then published, which is exactly the order the builder uses.
  insert into lms_quizzes (lesson_id, title, status, pass_percent)
  values (v_l, 'Loading a CSV check', 'draft', 100) returning id into v_q;
  perform lms_save_question(v_q, null, 'What does read_csv return?', 'A DataFrame.',
    '[{"label":"A DataFrame","is_correct":true},{"label":"A list","is_correct":false}]'::jsonb);
  -- NOT published here, and that is the point: a facilitator builds it
  -- and the administrator publishing the course publishes it too.

  -- and the exam bank: 30 for a serve of 20
  select id into v_exam from lms_quizzes where course_id = v_c;
  for v_i in 1 .. 30 loop
    perform lms_save_question(v_exam, null, 'Exam question ' || v_i, 'Because.',
      ('[{"label":"Right ' || v_i || '","is_correct":true},{"label":"Wrong ' || v_i || '","is_correct":false}]')::jsonb);
  end loop;

  perform t17_say('4a with the course built, every check passes',
    (select count(*)::text from lms_publish_checks(v_c) b where not b.passes), '0');
end $$;


-- =====================================================================
-- 5. SENDING FOR REVIEW, AND PUBLISHING (item 1)
-- =====================================================================
do $$
declare v_c uuid; v_ok boolean; v_msg text;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';

  perform t17_be('a7000000-0000-0000-0000-000000000001');
  perform lms_send_for_review(v_c, 'Ready when you are.');
  perform t17_say('5a a sent draft reads as ready for review',
    lms_course_state(v_c), 'review');

  perform t17_be('a7000000-0000-0000-0000-000000000003');
  begin
    perform lms_send_back(v_c, '');
    perform t17_say('5b sending it back with no note is refused', 'allowed', 'refused');
  exception when others then
    perform t17_say('5b sending it back with no note is refused', 'refused', 'refused');
  end;

  select published, message into v_ok, v_msg from lms_publish_course(v_c);
  perform t17_say('5c an administrator publishes it', v_ok::text || ' / ' || v_msg,
    'true / Published.');
  perform t17_say('5d and it is no longer waiting for review',
    lms_course_state(v_c), 'published');

  perform t17_say('5e publishing the course published its lesson checks',
    (select count(*)::text from lms_quizzes q
      join lms_lessons l on l.id = q.lesson_id
      join lms_modules m on m.id = l.module_id
     where m.course_id = v_c and q.status = 'published'), '1');

  perform t17_say('5f the publish is in the activity log',
    (select count(*)::text from lms_admin_actions
      where action = 'course_published' and subject_id = v_c), '1');
end $$;


-- =====================================================================
-- 6. A PUBLISHED COURSE: WORDS YES, VIDEO NO (item 1)
-- =====================================================================
do $$
declare v_c uuid; v_l uuid;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';
  select l.id into v_l from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = v_c limit 1;
  perform t17_be('a7000000-0000-0000-0000-000000000001');

  update lms_lessons set title = 'Loading a CSV file' where id = v_l;
  perform t17_say('6a the title of a live lesson can be fixed',
    (select title from lms_lessons where id = v_l), 'Loading a CSV file');

  begin
    update lms_lessons set video_ref = 'somethingElse' where id = v_l;
    perform t17_say('6b but its video cannot change', 'allowed', 'refused');
  exception when others then
    perform t17_say('6b but its video cannot change', 'refused', 'refused');
  end;

  begin
    update lms_lessons set duration_seconds = 999 where id = v_l;
    perform t17_say('6c nor its length', 'allowed', 'refused');
  exception when others then
    perform t17_say('6c nor its length', 'refused', 'refused');
  end;

  begin
    update lms_lessons set position = 7 where id = v_l;
    perform t17_say('6d nor its place in the order', 'allowed', 'refused');
  exception when others then
    perform t17_say('6d nor its place in the order', 'refused', 'refused');
  end;
end $$;


-- =====================================================================
-- 7. AN ANSWERED QUESTION IS FROZEN (item 3)
-- =====================================================================
do $$
declare v_c uuid; v_exam uuid; v_q uuid;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';
  select id into v_exam from lms_quizzes where course_id = v_c;
  select id into v_q from lms_questions where quiz_id = v_exam order by position limit 1;

  perform t17_say('7a a question nobody has sat is not locked',
    lms_question_is_locked(v_q)::text, 'false');

  -- somebody sits it
  insert into lms_quiz_attempts (user_id, quiz_id, attempt_no, served_question_ids, submitted_at)
  values ('a7000000-0000-0000-0000-000000000004', v_exam, 1, array[v_q], now());

  perform t17_say('7b once it has been served it is locked',
    lms_question_is_locked(v_q)::text, 'true');

  perform t17_be('a7000000-0000-0000-0000-000000000001');

  -- wording: still allowed, because improving a badly worded question
  -- is a Tuesday job
  perform lms_save_question(v_exam, v_q, 'Exam question 1, reworded');
  perform t17_say('7c its wording can still be improved',
    (select prompt from lms_questions where id = v_q), 'Exam question 1, reworded');

  begin
    perform lms_save_question(v_exam, v_q, null, null,
      '[{"label":"A new answer","is_correct":true},{"label":"Another","is_correct":false}]'::jsonb);
    perform t17_say('7d but its options and answer cannot change', 'allowed', 'refused');
  exception when others then
    perform t17_say('7d but its options and answer cannot change', 'refused', 'refused');
  end;

  perform lms_retire_question(v_q);
  perform t17_say('7e retiring it keeps the row, so old attempts still make sense',
    (select case when active then 'still active' else 'retired, row kept' end
       from lms_questions where id = v_q), 'retired, row kept');
end $$;


-- =====================================================================
-- 8. PASTE FROM A SHEET: THE GOOD ROWS LAND, THE BAD ONES ARE NAMED
-- =====================================================================
do $$
declare v_c uuid; v_exam uuid; v_added integer; v_skipped integer; v_first text;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';
  select id into v_exam from lms_quizzes where course_id = v_c;
  perform t17_be('a7000000-0000-0000-0000-000000000001');

  create temporary table t17_paste on commit drop as
  select * from lms_paste_questions(v_exam, '[
    {"Question":"A good row","A":"Yes","B":"No","Right":"A","Why":"Because."},
    {"Question":"","A":"Yes","B":"No","Right":"A"},
    {"Question":"Only one option","A":"Yes","Right":"A"},
    {"Question":"Right points nowhere","A":"Yes","B":"No","Right":"D"},
    {"Question":"No Right at all","A":"Yes","B":"No"},
    {"Question":"Time with no lesson","A":"Yes","B":"No","Right":"B","Time":"2:30"},
    {"Question":"Another good row","A":"Yes","B":"No","C":"Maybe","Right":"C"}
  ]'::jsonb);

  select count(*) filter (where outcome = 'added'),
         count(*) filter (where outcome = 'skipped')
    into v_added, v_skipped from t17_paste;

  perform t17_say('8a the two good rows are added', v_added::text, '2');
  perform t17_say('8b the five bad rows are skipped, not the whole paste',
    v_skipped::text, '5');

  perform t17_say('8c and each one says why, by row number',
    (select detail from t17_paste where row_no = 4),
    'Right says "D", which is not one of the options given.');

  perform t17_say('8d a time with no lesson is named rather than ignored',
    (select detail from t17_paste where row_no = 6),
    'There is a Time but no Lesson, so there is nothing for it to be a time in.');
end $$;


-- =====================================================================
-- 9. LEARNERS ARE ADMINISTRATORS ONLY, EVERY ROUTE (items 4 and 12)
-- =====================================================================
do $$
declare v_n integer;
begin
  perform t17_be('a7000000-0000-0000-0000-000000000001');

  begin
    perform * from lms_staff_learners();
    perform t17_say('9a a facilitator cannot read the learner list', 'allowed', 'refused');
  exception when others then
    perform t17_say('9a a facilitator cannot read the learner list', 'refused', 'refused');
  end;

  begin
    perform * from lms_learner_record('a7000000-0000-0000-0000-000000000004');
    perform t17_say('9b nor one learner record', 'allowed', 'refused');
  exception when others then
    perform t17_say('9b nor one learner record', 'refused', 'refused');
  end;

  begin
    perform * from lms_report_who('disability');
    perform t17_say('9c nor who our learners are', 'allowed', 'refused');
  exception when others then
    perform t17_say('9c nor who our learners are', 'refused', 'refused');
  end;

  begin
    perform lms_give_access('a7000000-0000-0000-0000-000000000004',
      (select id from lms_courses where slug = 'pandas-for-m-and-e'), 'because');
    perform t17_say('9d nor give anybody access', 'allowed', 'refused');
  exception when others then
    perform t17_say('9d nor give anybody access', 'refused', 'refused');
  end;

end $$;

-- A facilitator reading lms_learner_profiles DIRECTLY, which is the
-- route that goes through no function at all, only the policy. As the
-- authenticated role, so the policy is what answers.
do $$
declare v_got text;
begin
  perform t17_be('a7000000-0000-0000-0000-000000000001');
  -- The read happens as authenticated and the ANSWER is kept in a
  -- variable. Writing the result down has to wait until the role is
  -- back, because authenticated cannot write to this file's own results
  -- table either, which is the point.
  begin
    set local role authenticated;
    v_got := (select count(*) from lms_learner_profiles)::text || ' rows';
    reset role;
  exception when others then
    reset role;
    v_got := 'refused';
  end;
  perform t17_say('9e nor read the About you table directly', v_got, '0 rows');
end $$;


-- =====================================================================
-- 10. ACCESS, WITH A REASON, LOGGED (item 4)
-- =====================================================================
do $$
declare v_c uuid;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';
  perform t17_be('a7000000-0000-0000-0000-000000000003');

  begin
    perform lms_give_access('a7000000-0000-0000-0000-000000000004', v_c, '');
    perform t17_say('10a access with no reason is refused', 'allowed', 'refused');
  exception when others then
    perform t17_say('10a access with no reason is refused', 'refused', 'refused');
  end;

  begin
    perform lms_give_access('a7000000-0000-0000-0000-000000000004', v_c, 'a reason', 'roster');
    perform t17_say('10b bootcamp access is not given by hand', 'allowed', 'refused');
  exception when others then
    perform t17_say('10b bootcamp access is not given by hand', 'refused', 'refused');
  end;

  perform lms_give_access('a7000000-0000-0000-0000-000000000004', v_c, 'Scholarship for the cohort', 'scholarship');
  -- One live grant per learner per course, so a scholarship given to
  -- somebody who already holds the free grant LIFTS it rather than
  -- adding a second row or silently doing nothing.
  perform t17_say('10c with a reason it lands, lifting the free grant rather than doing nothing',
    coalesce((select string_agg(e.source::text || '/' || e.status::text, ', ')
                from lms_entitlements e
               where e.user_id = 'a7000000-0000-0000-0000-000000000004'
                 and e.course_id = v_c), 'nothing at all'),
    'scholarship/active');

  perform t17_say('10d and the reason is in the log',
    (select detail ->> 'reason' from lms_admin_actions
      where action = 'access_given' order by created_at desc limit 1),
    'Scholarship for the cohort');

  perform lms_remove_access('a7000000-0000-0000-0000-000000000004', v_c, 'Cohort ended');
  perform t17_say('10e removing it revokes rather than deletes',
    (select status::text from lms_entitlements
      where user_id = 'a7000000-0000-0000-0000-000000000004' and course_id = v_c
        and source = 'scholarship'), 'revoked');
end $$;


-- =====================================================================
-- 11. THE ACTIVITY LOG CANNOT BE EDITED (item 11)
-- =====================================================================
do $$
declare v_before integer; v_after integer;
begin
  perform t17_be('a7000000-0000-0000-0000-000000000003');
  select count(*) into v_before from lms_admin_actions;

  begin
    update lms_admin_actions set action = 'nothing happened' where true;
    perform t17_say('11a an administrator cannot change a log row', 'allowed', 'refused');
  exception when others then
    perform t17_say('11a an administrator cannot change a log row', 'refused', 'refused');
  end;

  begin
    delete from lms_admin_actions where true;
    perform t17_say('11b nor delete one', 'allowed', 'refused');
  exception when others then
    perform t17_say('11b nor delete one', 'refused', 'refused');
  end;

  select count(*) into v_after from lms_admin_actions;
  perform t17_say('11c and nothing was lost trying',
    (v_after >= v_before)::text, 'true');
end $$;


-- =====================================================================
-- 12. NOBODY MAKES AN ADMINISTRATOR FROM A PAGE (roles)
-- =====================================================================
do $$
begin
  perform t17_be('a7000000-0000-0000-0000-000000000003');
  begin
    perform lms_set_staff_role('a7000000-0000-0000-0000-000000000001', 'admin');
    perform t17_say('12a an administrator cannot make another from a page', 'allowed', 'refused');
  exception when others then
    perform t17_say('12a an administrator cannot make another from a page', 'refused', 'refused');
  end;

  perform lms_set_staff_role('a7000000-0000-0000-0000-000000000004', 'facilitator');
  perform t17_say('12b but a facilitator can be made',
    (select role::text from lms_profiles where id = 'a7000000-0000-0000-0000-000000000004'),
    'facilitator');

  begin
    perform lms_set_staff_role('a7000000-0000-0000-0000-000000000003', 'learner');
    perform t17_say('12c and nobody can change their own role', 'allowed', 'refused');
  exception when others then
    perform t17_say('12c and nobody can change their own role', 'refused', 'refused');
  end;
end $$;


-- =====================================================================
-- 13. PRICE IS ADMINISTRATORS ONLY, AND BOTH NUMBERS ARE LOGGED (item 2)
-- =====================================================================
do $$
declare v_c uuid;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';

  perform t17_be('a7000000-0000-0000-0000-000000000001');
  begin
    perform lms_set_course_price(v_c, 500000);
    perform t17_say('13a a facilitator cannot set a price', 'allowed', 'refused');
  exception when others then
    perform t17_say('13a a facilitator cannot set a price', 'refused', 'refused');
  end;

  perform t17_be('a7000000-0000-0000-0000-000000000003');
  perform lms_set_course_price(v_c, 500000, true);
  perform t17_say('13b an administrator can',
    (select price_kobo::text from lms_courses where id = v_c), '500000');

  perform t17_say('13c and the log carries the old number and the new one',
    (select (detail ->> 'was_kobo') || ' to ' || (detail ->> 'now_kobo')
       from lms_admin_actions where action = 'course_price_changed'
      order by created_at desc limit 1), '0 to 500000');
end $$;


-- =====================================================================
-- 14. ONE POPUP LIVE AT A TIME, AND NEVER OVER A LESSON (item 9)
-- =====================================================================
do $$
declare v_a uuid; v_b uuid;
begin
  perform t17_be('a7000000-0000-0000-0000-000000000003');

  begin
    perform lms_save_popup(p_heading => 'Nowhere', p_message => 'No button target');
    perform t17_say('14z a popup pointing nowhere is refused', 'allowed', 'refused');
  exception when others then
    perform t17_say('14z a popup pointing nowhere is refused', 'refused', 'refused');
  end;

  v_a := lms_save_popup(p_heading => 'First', p_message => 'One',
                        p_url => 'https://dataleadafrica.com/lms/courses');
  perform t17_say('14a a new popup starts as a draft',
    (select status from lms_popups where id = v_a), 'draft');

  begin
    perform lms_save_popup(p_heading => 'Bad', p_place => 'lesson',
                           p_url => 'https://dataleadafrica.com/lms');
    perform t17_say('14b a popup cannot be put on a lesson', 'allowed', 'refused');
  exception when others then
    perform t17_say('14b a popup cannot be put on a lesson', 'refused', 'refused');
  end;

  v_b := lms_save_popup(p_heading => 'Second', p_message => 'Two',
                        p_url => 'https://dataleadafrica.com/lms');
  perform lms_start_popup(v_a);
  perform lms_start_popup(v_b);
  perform t17_say('14c starting one stands the other down',
    (select count(*)::text from lms_popups where status = 'live'), '1');
  perform t17_say('14d and it is the one just started',
    (select heading from lms_popups where status = 'live'), 'Second');
end $$;


-- =====================================================================
-- 15. REPORTS: A FACILITATOR SEES ONLY THEIR OWN (item 7)
-- =====================================================================
do $$
declare v_c uuid; v_other uuid; v_n integer;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';

  -- fac2 builds one of their own, so there is something to NOT see
  perform t17_be('a7000000-0000-0000-0000-000000000002');
  v_other := lms_create_course('Fac Two Course', 'Analysis', 'STATA');

  perform t17_be('a7000000-0000-0000-0000-000000000001');
  begin
    perform * from lms_report_funnel(v_other);
    perform t17_say('15a a facilitator cannot see another course funnel', 'allowed', 'refused');
  exception when others then
    perform t17_say('15a a facilitator cannot see another course funnel', 'refused', 'refused');
  end;

  select count(*) into v_n from lms_report_funnel(v_c);
  perform t17_say('15b but their own has its five stages', v_n::text, '5');

  -- the activity log, same rule
  select count(*) into v_n from lms_activity_log()
   where subject_type = 'learner';
  perform t17_say('15c and the log shows them nothing about a learner', v_n::text, '0');
end $$;


-- =====================================================================
-- 16. A LEARNER IS STILL A LEARNER (nothing widened)
-- =====================================================================
do $$
declare v_n integer; v_c uuid;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';
  -- somebody with no role at all
  insert into auth.users (id, email, email_confirmed_at)
  values ('a7000000-0000-0000-0000-000000000009', 'plain@t17.invalid', now())
  on conflict (id) do nothing;
  perform t17_be('a7000000-0000-0000-0000-000000000009');

  begin
    perform lms_create_course('I should not exist');
    perform t17_say('16a a learner cannot create a course', 'allowed', 'refused');
  exception when others then
    perform t17_say('16a a learner cannot create a course', 'refused', 'refused');
  end;

  begin
    perform * from lms_studio_overview();
    perform t17_say('16b nor open the control room', 'allowed', 'refused');
  exception when others then
    perform t17_say('16b nor open the control room', 'refused', 'refused');
  end;

  begin
    perform * from lms_activity_log();
    perform t17_say('16c nor read the activity log', 'allowed', 'refused');
  exception when others then
    perform t17_say('16c nor read the activity log', 'refused', 'refused');
  end;

end $$;

-- THE ONE FILE 16'S REVIEW WAS ABOUT: an exam question read straight off
-- the table by somebody holding nothing. As the authenticated role, so
-- the policy answers rather than table ownership.
do $$
declare v_c uuid; v_q text; v_o text;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';
  perform t17_be('a7000000-0000-0000-0000-000000000009');
  begin
    set local role authenticated;
    v_q := (select count(*) from lms_questions q
              join lms_quizzes z on z.id = q.quiz_id where z.course_id = v_c)::text || ' questions';
    v_o := (select count(*) from lms_options)::text || ' options';
    reset role;
  exception when others then
    reset role;
    v_q := coalesce(v_q, 'refused');
    v_o := coalesce(v_o, 'refused');
  end;
  perform t17_say('16d and still reads no exam questions', v_q, '0 questions');
  perform t17_say('16e nor any option, which is where the answers are', v_o, '0 options');
end $$;


-- =====================================================================
-- 17. EVERY READ FUNCTION IS ACTUALLY CALLED
-- =====================================================================
--
-- THIS SECTION EXISTS BECAUSE THREE FUNCTIONS SHIPPED READING COLUMNS
-- THAT DO NOT EXIST. lms_studio_certificates and
-- lms_studio_certificate_counts read ct.revoked_at; the column is
-- revoked, a boolean. lms_studio_health read mail_outbox.sent_at; the
-- column is sent, a boolean. schema-snapshot.md had said so all along.
--
-- Nothing caught them because PL/pgSQL resolves a column name only when
-- the function RUNS, and every test above was about a refusal. I had
-- tested that the wrong people are turned away from these pages and
-- never once that the right people get a page.
--
-- So this calls every read function in file 17, as an administrator and
-- as a facilitator, and asks only that it does not raise. It does not
-- check what comes back: the point is to execute every line of SQL in
-- them at least once.
do $$
declare
  v_fn   text;
  v_bad  text[] := '{}';
  v_c    uuid;
  v_exam uuid;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';
  select id into v_exam from lms_quizzes where course_id = v_c;

  perform t17_be('a7000000-0000-0000-0000-000000000003');

  foreach v_fn in array array[
    'select * from lms_studio_certificates()',
    'select * from lms_studio_certificate_counts()',
    'select * from lms_studio_health()',
    'select * from lms_studio_biggest_tables()',
    'select * from lms_studio_staff()',
    'select * from lms_activity_log()',
    'select * from lms_areas_overview()',
    'select * from lms_studio_overview()',
    'select * from lms_report_active_days(7)',
    'select * from lms_report_active_days(30)',
    'select * from lms_report_active_days(90)',
    'select * from lms_report_hard_questions()',
    'select * from lms_report_who(''gender'')',
    'select * from lms_staff_learners()',
    'select * from lms_learner_totals(''country'')'
  ] loop
    begin
      execute v_fn;
    exception when others then
      v_bad := v_bad || (v_fn || ' -> ' || sqlerrm);
    end;
  end loop;

  -- The ones that need a course or an exam.
  foreach v_fn in array array[
    'select * from lms_publish_checks($1)',
    'select * from lms_studio_course($1)',
    'select * from lms_report_funnel($1)',
    'select * from lms_report_lesson_drop($1)',
    'select * from lms_report_hard_questions($1)'
  ] loop
    begin
      execute v_fn using v_c;
    exception when others then
      v_bad := v_bad || (v_fn || ' -> ' || sqlerrm);
    end;
  end loop;

  begin
    execute 'select * from lms_studio_questions($1)' using v_exam;
  exception when others then
    v_bad := v_bad || ('lms_studio_questions -> ' || sqlerrm);
  end;

  perform t17_say('17a every read function runs as an administrator',
    case when array_length(v_bad, 1) is null then 'all of them ran'
         else array_to_string(v_bad, ' | ') end,
    'all of them ran');
end $$;

do $$
declare v_fn text; v_bad text[] := '{}'; v_c uuid;
begin
  select id into v_c from lms_courses where slug = 'pandas-for-m-and-e';
  perform t17_be('a7000000-0000-0000-0000-000000000001');

  -- The four a facilitator is allowed, on their own course. Anything
  -- that raises 42501 here would be a page they cannot use at all.
  foreach v_fn in array array[
    'select * from lms_studio_overview()',
    'select * from lms_areas_overview()',
    'select * from lms_activity_log()',
    'select * from lms_report_active_days(30)'
  ] loop
    begin
      execute v_fn;
    exception when others then
      v_bad := v_bad || (v_fn || ' -> ' || sqlerrm);
    end;
  end loop;

  foreach v_fn in array array[
    'select * from lms_studio_course($1)',
    'select * from lms_publish_checks($1)',
    'select * from lms_report_funnel($1)',
    'select * from lms_report_lesson_drop($1)'
  ] loop
    begin
      execute v_fn using v_c;
    exception when others then
      v_bad := v_bad || (v_fn || ' -> ' || sqlerrm);
    end;
  end loop;

  perform t17_say('17b and the four a facilitator may use run for them too',
    case when array_length(v_bad, 1) is null then 'all of them ran'
         else array_to_string(v_bad, ' | ') end,
    'all of them ran');
end $$;


-- =====================================================================
-- 18. AN ADMINISTRATOR CANNOT BE DEMOTED FROM A PAGE
-- =====================================================================
do $$
begin
  perform t17_be('a7000000-0000-0000-0000-000000000003');

  -- fac2 is made an administrator the only way it can be done, by hand.
  -- OUTSIDE the block below, because a caught exception in plpgsql rolls
  -- back to the start of ITS block, and doing the promotion inside would
  -- have undone it along with the thing being tested. 18b then reported
  -- "facilitator" and looked like a failure of the fix rather than of
  -- the test.
  update lms_profiles set role = 'admin' where id = 'a7000000-0000-0000-0000-000000000002';

  begin
    perform lms_set_staff_role('a7000000-0000-0000-0000-000000000002', 'learner');
    perform t17_say('18a an administrator cannot demote the other administrator',
      'allowed', 'refused');
  exception when others then
    perform t17_say('18a an administrator cannot demote the other administrator',
      'refused', 'refused');
  end;

  perform t17_say('18b and the other administrator is still one',
    (select role::text from lms_profiles where id = 'a7000000-0000-0000-0000-000000000002'),
    'admin');
end $$;


-- ---------------------------------------------------------------------
-- 19. "New learners" counts learners, not staff
-- ---------------------------------------------------------------------
-- IT COUNTED EVERY ROW IN auth.users. On Big Sam's database that read 2
-- when both accounts were administrators and there were no learners at
-- all. Staff were counted, and so was anybody who had started a sign up
-- and never confirmed their email address.
--
-- This is a COUNTING mistake, so a test that reads the source for the
-- word "learner" would pass whatever the count came out as. The only
-- test worth having makes three accounts of known kinds and asks what
-- the number says, which is what this does.
do $$
declare
  v_admin   uuid := 'a7000000-0000-0000-0000-000000000002';
  v_learner uuid := 'c9000000-0000-0000-0000-00000000f001';
  v_unconf  uuid := 'c9000000-0000-0000-0000-00000000f002';
  v_old     uuid := 'c9000000-0000-0000-0000-00000000f003';
  v_week    jsonb;
  v_before  integer;
begin
  -- MEASURED AS A CHANGE, not as an absolute number. Earlier sections of
  -- this file make learners of their own, so "how many new learners" is
  -- not 1 here and a test expecting 1 fails for the wrong reason. What
  -- the bug was about is WHICH accounts get counted, and that shows in
  -- the change when three accounts of known kinds are added: it must go
  -- up by exactly one.
  perform t17_be(v_admin);
  v_before := (select lms_studio_overview() -> 'week' ->> 'new_learners')::integer;
  perform t17_be(null);
  -- One confirmed learner who signed up today. Counts.
  insert into auth.users (id, email, created_at, email_confirmed_at)
       values (v_learner, 'this-week@example.com', now(), now());
  -- Upserted, because file 01 puts a trigger on auth.users that makes
  -- the profile row already. Either way the role ends up stated here.
  insert into lms_profiles (id, full_name, role)
       values (v_learner, 'This Week', 'learner')
  on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

  -- One learner who never confirmed their email address.
  --
  -- THIS ONE COUNTED AS OF FILE 19. When this test was written, an
  -- unconfirmed sign up was not a new learner: it was an address
  -- somebody typed and the nightly prune might well delete it.
  --
  -- File 19 drops the confirmed test, and that is not a loosening.
  -- Supabase "Confirm email" is off, so email_confirmed_at is set at
  -- insert for everybody and the test excluded nobody. It only looked
  -- like a filter. The number this tile means is how many people signed
  -- up this week, which is what it now counts.
  insert into auth.users (id, email, created_at, email_confirmed_at)
       values (v_unconf, 'never-confirmed@example.com', now(), null);
  insert into lms_profiles (id, full_name, role)
       values (v_unconf, 'Never Confirmed', 'learner')
  on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

  -- One confirmed learner from a month ago. Does not count: the number
  -- is this week's, not everybody's.
  insert into auth.users (id, email, created_at, email_confirmed_at)
       values (v_old, 'last-month@example.com', now() - interval '31 days',
               now() - interval '31 days');
  insert into lms_profiles (id, full_name, role)
       values (v_old, 'Last Month', 'learner')
  on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

  -- And the two administrators, who were made earlier in this file and
  -- are the ones that produced the wrong answer of 2.
  perform t17_be(v_admin);
  v_week := (select lms_studio_overview() -> 'week');

  -- Two of the three once file 19 is in: the learner who signed up this
  -- week and the one who never confirmed. One before it, when the
  -- unconfirmed sign up did not count.
  --
  -- ASKED OF THE SCHEMA rather than assumed, so this file is right on a
  -- database at 01 to 18 as well as on one at 01 to 19. The alternative
  -- is a test that fails on a correct database, which teaches whoever
  -- runs it to ignore a failure.
  --
  -- Either way the month old learner is outside the week and the
  -- administrators are not learners, which is the part that has not
  -- changed.
  perform t17_say('19a three accounts added, the learners of this week count',
    ((v_week ->> 'new_learners')::integer - v_before)::text,
    case when exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'lms_profiles'
                         and column_name = 'email_verified_at')
         then '2' else '1' end);

  -- Said separately, because a count of 1 could also be reached by
  -- counting the administrators and getting it wrong in two directions
  -- at once.
  perform t17_say('19b and there really were three other accounts it had to leave out',
    (select count(*)::text from auth.users
      where id in (v_unconf, v_old, v_admin)), '3');
end $$;


-- ------------------------------------------------------------- results
\pset tuples_only off
\pset format aligned
select n as "#", label as "what was checked",
       case when got is not distinct from want then 'pass' else 'FAIL' end as "result",
       got as "got", want as "wanted"
  from t17_out order by n;

select case when count(*) = 0 then 'ALL PASS'
            else count(*) || ' FAILED' end as "summary"
  from t17_out where got is distinct from want;

rollback;
