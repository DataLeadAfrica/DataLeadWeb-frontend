\set QUIET on
-- =====================================================================
-- N. PART A: quiz safety
-- =====================================================================
-- A learner cannot even START a check with no questions: lms_start_quiz
-- refuses. Worth asserting, because it is the first line of defence.
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare v_att uuid; begin
  select attempt_id into v_att from lms_start_quiz('c0000000-0000-0000-0000-0000000000d2') limit 1;
  perform t_rec('N0 a learner cannot start a check that has no questions', v_att is null,
                'attempt '||coalesce(v_att::text,'none, which is correct'));
exception when others then perform t_rec('N0 a learner cannot start a check that has no questions', true, 'refused: '||SQLERRM);
end $$;
-- The reachable path to zero marked questions: a learner starts a real check,
-- and the administrator then deletes the question outright. The retire fix in
-- file 10 covers the import route, but an administrator can still delete, and
-- the marking rule underneath has to cope.
do $$ declare v_att uuid; begin
  select attempt_id into v_att from lms_start_quiz('c0000000-0000-0000-0000-0000000000d1') limit 1;
  insert into t_scratch(k,v) values ('empty_att', coalesce(v_att::text,'none'))
    on conflict (k) do update set v=excluded.v;
  perform t_rec('N0b the learner starts a real check', v_att is not null,
                'attempt '||coalesce(v_att::text,'none'));
exception when others then perform t_rec('N0b the learner starts a real check', false, SQLERRM);
end $$;
reset role;
set role postgres;
select set_config('request.jwt.claim.sub','',false);
delete from lms_questions where id='c0000000-0000-0000-0000-0000000000e1';
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare v_att uuid; r record; begin
  select v::uuid into v_att from t_scratch where k='empty_att';
  select * into r from lms_submit_quiz(v_att, '{}'::jsonb);
  perform t_rec('N1 zero marked questions never tells the learner they are through',
                coalesce(r.feedback,'') not like '%On you go%' and coalesce(r.passed,false) = false,
                'passed='||coalesce(r.passed::text,'null')||' marked='||coalesce(r.question_count::text,'null')
                ||' feedback: '||coalesce(r.feedback,'none'));
exception when others then perform t_rec('N1 zero marked questions never tells the learner they are through', false, SQLERRM);
end $$;
do $$ declare v_att uuid; v_status text; v_sub boolean; begin
  select v::uuid into v_att from t_scratch where k='empty_att';
  select status::text, submitted_at is not null into v_status, v_sub
    from lms_quiz_attempts where id = v_att;
  perform t_rec('N2 zero marked questions leaves the attempt unmarked instead of failing it',
                v_status = 'in_progress' and not v_sub,
                'status='||coalesce(v_status,'gone')||' submitted='||coalesce(v_sub::text,'null'));
exception when others then perform t_rec('N2 zero marked questions leaves the attempt unmarked instead of failing it', false, SQLERRM);
end $$;
reset role;
-- put the question back so the housekeeping tests have a working check
set role postgres;
select set_config('request.jwt.claim.sub','',false);
insert into lms_questions (id, quiz_id, prompt, position, marks)
 values ('c0000000-0000-0000-0000-0000000000e1','c0000000-0000-0000-0000-0000000000d1','Which command summarises?',2,1);
insert into lms_options (question_id, label, is_correct, position) values
 ('c0000000-0000-0000-0000-0000000000e1','summarize',true,1),
 ('c0000000-0000-0000-0000-0000000000e1','describe',false,2);
delete from lms_quiz_attempts where quiz_id='c0000000-0000-0000-0000-0000000000d1';
reset role;
reset role;
set role postgres;
select set_config('request.jwt.claim.sub','',false);
do $$ declare v_bad int; v_labels text; begin
  select count(*) filter (where not ok), string_agg(label, '; ') filter (where not ok)
    into v_bad, v_labels
    from lms_course_blockers('c0000000-0000-0000-0000-0000000000f0');
  perform t_rec('N3 an empty set of questions blocks the course from publishing',
                v_bad = 1 and v_labels is not null,
                'blockers='||v_bad||' -> '||coalesce(v_labels,'none'));
exception when others then perform t_rec('N3 an empty set of questions blocks the course from publishing', false, SQLERRM);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$ declare r record; begin
  select * into r from lms_publish_course('c0000000-0000-0000-0000-0000000000f0');
  perform t_rec('N4 the administrator is refused, with a readable reason',
                not r.published, coalesce(r.message,'no message'));
exception when others then perform t_rec('N4 the administrator is refused, with a readable reason', true, 'refused: '||SQLERRM);
end $$;
reset role;
set role postgres;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
  update lms_quizzes set status='published' where id='c0000000-0000-0000-0000-0000000000f3';
  perform t_rec('N5 publishing an empty set of questions is refused', false, 'the update went through');
exception when others then perform t_rec('N5 publishing an empty set of questions is refused', true, 'refused: '||SQLERRM);
end $$;
do $$ declare v_n int; begin
  -- give the draft check a question, then it may be published
  insert into lms_questions (quiz_id, prompt, position, marks)
   values ('c0000000-0000-0000-0000-0000000000f3','A real question',1,1);
  insert into lms_options (question_id, label, is_correct, position)
   select id, 'right', true, 1 from lms_questions where quiz_id='c0000000-0000-0000-0000-0000000000f3';
  update lms_quizzes set status='published' where id='c0000000-0000-0000-0000-0000000000f3';
  get diagnostics v_n = row_count;
  perform t_rec('N6 a set of questions with a question CAN still be published', v_n = 1, 'rows changed='||v_n);
exception when others then perform t_rec('N6 a set of questions with a question CAN still be published', false, SQLERRM);
end $$;
do $$ declare v_bad int; begin
  select count(*) filter (where not ok) into v_bad
    from lms_course_blockers('c0000000-0000-0000-0000-0000000000f0');
  perform t_rec('N7 once every check has a question the course can publish', v_bad = 0, 'blockers left='||v_bad);
exception when others then perform t_rec('N7 once every check has a question the course can publish', false, SQLERRM);
end $$;
reset role;

-- =====================================================================
-- N. PART B: housekeeping
-- =====================================================================
-- the learner watches lesson one right through, then passes its check
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare i int; v_n int; begin
  for i in 0..11 loop
    perform lms_record_watch('c0000000-0000-0000-0000-0000000000c1', i, i*10);
  end loop;
  select count(*) into v_n from lms_watch_buckets
   where user_id='33333333-3333-3333-3333-333333333333'
     and lesson_id='c0000000-0000-0000-0000-0000000000c1';
  perform t_rec('N8 lms_record_watch throttles a burst, as it is meant to',
                v_n > 0 and v_n < 12, 'slices recorded in one burst='||v_n||' of 12 asked for');
exception when others then perform t_rec('N8 lms_record_watch throttles a burst, as it is meant to', false, SQLERRM);
end $$;
reset role;
-- fill in the rest as the owner, so the lesson really is fully watched. The
-- throttle above is why this cannot be done through the function in one go.
set role postgres;
select set_config('request.jwt.claim.sub','',false);
insert into lms_watch_buckets (user_id, lesson_id, bucket_index)
 select '33333333-3333-3333-3333-333333333333','c0000000-0000-0000-0000-0000000000c1', g
   from generate_series(0,11) g
 on conflict do nothing;
do $$ declare v_n int; begin
  select count(*) into v_n from lms_watch_buckets
   where user_id='33333333-3333-3333-3333-333333333333'
     and lesson_id='c0000000-0000-0000-0000-0000000000c1';
  perform t_rec('N8b the lesson is now fully watched', v_n = 12, 'slices='||v_n);
end $$;
reset role;
set role postgres;
select set_config('request.jwt.claim.sub','',false);
do $$ declare v_ans jsonb; v_q uuid; begin
  select o.id::text into v_q from lms_options o
   where o.question_id='c0000000-0000-0000-0000-0000000000e1' and o.is_correct;
  v_ans := jsonb_build_object('c0000000-0000-0000-0000-0000000000e1', v_q);
  insert into t_scratch(k,v) values ('ans1', v_ans::text) on conflict (k) do update set v=excluded.v;
  select o.id::text into v_q from lms_options o
   where o.question_id='c0000000-0000-0000-0000-0000000000ee' and o.is_correct;
  insert into t_scratch(k,v) values ('ansm',
    jsonb_build_object('c0000000-0000-0000-0000-0000000000ee', v_q)::text)
    on conflict (k) do update set v=excluded.v;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare v_att uuid; r record; begin
  select attempt_id into v_att from lms_start_quiz('c0000000-0000-0000-0000-0000000000d1') limit 1;
  select * into r from lms_submit_quiz(v_att, (select v::jsonb from t_scratch where k='ans1'));
  perform t_rec('N9 the learner passes the lesson check', r.passed, coalesce(r.feedback,'none'));
exception when others then perform t_rec('N9 the learner passes the lesson check', false, SQLERRM);
end $$;
-- and sits the module quiz, whose attempt must survive
do $$ declare v_att uuid; r record; begin
  select attempt_id into v_att from lms_start_quiz('c0000000-0000-0000-0000-0000000000dd') limit 1;
  select * into r from lms_submit_quiz(v_att, (select v::jsonb from t_scratch where k='ansm'));
  perform t_rec('N10 the learner passes the module quiz', r.passed, coalesce(r.feedback,'none'));
exception when others then perform t_rec('N10 the learner passes the module quiz', false, SQLERRM);
end $$;
do $$ declare r record; begin
  select * into r from lms_complete_lesson('c0000000-0000-0000-0000-0000000000c1');
  perform t_rec('N11 lesson one completes', r.completed, coalesce(r.reason,'none'));
exception when others then perform t_rec('N11 lesson one completes', false, SQLERRM);
end $$;
reset role;
set role postgres;
select set_config('request.jwt.claim.sub','',false);
do $$ declare v_slices int; begin
  select count(*) into v_slices from lms_watch_buckets
   where user_id='33333333-3333-3333-3333-333333333333'
     and lesson_id='c0000000-0000-0000-0000-0000000000c1';
  perform t_rec('N12 completing the lesson threw away its watch slices', v_slices = 0, 'slices left='||v_slices);
end $$;
do $$ declare v_cov numeric; begin
  select final_coverage into v_cov from lms_lesson_progress
   where user_id='33333333-3333-3333-3333-333333333333'
     and lesson_id='c0000000-0000-0000-0000-0000000000c1';
  perform t_rec('N13 the final coverage figure was kept on the progress row',
                v_cov is not null and v_cov >= 92, 'final coverage='||coalesce(v_cov::text,'null'));
exception when others then perform t_rec('N13 the final coverage figure was kept on the progress row', false, SQLERRM);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare v_cov numeric; begin
  v_cov := lms_watch_coverage('c0000000-0000-0000-0000-0000000000c1');
  perform t_rec('N14 coverage still reads correctly after the slices are gone',
                v_cov >= 92, 'coverage reported='||coalesce(v_cov::text,'null'));
exception when others then perform t_rec('N14 coverage still reads correctly after the slices are gone', false, SQLERRM);
end $$;
reset role;
set role postgres;
select set_config('request.jwt.claim.sub','',false);
do $$ declare v_check int; v_mod int; begin
  select count(*) into v_check from lms_quiz_attempts
   where user_id='33333333-3333-3333-3333-333333333333' and quiz_id='c0000000-0000-0000-0000-0000000000d1';
  select count(*) into v_mod from lms_quiz_attempts
   where user_id='33333333-3333-3333-3333-333333333333' and quiz_id='c0000000-0000-0000-0000-0000000000dd';
  perform t_rec('N15 the lesson check attempts went, the module quiz attempt stayed',
                v_check = 0 and v_mod = 1, 'check attempts='||v_check||' module attempts='||v_mod);
end $$;
do $$ declare v_passed boolean; begin
  select check_passed into v_passed from lms_lesson_progress
   where user_id='33333333-3333-3333-3333-333333333333'
     and lesson_id='c0000000-0000-0000-0000-0000000000c1';
  perform t_rec('N16 the pass itself was written onto the progress row',
                v_passed, 'check_passed='||coalesce(v_passed::text,'null'));
exception when others then perform t_rec('N16 the pass itself was written onto the progress row', false, SQLERRM);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare r record; begin
  select * into r from lms_complete_lesson('c0000000-0000-0000-0000-0000000000c1');
  perform t_rec('N17 the lesson is NOT locked after its attempts are deleted',
                r.completed, coalesce(r.reason,'none'));
exception when others then perform t_rec('N17 the lesson is NOT locked after its attempts are deleted', false, SQLERRM);
end $$;
do $$ begin
  perform t_rec('N18 the next lesson is still unlocked',
                lms_is_lesson_unlocked('c0000000-0000-0000-0000-0000000000c2'),
                'unlocked='||lms_is_lesson_unlocked('c0000000-0000-0000-0000-0000000000c2')::text);
exception when others then perform t_rec('N18 the next lesson is still unlocked', false, SQLERRM);
end $$;
-- the learner starts lesson three and abandons it
do $$ declare i int; begin
  for i in 0..3 loop
    perform lms_record_watch('c0000000-0000-0000-0000-0000000000c3', i, i*10);
  end loop;
  perform t_rec('N19 lesson three has some slices, then is abandoned',
    (select count(*) from lms_watch_buckets
      where lesson_id='c0000000-0000-0000-0000-0000000000c3') = 4,
    'slices='||(select count(*) from lms_watch_buckets
      where lesson_id='c0000000-0000-0000-0000-0000000000c3'));
exception when others then perform t_rec('N19 lesson three has some slices, then is abandoned', false, SQLERRM);
end $$;
reset role;
set role postgres;
select set_config('request.jwt.claim.sub','',false);
-- age the abandoned slices past ninety days, and lesson two's past nothing
do $$ begin
  update lms_watch_buckets set first_seen_at = now() - interval '120 days'
   where lesson_id='c0000000-0000-0000-0000-0000000000c3';
  insert into lms_watch_buckets (user_id, lesson_id, bucket_index, first_seen_at)
   values ('33333333-3333-3333-3333-333333333333','c0000000-0000-0000-0000-0000000000c2',0, now());
end $$;
do $$ declare r record; v_old int; v_new int; begin
  select * into r from lms_prune_watch_buckets();
  select count(*) into v_old from lms_watch_buckets where lesson_id='c0000000-0000-0000-0000-0000000000c3';
  select count(*) into v_new from lms_watch_buckets where lesson_id='c0000000-0000-0000-0000-0000000000c2';
  perform t_rec('N20 the nightly prune clears abandoned slices and spares recent ones',
                v_old = 0 and v_new = 1,
                'abandoned left='||v_old||' recent left='||v_new||' pruned='||coalesce(r.slices_removed::text,'?'));
exception when others then perform t_rec('N20 the nightly prune clears abandoned slices and spares recent ones', false, SQLERRM);
end $$;
do $$ declare v_n int; begin
  select count(*) into v_n from lms_lesson_progress
   where user_id='33333333-3333-3333-3333-333333333333';
  perform t_rec('N21 the prune leaves every progress row alone', v_n >= 2, 'progress rows='||v_n);
end $$;
reset role;

-- =====================================================================
-- N. the storage report
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ begin
  perform * from lms_storage_report();
  perform t_rec('N22 a learner CANNOT read the storage report', false, 'it ran');
exception when others then perform t_rec('N22 a learner CANNOT read the storage report', true, 'refused: '||SQLERRM);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$ declare v_n int; v_tot text; begin
  select count(*) into v_n from lms_storage_report();
  select pretty_size into v_tot from lms_storage_report() where item='WHOLE DATABASE';
  perform t_rec('N23 the administrator gets a row per table plus a total',
                v_n >= 18 and v_tot is not null, 'rows='||v_n||' database size='||coalesce(v_tot,'null'));
exception when others then perform t_rec('N23 the administrator gets a row per table plus a total', false, SQLERRM);
end $$;
reset role;

-- =====================================================================
-- N. PART C: permissions stay tight
-- =====================================================================
set role postgres;
select set_config('request.jwt.claim.sub','',false);
do $$ declare v_bad text; begin
  select string_agg(distinct table_name||'/'||grantee||'/'||privilege_type, ', ')
    into v_bad from information_schema.role_table_grants
   where table_schema='public' and table_name like 'lms\_%'
     and grantee in ('anon','authenticated')
     and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER');
  perform t_rec('N24 no table grants TRUNCATE, REFERENCES or TRIGGER', v_bad is null,
                coalesce('still held: '||left(v_bad,150),'none'));
end $$;
do $$ declare v_bad text; begin
  select string_agg(distinct table_name||'/'||privilege_type, ', ')
    into v_bad from information_schema.role_table_grants
   where table_schema='public' and table_name like 'lms\_%'
     and grantee='anon' and privilege_type in ('INSERT','UPDATE','DELETE');
  perform t_rec('N25 a visitor who is not signed in holds no write privilege', v_bad is null,
                coalesce('still held: '||left(v_bad,150),'none'));
end $$;
reset role;
