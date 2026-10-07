\set QUIET on
\pset border 2

-- =====================================================================
-- M. REVIEW ITEM 1: the returning bootcamp student
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
do $$ declare r record; v_exp timestamptz; begin
  select * into r from lms_sync_my_access();          -- first sign in, cohort one
  select expires_at into v_exp from lms_entitlements
   where user_id='44444444-4444-4444-4444-444444444444' and course_id is null and status='active';
  perform t_rec('M0 first sign in during cohort one creates the grant',
                r.bootcamp and v_exp is not null, 'expires '||coalesce(v_exp::text,'null'));
end $$;
reset role;
-- a second cohort starts, still active, ending next year
set role postgres;
insert into participant_enrolments (participant_id, programme_id, cohort, status, ends_on)
 values ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',
         'cohort-2','active', current_date + 300);
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
do $$ declare r record; v_exp timestamptz; begin
  select * into r from lms_sync_my_access();
  select expires_at into v_exp from lms_entitlements
   where user_id='44444444-4444-4444-4444-444444444444' and course_id is null and status='active';
  perform t_rec('M1 returning student in an active second cohort gets access back',
                lms_has_course_access('cccccccc-0000-0000-0000-000000000001'),
                'access='||lms_has_course_access('cccccccc-0000-0000-0000-000000000001')::text
                ||' expires '||coalesce(v_exp::text,'null')||' msg: '||r.message);
end $$;
reset role;
-- the cohort is extended by another year
set role postgres;
update participant_enrolments set ends_on = current_date + 700 where cohort='cohort-2';
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
do $$ declare v_exp timestamptz; r record; begin
  select * into r from lms_sync_my_access();
  select expires_at into v_exp from lms_entitlements
   where user_id='44444444-4444-4444-4444-444444444444' and course_id is null and status='active';
  perform t_rec('M2 extending the cohort moves the expiry date',
                v_exp::date = (current_date + 701), 'expires '||coalesce(v_exp::date::text,'null')
                ||', expected '||(current_date+701)::text);
end $$;
reset role;
-- the enrolment becomes open ended
set role postgres;
update participant_enrolments set ends_on = null where cohort='cohort-2';
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
do $$ declare v_exp timestamptz; r record; begin
  select * into r from lms_sync_my_access();
  select expires_at into v_exp from lms_entitlements
   where user_id='44444444-4444-4444-4444-444444444444' and course_id is null and status='active';
  perform t_rec('M3 an open ended enrolment clears the expiry',
                v_exp is null, 'expires '||coalesce(v_exp::text,'null'));
end $$;
do $$ declare r record; v_n int; begin
  select * into r from lms_sync_my_access();
  select count(*) into v_n from lms_entitlements
   where user_id='44444444-4444-4444-4444-444444444444' and course_id is null and status='active';
  perform t_rec('M4 calling it again changes nothing and leaves one live grant',
                not r.changed and v_n = 1, 'changed='||r.changed::text||' live='||v_n);
end $$;
reset role;

-- =====================================================================
-- M. REVIEW ITEM 2: what a facilitator must not be able to do
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$ declare v_n int; begin
  update lms_courses set status='published', published_at=now()
   where id='cccccccc-0000-0000-0000-000000000002';
  get diagnostics v_n = row_count;
  perform t_rec('M5 facilitator CANNOT publish a course directly', v_n = 0, 'rows changed='||v_n);
exception when others then perform t_rec('M5 facilitator CANNOT publish a course directly', true, 'refused: '||SQLERRM);
end $$;
do $$ declare v_n int; begin
  update lms_courses set price_kobo = 0 where id='cccccccc-0000-0000-0000-000000000002';
  get diagnostics v_n = row_count;
  perform t_rec('M6 facilitator CANNOT make a course free', v_n = 0, 'rows changed='||v_n);
exception when others then perform t_rec('M6 facilitator CANNOT make a course free', true, 'refused: '||SQLERRM);
end $$;
do $$ declare v_n int; begin
  delete from lms_courses where id='cccccccc-0000-0000-0000-000000000003';
  get diagnostics v_n = row_count;
  perform t_rec('M7 facilitator CANNOT delete a course', v_n = 0, 'rows deleted='||v_n);
exception when others then perform t_rec('M7 facilitator CANNOT delete a course', true, 'refused: '||SQLERRM);
end $$;
do $$ declare v_n int; begin
  update lms_courses set summary='edited while live' where id='cccccccc-0000-0000-0000-000000000001';
  get diagnostics v_n = row_count;
  perform t_rec('M8 facilitator CANNOT edit a course that is already live', v_n = 0, 'rows changed='||v_n);
exception when others then perform t_rec('M8 facilitator CANNOT edit a course that is already live', true, 'refused: '||SQLERRM);
end $$;
do $$ begin
  insert into lms_courses (slug,title,tool,area,level,status,published_at)
  values ('sneaky','Sneaky','R','Stats','Beginner','published', now());
  perform t_rec('M9 facilitator CANNOT create a course already published', false, 'the insert went through');
exception when others then perform t_rec('M9 facilitator CANNOT create a course already published', true, 'refused: '||SQLERRM);
end $$;
do $$ declare v_n int; begin
  insert into lms_modules (course_id, title, position)
  values ('cccccccc-0000-0000-0000-000000000001','Bolted onto a live course',9);
  perform t_rec('M10 facilitator CANNOT add a module to a live course', false, 'the insert went through');
exception when others then perform t_rec('M10 facilitator CANNOT add a module to a live course', true, 'refused: '||SQLERRM);
end $$;
do $$ begin
  update lms_lessons set video_ref='swapped' where id='dddddddd-0000-0000-0000-00000000000c';
  perform t_rec('M11 facilitator CANNOT change a lesson on a live course', false, 'the update went through');
exception when others then perform t_rec('M11 facilitator CANNOT change a lesson on a live course', true, 'refused: '||SQLERRM);
end $$;
reset role;
-- These two run as the table OWNER with a facilitator's user id set, so row
-- level security is out of the way and the guard itself is what is tested.
set role postgres;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$ begin
  update lms_paths set status='published' where id='eeeeeeee-0000-0000-0000-000000000002';
  perform t_rec('M12 the guard refuses a non-admin publishing a path', false, 'the update went through');
exception when others then perform t_rec('M12 the guard refuses a non-admin publishing a path', true, 'refused: '||SQLERRM);
end $$;
do $$ begin
  update lms_quizzes set status='published' where id='dddddddd-0000-0000-0000-0000000000eb';
  perform t_rec('M13 the guard refuses a non-admin publishing a set of questions', false, 'the update went through');
exception when others then perform t_rec('M13 the guard refuses a non-admin publishing a set of questions', true, 'refused: '||SQLERRM);
end $$;
do $$ begin
  delete from lms_paths where id='eeeeeeee-0000-0000-0000-000000000002';
  perform t_rec('M13b the guard refuses a non-admin deleting a path', false, 'the delete went through');
exception when others then perform t_rec('M13b the guard refuses a non-admin deleting a path', true, 'refused: '||SQLERRM);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
-- the things a facilitator MUST still be able to do
do $$ declare v_n int; begin
  update lms_courses set summary='a better description' where id='cccccccc-0000-0000-0000-000000000002';
  get diagnostics v_n = row_count;
  perform t_rec('M14 facilitator CAN still edit a draft course', v_n = 1, 'rows changed='||v_n);
exception when others then perform t_rec('M14 facilitator CAN still edit a draft course', false, 'refused: '||SQLERRM);
end $$;
do $$ declare v_c uuid; begin
  insert into lms_courses (slug,title,tool,area,level) values ('new-draft','New draft','R','Stats','Beginner')
  returning id into v_c;
  perform t_rec('M15 facilitator CAN still create a draft course', v_c is not null);
exception when others then perform t_rec('M15 facilitator CAN still create a draft course', false, 'refused: '||SQLERRM);
end $$;
do $$ begin
  insert into lms_modules (course_id, title, position)
  values ('cccccccc-0000-0000-0000-000000000002','Second draft module',2);
  perform t_rec('M16 facilitator CAN still add a module to a draft course', true);
exception when others then perform t_rec('M16 facilitator CAN still add a module to a draft course', false, 'refused: '||SQLERRM);
end $$;
reset role;
-- and the administrator must still be able to publish
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$ declare r record; v_s text; begin
  select * into r from lms_publish_course('cccccccc-0000-0000-0000-000000000002');
  select status::text into v_s from lms_courses where id='cccccccc-0000-0000-0000-000000000002';
  perform t_rec('M17 administrator CAN still publish', r.published and v_s='published',
                'published='||r.published::text||' status='||v_s||' msg: '||r.message);
exception when others then perform t_rec('M17 administrator CAN still publish', false, 'refused: '||SQLERRM);
end $$;
do $$ declare v_n int; begin
  update lms_courses set status='draft' where id='cccccccc-0000-0000-0000-000000000002';
  get diagnostics v_n = row_count;
  perform t_rec('M18 administrator CAN unpublish and edit a live course', v_n = 1, 'rows changed='||v_n);
exception when others then perform t_rec('M18 administrator CAN unpublish and edit a live course', false, 'refused: '||SQLERRM);
end $$;
reset role;

-- =====================================================================
-- M. REVIEW ITEM 3: importing questions must not delete the bank
-- =====================================================================
-- a learner starts the live check, freezing two question ids
set role postgres;
insert into lms_entitlements (user_id, course_id, source) values
 ('33333333-3333-3333-3333-333333333333', null, 'manual') on conflict do nothing;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare v_att uuid; begin
  select attempt_id into v_att from lms_start_quiz('dddddddd-0000-0000-0000-00000000000e') limit 1;
  insert into t_scratch(k,v) values ('att', v_att::text) on conflict (k) do update set v=excluded.v;
  perform t_rec('M19 a learner can start the check, freezing the question ids', v_att is not null,
                'attempt '||coalesce(v_att::text,'none'));
exception when others then perform t_rec('M19 a learner can start the check, freezing the question ids', false, SQLERRM);
end $$;
reset role;
-- a facilitator may not touch a set of questions that is live
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$ declare r record; begin
  select * into r from lms_import_questions('dddddddd-0000-0000-0000-00000000000e', '[
   {"prompt":"sneaked in","type":"single","options":[{"label":"y","correct":true}]}]'::jsonb);
  perform t_rec('M20 facilitator CANNOT import into a live set of questions', r.imported = 0, r.message);
exception when others then perform t_rec('M20 facilitator CANNOT import into a live set of questions', true, 'refused: '||SQLERRM);
end $$;
-- but may import into a draft set on a draft course
do $$ declare r record; begin
  select * into r from lms_import_questions('dddddddd-0000-0000-0000-0000000000eb', '[
   {"prompt":"draft one","type":"single","options":[{"label":"y","correct":true},{"label":"n","correct":false}]}]'::jsonb);
  perform t_rec('M21 facilitator CAN import into a draft set on a draft course', r.imported = 1, r.message);
exception when others then perform t_rec('M21 facilitator CAN import into a draft set on a draft course', false, SQLERRM);
end $$;
reset role;
-- the administrator revises the live set, which is the real case
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$ declare r record; begin
  select * into r from lms_import_questions('dddddddd-0000-0000-0000-00000000000e', '[
   {"prompt":"Brand new one","type":"single","options":[{"label":"yes","correct":true},{"label":"no","correct":false}]},
   {"prompt":"Brand new two","type":"single","options":[{"label":"yes","correct":true},{"label":"no","correct":false}]}]'::jsonb);
  perform t_rec('M22 administrator CAN revise a live set of questions', r.imported = 2, r.message);
exception when others then perform t_rec('M22 administrator CAN revise a live set of questions', false, SQLERRM);
end $$;
reset role;
set role postgres;
do $$ declare v_old int; v_act int; v_ret int; v_missing int; v_ids uuid[]; begin
  select count(*) into v_old from lms_questions
   where id in ('dddddddd-0000-0000-0000-000000000011','dddddddd-0000-0000-0000-000000000012');
  perform t_rec('M23 the old questions were NOT deleted', v_old = 2, 'old rows still present='||v_old||' of 2');
  select count(*) filter (where active), count(*) filter (where not active) into v_act, v_ret
    from lms_questions where quiz_id='dddddddd-0000-0000-0000-00000000000e';
  perform t_rec('M24 old questions were retired, new ones are active',
                v_act = 2 and v_ret = 2, 'active='||v_act||' retired='||v_ret);
  select served_question_ids into v_ids from lms_quiz_attempts
   where id = (select v::uuid from t_scratch where k='att');
  select count(*) into v_missing from unnest(v_ids) x
   where not exists (select 1 from lms_questions q where q.id = x);
  perform t_rec('M25 the learner frozen question ids still point at real rows',
                v_missing = 0, 'frozen ids with no row='||v_missing);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare v_att uuid; r record; begin
  select v::uuid into v_att from t_scratch where k='att';
  select * into r from lms_submit_quiz(v_att, '{}'::jsonb);
  perform t_rec('M26 a learner mid attempt is still marked against real questions',
                r.question_count = 2, 'questions marked='||coalesce(r.question_count::text,'none')
                ||' feedback: '||coalesce(r.feedback,'none'));
exception when others then perform t_rec('M26 a learner mid attempt is still marked against real questions', false, SQLERRM);
end $$;
reset role;
set role postgres;
do $$ declare v_dupes int; begin
  select count(*) into v_dupes from (
    select quiz_id, position, count(*) c from lms_questions group by quiz_id, position having count(*) > 1) x;
  perform t_rec('M27 no two questions in one quiz share a position', v_dupes = 0, 'clashing positions='||v_dupes);
end $$;
reset role;

-- =====================================================================
-- M. REVIEW ITEM 4: access must change without waiting for a sign in
-- =====================================================================
set role postgres;
do $$ declare r record; v_live int; begin
  -- the returning student is withdrawn, and does NOT sign in again
  update participant_enrolments set status='withdrawn'
   where participant_id='aaaaaaaa-0000-0000-0000-000000000001';
  select * into r from lms_nightly_access_sweep();
  select count(*) into v_live from lms_entitlements
   where user_id='44444444-4444-4444-4444-444444444444' and course_id is null and status='active';
  perform t_rec('M28 the nightly sweep closes a withdrawn student access with no sign in',
                v_live = 0 and r.revoked >= 1,
                'live grants='||v_live||' swept: granted '||r.granted||' renewed '||r.renewed
                ||' revoked '||r.revoked||' looked at '||r.looked_at);
exception when others then perform t_rec('M28 the nightly sweep closes a withdrawn student access with no sign in', false, SQLERRM);
end $$;
do $$ declare r record; v_exp timestamptz; begin
  -- re-enrolled with a far end date, still no sign in
  update participant_enrolments set status='active', ends_on = current_date + 500
   where participant_id='aaaaaaaa-0000-0000-0000-000000000001' and cohort='cohort-2';
  select * into r from lms_nightly_access_sweep();
  select expires_at into v_exp from lms_entitlements
   where user_id='44444444-4444-4444-4444-444444444444' and course_id is null and status='active';
  perform t_rec('M29 the nightly sweep gives it back and sets the right expiry',
                v_exp::date = (current_date + 501),
                'expires '||coalesce(v_exp::date::text,'null')||', expected '||(current_date+501)::text);
exception when others then perform t_rec('M29 the nightly sweep gives it back and sets the right expiry', false, SQLERRM);
end $$;
do $$ declare r record; begin
  select * into r from lms_nightly_access_sweep();
  perform t_rec('M30 running the sweep again changes nothing',
                r.granted = 0 and r.renewed = 0 and r.revoked = 0,
                'granted '||r.granted||' renewed '||r.renewed||' revoked '||r.revoked);
exception when others then perform t_rec('M30 running the sweep again changes nothing', false, SQLERRM);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ begin
  perform lms_nightly_access_sweep();
  perform t_rec('M31 a learner CANNOT run the nightly sweep', false, 'it ran');
exception when others then perform t_rec('M31 a learner CANNOT run the nightly sweep', true, 'refused: '||SQLERRM);
end $$;
reset role;

-- =====================================================================
-- M. REVIEW ITEM 5: table permissions
-- =====================================================================
set role postgres;
do $$ declare v_bad text; begin
  select string_agg(distinct table_name || ' / ' || grantee || ' / ' || privilege_type, ', ')
    into v_bad from information_schema.role_table_grants
   where table_schema='public' and table_name like 'lms\_%'
     and grantee in ('anon','authenticated')
     and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER');
  perform t_rec('M32 nobody signed in or out holds TRUNCATE, REFERENCES or TRIGGER',
                v_bad is null, coalesce('still held: '||left(v_bad,200),'none'));
end $$;
do $$ declare v_bad text; begin
  select string_agg(distinct table_name || ' / ' || privilege_type, ', ')
    into v_bad from information_schema.role_table_grants
   where table_schema='public' and table_name like 'lms\_%'
     and grantee = 'anon' and privilege_type in ('INSERT','UPDATE','DELETE');
  perform t_rec('M33 a visitor who is not signed in cannot write to any table',
                v_bad is null, coalesce('still held: '||left(v_bad,200),'none'));
end $$;
do $$ declare v_n int; begin
  select count(*) into v_n from information_schema.role_table_grants
   where table_schema='public' and table_name like 'lms\_%'
     and grantee='authenticated' and privilege_type='SELECT';
  perform t_rec('M34 a signed in person can still read the tables', v_n >= 17, 'tables readable='||v_n);
end $$;
reset role;
