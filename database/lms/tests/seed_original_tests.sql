-- ---------------------------------------------------------------- seed
set role postgres;
truncate lms_facilitators, lms_entitlements, lms_admin_actions cascade;
delete from participant_enrolments; delete from certificates; delete from participants; delete from programmes;
delete from lms_profiles; delete from auth.users;
delete from lms_quizzes; delete from lms_courses; delete from lms_paths;

create table if not exists t_results (
  n serial primary key, name text, pass boolean, detail text default '');
truncate t_results restart identity;
grant all on t_results to authenticated, anon;
grant all on sequence t_results_n_seq to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at) values
 ('11111111-1111-1111-1111-111111111111','boss@dataleadafrica.com', now()),
 ('22222222-2222-2222-2222-222222222222','tutor@dataleadafrica.com', now()),
 ('33333333-3333-3333-3333-333333333333','random@gmail.com', now()),
 ('44444444-4444-4444-4444-444444444444','  BootCamper@Gmail.COM ', now()),
 ('55555555-5555-5555-5555-555555555555','notyet@gmail.com', null),
 ('66666666-6666-6666-6666-666666666666','exfac@dataleadafrica.com', now());

update lms_profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';

-- the bootcamp participant, enrolled and active
insert into participants (id, full_name, email, email_norm)
 values ('aaaaaaaa-0000-0000-0000-000000000001','Boot Camper','bootcamper@gmail.com','bootcamper@gmail.com');
insert into programmes (id, slug, title, code)
 values ('bbbbbbbb-0000-0000-0000-000000000001','data-analytics','Data Analytics','DA');
insert into participant_enrolments (participant_id, programme_id, status, ends_on)
 values ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','active','2027-12-31');

-- someone with a participant record but NO enrolment at all
insert into participants (id, full_name, email, email_norm)
 values ('aaaaaaaa-0000-0000-0000-000000000002','No Enrolment','random@gmail.com','random@gmail.com');

-- a published course and a draft one
insert into lms_courses (id, slug, title, tool, area, level, status, published_at, price_kobo) values
 ('cccccccc-0000-0000-0000-000000000001','stata-basics','STATA Basics','STATA','Statistics','Beginner','published', now(), 1000000),
 ('cccccccc-0000-0000-0000-000000000002','sql-intro','SQL Intro','SQL','Data','Beginner','draft', null, 1000000);

-- a real question with a real answer key, so the "can you see the key"
-- tests are not passing merely because the table is empty
insert into lms_modules (id, course_id, title, position)
 values ('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','Seeded module',1);
insert into lms_lessons (id, module_id, title, type, position, video_provider, video_ref, duration_seconds)
 values ('dddddddd-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000001','Seeded lesson','video',1,'youtube','seed1',120);
insert into lms_quizzes (id, lesson_id, title)
 values ('dddddddd-0000-0000-0000-000000000003','dddddddd-0000-0000-0000-000000000002','Seeded check');
insert into lms_questions (id, quiz_id, prompt, position)
 values ('dddddddd-0000-0000-0000-000000000004','dddddddd-0000-0000-0000-000000000003','Seeded question',1);
insert into lms_options (question_id, label, is_correct, position) values
 ('dddddddd-0000-0000-0000-000000000004','right answer', true, 1),
 ('dddddddd-0000-0000-0000-000000000004','wrong answer', false, 2);

-- the facilitator list: tutor is on it, exfac will be taken off mid-test
insert into lms_facilitators (email_norm, full_name)
 values ('tutor@dataleadafrica.com','Tutor One'), ('exfac@dataleadafrica.com','Leaver');
reset role;
