-- Build a realistic course and a cohort, then report sizes.
-- 30 video lessons of ten minutes, in ten second slices: 60 slices a lesson.
set role postgres;
select set_config('request.jwt.claim.sub','',false);
\set LEARNERS 20

delete from lms_quiz_attempts; delete from lms_watch_buckets; delete from lms_lesson_progress;
delete from lms_options; delete from lms_questions; delete from lms_quizzes;
delete from lms_lessons; delete from lms_modules; delete from lms_entitlements;
delete from lms_courses; delete from lms_profiles; delete from auth.users;

insert into lms_courses (id, slug, title, tool, area, level, summary, status, published_at, price_kobo)
 values ('99999999-0000-0000-0000-000000000001','big','Thirty lesson course','STATA','Stats','Beginner',
         'A full course','published', now(), 1000000);
insert into lms_modules (id, course_id, title, position)
 values ('99999999-0000-0000-0000-000000000002','99999999-0000-0000-0000-000000000001','Module one',1);

-- 30 lessons of 600 seconds, each with its own lesson check
insert into lms_lessons (id, module_id, title, type, position, video_provider, video_ref,
                         duration_seconds, bucket_seconds, coverage_percent)
select ('99999999-0000-0000-0001-' || lpad(g::text,12,'0'))::uuid,
       '99999999-0000-0000-0000-000000000002', 'Lesson '||g, 'video', g, 'youtube', 'v'||g, 600, 10, 92
  from generate_series(1,30) g;

insert into lms_quizzes (id, lesson_id, title, status, pass_percent, max_attempts)
select ('99999999-0000-0000-0002-' || lpad(g::text,12,'0'))::uuid,
       ('99999999-0000-0000-0001-' || lpad(g::text,12,'0'))::uuid,
       'Check '||g, 'draft', 100, 20
  from generate_series(1,30) g;
insert into lms_questions (id, quiz_id, prompt, position, marks)
select ('99999999-0000-0000-0003-' || lpad(g::text,12,'0'))::uuid,
       ('99999999-0000-0000-0002-' || lpad(g::text,12,'0'))::uuid,
       'Question for lesson '||g, 1, 1
  from generate_series(1,30) g;
insert into lms_options (question_id, label, is_correct, position)
select ('99999999-0000-0000-0003-' || lpad(g::text,12,'0'))::uuid, 'right', true, 1
  from generate_series(1,30) g;
insert into lms_options (question_id, label, is_correct, position)
select ('99999999-0000-0000-0003-' || lpad(g::text,12,'0'))::uuid, 'wrong', false, 2
  from generate_series(1,30) g;
update lms_quizzes set status='published';

-- one module quiz for the course
insert into lms_quizzes (id, module_id, title, status, pass_percent, max_attempts)
 values ('99999999-0000-0000-0004-000000000001','99999999-0000-0000-0000-000000000002','Module quiz','draft',70,3);
insert into lms_questions (id, quiz_id, prompt, position, marks)
 values ('99999999-0000-0000-0005-000000000001','99999999-0000-0000-0004-000000000001','Module question',1,1);
insert into lms_options (question_id, label, is_correct, position)
 values ('99999999-0000-0000-0005-000000000001','right',true,1);
update lms_quizzes set status='published' where id='99999999-0000-0000-0004-000000000001';

-- the cohort
insert into auth.users (id, email, email_confirmed_at)
select ('aaaa0000-0000-0000-0000-' || lpad(g::text,12,'0'))::uuid, 'learner'||g||'@example.com', now()
  from generate_series(1,:LEARNERS) g;
insert into lms_entitlements (user_id, course_id, source)
select ('aaaa0000-0000-0000-0000-' || lpad(g::text,12,'0'))::uuid, null, 'manual'
  from generate_series(1,:LEARNERS) g;

-- every learner watches every lesson right through: 60 slices each
insert into lms_watch_buckets (user_id, lesson_id, bucket_index)
select ('aaaa0000-0000-0000-0000-' || lpad(u::text,12,'0'))::uuid,
       ('99999999-0000-0000-0001-' || lpad(l::text,12,'0'))::uuid, b
  from generate_series(1,:LEARNERS) u, generate_series(1,30) l, generate_series(0,59) b;

-- and sits every lesson check, and the module quiz
insert into lms_quiz_attempts (user_id, quiz_id, attempt_no, served_question_ids, answers,
                               score, max_score, percent, passed, status, submitted_at)
select ('aaaa0000-0000-0000-0000-' || lpad(u::text,12,'0'))::uuid,
       ('99999999-0000-0000-0002-' || lpad(l::text,12,'0'))::uuid, 1,
       array[('99999999-0000-0000-0003-' || lpad(l::text,12,'0'))::uuid],
       jsonb_build_object(('99999999-0000-0000-0003-' || lpad(l::text,12,'0')), 'some-option-id-here'),
       1, 1, 100.00, true, 'passed', now()
  from generate_series(1,:LEARNERS) u, generate_series(1,30) l;
insert into lms_quiz_attempts (user_id, quiz_id, attempt_no, served_question_ids, answers,
                               score, max_score, percent, passed, status, submitted_at)
select ('aaaa0000-0000-0000-0000-' || lpad(u::text,12,'0'))::uuid,
       '99999999-0000-0000-0004-000000000001', 1,
       array['99999999-0000-0000-0005-000000000001'::uuid],
       '{"q":"a"}'::jsonb, 1, 1, 100.00, true, 'passed', now()
  from generate_series(1,:LEARNERS) u;
reset role;
