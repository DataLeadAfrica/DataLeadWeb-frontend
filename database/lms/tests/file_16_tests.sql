-- =====================================================================
-- file_16_tests.sql
--
-- DO NOT RUN THIS ON SUPABASE. It makes a learner, a course and an exam
-- and then sits the exam twice. It is for a local Postgres with files
-- 01 to 16 already run, the way the other test files in this folder
-- are.
--
--   createdb t16 && run 01..15 && run 16_restructure.sql
--   psql -d t16 -f database/lms/tests/file_16_tests.sql
--
-- Every line of the output should say pass. These are the promises that
-- cannot be checked by reading the SQL, because they are about what
-- happens when somebody actually uses it: the exam really does shut
-- after two tries, the result really does leave the answers out, and
-- the skip logic really does refuse the combinations it should.
-- =====================================================================

\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned

begin;

-- ------------------------------------------------------------- set up
create temporary table t16_out (n serial, label text, got text, want text);

create or replace function t16_say(p_label text, p_got text, p_want text)
returns void language sql as $$
  insert into t16_out (label, got, want) values (p_label, p_got, p_want);
$$;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'learner@test.invalid'),
  ('22222222-2222-2222-2222-222222222222', 'admin@test.invalid'),
  ('33333333-3333-3333-3333-333333333333', 'facilitator@test.invalid')
on conflict (id) do nothing;

insert into lms_profiles (id, full_name, role) values
  ('11111111-1111-1111-1111-111111111111', 'A Learner', 'learner'),
  ('22222222-2222-2222-2222-222222222222', 'An Admin', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'A Facilitator', 'facilitator')
on conflict (id) do update set role = excluded.role;

insert into lms_courses (id, slug, title, summary, tool, area, level, cover_code,
                         price_kobo, status, published_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', 't16-course', 'Exam course',
        'A course for the file 16 tests.', 'Excel', 'Analysis', 'Beginner', 'EC', 0,
        'published', now())
on conflict (id) do nothing;

insert into lms_modules (id, course_id, title, position)
values ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Module one', 1)
on conflict (id) do nothing;

insert into lms_lessons (id, module_id, title, type, position, duration_seconds,
                         bucket_seconds, video_provider, video_ref)
values ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002',
        'Lesson one', 'video', 1, 1200, 10, 'youtube', 'test-ref')
on conflict (id) do nothing;


-- =====================================================================
-- 1  CHAPTERS
-- =====================================================================
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

-- lms_set_lesson_chapters returns how many chapters it saved, as a
-- single number. Counting its rows would always be 1.
select t16_say('1a chapters parse out of a pasted description',
  lms_set_lesson_chapters('aaaaaaaa-0000-0000-0000-000000000003',
     E'00:00 Opening\n01:15 Finding duplicates\n12:40 Wrapping up')::text, '3');

select t16_say('1b the pasted text is kept as it was typed',
  (select case when chapters_text like '%Finding duplicates%' then 'kept' else 'lost' end
     from lms_lessons where id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'kept');

do $$
begin
  perform lms_parse_chapters(E'00:00 Start\nthis is just prose');
  perform t16_say('1c prose in the middle is refused by line', 'accepted', 'refused');
exception when others then
  perform t16_say('1c prose in the middle is refused by line',
    case when sqlerrm like '%Line 2%' then 'refused' else 'refused but did not name the line' end, 'refused');
end $$;

do $$
begin
  perform lms_parse_chapters(E'01:00 Start');
  perform t16_say('1d the first chapter must be 00:00', 'accepted', 'refused');
exception when others then
  perform t16_say('1d the first chapter must be 00:00', 'refused', 'refused');
end $$;

do $$
begin
  perform lms_parse_chapters(E'00:00 A\n05:00 B\n03:00 C');
  perform t16_say('1e times must rise', 'accepted', 'refused');
exception when others then
  perform t16_say('1e times must rise', 'refused', 'refused');
end $$;


-- =====================================================================
-- 2  THE ABOUT YOU ANSWERS
-- =====================================================================
do $$
declare
  v_ok  integer := 0;
  v_bad integer := 0;
  r record;
begin
  -- Each row: should it be accepted, and the answers.
  for r in
    select * from (values
      (true,  'Nigeria','25','Female','secondary','none','no','{job}'::text[],'Lagos',null,'Ikeja','100001',null,null,null,null,null,null,null,null,null),
      (true,  'Ghana',  '25','Male','tertiary','employed','no','{work}'::text[],null,'Greater Accra','Accra',null,'bsc','Economics',null,'M&E officer',null,null,null,'Health',null),
      (true,  'Nigeria','u18','Female','secondary','none','no','{job}'::text[],'Lagos',null,'Ikeja','100001',null,null,null,null,null,null,null,null,null),
      (false, 'Ghana',  '25','Male','secondary','none','no','{job}'::text[],null,'Accra','Accra','123456',null,null,null,null,null,null,null,null,null),
      (false, 'Ghana',  '18','Male','tertiary','nysc','no','{job}'::text[],null,'Accra','Accra',null,'bsc','Stats',null,null,null,null,null,'Health',null),
      (false, 'Nigeria','35','Male','tertiary','nysc','no','{job}'::text[],'Lagos',null,'Ikeja','100001','bsc','Stats',null,null,null,null,null,'Health',null),
      (false, 'Nigeria','18','Male','tertiary','nysc','no','{job}'::text[],'Lagos',null,'Ikeja','100001','ond','Stats',null,null,null,null,null,'Health',null),
      (false, 'Nigeria','25','Male','secondary','none','no','{}'::text[],'Lagos',null,'Ikeja','100001',null,null,null,null,null,null,null,null,null),
      (false, 'Nigeria','25','Male','secondary','none','yes','{job}'::text[],'Lagos',null,'Ikeja','100001',null,null,null,null,null,null,null,null,null)
    ) as t(should_pass, country, age_band, gender, education_level, occupation, disability,
           goals, state, region, city, postal_code, qualification, course_of_study, trade,
           job_title, business, study_level, school, sector, disability_detail)
  loop
    begin
      insert into lms_learner_profiles (
        user_id, country, age_band, gender, education_level, occupation, disability, goals,
        state, region, city, postal_code, qualification, course_of_study, trade,
        job_title, business, study_level, school, sector, disability_detail, consented_at)
      values ((select id from auth.users order by random() limit 1),
        r.country, r.age_band, r.gender, r.education_level, r.occupation, r.disability, r.goals,
        r.state, r.region, r.city, r.postal_code, r.qualification, r.course_of_study, r.trade,
        r.job_title, r.business, r.study_level, r.school, r.sector, r.disability_detail, now());
      delete from lms_learner_profiles;          -- one at a time, user_id is the key
      if r.should_pass then v_ok := v_ok + 1; else v_bad := v_bad + 1; end if;
    exception when others then
      if r.should_pass then v_bad := v_bad + 1; else v_ok := v_ok + 1; end if;
    end;
  end loop;
  perform t16_say('2a every About you case behaves as it should', v_ok || ' of 9', '9 of 9');
end $$;


-- =====================================================================
-- 3  WHO CAN READ THE ANSWERS
-- =====================================================================
insert into lms_learner_profiles (user_id, country, state, city, postal_code, age_band, gender,
                                  education_level, occupation, disability, disability_detail,
                                  goals, consented_at)
values ('11111111-1111-1111-1111-111111111111', 'Nigeria', 'Lagos', 'Ikeja', '100001', '25',
        'Female', 'secondary', 'none', 'yes', 'low vision', '{job}', now())
on conflict (user_id) do nothing;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select t16_say('3a a learner reads their own row and no more',
  (select count(*)::text from lms_my_profile()), '1');

do $$
begin
  perform lms_learner_record('11111111-1111-1111-1111-111111111111');
  perform t16_say('3b a learner cannot open a learner record', 'allowed', 'refused');
exception when others then
  perform t16_say('3b a learner cannot open a learner record', 'refused', 'refused');
end $$;

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$
begin
  perform lms_learner_record('11111111-1111-1111-1111-111111111111');
  perform t16_say('3c a facilitator cannot either', 'allowed', 'refused');
exception when others then
  perform t16_say('3c a facilitator cannot either', 'refused', 'refused');
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select t16_say('3d an administrator can, one record at a time',
  (select count(*)::text from lms_learner_record('11111111-1111-1111-1111-111111111111')), '1');

select t16_say('3e and that read was written down',
  (select case when count(*) > 0 then 'logged' else 'not logged' end
     from lms_admin_actions where action = 'read_learner_record'), 'logged');

select t16_say('3f a total under 5 is never a number',
  (select case when bool_or(total = 'fewer than 5') then 'hidden' else 'shown' end
     from lms_learner_totals('disability')), 'hidden');


-- =====================================================================
-- 4  THE COURSE EXAM
-- =====================================================================
select lms_ensure_course_exam('aaaaaaaa-0000-0000-0000-000000000001');

do $$
declare v_exam uuid; v_q uuid; i integer;
begin
  select id into v_exam from lms_quizzes where course_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  for i in 1..30 loop
    insert into lms_questions (quiz_id, prompt, type, position, marks, active, lesson_id)
    values (v_exam, 'Question ' || i, 'single', i, 1, true, 'aaaaaaaa-0000-0000-0000-000000000003')
    returning id into v_q;
    insert into lms_options (question_id, label, is_correct, position)
    values (v_q, 'the right one', true, 1), (v_q, 'a wrong one', false, 2);
  end loop;
  perform lms_publish_exam(v_exam);
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

select t16_say('4a shut until every lesson is finished',
  (select state from lms_exam_status(
     (select id from lms_quizzes where course_id = 'aaaaaaaa-0000-0000-0000-000000000001'))), 'not_open');

insert into lms_lesson_progress (user_id, lesson_id, completed_at)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000003', now())
on conflict do nothing;

select t16_say('4b open once the lessons are done',
  (select state from lms_exam_status(
     (select id from lms_quizzes where course_id = 'aaaaaaaa-0000-0000-0000-000000000001'))), 'open');

select t16_say('4c a try serves 20 of the 30 questions',
  (select count(distinct question_id)::text from lms_start_exam(
     (select id from lms_quizzes where course_id = 'aaaaaaaa-0000-0000-0000-000000000001'))), '20');

select t16_say('4d and the deadline is the server''s, 40 minutes out',
  (select round(extract(epoch from (deadline_at - now())) / 60)::text
     from lms_quiz_attempts
    where user_id = '11111111-1111-1111-1111-111111111111' and status = 'in_progress'
    order by started_at desc limit 1), '40');

-- Fail it twice.
select 'first fail' from lms_submit_exam(
  (select id from lms_quiz_attempts where user_id = '11111111-1111-1111-1111-111111111111'
     and status = 'in_progress' order by started_at desc limit 1), '{}'::jsonb);
select count(*) from lms_start_exam(
  (select id from lms_quizzes where course_id = 'aaaaaaaa-0000-0000-0000-000000000001'));
select 'second fail' from lms_submit_exam(
  (select id from lms_quiz_attempts where user_id = '11111111-1111-1111-1111-111111111111'
     and status = 'in_progress' order by started_at desc limit 1), '{}'::jsonb);

select t16_say('4e two fails and it is waiting, with no tries left',
  (select state || '/' || tries_left from lms_exam_status(
     (select id from lms_quizzes where course_id = 'aaaaaaaa-0000-0000-0000-000000000001'))), 'waiting/0');

do $$
begin
  perform lms_start_exam((select id from lms_quizzes where course_id = 'aaaaaaaa-0000-0000-0000-000000000001'));
  perform t16_say('4f a third try inside 24 hours is refused', 'allowed', 'refused');
exception when others then
  perform t16_say('4f a third try inside 24 hours is refused', 'refused', 'refused');
end $$;

select t16_say('4g the result says what to watch again, by chapter',
  (select lesson_title || ' at ' || chapter_start from lms_exam_rewatch(
     (select id from lms_quiz_attempts where user_id = '11111111-1111-1111-1111-111111111111'
        order by started_at desc limit 1)) limit 1), 'Lesson one at 0');

update lms_quiz_attempts set submitted_at = submitted_at - interval '25 hours'
 where user_id = '11111111-1111-1111-1111-111111111111';

select t16_say('4h and a day later it opens again, with a fresh block of tries',
  (select state || '/' || tries_left from lms_exam_status(
     (select id from lms_quizzes where course_id = 'aaaaaaaa-0000-0000-0000-000000000001'))), 'open/2');


-- =====================================================================
-- 5  NO NEW MODULE QUIZZES
-- =====================================================================
do $$
begin
  insert into lms_quizzes (module_id, title, pass_percent, max_attempts)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'A new module quiz', 70, 3);
  perform t16_say('5a a new module quiz is refused', 'made', 'refused');
exception when others then
  perform t16_say('5a a new module quiz is refused', 'refused', 'refused');
end $$;


-- =====================================================================
-- 6  THE REFERENCE TABLES ARE NOT A LEARNER'S TO EDIT
-- =====================================================================
do $$
declare v_n integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  update lms_areas set name = 'Hacked' where slug = 'analysis';
  get diagnostics v_n = row_count;
  reset role;
  perform t16_say('6a a learner cannot rename an area', v_n || ' rows', '0 rows');
exception when others then
  reset role;
  perform t16_say('6a a learner cannot rename an area', '0 rows', '0 rows');
end $$;



-- A learner with no About you row of their own, so the only thing that
-- can refuse these is the rule being tested and not the one row per
-- learner rule.
insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-000000000001', 'nocountry@test.invalid')
on conflict (id) do nothing;

-- =====================================================================
-- 7. A COUNTRY IS A REAL COUNTRY (review item 6)
--
-- Before this, country and state were free text. Dr Ayoola stored
-- "<script>" as a country. Both columns now point at a seeded list.
-- =====================================================================
do $$
declare v_got text := 'stored';
begin
  -- No state and no postal code, so the only rule left that can stop
  -- this is the foreign key. Anything else refusing it would mean the
  -- test was proving the wrong thing.
  begin
    insert into lms_learner_profiles (
      user_id, country, region, age_band, gender, education_level,
      occupation, disability, heard_from, goals, consented_at)
    values ('66666666-0000-0000-0000-000000000001', '<script>alert(1)</script>',
            'Somewhere', '25', 'Female', 'secondary', 'none', 'no', 'friend',
            array['job'], now());
  exception when others then v_got := case when sqlstate = '23503'
                                           then 'refused by the country list'
                                           else 'refused by something else, ' || sqlstate end;
  end;
  perform t16_say('7a a made up country is refused', v_got, 'refused by the country list');
end $$;

do $$
declare v_got text := 'stored';
begin
  begin
    insert into lms_learner_profiles (
      user_id, country, state, postal_code, age_band, gender, education_level,
      occupation, disability, heard_from, goals, consented_at)
    values ('66666666-0000-0000-0000-000000000001', 'Nigeria', 'Nowhere',
            '100001', '25', 'Female', 'secondary', 'none', 'no', 'friend',
            array['job'], now());
  exception when others then v_got := case when sqlstate = '23503'
                                           then 'refused by the state list'
                                           else 'refused by something else, ' || sqlstate end;
  end;
  perform t16_say('7b a made up Nigerian state is refused', v_got, 'refused by the state list');
end $$;

do $$
declare v_got text := 'refused';
begin
  insert into lms_learner_profiles (
    user_id, country, region, age_band, gender, education_level,
    occupation, disability, heard_from, goals, consented_at)
  values ('33333333-3333-3333-3333-333333333333', 'Ghana', 'Greater Accra',
          '25', 'Female', 'secondary', 'none', 'no', 'friend', array['job'], now());
  v_got := 'stored';
  delete from lms_learner_profiles where user_id = '33333333-3333-3333-3333-333333333333';
  perform t16_say('7c a real country outside Nigeria is accepted', v_got, 'stored');
end $$;

do $$
begin
  perform t16_say('7d the list is the 195 from answers.js, Nigeria first',
    (select count(*) from lms_countries) || ', ' ||
    (select name from lms_countries order by position limit 1) || ', ' ||
    (select count(*) from lms_ng_states) || ' states',
    '195, Nigeria, 37 states');
end $$;


-- =====================================================================
-- 8. A REFUSED SIGN UP STORES NOTHING, INCLUDING IN THE TOKEN
--    (review items 2 and 3)
--
-- The replay Dr Ayoola used: Ghana with a Nigerian postal code, which
-- breaks lp_post_ck. Nothing may be stored, the answers must come out
-- of raw_user_meta_data, and the refusal must be written down.
-- =====================================================================
do $$
declare
  v_u uuid := '44444444-0000-0000-0000-000000000001';
begin
  delete from lms_system_heartbeat where name = 'signup_answers_refused';

  insert into auth.users (id, email, raw_user_meta_data)
  values (v_u, 'refused@test.invalid', jsonb_build_object(
    'country', 'Ghana', 'postal_code', '100001', 'region', 'Greater Accra',
    'age_band', '25', 'gender', 'Female', 'education_level', 'secondary',
    'occupation', 'none', 'disability', 'yes', 'disability_detail', 'Deaf',
    'heard_from', 'friend', 'goals', '["job"]'::jsonb));

  -- the account is confirmed, which is what sets the whole thing going
  update auth.users set email_confirmed_at = now() where id = v_u;

  perform t16_say('8a a refused sign up stores no answers',
    (select count(*)::text from lms_learner_profiles where user_id = v_u), '0');

  perform t16_say('8b and takes the answers out of the token too',
    (select coalesce(raw_user_meta_data ->> 'disability_detail', 'gone')
       from auth.users where id = v_u), 'gone');

  perform t16_say('8c and the account itself is kept',
    (select count(*)::text from auth.users where id = v_u), '1');

  perform t16_say('8d and the refusal is written down, as jsonb',
    (select case when detail ->> 'reason' is not null then 'reason recorded'
                 else 'nothing' end
       from lms_system_heartbeat where name = 'signup_answers_refused'),
    'reason recorded');
end $$;

do $$
declare v_tok text;
begin
  -- system_health needs a token, and only the alarm script may call it
  v_tok := 'file-16-test-token-that-is-long-enough';
  -- only an administrator may set it, and only the alarm script (nobody
  -- signed in) may read the report
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  perform lms_set_health_token(v_tok);
  perform set_config('request.jwt.claim.sub', '', true);

  perform t16_say('8e and system_health says so, as a warning',
    (select severity || ': ' || value from system_health(v_tok)
      where item = 'sign up answers refused, last 7 days'),
    'warn: 1');
end $$;


-- =====================================================================
-- 9. AN ACCOUNT THAT IS CONFIRMED THE MOMENT IT IS MADE (item 4)
--
-- An administrator making an account by hand, or email confirmation
-- switched off in the project settings. The old trigger was on update
-- only, so these accounts kept their answers for ever and never got a
-- profile row.
-- =====================================================================
do $$
declare v_u uuid := '44444444-0000-0000-0000-000000000002';
begin
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (v_u, 'madebyadmin@test.invalid', now(), jsonb_build_object(
    'country', 'Nigeria', 'state', 'Lagos', 'postal_code', '100001',
    'age_band', '25', 'gender', 'Male', 'education_level', 'tertiary',
    'qualification', 'bsc', 'course_of_study', 'Statistics',
    'occupation', 'employed', 'job_title', 'Analyst', 'sector', 'private',
    'disability', 'no', 'heard_from', 'friend', 'goals', '["job","work"]'::jsonb));

  perform t16_say('9a an account made already confirmed gets its profile row',
    (select count(*)::text from lms_learner_profiles where user_id = v_u), '1');

  perform t16_say('9b and its answers come out of the token',
    (select coalesce(raw_user_meta_data ->> 'country', 'gone')
       from auth.users where id = v_u), 'gone');

  perform t16_say('9c and the answers are the ones that were sent',
    (select country || '/' || state || '/' || job_title
       from lms_learner_profiles where user_id = v_u),
    'Nigeria/Lagos/Analyst');
end $$;


-- =====================================================================
-- 10. ABANDONED SIGN UPS GO AFTER A DAY, AND NOTHING ELSE DOES (item 5)
-- =====================================================================
do $$
declare
  v_old   uuid := '55555555-0000-0000-0000-000000000001';  -- 48 hours, clean
  v_fresh uuid := '55555555-0000-0000-0000-000000000002';  -- 1 hour
  v_conf  uuid := '55555555-0000-0000-0000-000000000003';  -- 48 hours, confirmed
  v_paid  uuid := '55555555-0000-0000-0000-000000000004';  -- 48 hours, has a course
  v_gone  integer;
begin
  insert into auth.users (id, email, created_at, email_confirmed_at) values
    (v_old,   'old@test.invalid',   now() - interval '48 hours', null),
    (v_fresh, 'fresh@test.invalid', now() - interval '1 hour',   null),
    (v_conf,  'conf@test.invalid',  now() - interval '48 hours', now() - interval '47 hours'),
    (v_paid,  'paid@test.invalid',  now() - interval '48 hours', null);

  -- NOT source 'free': every new account is given the free courses by
  -- the sign up trigger, so a free grant proves nothing. This is a
  -- grant somebody had to do something to get: a scholarship over the
  -- whole catalogue, which is course_id null.
  insert into lms_entitlements (user_id, course_id, source)
  values (v_paid, null, 'scholarship');

  v_gone := lms_prune_unconfirmed_signups(24);

  perform t16_say('10a an unconfirmed sign up older than a day goes, free grants and all',
    (select count(*)::text from auth.users where id = v_old), '0');
  perform t16_say('10b one made an hour ago stays',
    (select count(*)::text from auth.users where id = v_fresh), '1');
  perform t16_say('10c a confirmed account is never touched',
    (select count(*)::text from auth.users where id = v_conf), '1');
  perform t16_say('10d nor is one with a grant somebody had to give it',
    (select count(*)::text from auth.users where id = v_paid), '1');
  perform t16_say('10e and the count is written down',
    (select (detail ->> 'deleted') || ' deleted, ' || (detail ->> 'left_alone_because_they_had_something') || ' kept'
       from lms_admin_actions where action = 'prune_unconfirmed_signups'
      order by created_at desc limit 1),
    '1 deleted, 1 kept');
end $$;


-- =====================================================================
-- 11. NOTHING THAT DOES NOT NEED CALLING IS CALLABLE (item 7)
-- =====================================================================
do $$
begin
  perform t16_say('11a the trigger functions are not callable by anyone signed in',
    (select string_agg(proname || '=' ||
              case when has_function_privilege('authenticated', p.oid, 'execute')
                     or has_function_privilege('anon', p.oid, 'execute')
                   then 'CALLABLE' else 'no' end, ', ' order by proname)
       from pg_proc p
      where proname in ('lms_on_email_confirmed', 'lms_sync_course_area',
                        'lms_strip_signup_metadata', 'lms_apply_signup_answers',
                        'lms_prune_unconfirmed_signups')),
    'lms_apply_signup_answers=no, lms_on_email_confirmed=no, lms_prune_unconfirmed_signups=no, lms_strip_signup_metadata=no, lms_sync_course_area=no');
end $$;



-- =====================================================================
-- 12. THE LIVE CHECK PAGE STILL WORKS, AND THE BANK IS STILL SHUT
--     (review item 1)
--
-- Dr Ayoola asked for this one by name: "Test the live page's query as
-- a learner after the change." The query below is findCheck's, copied
-- out of src/pages/Academy/Learn/Check/LessonCheck.tsx:
--
--   .from("lms_quizzes").select("id")
--   .eq("lesson_id", lessonId).eq("status", "published").maybeSingle()
--
-- Shutting lms_quizzes completely would have passed every policy test
-- and broken every lesson check on the site, silently, because the page
-- treats "no row" as "this lesson has no check".
-- =====================================================================
do $$
declare
  v_check  uuid;
  v_q      uuid;
  v_found  uuid;
  v_qs     integer;
  v_exams  integer;
begin
  insert into lms_quizzes (id, lesson_id, title, pass_percent, max_attempts, serve_count, status)
  values ('cccccccc-0000-0000-0000-000000000001',
          'aaaaaaaa-0000-0000-0000-000000000003', 'Lesson check', 70, 20, 1, 'draft')
  on conflict (id) do nothing
  returning id into v_check;
  v_check := 'cccccccc-0000-0000-0000-000000000001';

  insert into lms_questions (id, quiz_id, prompt, type, explanation, position)
  values ('cccccccc-0000-0000-0000-000000000002', v_check,
          'Which weight for a household survey?', 'single',
          'Sampling weights are pweights.', 1)
  on conflict (id) do nothing;
  v_q := 'cccccccc-0000-0000-0000-000000000002';

  insert into lms_options (question_id, label, is_correct, position)
  select v_q, x.label, x.ok, x.pos
    from (values ('pweights', true, 1), ('fweights', false, 2)) as x(label, ok, pos)
   where not exists (select 1 from lms_options o where o.question_id = v_q);

  update lms_quizzes set status = 'published' where id = v_check;

  -- the learner holds the course, so the lesson is open to them
  insert into lms_entitlements (user_id, course_id, source)
  select '11111111-1111-1111-1111-111111111111',
         'aaaaaaaa-0000-0000-0000-000000000001', 'free'
   where not exists (
     select 1 from lms_entitlements e
      where e.user_id = '11111111-1111-1111-1111-111111111111'
        and e.course_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        and e.status = 'active');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  -- findCheck's query, as the learner's own browser sends it
  select id into v_found from lms_quizzes
   where lesson_id = 'aaaaaaaa-0000-0000-0000-000000000003'
     and status = 'published';

  select count(*) into v_qs    from lms_questions;
  select count(*) into v_exams from lms_quizzes where course_id is not null;
  reset role;

  perform t16_say('12a the check page still finds its quiz row',
    coalesce(v_found::text, 'nothing'), v_check::text);
  perform t16_say('12b but the question bank is shut to that same learner',
    v_qs || ' questions', '0 questions');
  perform t16_say('12c and they cannot list exam rows either',
    v_exams || ' exam rows', '0 exam rows');
exception when others then
  reset role;
  perform t16_say('12a the check page still finds its quiz row',
    'the test itself broke: ' || sqlerrm, 'the quiz id');
end $$;

-- And the same questions, read by an administrator, are all there. A
-- test that only proves nobody can read anything would also pass if the
-- table had been emptied by mistake.
do $$
declare v_qs integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  select count(*) into v_qs from lms_questions;
  reset role;
  perform t16_say('12d staff can still read the bank, so it is shut and not empty',
    case when v_qs > 0 then 'yes' else 'no, the bank is empty' end, 'yes');
exception when others then
  reset role;
  perform t16_say('12d staff can still read the bank, so it is shut and not empty',
    'refused: ' || sqlerrm, 'yes');
end $$;



-- =====================================================================
-- 13. WHAT PART B NEEDED
--
-- Three functions grew while the learner pages were built. These are
-- the promises those pages rest on.
-- =====================================================================

-- ----- the lesson door hands over the chapters
do $$
declare v_n integer; v_full boolean;
begin
  perform lms_set_lesson_chapters('aaaaaaaa-0000-0000-0000-000000000003',
    E'00:00 What clean data means\n01:15 Finding duplicates\n03:42 Missing value codes');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  select jsonb_array_length(chapters), fully_watched into v_n, v_full
    from lms_open_lesson('aaaaaaaa-0000-0000-0000-000000000003');
  reset role;

  perform t16_say('13a the lesson door hands over the chapters', coalesce(v_n, -1) || ' chapters', '3 chapters');
  perform t16_say('13b and says whether it has been watched through',
    case when v_full is null then 'did not say' else 'said' end, 'said');
exception when others then
  reset role;
  perform t16_say('13a the lesson door hands over the chapters', 'refused: ' || sqlerrm, '3 chapters');
end $$;

-- ----- my course lists the exam and not the module quiz
do $$
declare v_mods jsonb; v_exam jsonb; v_quizzes integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  select modules, exam into v_mods, v_exam from lms_my_course('t16-course');
  reset role;

  select count(*) into v_quizzes
    from jsonb_array_elements(coalesce(v_mods, '[]'::jsonb)) m
   where m -> 'quiz' is not null and m ->> 'quiz' <> 'null';

  perform t16_say('13c my course lists no module quiz', v_quizzes || ' module quizzes', '0 module quizzes');
  -- One of the five states, whichever it is by this point in the file:
  -- the tests above this one finish the lessons and sit the exam, so
  -- pinning a particular state here would be pinning the order of the
  -- file rather than the behaviour of the function.
  perform t16_say('13d and it does list the course exam',
    case when coalesce(v_exam ->> 'state', '') in
              ('not_open','open','in_progress','waiting','passed')
         then 'a known state' else 'nothing: ' || coalesce(v_exam ->> 'state', 'null') end,
    'a known state');
exception when others then
  reset role;
  perform t16_say('13c my course lists no module quiz', 'refused: ' || sqlerrm, '0 module quizzes');
end $$;

-- ----- a course is one course wherever it appears
do $$
declare
  v_path uuid := 'ffffffff-0000-0000-0000-00000000000a';
  v_other uuid := 'ffffffff-0000-0000-0000-00000000000b';
  v_json jsonb;
  v_row jsonb;
begin
  -- Made as drafts and then published by hand, because a trigger from
  -- an earlier file refuses a path that is created published: a path
  -- goes live through lms_publish_path, which checks its courses.
  insert into lms_paths (id, slug, name, description, status, position)
  values (v_path,  't16-path',  'Test path',  'A path for the file 16 tests.', 'draft', 90),
         (v_other, 't16-other', 'Other path', 'Another one.',                  'draft', 91);
  insert into lms_path_courses (path_id, course_id, position) values
    (v_path,  'aaaaaaaa-0000-0000-0000-000000000001', 1),
    (v_other, 'aaaaaaaa-0000-0000-0000-000000000001', 1);

  -- Straight to published, past lms_publish_path, because this test is
  -- about reading a path and not about the rules for publishing one.
  -- Those have their own checks in 16_verify.sql.
  alter table lms_paths disable trigger user;
  update lms_paths set status = 'published' where id in (v_path, v_other);
  alter table lms_paths enable trigger user;

  -- A programme, so the course can have a certificate at all, and then
  -- a certificate for it earned somewhere else.
  insert into programmes (slug, title, code, template_key, active)
  values ('t16-prog', 'Test programme', 'T16', 'default', true);
  -- Past the guard that stops a live course being edited. That guard
  -- is right and is tested elsewhere; this test is about reading a
  -- path, and the course has to be published to be in one.
  alter table lms_courses disable trigger user;
  update lms_courses set programme_id = (select id from programmes where slug = 't16-prog')
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  alter table lms_courses enable trigger user;

  insert into participants (id, full_name, email, email_norm)
  values ('aaaa0000-0000-0000-0000-0000000ce111', 'A Learner', 'learner@test.invalid', 'learner@test.invalid');
  update lms_profiles set participant_id = 'aaaa0000-0000-0000-0000-0000000ce111'
   where id = '11111111-1111-1111-1111-111111111111';
  insert into certificates (certificate_number, participant_id, programme_id, module_id, completed_on, issued_by)
  select 'DLA-2026-T16-0001', 'aaaa0000-0000-0000-0000-0000000ce111', c.programme_id, null, current_date, 'Data-Lead Academy'
    from lms_courses c where c.id = 'aaaaaaaa-0000-0000-0000-000000000001' and c.programme_id is not null;

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  v_json := lms_my_path('t16-path');
  v_row := v_json -> 'courses' -> 0;

  perform t16_say('13e a path says which of its courses are done',
    case when v_row ->> 'certificate_number' is not null then 'certified' else 'not certified' end,
    case when exists (select 1 from certificates where certificate_number = 'DLA-2026-T16-0001')
         then 'certified' else 'not certified' end);

  perform t16_say('13f and names the other path it was taken in',
    coalesce(v_row ->> 'also_in', 'nothing'),
    case when exists (select 1 from certificates where certificate_number = 'DLA-2026-T16-0001')
         then 'Other path' else 'nothing' end);

  -- And signed out: the path is still readable, with nothing ticked.
  perform set_config('request.jwt.claim.sub', '', true);
  v_json := lms_my_path('t16-path');
  perform t16_say('13g signed out, the path reads with nothing ticked',
    coalesce(v_json -> 'courses' -> 0 ->> 'certificate_number', 'nothing') || ', ' ||
    coalesce(v_json ->> 'name', 'no path'),
    'nothing, Test path');

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
end $$;

-- ----- the certificate moment knows what it counts towards
do $$
declare v_paths jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  select paths into v_paths from lms_my_course('t16-course');
  reset role;
  perform t16_say('13h my course names every path the course is in',
    jsonb_array_length(coalesce(v_paths, '[]'::jsonb)) || ' paths', '2 paths');
exception when others then
  reset role;
  perform t16_say('13h my course names every path the course is in', 'refused: ' || sqlerrm, '2 paths');
end $$;


-- ------------------------------------------------------------- results
\pset tuples_only off
\pset format aligned
select n as "#",
       label as "what was checked",
       case when got is not distinct from want then 'pass' else 'FAIL' end as "result",
       got as "got", want as "wanted"
  from t16_out order by n;

select case when count(*) = 0 then 'ALL PASS'
            else count(*) || ' FAILED' end as "summary"
  from t16_out where got is distinct from want;

rollback;
