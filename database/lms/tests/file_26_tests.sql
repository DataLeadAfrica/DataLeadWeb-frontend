-- Tests file 26. NOT for the Supabase editor: it makes accounts and
-- courses, acts as a facilitator and a learner through row level
-- security, performs the three attacks, and rolls everything back.
--
-- SECTION 1 IS THE ATTACKS, all three exactly as they were measured on
-- a database built from 01 to 24. SECTION 2 IS THE REGRESSION, and it
-- is the one that pays for itself: a facilitator must still be able to
-- do every part of their own job through the functions, because taking
-- the write away without checking that would have stopped the control
-- room working for the people it is for.
--
-- EVERY PERMISSION TEST RUNS AS authenticated. Row level security does
-- not apply to a table's owner unless FORCE is set, and psql connects
-- as the owner, so a test that forgets "set local role" passes whatever
-- the rules say.
--
-- NOTHING IS RECORDED WHILE A ROLE IS SET. t26_say writes to a
-- temporary table that authenticated cannot touch. Capture into
-- variables, reset role, then record.

\set ON_ERROR_STOP on
begin;

create temporary table t26_out (n integer, label text, got text, want text) on commit drop;

create or replace function t26_say(p_label text, p_got text, p_want text)
returns void language plpgsql as $$
begin
  insert into t26_out values ((select coalesce(max(n), 0) + 1 from t26_out), p_label, p_got, p_want);
end $$;

create or replace function t26_be(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end $$;

-- ASKED THROUGH to_regprocedure, so a database without file 26 reports
-- a failed check instead of dying on a missing function.
create or replace function t26_helper_reachable(p_role text)
returns text language plpgsql as $$
declare v_ok boolean;
begin
  if to_regprocedure('public.lms_may_edit_quiz(uuid)') is null then
    return 'no such function';
  end if;
  execute 'select has_function_privilege($1, ''lms_may_edit_quiz(uuid)'', ''EXECUTE'')'
    into v_ok using p_role;
  return v_ok::text;
exception when others then
  return 'error: ' || left(sqlerrm, 40);
end $$;

-- ---------------------------------------------------------------------
-- The ground: an administrator who owns a live course, a facilitator
-- who owns nothing, and a learner. Built as the owner, because the
-- question is what each ROLE can do, not what a builder can.
-- ---------------------------------------------------------------------
insert into auth.users (id, email, created_at, email_confirmed_at) values
  ('26d10000-0000-0000-0000-0000000000d1', 't26-admin@example.com',       now(), now()),
  ('26f10000-0000-0000-0000-0000000000f1', 't26-facilitator@example.com', now(), now()),
  ('26a10000-0000-0000-0000-0000000000a1', 't26-learner@example.com',     now(), now());

update lms_profiles set role='admin',       email_verified_at=now(), full_name='T26 Admin'
 where id='26d10000-0000-0000-0000-0000000000d1';
update lms_profiles set role='facilitator', email_verified_at=now(), full_name='T26 Facilitator'
 where id='26f10000-0000-0000-0000-0000000000f1';
update lms_profiles set role='learner',     email_verified_at=now(), full_name='T26 Learner'
 where id='26a10000-0000-0000-0000-0000000000a1';

insert into lms_courses (id, slug, title, summary, status, price_kobo, published_at, created_by)
values ('26c10000-0000-0000-0000-0000000000c1','t26-not-yours','T26 Not Yours','x',
        'published', 0, now(), '26d10000-0000-0000-0000-0000000000d1');
insert into lms_modules (id, course_id, title, position)
values ('26b10000-0000-0000-0000-0000000000b1','26c10000-0000-0000-0000-0000000000c1','T26 Module',1);
insert into lms_lessons (id, module_id, title, type, position, content_md, duration_seconds,
                         video_provider, video_ref)
values ('26e10000-0000-0000-0000-0000000000e1','26b10000-0000-0000-0000-0000000000b1',
        'T26 Their Lesson','video',1,'x',600,'youtube','abc123XYZ_0');
insert into lms_lesson_chapters (lesson_id, start_seconds, title)
values ('26e10000-0000-0000-0000-0000000000e1', 0, 'T26 Their Chapter');

insert into lms_quizzes (id, course_id, title, status, pass_percent, max_attempts, serve_count)
values ('26710000-0000-0000-0000-000000000071','26c10000-0000-0000-0000-0000000000c1',
        'T26 Their Exam','draft',70,2,20);
insert into lms_questions (id, quiz_id, prompt, position, active)
values ('26720000-0000-0000-0000-000000000072','26710000-0000-0000-0000-000000000071',
        'T26 their question?',1,true);
insert into lms_options (question_id, label, is_correct, position) values
  ('26720000-0000-0000-0000-000000000072','T26 right', true, 1),
  ('26720000-0000-0000-0000-000000000072','T26 wrong', false, 2);
update lms_quizzes set status='published' where id='26710000-0000-0000-0000-000000000071';

-- ---------------------------------------------------------------------
-- 1. The three attacks, performed and refused
-- ---------------------------------------------------------------------
do $$
declare v_said text;
begin
  perform t26_be('26f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  begin
    update lms_lessons set title = 'T26 I RENAMED THIS'
     where id = '26e10000-0000-0000-0000-0000000000e1';
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t26_say('1a a facilitator cannot retitle a lesson in a course that is not theirs',
    v_said, 'refused');
  perform t26_say('1b and the title is untouched',
    (select title from lms_lessons where id = '26e10000-0000-0000-0000-0000000000e1'),
    'T26 Their Lesson');
end $$;

do $$
declare v_said text;
begin
  perform t26_be('26f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  begin
    delete from lms_lesson_chapters where true;
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t26_say('1c nor empty every chapter of every course in one statement',
    v_said, 'refused');
  perform t26_say('1d and the chapters are all still there',
    (select count(*)::text from lms_lesson_chapters
      where lesson_id = '26e10000-0000-0000-0000-0000000000e1'), '1');
end $$;

do $$
declare v_n integer;
begin
  perform t26_be('26f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  select count(*) into v_n from lms_options
   where question_id = '26720000-0000-0000-0000-000000000072';
  reset role;
  perform t26_say('1e nor read the answer key of an exam that is not theirs',
    v_n::text, '0');
end $$;

-- ---------------------------------------------------------------------
-- 2. THE REGRESSION. A facilitator can still do their own job.
--
-- Taking the write away without this check would have stopped the
-- control room working for the very people it is for, which is the
-- same trap file 23 set and the same way out of it.
-- ---------------------------------------------------------------------
do $$
declare v_course uuid; v_mod uuid; v_lesson uuid; v_quiz uuid; v_q uuid;
        v_chapters integer; v_own integer; v_all integer; v_stopped text := '';
begin
  perform t26_be('26f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  begin
    v_course := lms_create_course('T26 My Own Course', 'analysis', 'excel');
    v_mod    := lms_add_module(v_course, 'T26 My Module');
    -- CHAPTERS GO IN THROUGH lms_save_lesson, not lms_set_lesson_chapters.
    -- That second one was closed to authenticated by the 6D hand fix and
    -- is meant to stay closed, so a test that called it would report a
    -- regression that is actually the rule working.
    v_lesson := lms_save_lesson(
      p_module => v_mod, p_title => 'T26 My Lesson', p_type => 'video',
      p_video_ref => 'abc123XYZ_0', p_duration_seconds => 600,
      p_chapters_text => '00:00 Start' || chr(10) || '02:00 Middle');
    perform lms_set_course_details(v_course, 'T26 My Own Course, Renamed');
    select id into v_quiz from lms_quizzes where course_id = v_course limit 1;
    v_q := lms_save_question(v_quiz, null, 'T26 my question?', 'because',
             jsonb_build_array(jsonb_build_object('label','right','is_correct',true),
                               jsonb_build_object('label','wrong','is_correct',false)));
    select count(*) into v_chapters from lms_lesson_chapters where lesson_id = v_lesson;
    select count(*) into v_own from lms_options where question_id = v_q;
    select count(*) into v_all from lms_options;
  exception when others then
    v_stopped := left(sqlerrm, 60);
  end;
  reset role;

  perform t26_say('2a a facilitator still creates a course of their own',
    coalesce(v_stopped, '') || case when v_course is not null then 'made' else 'nothing' end, 'made');
  perform t26_say('2b and a module and a lesson in it',
    case when v_mod is not null and v_lesson is not null then 'both' else 'missing' end, 'both');
  perform t26_say('2c and its chapters are written', coalesce(v_chapters, -1)::text, '2');
  perform t26_say('2d and an exam question', case when v_q is not null then 'written' else 'no' end, 'written');
  perform t26_say('2e and the answer key for THEIR OWN course is readable',
    coalesce(v_own, -1)::text, '2');
  perform t26_say('2f while the other course''s answers stay hidden',
    coalesce(v_all, -1)::text, '2');
end $$;

-- ---------------------------------------------------------------------
-- 3. An administrator still sees everything
-- ---------------------------------------------------------------------
do $$
declare v_q integer; v_o integer;
begin
  perform t26_be('26d10000-0000-0000-0000-0000000000d1');
  set local role authenticated;
  select count(*) into v_q from lms_questions;
  select count(*) into v_o from lms_options;
  reset role;
  perform t26_say('3a an administrator reads every question', (v_q >= 2)::text, 'true');
  perform t26_say('3b and every answer', (v_o >= 4)::text, 'true');
end $$;

-- ---------------------------------------------------------------------
-- 4. A learner and a visitor are exactly where they were
-- ---------------------------------------------------------------------
do $$
declare v_q integer; v_o integer;
begin
  perform t26_be('26a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  select count(*) into v_q from lms_questions;
  select count(*) into v_o from lms_options;
  reset role;
  perform t26_say('4a a learner reads no questions', v_q::text, '0');
  perform t26_say('4b and no answers', v_o::text, '0');
end $$;

do $$
declare v_q integer; v_o integer;
begin
  perform t26_be(null);
  set local role anon;
  select count(*) into v_q from lms_questions;
  select count(*) into v_o from lms_options;
  reset role;
  perform t26_say('4c a visitor reads no questions', v_q::text, '0');
  perform t26_say('4d and no answers', v_o::text, '0');
end $$;

-- ---------------------------------------------------------------------
-- 5. The rule inside the policy is reachable by the right people
--
-- THE FILE 21 LESSON IN A NEW SHAPE. A helper used inside a policy is
-- run by whoever is querying, so taking execute off authenticated turns
-- an ordinary staff read into "permission denied".
-- ---------------------------------------------------------------------
do $$ begin
  perform t26_say('5a authenticated can run the rule the policy asks',
    t26_helper_reachable('authenticated'), 'true');
  perform t26_say('5b and a visitor cannot',
    t26_helper_reachable('anon'), 'false');
end $$;

-- ---------------------------------------------------------------------
-- 6. The reads that used to ride on a write policy are back
-- ---------------------------------------------------------------------
do $$
declare v_pop integer;
begin
  perform t26_be('26d10000-0000-0000-0000-0000000000d1');
  set local role authenticated;
  select count(*) into v_pop from lms_popups;
  reset role;
  perform t26_say('6a staff can still read the popups record', (v_pop >= 0)::text, 'true');
  perform t26_say('6b and it has a read policy of its own now',
    (select count(*)::text from pg_policy p
      where p.polrelid = to_regclass('public.lms_popups') and p.polcmd = 'r'), '1');
  perform t26_say('6c as does the answers record',
    (select count(*)::text from pg_policy p
      where p.polrelid = to_regclass('public.lms_options') and p.polcmd = 'r'), '1');
end $$;

-- ---------------------------------------------------------------------
-- 7. And no write policy or write grant is left on the fourteen
-- ---------------------------------------------------------------------
do $$
declare v_pol integer; v_grant integer;
begin
  select count(*) into v_pol
    from pg_policy p join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and p.polcmd <> 'r'
     and c.relname in ('lms_courses','lms_lessons','lms_modules','lms_quizzes','lms_questions',
                       'lms_options','lms_lesson_chapters','lms_areas','lms_area_tools',
                       'lms_course_areas','lms_course_next','lms_countries','lms_ng_states','lms_popups');
  select count(*) into v_grant
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('lms_courses','lms_lessons','lms_modules','lms_quizzes','lms_questions',
                        'lms_options','lms_lesson_chapters','lms_areas','lms_area_tools',
                        'lms_course_areas','lms_course_next','lms_countries','lms_ng_states','lms_popups')
     and grantee in ('anon','authenticated','PUBLIC')
     and privilege_type in ('INSERT','UPDATE','DELETE');
  perform t26_say('7a no write policy is left on the fourteen', v_pol::text, '0');
  perform t26_say('7b and no write grant either', v_grant::text, '0');
end $$;

-- ------------------------------------------------------------- results
\pset tuples_only off
\pset format aligned
select n as "#", label as "what was checked",
       case when got is not distinct from want then 'pass' else 'FAIL' end as "result",
       got as "got", want as "wanted"
  from t26_out order by n;

select case when count(*) = 0 then 'ALL PASS'
            else count(*) || ' FAILED' end as "summary"
  from t26_out where got is distinct from want;

rollback;
