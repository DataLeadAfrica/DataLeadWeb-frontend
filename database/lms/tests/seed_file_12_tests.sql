-- =====================================================================
-- DO NOT RUN THIS ON SUPABASE. LOCAL POSTGRESQL ONLY.
--
-- The seed files in this folder begin by DELETING every participant,
-- certificate, enrolment, programme and user account, because a test
-- database has to start from a known empty state. On the live database
-- that is not a test, it is the end of the certification system.
--
-- Nothing in this folder ever needs running by hand. It is committed so
-- the repository holds the evidence that the numbered files were tested,
-- and so somebody can re-run it on a local copy years from now.
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

-- -------------------------------------------------------------------
-- Make the suite repeatable.
--
-- P13 checks that a mailer which has never called in raises an alarm,
-- and P14, four lines later, makes it call in. So the second run of this
-- suite on the same database saw a heartbeat from the first run and P13
-- reported ok. The test was right and the seed was not resetting
-- everything the tests change.
-- -------------------------------------------------------------------
delete from lms_system_heartbeat where name = 'mailer_fetch';
