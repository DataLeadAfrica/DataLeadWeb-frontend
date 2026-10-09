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
-- seed for the new tests. Real schema constraints respected throughout.
set role postgres;
create table if not exists t_results (n serial primary key, name text, pass boolean, detail text default '');
truncate t_results restart identity;
grant all on t_results to authenticated, anon;
grant all on sequence t_results_n_seq to authenticated, anon;
create or replace function t_rec(p_name text, p_pass boolean, p_detail text default '')
returns void language sql as $$ insert into t_results(name,pass,detail) values(p_name,coalesce(p_pass,false),p_detail) $$;
grant execute on function t_rec(text,boolean,text) to authenticated, anon;
drop table if exists t_scratch;
create table t_scratch (k text primary key, v text);
grant all on t_scratch to authenticated, anon;

delete from lms_entitlements; delete from lms_admin_actions;
delete from lms_quiz_attempts; delete from lms_options; delete from lms_questions;
delete from lms_quizzes; delete from lms_lessons; delete from lms_modules;
delete from lms_path_courses; delete from lms_paths; delete from lms_courses;
delete from participant_enrolments; delete from certificates; delete from participants;
delete from programmes; delete from lms_profiles; delete from auth.users;
delete from lms_facilitators;

insert into auth.users (id, email, email_confirmed_at) values
 ('11111111-1111-1111-1111-111111111111','boss@dataleadafrica.com', now()),
 ('22222222-2222-2222-2222-222222222222','tutor@dataleadafrica.com', now()),
 ('33333333-3333-3333-3333-333333333333','learner@gmail.com', now()),
 ('44444444-4444-4444-4444-444444444444','returning@gmail.com', now());
update lms_profiles set role='admin'       where id='11111111-1111-1111-1111-111111111111';
update lms_profiles set role='facilitator' where id='22222222-2222-2222-2222-222222222222';
insert into lms_facilitators (email_norm, full_name) values ('tutor@dataleadafrica.com','Tutor');

-- the returning bootcamp student: cohort one already finished
insert into programmes (id, slug, title, code)
 values ('bbbbbbbb-0000-0000-0000-000000000001','data-analytics','Data Analytics','DA');
insert into participants (id, full_name, email, email_norm)
 values ('aaaaaaaa-0000-0000-0000-000000000001','Returning Student','returning@gmail.com','returning@gmail.com');
insert into participant_enrolments (id, participant_id, programme_id, cohort, status, ends_on)
 values ('a1a1a1a1-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
         'bbbbbbbb-0000-0000-0000-000000000001','cohort-1','active', current_date - 30);

-- one published course and one draft course
insert into lms_courses (id, slug, title, tool, area, level, status, published_at, price_kobo) values
 ('cccccccc-0000-0000-0000-000000000001','stata','STATA Basics','STATA','Stats','Beginner','published', now(), 1000000),
 ('cccccccc-0000-0000-0000-000000000002','sql','SQL Intro','SQL','Data','Beginner','draft', null, 1000000);
insert into lms_modules (id, course_id, title, position) values
 ('dddddddd-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-000000000001','Live module',1),
 ('dddddddd-0000-0000-0000-00000000000b','cccccccc-0000-0000-0000-000000000002','Draft module',1);
insert into lms_lessons (id, module_id, title, type, position, video_provider, video_ref, duration_seconds) values
 ('dddddddd-0000-0000-0000-00000000000c','dddddddd-0000-0000-0000-00000000000a','Live lesson','video',1,'youtube','live1',120),
 ('dddddddd-0000-0000-0000-00000000000d','dddddddd-0000-0000-0000-00000000000b','Draft lesson','video',1,'youtube','draft1',120);
-- a published check on the DRAFT course, so a learner can sit it in the import test
insert into lms_quizzes (id, lesson_id, title, status, pass_percent, max_attempts)
 values ('dddddddd-0000-0000-0000-00000000000e','dddddddd-0000-0000-0000-00000000000d','Draft course check','draft',100,20);
insert into lms_questions (id, quiz_id, prompt, position, marks) values
 ('dddddddd-0000-0000-0000-000000000011','dddddddd-0000-0000-0000-00000000000e','Old question one',1,1),
 ('dddddddd-0000-0000-0000-000000000012','dddddddd-0000-0000-0000-00000000000e','Old question two',2,1);
insert into lms_options (question_id, label, is_correct, position) values
 ('dddddddd-0000-0000-0000-000000000011','right',true,1),
 ('dddddddd-0000-0000-0000-000000000011','wrong',false,2),
 ('dddddddd-0000-0000-0000-000000000012','right',true,1),
 ('dddddddd-0000-0000-0000-000000000012','wrong',false,2);
-- published only once it has its questions, which file 11 insists on
update lms_quizzes set status='published' where id='dddddddd-0000-0000-0000-00000000000e';
-- a published quiz on the PUBLISHED course, for the published-quiz import rule
insert into lms_quizzes (id, lesson_id, title, status, pass_percent, max_attempts)
 values ('dddddddd-0000-0000-0000-00000000000f','dddddddd-0000-0000-0000-00000000000c','Live check','draft',100,20);
insert into lms_questions (id, quiz_id, prompt, position, marks)
 values ('dddddddd-0000-0000-0000-000000000013','dddddddd-0000-0000-0000-00000000000f','Live question',1,1);
insert into lms_options (question_id, label, is_correct, position) values
 ('dddddddd-0000-0000-0000-000000000013','right',true,1);
update lms_quizzes set status='published' where id='dddddddd-0000-0000-0000-00000000000f';
-- a throwaway draft course, so the delete test cannot destroy the fixture
insert into lms_courses (id, slug, title, tool, area, level, status, price_kobo)
 values ('cccccccc-0000-0000-0000-000000000003','throwaway','Throwaway','X','Stats','Beginner','draft', 1);
-- a second draft lesson with its own DRAFT quiz, for the publish-a-quiz test
insert into lms_lessons (id, module_id, title, type, position)
 values ('dddddddd-0000-0000-0000-0000000000da','dddddddd-0000-0000-0000-00000000000b','Draft lesson two','reading',2);
insert into lms_quizzes (id, lesson_id, title, status, pass_percent, max_attempts)
 values ('dddddddd-0000-0000-0000-0000000000eb','dddddddd-0000-0000-0000-0000000000da','Draft check','draft',100,20);
-- given a question so it does not hold its course back from publishing,
-- which is what file 11 now requires of every set of questions
insert into lms_questions (id, quiz_id, prompt, position, marks)
 values ('dddddddd-0000-0000-0000-000000000014','dddddddd-0000-0000-0000-0000000000eb','Placeholder',1,1);
insert into lms_options (question_id, label, is_correct, position) values
 ('dddddddd-0000-0000-0000-000000000014','right',true,1);
insert into lms_paths (id, slug, name, status) values
 ('eeeeeeee-0000-0000-0000-000000000001','live-path','Live path','published'),
 ('eeeeeeee-0000-0000-0000-000000000002','draft-path','Draft path','draft');
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
