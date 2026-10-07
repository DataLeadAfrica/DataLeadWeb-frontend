-- Seed for the file 11 tests. Runs as the owner with no signed in user, which
-- is what the file 10 guards treat as the trusted SQL editor.
set role postgres;
select set_config('request.jwt.claim.sub','',false);

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
delete from lms_quiz_attempts; delete from lms_watch_buckets; delete from lms_lesson_progress;
delete from lms_options; delete from lms_questions; delete from lms_quizzes;
delete from lms_lessons; delete from lms_modules;
delete from lms_path_courses; delete from lms_paths; delete from lms_courses;
delete from participant_enrolments; delete from certificates; delete from participants;
delete from programmes; delete from lms_profiles; delete from auth.users;
delete from lms_facilitators;

insert into auth.users (id, email, email_confirmed_at) values
 ('11111111-1111-1111-1111-111111111111','boss@dataleadafrica.com', now()),
 ('22222222-2222-2222-2222-222222222222','tutor@dataleadafrica.com', now()),
 ('33333333-3333-3333-3333-333333333333','learner@gmail.com', now());
update lms_profiles set role='admin'       where id='11111111-1111-1111-1111-111111111111';
update lms_profiles set role='facilitator' where id='22222222-2222-2222-2222-222222222222';

-- the live course the learner works through
insert into lms_courses (id, slug, title, tool, area, level, summary, status, published_at, price_kobo)
 values ('c0000000-0000-0000-0000-0000000000a0','stata','STATA Basics','STATA','Stats','Beginner',
         'Learn STATA','published', now(), 1000000);
insert into lms_modules (id, course_id, title, position)
 values ('c0000000-0000-0000-0000-0000000000b0','c0000000-0000-0000-0000-0000000000a0','Module one',1);
insert into lms_lessons (id, module_id, title, type, position, video_provider, video_ref, duration_seconds, bucket_seconds, coverage_percent) values
 ('c0000000-0000-0000-0000-0000000000c1','c0000000-0000-0000-0000-0000000000b0','Lesson one','video',1,'youtube','l1',120,10,92),
 ('c0000000-0000-0000-0000-0000000000c2','c0000000-0000-0000-0000-0000000000b0','Lesson two','video',2,'youtube','l2',120,10,92),
 ('c0000000-0000-0000-0000-0000000000c3','c0000000-0000-0000-0000-0000000000b0','Lesson three','video',3,'youtube','l3',120,10,92);

-- lesson one has a proper check. Created as a draft, given its question,
-- then published: that is the order file 11 requires, and the order the
-- control room follows anyway.
insert into lms_quizzes (id, lesson_id, title, status, pass_percent, max_attempts)
 values ('c0000000-0000-0000-0000-0000000000d1','c0000000-0000-0000-0000-0000000000c1','Check one','draft',100,20);
insert into lms_questions (id, quiz_id, prompt, position, marks)
 values ('c0000000-0000-0000-0000-0000000000e1','c0000000-0000-0000-0000-0000000000d1','Which command summarises?',1,1);
insert into lms_options (question_id, label, is_correct, position) values
 ('c0000000-0000-0000-0000-0000000000e1','summarize',true,1),
 ('c0000000-0000-0000-0000-0000000000e1','describe',false,2);
update lms_quizzes set status='published' where id='c0000000-0000-0000-0000-0000000000d1';

-- a module quiz, whose attempts must survive housekeeping
insert into lms_quizzes (id, module_id, title, status, pass_percent, max_attempts)
 values ('c0000000-0000-0000-0000-0000000000dd','c0000000-0000-0000-0000-0000000000b0','Module quiz','draft',70,3);
insert into lms_questions (id, quiz_id, prompt, position, marks)
 values ('c0000000-0000-0000-0000-0000000000ee','c0000000-0000-0000-0000-0000000000dd','Module question',1,1);
insert into lms_options (question_id, label, is_correct, position) values
 ('c0000000-0000-0000-0000-0000000000ee','right',true,1),
 ('c0000000-0000-0000-0000-0000000000ee','wrong',false,2);
update lms_quizzes set status='published' where id='c0000000-0000-0000-0000-0000000000dd';

-- LESSON TWO HAS A PUBLISHED CHECK WITH NO QUESTIONS AT ALL.
-- This is the shape that produced "All 0 correct. On you go." A row like this
-- can already exist on the live database, so the seed has to be able to make
-- one even after file 11 forbids creating new ones. The trigger is switched
-- off for this one insert only, and only if it exists yet.
do $$
declare v_has boolean;
begin
  select exists (select 1 from pg_trigger where tgname='t_guard_quiz_has_questions'
                   and not tgisinternal) into v_has;
  if v_has then execute 'alter table lms_quizzes disable trigger t_guard_quiz_has_questions'; end if;
  insert into lms_quizzes (id, lesson_id, title, status, pass_percent, max_attempts)
   values ('c0000000-0000-0000-0000-0000000000d2','c0000000-0000-0000-0000-0000000000c2',
           'Empty check','published',100,20);
  if v_has then execute 'alter table lms_quizzes enable trigger t_guard_quiz_has_questions'; end if;
end $$;

-- a draft course that is complete EXCEPT that one of its checks is empty,
-- so the only thing standing between it and publication is that check
insert into lms_courses (id, slug, title, tool, area, level, summary, status, price_kobo)
 values ('c0000000-0000-0000-0000-0000000000f0','r-intro','R Intro','R','Stats','Beginner',
         'Learn R','draft', 500000);
insert into lms_modules (id, course_id, title, position)
 values ('c0000000-0000-0000-0000-0000000000f1','c0000000-0000-0000-0000-0000000000f0','Draft module',1);
insert into lms_lessons (id, module_id, title, type, position, video_provider, video_ref, duration_seconds)
 values ('c0000000-0000-0000-0000-0000000000f2','c0000000-0000-0000-0000-0000000000f1','Draft lesson','video',1,'youtube','d1',120);
insert into lms_quizzes (id, lesson_id, title, status, pass_percent, max_attempts)
 values ('c0000000-0000-0000-0000-0000000000f3','c0000000-0000-0000-0000-0000000000f2','Draft empty check','draft',100,20);

-- the learner, with access to everything
insert into lms_entitlements (user_id, course_id, source)
 values ('33333333-3333-3333-3333-333333333333', null, 'manual');
reset role;
