-- =====================================================================
-- DO NOT RUN THIS ON SUPABASE. LOCAL POSTGRESQL ONLY.
-- The seed deletes every participant, certificate and account.
-- =====================================================================
drop table if exists t_scratch;
create table t_scratch (k text primary key, v text);
grant all on t_scratch to authenticated, anon;

-- =====================================================================
-- U. Part B: nobody but staff may set how long a video is
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);

do $$ declare v_n int; begin
  update lms_lessons set duration_seconds = 5 where id='c3000000-0000-0000-0000-000000000001';
  get diagnostics v_n = row_count;
  perform t_rec('U1 a learner cannot change a video length directly', v_n = 0, 'rows changed='||v_n);
exception when others then perform t_rec('U1 a learner cannot change a video length directly', true, 'refused: '||SQLERRM);
end $$;

do $$ declare r record; begin
  select * into r from lms_set_lesson_duration('c3000000-0000-0000-0000-000000000001', 5);
  insert into t_scratch(k,v) values ('u2msg', coalesce(r.message,'')) on conflict (k) do update set v = excluded.v;
  insert into t_scratch(k,v) values ('u2ok', (r.ok)::text) on conflict (k) do update set v = excluded.v;
exception when others then
  insert into t_scratch(k,v) values ('u2msg','refused: '||SQLERRM) on conflict (k) do update set v = excluded.v;
  insert into t_scratch(k,v) values ('u2ok','false') on conflict (k) do update set v = excluded.v;
end $$;
reset role;
-- The length has to be read as the owner. A learner cannot even SEE a
-- lesson on a draft course, so reading it as the learner returns null
-- and the test would pass for the wrong reason.
set role postgres;
do $$ declare r_len int; r_ok text; r_msg text; begin
  select duration_seconds into r_len from lms_lessons where id='c3000000-0000-0000-0000-000000000001';
  select v into r_ok  from t_scratch where k='u2ok';
  select v into r_msg from t_scratch where k='u2msg';
  perform t_rec('U2 a learner cannot change it through the function either',
                r_ok = 'false' and r_len = 600, 'length is still '||r_len||'. '||left(r_msg,46));
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
do $$ declare v record; begin
  select * into v from lms_set_lesson_duration('c3000000-0000-0000-0000-000000000001', 900);
  perform t_rec('U3 a facilitator CAN correct it on a draft course',
                v.ok and (select duration_seconds from lms_lessons where id='c3000000-0000-0000-0000-000000000001') = 900,
                coalesce(v.message,'no message'));
exception when others then perform t_rec('U3 a facilitator CAN correct it on a draft course', false, SQLERRM);
end $$;

do $$ declare v record; begin
  select * into v from lms_set_lesson_duration('c3000000-0000-0000-0000-000000000001', 0);
  perform t_rec('U4 a silly length is refused', not v.ok, coalesce(v.message,'no message'));
exception when others then perform t_rec('U4 a silly length is refused', true, 'refused: '||SQLERRM);
end $$;
reset role;
set role postgres;
select set_config('request.jwt.claim.sub','',false);
update lms_lessons set duration_seconds = 600 where id='c3000000-0000-0000-0000-000000000001';
reset role;

-- =====================================================================
-- V. Part B: the publish checklist
-- =====================================================================
set role postgres;
do $$ declare v_lbl text; begin
  select label into v_lbl from lms_course_blockers('c1000000-0000-0000-0000-000000000002') where not ok and label like 'Has a programme%';
  perform t_rec('V1 a course with no programme cannot be published', v_lbl is not null, left(coalesce(v_lbl,'no such item'),70));
end $$;

do $$ declare v_lbl text; begin
  select label into v_lbl from lms_course_blockers('c1000000-0000-0000-0000-000000000002') where not ok and label like 'Every video lesson%';
  perform t_rec('V2 a lesson with no video is named, not just counted',
                v_lbl like '%Lesson one%', left(coalesce(v_lbl,'no such item'),80));
end $$;

do $$ declare v_bad int; begin
  select count(*) into v_bad from lms_course_blockers('c1000000-0000-0000-0000-000000000001') where not ok;
  perform t_rec('V3 the good test course has nothing blocking it', v_bad = 0, 'blockers='||v_bad);
end $$;
reset role;

-- =====================================================================
-- W. Part A: the certificate
-- =====================================================================
set role anon;
do $$ declare v record; begin
  select * into v from lms_claim_course_certificate('c1000000-0000-0000-0000-000000000001');
  perform t_rec('W1 somebody not signed in gets nothing', not v.issued, coalesce(v.message,'no message'));
exception when others then perform t_rec('W1 somebody not signed in gets nothing', true, 'refused: '||SQLERRM);
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare v record; begin
  select * into v from lms_claim_course_certificate('c1000000-0000-0000-0000-000000000001');
  perform t_rec('W2 no certificate while lessons are unfinished',
                not v.issued and v.message like '%of 2 lessons%', coalesce(v.message,'no message'));
exception when others then perform t_rec('W2 no certificate while lessons are unfinished', false, SQLERRM);
end $$;
reset role;

-- finish the lessons as the owner, which is what watching them would do
set role postgres;
select set_config('request.jwt.claim.sub','',false);
insert into lms_lesson_progress (user_id, lesson_id, completed, completed_at, check_passed)
 values ('33333333-3333-3333-3333-333333333333','c3000000-0000-0000-0000-000000000001',true,now(),true),
        ('33333333-3333-3333-3333-333333333333','c3000000-0000-0000-0000-000000000002',true,now(),true)
 on conflict (user_id, lesson_id) do update set completed = true, completed_at = now();
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare v record; begin
  select * into v from lms_claim_course_certificate('c1000000-0000-0000-0000-000000000001');
  perform t_rec('W3 no certificate while the module quiz is unpassed',
                not v.issued and v.message like '%module quizzes%', coalesce(v.message,'no message'));
exception when others then perform t_rec('W3 no certificate while the module quiz is unpassed', false, SQLERRM);
end $$;
reset role;

-- pass the module quiz, properly, through the real functions
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare v_att uuid; v_opt uuid; v_ans jsonb; begin
  select attempt_id into v_att from lms_start_quiz('c4000000-0000-0000-0000-000000000001') limit 1;
  select option_id into v_opt from lms_start_quiz('c4000000-0000-0000-0000-000000000001') limit 1;
  insert into t_scratch(k,v) values ('att', v_att::text) on conflict (k) do update set v = excluded.v;
exception when others then perform t_rec('W3b could not start the module quiz', false, SQLERRM);
end $$;
reset role;
set role postgres;
select set_config('request.jwt.claim.sub','',false);
-- mark it passed the way a correct submission would
update lms_quiz_attempts set passed = true, status = 'passed', score = 1, max_score = 1, percent = 100
 where quiz_id = 'c4000000-0000-0000-0000-000000000001'
   and user_id = '33333333-3333-3333-3333-333333333333';
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare v record; begin
  select * into v from lms_claim_course_certificate('c1000000-0000-0000-0000-000000000001');
  insert into t_scratch(k,v) values ('cert', coalesce(v.certificate_number,'')) on conflict (k) do update set v = excluded.v;
  perform t_rec('W4 a finished course issues a certificate',
                v.issued and v.certificate_number is not null,
                coalesce(v.certificate_number,'none')||' / '||coalesce(v.message,''));
exception when others then perform t_rec('W4 a finished course issues a certificate', false, SQLERRM);
end $$;

do $$ declare r record; r_first text; r_n int; begin
  select t.v into r_first from t_scratch t where t.k='cert';
  select * into r from lms_claim_course_certificate('c1000000-0000-0000-0000-000000000001');
  -- count only certificates for THIS course's programme and participant.
  -- The seed already carries two unrelated ones, and counting all of them
  -- is how the first version of this test accused the function of a bug
  -- it did not have.
  select count(*) into r_n from certificates c
    join lms_profiles p on p.participant_id = c.participant_id
   where p.id = '33333333-3333-3333-3333-333333333333';
  perform t_rec('W5 claiming twice gives the same number and makes no second certificate',
                r.certificate_number = r_first and not r.issued and r_n = 1,
                'same number='||(r.certificate_number = r_first)::text||' this learner has '||r_n);
exception when others then perform t_rec('W5 claiming twice gives the same number and makes no second certificate', false, SQLERRM);
end $$;
reset role;

-- it must be a real certificate the public verify page can read
set role postgres;
do $$ declare r record; r_num text; begin
  select t.v into r_num from t_scratch t where t.k='cert';
  select * into r from verify_certificate(r_num);
  perform t_rec('W6 the certificate verifies on the public page',
                r.found and not r.revoked and r.full_name is not null,
                'name='||coalesce(r.full_name,'null')||' programme='||coalesce(r.programme_title,'null'));
exception when others then perform t_rec('W6 the certificate verifies on the public page', false, SQLERRM);
end $$;

-- a withdrawn certificate must not be quietly reissued
do $$ begin
  update certificates c set revoked = true, revoked_reason = 'testing'
   where c.participant_id = (select participant_id from lms_profiles
                              where id = '33333333-3333-3333-3333-333333333333');
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare r record; r_n int; begin
  select * into r from lms_claim_course_certificate('c1000000-0000-0000-0000-000000000001');
  select count(*) into r_n from certificates c
    join lms_profiles p on p.participant_id = c.participant_id
   where p.id = '33333333-3333-3333-3333-333333333333';
  perform t_rec('W7 a withdrawn certificate is NOT quietly reissued',
                not r.issued and r_n = 1 and r.message like '%withdrawn%',
                'this learner still has '||r_n||'. '||left(coalesce(r.message,''),44));
exception when others then perform t_rec('W7 a withdrawn certificate is NOT quietly reissued', false, SQLERRM);
end $$;
reset role;
set role postgres;
update certificates set revoked = false, revoked_reason = null where revoked_reason = 'testing';
reset role;

-- somebody with no access to the course
set role postgres;
insert into auth.users (id, email, email_confirmed_at)
 values ('55555555-5555-5555-5555-555555555555','stranger@gmail.com', now()) on conflict (id) do nothing;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false);
do $$ declare v record; begin
  select * into v from lms_claim_course_certificate('c1000000-0000-0000-0000-000000000001');
  perform t_rec('W8 somebody with no access to the course gets nothing',
                not v.issued and v.message like '%do not have access%', coalesce(v.message,'no message'));
exception when others then perform t_rec('W8 somebody with no access to the course gets nothing', false, SQLERRM);
end $$;
reset role;

-- a course with no programme
set role postgres;
insert into lms_entitlements (user_id, course_id, source)
 values ('33333333-3333-3333-3333-333333333333','c1000000-0000-0000-0000-000000000002','manual');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare v record; begin
  select * into v from lms_claim_course_certificate('c1000000-0000-0000-0000-000000000002');
  perform t_rec('W9 a course with no programme says so plainly',
                not v.issued and v.message like '%no programme%', coalesce(v.message,'no message'));
exception when others then perform t_rec('W9 a course with no programme says so plainly', false, SQLERRM);
end $$;
reset role;

-- =====================================================================
-- X. permissions stay tight
-- =====================================================================
set role postgres;
do $$ declare v_bad text; begin
  select string_agg(distinct grantee, ', ') into v_bad
    from information_schema.role_routine_grants
   where routine_schema='public' and routine_name='lms_set_lesson_duration'
     and grantee in ('anon','PUBLIC');
  perform t_rec('X1 a visitor who is not signed in cannot reach the length function',
                v_bad is null, coalesce('reachable by: '||v_bad,'nobody'));
end $$;

do $$ declare v_bad text; begin
  select string_agg(distinct table_name||'/'||privilege_type, ', ') into v_bad
    from information_schema.role_table_grants
   where table_schema='public' and table_name like 'lms\_%'
     and grantee in ('anon','authenticated')
     and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER');
  perform t_rec('X2 no table grants TRUNCATE, REFERENCES or TRIGGER',
                v_bad is null, coalesce('still held: '||left(v_bad,100),'none'));
end $$;
reset role;
