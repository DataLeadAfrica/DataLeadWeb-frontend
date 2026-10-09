-- =====================================================================
-- DO NOT RUN THIS ON SUPABASE. LOCAL POSTGRESQL ONLY.
--
-- The seed files in this folder begin by DELETING every participant,
-- certificate, enrolment, programme and user account, because a test
-- database has to start from a known empty state. On the live database
-- that is not a test, it is the end of the certification system.
--
-- Nothing in this folder ever needs running by hand.
-- =====================================================================
set role postgres;
select set_config('request.jwt.claim.sub','',false);
create table if not exists t_results (n serial primary key, name text, pass boolean, detail text default '');
truncate t_results restart identity;
grant all on t_results to authenticated, anon;
grant all on sequence t_results_n_seq to authenticated, anon;
create or replace function t_rec(p_name text, p_pass boolean, p_detail text default '')
returns void language sql as $$ insert into t_results(name,pass,detail) values(p_name,coalesce(p_pass,false),p_detail) $$;
grant execute on function t_rec(text,boolean,text) to authenticated, anon;

delete from auth_codes; delete from mail_outbox;
delete from lms_quiz_attempts; delete from lms_watch_buckets; delete from lms_lesson_progress;
delete from lms_options; delete from lms_questions; delete from lms_quizzes;
delete from lms_lessons; delete from lms_modules; delete from lms_entitlements;
delete from lms_courses; delete from certificates; delete from participant_enrolments;
delete from participants; delete from programmes; delete from lms_profiles; delete from auth.users;

insert into programmes (id, slug, title, code)
 values ('b0000000-0000-0000-0000-000000000001','data-analytics','Data Analytics','DA');

-- A. enrolled on an active bootcamp, NO certificate. This person cannot sign in today.
insert into participants (id, full_name, email, email_norm)
 values ('a0000000-0000-0000-0000-00000000000a','New Student','newstudent@gmail.com','newstudent@gmail.com');
insert into participant_enrolments (participant_id, programme_id, cohort, status, ends_on)
 values ('a0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-000000000001','c1','active', current_date + 90);

-- B. holds a certificate. This person can sign in today.
insert into participants (id, full_name, email, email_norm)
 values ('a0000000-0000-0000-0000-00000000000b','Graduate','graduate@gmail.com','graduate@gmail.com');
insert into certificates (participant_id, programme_id, certificate_number, completed_on)
 values ('a0000000-0000-0000-0000-00000000000b','b0000000-0000-0000-0000-000000000001','DLA-0001', current_date - 10);

-- C. withdrawn, no certificate. Must stay out.
insert into participants (id, full_name, email, email_norm)
 values ('a0000000-0000-0000-0000-00000000000c','Withdrawn','withdrawn@gmail.com','withdrawn@gmail.com');
insert into participant_enrolments (participant_id, programme_id, cohort, status, ends_on)
 values ('a0000000-0000-0000-0000-00000000000c','b0000000-0000-0000-0000-000000000001','c1','withdrawn', current_date + 90);

-- D. a revoked certificate only. Must stay out.
insert into participants (id, full_name, email, email_norm)
 values ('a0000000-0000-0000-0000-00000000000d','Revoked','revoked@gmail.com','revoked@gmail.com');
insert into certificates (participant_id, programme_id, certificate_number, completed_on, revoked)
 values ('a0000000-0000-0000-0000-00000000000d','b0000000-0000-0000-0000-000000000001','DLA-0002', current_date - 10, true);

-- accounts, for the unconfirmed sign up count
insert into auth.users (id, email, email_confirmed_at) values
 ('11111111-1111-1111-1111-111111111111','boss@dataleadafrica.com', now()),
 ('33333333-3333-3333-3333-333333333333','learner@gmail.com', now());
update lms_profiles set role='admin' where id='11111111-1111-1111-1111-111111111111';
insert into auth.users (id, email, email_confirmed_at, created_at) values
 ('55555555-5555-5555-5555-555555555551','pending1@gmail.com', null, now() - interval '2 hours'),
 ('55555555-5555-5555-5555-555555555552','pending2@gmail.com', null, now() - interval '20 hours'),
 ('55555555-5555-5555-5555-555555555553','pending3@gmail.com', null, now() - interval '40 hours');

-- a course with a question that gets served, for the delete guard
insert into lms_courses (id, slug, title, tool, area, level, summary, status, published_at, price_kobo)
 values ('c0000000-0000-0000-0000-0000000000a0','stata','STATA','STATA','Stats','Beginner','s','published', now(), 1000);
insert into lms_modules (id, course_id, title, position)
 values ('c0000000-0000-0000-0000-0000000000b0','c0000000-0000-0000-0000-0000000000a0','M1',1);
insert into lms_lessons (id, module_id, title, type, position, video_provider, video_ref, duration_seconds)
 values ('c0000000-0000-0000-0000-0000000000c1','c0000000-0000-0000-0000-0000000000b0','L1','video',1,'youtube','v1',120);
insert into lms_quizzes (id, lesson_id, title, status, pass_percent, max_attempts)
 values ('c0000000-0000-0000-0000-0000000000d1','c0000000-0000-0000-0000-0000000000c1','Check','draft',100,20);
insert into lms_questions (id, quiz_id, prompt, position, marks) values
 ('c0000000-0000-0000-0000-0000000000e1','c0000000-0000-0000-0000-0000000000d1','Served question',1,1),
 ('c0000000-0000-0000-0000-0000000000e2','c0000000-0000-0000-0000-0000000000d1','Never served question',2,1);
insert into lms_options (question_id, label, is_correct, position) values
 ('c0000000-0000-0000-0000-0000000000e1','right',true,1),
 ('c0000000-0000-0000-0000-0000000000e2','right',true,1);
update lms_quizzes set status='published' where id='c0000000-0000-0000-0000-0000000000d1';
insert into lms_entitlements (user_id, course_id, source)
 values ('33333333-3333-3333-3333-333333333333', null, 'manual');
-- an attempt that has been SERVED question e1 only
insert into lms_quiz_attempts (user_id, quiz_id, attempt_no, served_question_ids, status)
 values ('33333333-3333-3333-3333-333333333333','c0000000-0000-0000-0000-0000000000d1',1,
         array['c0000000-0000-0000-0000-0000000000e1'::uuid],'in_progress');

-- an email waiting in the outbox, aged, for the health check
insert into mail_outbox (to_email, code_plain, created_at)
 values ('someone@gmail.com','123456', now() - interval '25 minutes');
reset role;

-- ---------------------------------------------------------------- file 13
-- A finished-able course: one module, two video lessons, one module quiz.
set role postgres;
select set_config('request.jwt.claim.sub','',false);

insert into modules (id, programme_id, slug, title, code, week_number)
 values ('f0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','wk1','Week 1','W1',1)
 on conflict do nothing;

insert into lms_courses (id, slug, title, tool, summary, level, price_kobo, status, programme_id)
 values ('c1000000-0000-0000-0000-000000000001','stata-test','STATA test','STATA','A short test course','Beginner',0,'draft','b0000000-0000-0000-0000-000000000001');

insert into lms_modules (id, course_id, title, position)
 values ('c2000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','Module one',1);

insert into lms_lessons (id, module_id, title, type, position, video_provider, video_ref, duration_seconds)
 values ('c3000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000001','Lesson one','video',1,'youtube','abc123',600),
        ('c3000000-0000-0000-0000-000000000002','c2000000-0000-0000-0000-000000000001','Lesson two','video',2,'youtube','def456',600);

-- a published module quiz with one question
insert into lms_quizzes (id, module_id, title, pass_percent, max_attempts, status)
 values ('c4000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000001','Module quiz',70,3,'draft');
insert into lms_questions (id, quiz_id, prompt, type, marks, position, active)
 values ('c5000000-0000-0000-0000-000000000001','c4000000-0000-0000-0000-000000000001','Two plus two?','single',1,1,true);
insert into lms_options (question_id, label, is_correct, position)
 values ('c5000000-0000-0000-0000-000000000001','4',true,1),
        ('c5000000-0000-0000-0000-000000000001','5',false,2);
update lms_quizzes set status='published' where id='c4000000-0000-0000-0000-000000000001';

-- a second course with NO programme, to prove the new blocker
insert into lms_courses (id, slug, title, tool, summary, level, price_kobo, status)
 values ('c1000000-0000-0000-0000-000000000002','noprog-test','No programme','STATA','Another test','Beginner',0,'draft');
insert into lms_modules (id, course_id, title, position)
 values ('c2000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','Module one',1);
-- all three empty, which the table constraint allows: a placeholder
insert into lms_lessons (id, module_id, title, type, position, video_provider, video_ref, duration_seconds)
 values ('c3000000-0000-0000-0000-000000000003','c2000000-0000-0000-0000-000000000002','Lesson one','video',1,null,null,null);

-- the learner, with access
insert into lms_entitlements (user_id, course_id, source)
 values ('33333333-3333-3333-3333-333333333333','c1000000-0000-0000-0000-000000000001','manual');

-- a facilitator account
insert into auth.users (id, email, email_confirmed_at)
 values ('44444444-4444-4444-4444-444444444444','tutor@dataleadafrica.com', now())
 on conflict (id) do nothing;
update lms_profiles set role='facilitator' where id='44444444-4444-4444-4444-444444444444';
update lms_profiles set full_name='Test Learner' where id='33333333-3333-3333-3333-333333333333';
reset role;

-- -------------------------------------------------------------------
-- Brought up to date with the publish checklist.
--
-- These fixtures were written before a course needed a programme (file
-- 13) and three things a learner will be able to do (file 14). The rules
-- are right and the fixtures were simply older than them, so they are
-- brought up to date here rather than the rules being weakened.
--
-- The courses listed in "keep as they are" are the ones whose whole job
-- is to be incomplete, so a test can prove the checklist refuses them.
-- Guarded, so this seed still runs on a database without file 14.
-- -------------------------------------------------------------------
do $$
declare v_prog uuid;
begin
  insert into programmes (slug, title, code, template_key, active)
  select 'seed-programme', 'Seed test programme', 'SEED', 'default', true
   where not exists (select 1 from programmes where slug = 'seed-programme');
  select id into v_prog from programmes where slug = 'seed-programme';

  update lms_courses
     set programme_id = coalesce(programme_id, v_prog),
         summary = case when btrim(coalesce(summary, '')) = ''
                        then 'A short description, so the checklist is satisfied.'
                        else summary end
   where slug not in ('noprog-test', 't14-thin');   -- keep as they are

  if exists (select 1 from information_schema.columns
              where table_name = 'lms_courses' and column_name = 'outcomes') then
    update lms_courses
       set outcomes = array['Do the first thing', 'Do the second thing',
                            'Do the third thing']
     where coalesce(array_length(outcomes, 1), 0) < 3
       and slug not in ('t14-thin');                -- keep as it is
  end if;
end $$;
