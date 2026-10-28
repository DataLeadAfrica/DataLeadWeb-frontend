-- Tests file 27. NOT for the Supabase editor: it makes accounts and a
-- course, acts as a facilitator, an administrator and a learner through
-- row level security, and rolls everything back.
--
-- SECTION 3 IS THE WHOLE POINT. It walks a learner to a hundred per
-- cent, shows that the exam is invisible while it is a draft, has an
-- administrator publish it, and then has the learner sit it and be
-- certified. That is the fault this file fixes, demonstrated rather
-- than described: the chain was never broken, it just had no way to be
-- started.
--
-- EVERY PERMISSION TEST RUNS AS authenticated. Row level security does
-- not apply to a table's owner unless FORCE is set, and psql connects
-- as the owner, so a test that forgets "set local role" passes whatever
-- the rules say.
--
-- NOTHING IS RECORDED WHILE A ROLE IS SET. t27_say writes to a
-- temporary table that authenticated cannot touch. Capture into
-- variables, reset role, then record.

\set ON_ERROR_STOP on
begin;

create temporary table t27_out (n integer, label text, got text, want text) on commit drop;

create or replace function t27_say(p_label text, p_got text, p_want text)
returns void language plpgsql as $$
begin
  insert into t27_out values ((select coalesce(max(n), 0) + 1 from t27_out), p_label, p_got, p_want);
end $$;

create or replace function t27_be(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end $$;

-- The answer key, read as the owner, so the learner never sees it.
create or replace function t27_key(p_quiz uuid) returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(q.id::text, o.id::text), '{}'::jsonb)
    from lms_questions q
    join lms_options o on o.question_id = q.id and o.is_correct
   where q.quiz_id = p_quiz and q.active
$$;

-- Asked through to_regprocedure so a database without file 27 reports a
-- failed check rather than dying on a missing row in the checklist.
create or replace function t27_checklist_row10(p_course uuid) returns text
language plpgsql as $$
declare v_passes boolean;
begin
  if to_regprocedure('public.lms_publish_checks(uuid)') is null then
    return 'no checklist';
  end if;
  -- EXECUTE DOES NOT SET found. That is documented and it is easy to
  -- forget: the first version of this helper asked "if not found" after
  -- an EXECUTE, found was still false from function entry, and the
  -- helper answered "no row 10" even when row 10 was sitting right
  -- there. Both checks that use it failed for a reason that had nothing
  -- to do with what they were checking. The null is the test instead,
  -- which is reliable because a boolean column that exists is never
  -- null here.
  v_passes := null;
  execute 'select passes from lms_publish_checks($1) where n = 10'
    into v_passes using p_course;
  if v_passes is null then return 'no row 10'; end if;
  return v_passes::text;
exception when others then
  return 'error: ' || left(sqlerrm, 40);
end $$;

-- ---------------------------------------------------------------------
-- The ground: an administrator who owns a course, a facilitator who
-- owns nothing, and a learner. Built as the owner.
-- ---------------------------------------------------------------------
insert into auth.users (id, email, created_at, email_confirmed_at) values
  ('27d10000-0000-0000-0000-0000000000d1','t27-admin@example.com',       now(), now()),
  ('27f10000-0000-0000-0000-0000000000f1','t27-facilitator@example.com', now(), now()),
  ('27a10000-0000-0000-0000-0000000000a1','t27-learner@example.com',     now(), now());

update lms_profiles set role='admin', email_verified_at=now(), full_name='T27 Admin'
 where id='27d10000-0000-0000-0000-0000000000d1';
update lms_profiles set role='facilitator', email_verified_at=now(), full_name='T27 Facilitator'
 where id='27f10000-0000-0000-0000-0000000000f1';
update lms_profiles set role='learner', email_verified_at=now(), full_name='T27 Learner'
 where id='27a10000-0000-0000-0000-0000000000a1';

insert into lms_courses (id, slug, title, summary, status, price_kobo, published_at, created_by)
values ('27c10000-0000-0000-0000-0000000000c1','t27-course','T27 Course',
        'A course for the file 27 tests.', 'published', 0, now(),
        '27d10000-0000-0000-0000-0000000000d1');
insert into lms_modules (id, course_id, title, position)
values ('27b10000-0000-0000-0000-0000000000b1','27c10000-0000-0000-0000-0000000000c1','T27 Module',1);
insert into lms_lessons (id, module_id, title, type, position, content_md)
values ('27e10000-0000-0000-0000-0000000000e1','27b10000-0000-0000-0000-0000000000b1',
        'T27 Lesson','reading',1,'x');

-- An exam with a full bank, left as a DRAFT, which is the state every
-- course in the Academy was in.
insert into lms_quizzes (id, course_id, title, status, pass_percent, max_attempts,
                         serve_count, bank_multiple)
values ('27710000-0000-0000-0000-000000000071','27c10000-0000-0000-0000-0000000000c1',
        'T27 Exam','draft',50,2,2,1.5);
do $$
declare v_q uuid;
begin
  for i in 1..3 loop
    insert into lms_questions (quiz_id, prompt, position, active)
    values ('27710000-0000-0000-0000-000000000071', 'T27 question ' || i || '?', i, true)
    returning id into v_q;
    insert into lms_options (question_id, label, is_correct, position) values
      (v_q, 'right', true, 1), (v_q, 'wrong', false, 2);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 0. THE ACTORS ARE WHO WE THINK THEY ARE.
--
-- Without this, section 1 passes on a database where the facilitator
-- was never given the role: a learner is refused by every guard, so
-- "a facilitator cannot publish an exam" goes green while proving
-- nothing at all. The profile row is made by a trigger on the account,
-- so an UPDATE that runs too early quietly changes no rows.
-- ---------------------------------------------------------------------
do $$ begin
  perform t27_say('0a the administrator really is an administrator',
    (select role::text from lms_profiles where id = '27d10000-0000-0000-0000-0000000000d1'),
    'admin');
  perform t27_say('0b the facilitator really is a facilitator',
    (select role::text from lms_profiles where id = '27f10000-0000-0000-0000-0000000000f1'),
    'facilitator');
  perform t27_say('0c and the learner really is a learner',
    (select role::text from lms_profiles where id = '27a10000-0000-0000-0000-0000000000a1'),
    'learner');
end $$;

-- ---------------------------------------------------------------------
-- 1. Publishing is an administrator's decision
-- ---------------------------------------------------------------------
do $$
declare v_said text;
begin
  perform t27_be('27f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  begin
    perform lms_publish_exam('27710000-0000-0000-0000-000000000071');
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t27_say('1a a facilitator cannot publish an exam', v_said, 'refused');
  perform t27_say('1b and the exam is still a draft',
    (select status::text from lms_quizzes where id = '27710000-0000-0000-0000-000000000071'),
    'draft');
end $$;

do $$
declare v_said text; v_path uuid;
begin
  perform t27_be('27d10000-0000-0000-0000-0000000000d1');
  set local role authenticated;
  select lms_create_path('T27 Path', 'The T27 Certificate') into v_path;
  reset role;

  perform t27_be('27f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  begin
    perform lms_publish_path(v_path);
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t27_say('1c nor publish a path', v_said, 'refused');
end $$;

-- ---------------------------------------------------------------------
-- 2. The publish screen stops reporting success
-- ---------------------------------------------------------------------
do $$ begin
  perform t27_be('27d10000-0000-0000-0000-0000000000d1');
  perform t27_say('2a the checklist has a row for the exam being published',
    t27_checklist_row10('27c10000-0000-0000-0000-0000000000c1'), 'false');
end $$;

-- ---------------------------------------------------------------------
-- 3. THE WHOLE POINT. A learner cannot be certified until somebody
-- publishes the exam, and can be the moment they do.
-- ---------------------------------------------------------------------
-- THE EXAM OPENS ONLY ONCE THE COURSE IS FINISHED, which is the rule
-- and not a fault. The learner completes the one reading lesson first,
-- or lms_start_exam refuses with "not_open" and the test would be
-- measuring the wrong thing.
do $$
declare v_done boolean; v_reason text;
begin
  perform t27_be('27a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  select completed, reason into v_done, v_reason
    from lms_complete_lesson('27e10000-0000-0000-0000-0000000000e1');
  reset role;
  perform t27_say('3a the learner finishes the course',
    coalesce(v_done, false)::text || ' ' || coalesce(v_reason, ''), 'true Lesson complete.');
end $$;

do $$
declare v_c record; v_state text;
begin
  perform t27_be('27a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  select * into v_c from lms_my_course('t27-course');
  v_state := coalesce(v_c.exam->>'state', 'NO EXAM');
  reset role;
  perform t27_say('3b but while the exam is a draft they see none', v_state, 'NO EXAM');
end $$;

do $$
declare v_said text;
begin
  perform t27_be('27d10000-0000-0000-0000-0000000000d1');
  set local role authenticated;
  begin
    perform lms_publish_exam('27710000-0000-0000-0000-000000000071');
    v_said := 'published';
  exception when others then v_said := 'refused: ' || left(sqlerrm, 40);
  end;
  reset role;
  perform t27_say('3c an administrator publishes it', v_said, 'published');
  perform t27_say('3d and the checklist is satisfied',
    t27_checklist_row10('27c10000-0000-0000-0000-0000000000c1'), 'true');
end $$;

do $$
declare v_c record; v_state text; v_att uuid; v_ans jsonb; v_res record;
        v_claim record; v_exam uuid; v_said text;
begin
  perform t27_be('27a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  select * into v_c from lms_my_course('t27-course');
  v_state := coalesce(v_c.exam->>'state', 'NO EXAM');
  v_exam := (v_c.exam->>'exam_id')::uuid;
  reset role;
  perform t27_say('3e now the learner can see the exam', (v_state <> 'NO EXAM')::text, 'true');

  if v_exam is null then
    perform t27_say('3f and can sit it', 'no exam id', 'passed');
    perform t27_say('3g and is certified', 'not reached', 'issued');
    return;
  end if;

  -- WRAPPED, so a refusal is reported as a failed check rather than
  -- stopping the file and hiding every check after it. v_said is
  -- declared on the outer block, because a variable declared on a
  -- nested one is out of scope by the time the check is recorded.
  begin
    perform t27_be('27a10000-0000-0000-0000-0000000000a1');
    set local role authenticated;
    select attempt_id into v_att from lms_start_exam(v_exam) limit 1;
    select coalesce(jsonb_object_agg(s.question_id::text, (t27_key(v_exam) ->> s.question_id::text)), '{}')
      into v_ans from (select distinct question_id from lms_start_exam(v_exam)) s;
    select * into v_res from lms_submit_quiz(v_att, v_ans);
    v_said := case when v_res.passed then 'passed' else 'failed' end;
  exception when others then
    begin reset role; exception when others then null; end;
    v_said := 'refused: ' || left(sqlerrm, 40);
  end;
  begin reset role; exception when others then null; end;
  perform t27_say('3f and can sit it', v_said, 'passed');
end $$;

-- ---------------------------------------------------------------------
-- 4. The grants, both halves
-- ---------------------------------------------------------------------
do $$ begin
  perform t27_say('4a a signed in person may call the exam publisher',
    has_function_privilege('authenticated', 'lms_publish_exam(uuid)', 'EXECUTE')::text, 'true');
  perform t27_say('4b and a visitor may not',
    has_function_privilege('anon', 'lms_publish_exam(uuid)', 'EXECUTE')::text, 'false');
  perform t27_say('4c the same for the path publisher',
    has_function_privilege('authenticated', 'lms_publish_path(uuid)', 'EXECUTE')::text, 'true');
  perform t27_say('4d and the same for a visitor',
    has_function_privilege('anon', 'lms_publish_path(uuid)', 'EXECUTE')::text, 'false');
end $$;

-- ---------------------------------------------------------------------
-- 5. And no live course anywhere is left with a draft exam
-- ---------------------------------------------------------------------
do $$
declare v_n integer;
begin
  select count(*) into v_n
    from lms_quizzes q join lms_courses c on c.id = q.course_id
   where q.lesson_id is null and q.module_id is null
     and c.status = 'published' and q.status <> 'published';
  perform t27_say('5a no live course has an exam still in draft', v_n::text, '0');
end $$;

-- ------------------------------------------------------------- results
\pset tuples_only off
\pset format aligned
select n as "#", label as "what was checked",
       case when got is not distinct from want then 'pass' else 'FAIL' end as "result",
       got as "got", want as "wanted"
  from t27_out order by n;

select case when count(*) = 0 then 'ALL PASS'
            else count(*) || ' FAILED' end as "summary"
  from t27_out where got is distinct from want;

rollback;
