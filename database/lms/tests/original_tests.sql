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
\set QUIET on
\pset border 2
set role postgres;
create or replace function t_rec(p_name text, p_pass boolean, p_detail text default '')
returns void language sql as $$ insert into t_results(name,pass,detail) values(p_name,coalesce(p_pass,false),p_detail) $$;
grant execute on function t_rec(text,boolean,text) to authenticated, anon;
drop table if exists t_scratch;
create table t_scratch (k text primary key, v text);
grant all on t_scratch to authenticated, anon;
reset role;

-- =====================================================================
-- A. the migration did not break what was already there
-- =====================================================================
do $$
declare v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.prosrc like '%''uploader''%';
  perform t_rec('A1 no function body still names the old role label',
                v_bad is null, coalesce('still stale: '||v_bad,''));
end $$;

do $$ begin
  begin
    perform lms_lesson_is_open('cccccccc-0000-0000-0000-000000000001'::uuid);
    perform t_rec('A2 lms_lesson_is_open still runs (it gates every lesson read)', true);
  exception when others then
    perform t_rec('A2 lms_lesson_is_open still runs (it gates every lesson read)', false, SQLERRM);
  end;
end $$;

do $$
declare v_n int;
begin
  select count(*) into v_n from pg_enum e join pg_type t on t.oid = e.enumtypid
   where t.typname = 'lms_role' and e.enumlabel = 'facilitator';
  perform t_rec('A3 role label renamed to facilitator', v_n = 1);
end $$;

-- =====================================================================
-- B. facilitator access follows the list, both directions
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$
declare r record;
begin
  select * into r from lms_sync_my_access();
  perform t_rec('B1 email on the list grants facilitator at sign in',
                r.role = 'facilitator' and r.changed, 'role='||coalesce(r.role,'null')||' msg='||r.message);
end $$;
do $$
declare r record;
begin
  select * into r from lms_sync_my_access();
  perform t_rec('B2 signing in again changes nothing', r.role = 'facilitator' and not r.changed, r.message);
end $$;
reset role;

-- take the leaver off the list, as the administrator would
set role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',false);
do $$ declare r record; begin
  select * into r from lms_sync_my_access();
  perform t_rec('B3 leaver starts as facilitator', r.role = 'facilitator', r.role);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$ declare r record; begin
  select * into r from lms_remove_facilitator('exfac@dataleadafrica.com');
  perform t_rec('B4 administrator can take someone off the list', r.ok, r.message);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',false);
do $$ declare r record; begin
  select * into r from lms_sync_my_access();
  perform t_rec('B5 taken off the list, they are a learner again',
                r.role = 'learner', 'role='||r.role||' msg='||r.message);
end $$;
reset role;

-- and if the list is edited straight in the table, bypassing the
-- function, the sign-in check is what has to notice
set role postgres;
insert into lms_facilitators (email_norm) values ('exfac@dataleadafrica.com');
update lms_profiles set role = 'facilitator' where id = '66666666-6666-6666-6666-666666666666';
delete from lms_facilitators where email_norm = 'exfac@dataleadafrica.com';
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',false);
do $$ declare r record; begin
  select * into r from lms_sync_my_access();
  perform t_rec('B6 list edited by hand, sign-in check still revokes',
                r.role = 'learner' and r.changed, 'role='||r.role||' msg='||r.message);
end $$;
reset role;

-- =====================================================================
-- C. bootcamp access follows the enrolment, both directions
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
do $$ declare r record; v_n int; begin
  select * into r from lms_sync_my_access();
  select count(*) into v_n from lms_entitlements
   where user_id = '44444444-4444-4444-4444-444444444444' and course_id is null
     and source = 'roster' and status = 'active';
  perform t_rec('C1 enrolled bootcamp email gets the whole catalogue',
                r.bootcamp and v_n = 1, 'bootcamp='||r.bootcamp||' rows='||v_n||' msg='||r.message);
end $$;
do $$ begin
  perform t_rec('C2 and that opens a paid course',
    lms_has_course_access('cccccccc-0000-0000-0000-000000000001'::uuid));
end $$;
reset role;

-- mark the enrolment withdrawn
set role postgres;
update participant_enrolments set status = 'withdrawn'
 where participant_id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
do $$ declare r record; v_n int; begin
  select * into r from lms_sync_my_access();
  select count(*) into v_n from lms_entitlements
   where user_id = '44444444-4444-4444-4444-444444444444' and course_id is null
     and source = 'roster' and status = 'active';
  perform t_rec('C3 withdrawn enrolment closes the access',
                not r.bootcamp and v_n = 0, 'bootcamp='||r.bootcamp||' active rows='||v_n||' msg='||r.message);
end $$;
reset role;

-- someone whose email matches a participant who was never enrolled
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare r record; v_n int; begin
  select * into r from lms_sync_my_access();
  select count(*) into v_n from lms_entitlements
   where user_id = '33333333-3333-3333-3333-333333333333' and status = 'active';
  perform t_rec('C4 participant record but no enrolment grants nothing',
                not r.bootcamp and v_n = 0, 'bootcamp='||r.bootcamp||' active rows='||v_n);
end $$;
reset role;

-- =====================================================================
-- D. an unproven email grants nothing
-- =====================================================================
set role postgres;
insert into lms_facilitators (email_norm, full_name) values ('notyet@gmail.com','Unconfirmed')
  on conflict do nothing;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false);
do $$ declare r record; begin
  select * into r from lms_sync_my_access();
  perform t_rec('D1 on the list but email unconfirmed grants nothing',
                r.role = 'learner' and not r.changed, 'role='||coalesce(r.role,'null')||' msg='||r.message);
end $$;
reset role;

-- =====================================================================
-- E. the administrator is never demoted
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$ declare r record; begin
  select * into r from lms_sync_my_access();
  perform t_rec('E1 administrator is not on the list, and is not demoted',
                r.role = 'admin', 'role='||r.role);
end $$;
reset role;

-- =====================================================================
-- F. what a facilitator may and may not do
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$ declare v_n int; begin
  select count(*) into v_n from lms_options;
  perform t_rec('F1 facilitator can see the answer key (they write it)', v_n >= 2, 'rows='||v_n);
exception when others then perform t_rec('F1 facilitator can see the answer key (they write it)', false, SQLERRM);
end $$;
do $$ declare v_c uuid; begin
  insert into lms_courses (slug, title, tool) values ('fac-made','Made by a facilitator','R') returning id into v_c;
  perform t_rec('F2 facilitator can create a course', v_c is not null);
exception when others then perform t_rec('F2 facilitator can create a course', false, SQLERRM);
end $$;
do $$ declare v_m uuid; v_l uuid; v_q uuid; r record; begin
  insert into lms_modules (course_id, title, position) values ('cccccccc-0000-0000-0000-000000000002','M1',1) returning id into v_m;
  insert into lms_lessons (module_id, title, type, position) values (v_m,'L1','reading',1) returning id into v_l;
  v_q := lms_create_quiz(v_l, null, 'Check what you remember');
  select * into r from lms_import_questions(v_q, '[
    {"prompt":"Which command summarises a variable in STATA?","type":"single",
     "options":[{"label":"summarize","correct":true},{"label":"describe","correct":false}]}]'::jsonb);
  perform t_rec('F3 facilitator can build a lesson and its questions', r.imported = 1, r.message);
exception when others then perform t_rec('F3 facilitator can build a lesson and its questions', false, SQLERRM);
end $$;
do $$ declare r record; begin
  select * into r from lms_publish_course('cccccccc-0000-0000-0000-000000000002');
  perform t_rec('F4 facilitator CANNOT publish', not r.published, r.message);
exception when others then perform t_rec('F4 facilitator CANNOT publish', true, 'refused: '||SQLERRM);
end $$;
do $$ declare r record; begin
  select * into r from lms_add_facilitator('friend@gmail.com');
  perform t_rec('F5 facilitator CANNOT appoint another facilitator', not r.ok, r.message);
exception when others then perform t_rec('F5 facilitator CANNOT appoint another facilitator', true, 'refused: '||SQLERRM);
end $$;
reset role;

-- =====================================================================
-- G. what a learner may not do
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare v_n int; begin
  select count(*) into v_n from lms_options;
  perform t_rec('G1 learner CANNOT read the answer key', v_n = 0, 'rows visible='||v_n||' of 2 that exist');
exception when others then perform t_rec('G1 learner CANNOT read the answer key', true, 'refused: '||SQLERRM);
end $$;
do $$ declare v_n int; begin
  select count(*) into v_n from lms_facilitators;
  perform t_rec('G2 learner CANNOT list staff emails', v_n = 0, 'rows visible='||v_n);
exception when others then perform t_rec('G2 learner CANNOT list staff emails', true, 'refused: '||SQLERRM);
end $$;
do $$ begin
  insert into lms_facilitators (email_norm) values ('selfpromoted@gmail.com');
  perform t_rec('G3 learner CANNOT put themselves on the list', false, 'the insert went through');
exception when others then perform t_rec('G3 learner CANNOT put themselves on the list', true, 'refused: '||SQLERRM);
end $$;
do $$ declare r record; begin
  select * into r from lms_add_facilitator('selfpromoted@gmail.com');
  perform t_rec('G4 learner CANNOT call the appoint function', not r.ok, r.message);
exception when others then perform t_rec('G4 learner CANNOT call the appoint function', true, 'refused: '||SQLERRM);
end $$;
do $$ begin
  insert into lms_courses (slug, title, tool) values ('learner-made','Nope','X');
  perform t_rec('G5 learner CANNOT create a course', false, 'the insert went through');
exception when others then perform t_rec('G5 learner CANNOT create a course', true, 'refused: '||SQLERRM);
end $$;
do $$ begin
  insert into lms_entitlements (user_id, course_id, source)
  values ('33333333-3333-3333-3333-333333333333', null, 'manual');
  perform t_rec('G6 learner CANNOT grant themselves the catalogue', false, 'THE INSERT WENT THROUGH');
exception when others then perform t_rec('G6 learner CANNOT grant themselves the catalogue', true, 'refused: '||SQLERRM);
end $$;
reset role;

-- =====================================================================
-- H. the administrator route end to end
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$ declare r record; v_role lms_role; begin
  select * into r from lms_add_facilitator('newtutor@dataleadafrica.com','New Tutor','maternity cover');
  perform t_rec('H1 administrator can appoint someone with no account yet', r.ok, r.message);
end $$;
do $$ declare r record; v_role lms_role; begin
  select * into r from lms_add_facilitator('random@gmail.com','Promoted Learner');
  select role into v_role from lms_profiles where id = '33333333-3333-3333-3333-333333333333';
  perform t_rec('H2 appointing someone who already has an account takes effect at once',
                r.ok and v_role = 'facilitator', 'role now '||v_role||' / '||r.message);
end $$;
do $$ declare r record; begin
  select * into r from lms_remove_facilitator('nobody@nowhere.com');
  perform t_rec('H3 removing an email that is not on the list says so', not r.ok, r.message);
end $$;
do $$ declare r record; begin
  select * into r from lms_add_facilitator('not an email');
  perform t_rec('H4 a malformed address is refused', not r.ok, r.message);
end $$;
do $$ declare v_n int; begin
  select count(*) into v_n from lms_admin_actions where action in ('add_facilitator','remove_facilitator');
  perform t_rec('H5 every appointment and removal is written down', v_n = 3,
    'entries='||v_n||' (2 appointments, 1 removal; the two refusals write nothing)');
end $$;
reset role;

-- =====================================================================
-- I. signed out
-- =====================================================================
set role anon;
do $$ declare v_n int; begin
  select count(*) into v_n from lms_facilitators;
  perform t_rec('I1 signed out, staff list is not readable', v_n = 0, 'rows visible='||v_n);
exception when others then perform t_rec('I1 signed out, staff list is not readable', true, 'refused: '||SQLERRM);
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
do $$ declare r record; v_n int := 0; begin
  for r in select * from lms_sync_my_access() loop v_n := v_n + 1; end loop;
  perform t_rec('I2 signed out, the sign-in check returns nothing', v_n = 0, 'rows='||v_n);
end $$;

-- =====================================================================
-- J. file 10 rewrote two of 07's functions. Does the rest of 07 still
--    work on top of them, end to end, as a real learner?
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$ declare r record; begin
  select * into r from lms_sync_my_access();  -- back to facilitator
  perform t_rec('J0 tutor is a facilitator again', r.role='facilitator', r.role);
end $$;
-- a facilitator builds a lesson check with three questions
do $$
declare v_m uuid; v_l uuid; v_q uuid; r record;
begin
  insert into lms_modules (id, course_id, title, position)
   values ('eeeeeeee-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000002','J module',2);
  insert into lms_lessons (id, module_id, title, type, position, video_provider, video_ref, duration_seconds)
   values ('eeeeeeee-0000-0000-0000-000000000002','eeeeeeee-0000-0000-0000-000000000001','J lesson','video',1,'youtube','abc',100);
  v_q := lms_create_quiz('eeeeeeee-0000-0000-0000-000000000002', null, 'J check');
  select * into r from lms_import_questions(v_q, '[
   {"prompt":"q1","type":"single","options":[{"label":"right","correct":true},{"label":"wrong","correct":false}]},
   {"prompt":"q2","type":"single","options":[{"label":"right","correct":true},{"label":"wrong","correct":false}]},
   {"prompt":"q3","type":"single","options":[{"label":"right","correct":true},{"label":"wrong","correct":false}]}]'::jsonb);
  perform t_rec('J1 facilitator builds a 3-question lesson check', r.imported = 3, r.message);
  insert into t_scratch(k,v) values ('j_quiz', v_q::text)
    on conflict (k) do update set v = excluded.v;
exception when others then perform t_rec('J1 facilitator builds a 3-question lesson check', false, SQLERRM);
end $$;
reset role;
set role postgres;
-- the administrator publishes it. Clearing the signed-in user is what makes
-- this the trusted SQL editor as far as the guard triggers are concerned.
select set_config('request.jwt.claim.sub','',false);
update lms_quizzes set status='published'
 where id = (select v::uuid from t_scratch where k='j_quiz');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$ declare v_q uuid; begin
  select v::uuid into v_q from t_scratch where k='j_quiz';
  perform t_rec('J2 it is a check, not a module quiz',
                coalesce(lms_quiz_kind(v_q),'(null)') = 'check', coalesce(lms_quiz_kind(v_q),'(null)'));
exception when others then perform t_rec('J2 it is a check, not a module quiz', false, SQLERRM);
end $$;
reset role;

-- the bootcamp learner takes it: two right, one wrong
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
set role postgres;
update participant_enrolments set status='active'
 where participant_id='aaaaaaaa-0000-0000-0000-000000000001';
reset role;
set role authenticated;
do $$ declare r record; begin
  select * into r from lms_sync_my_access();
  perform t_rec('J3 the learner has access again', r.bootcamp, r.message);
end $$;
-- Build the answer sheet as the OWNER, because a learner cannot read
-- lms_options and must not be able to. Two right, the third wrong.
reset role;
set role postgres;
do $$
declare v_q uuid; v_ans jsonb := '{}'::jsonb; q record; v_i int := 0;
begin
  select v::uuid into v_q from t_scratch where k='j_quiz';
  for q in select id from lms_questions where quiz_id = v_q order by position loop
    v_i := v_i + 1;
    v_ans := v_ans || jsonb_build_object(q.id::text,
      (select o.id::text from lms_options o
        where o.question_id = q.id and o.is_correct = (v_i < 3)
        order by o.position limit 1));
  end loop;
  insert into t_scratch(k,v) values ('j_answers', v_ans::text)
    on conflict (k) do update set v = excluded.v;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
do $$
declare v_q uuid; v_att uuid; v_ans jsonb; r record;
begin
  select v::uuid into v_q from t_scratch where k='j_quiz';
  select v::jsonb into v_ans from t_scratch where k='j_answers';
  select attempt_id into v_att from lms_start_quiz(v_q) limit 1;
  select * into r from lms_submit_quiz(v_att, v_ans);
  perform t_rec('J4 a lesson check reports counts, never a score',
                r.kind = 'check' and r.correct_count = 2 and r.question_count = 3
                  and r.feedback like '2 of 3 correct%' and r.feedback not like '%percent%',
                'kind='||r.kind||' '||r.correct_count||'/'||r.question_count||' feedback: '||r.feedback);
exception when others then perform t_rec('J4 a lesson check reports counts, never a score', false, SQLERRM);
end $$;
do $$ declare v_n int; v_leak int; begin
  select count(*), count(*) filter (where was_right) into v_n, v_leak
    from lms_attempt_marks((select id from lms_quiz_attempts
      where user_id='44444444-4444-4444-4444-444444444444'
      order by started_at desc limit 1));
  perform t_rec('J5 the learner is told which ones they missed, not the answers',
                v_n = 3 and v_leak = 2, 'questions marked='||v_n||' right='||v_leak);
exception when others then perform t_rec('J5 the learner is told which ones they missed, not the answers', false, SQLERRM);
end $$;
reset role;

-- =====================================================================
-- K. the real partial unique indexes on lms_entitlements
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
do $$ declare r record; v_n int; begin
  select * into r from lms_sync_my_access();
  select * into r from lms_sync_my_access();
  select * into r from lms_sync_my_access();
  select count(*) into v_n from lms_entitlements
   where user_id='44444444-4444-4444-4444-444444444444' and course_id is null and status='active';
  perform t_rec('K1 signing in repeatedly leaves one live grant, not three', v_n = 1, 'live rows='||v_n);
exception when others then perform t_rec('K1 signing in repeatedly leaves one live grant, not three', false, SQLERRM);
end $$;
reset role;
set role postgres;
update participant_enrolments set status='withdrawn' where participant_id='aaaaaaaa-0000-0000-0000-000000000001';
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
do $$ declare r record; begin select * into r from lms_sync_my_access(); end $$;
reset role;
set role postgres;
update participant_enrolments set status='active' where participant_id='aaaaaaaa-0000-0000-0000-000000000001';
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
do $$ declare r record; v_live int; v_hist int; begin
  select * into r from lms_sync_my_access();
  select count(*) filter (where status='active'), count(*)
    into v_live, v_hist
    from lms_entitlements
   where user_id='44444444-4444-4444-4444-444444444444' and course_id is null;
  perform t_rec('K2 withdrawn then re-enrolled works, and the history is kept',
                v_live = 1 and v_hist >= 2, 'live='||v_live||' rows in total='||v_hist);
exception when others then perform t_rec('K2 withdrawn then re-enrolled works, and the history is kept', false, SQLERRM);
end $$;
reset role;

-- =====================================================================
-- L. a facilitator editing an existing lesson, which 06 used to allow
--    only through a narrow uploader policy that file 10 removed
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$ declare v_n int; begin
  update lms_lessons set video_ref = 'new-ref', duration_seconds = 240
   where id = 'eeeeeeee-0000-0000-0000-000000000002';
  get diagnostics v_n = row_count;
  perform t_rec('L1 facilitator can still set a video on an existing lesson', v_n = 1, 'rows updated='||v_n);
exception when others then perform t_rec('L1 facilitator can still set a video on an existing lesson', false, SQLERRM);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
set role postgres;
update lms_profiles set role='learner' where id='33333333-3333-3333-3333-333333333333';
delete from lms_facilitators where email_norm='random@gmail.com';
reset role;
set role authenticated;
do $$ declare v_n int; begin
  update lms_lessons set video_ref = 'hacked' where id = 'eeeeeeee-0000-0000-0000-000000000002';
  get diagnostics v_n = row_count;
  perform t_rec('L2 learner CANNOT set a video', v_n = 0, 'rows updated='||v_n);
exception when others then perform t_rec('L2 learner CANNOT set a video', true, 'refused: '||SQLERRM);
end $$;
reset role;
