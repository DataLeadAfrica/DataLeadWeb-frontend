-- Tests file 24. NOT for the Supabase editor: it makes accounts,
-- courses and a path, acts as a learner through row level security, and
-- rolls everything back.
--
-- SECTION 1 IS THE AWARD ITSELF, and the order inside it is the point:
-- no badge part way through a module, a badge the moment the last
-- lesson is done, and nothing a learner can do by hand to bring one
-- forward.
--
-- SECTION 3 IS THE ONE THAT WOULD HAVE BEEN MISSED. A badge once earned
-- stays earned, so a module that gains a lesson afterwards keeps it. The
-- obvious implementation, comparing lessons done against lessons, passes
-- every other check in this file and fails that one.
--
-- EVERY PERMISSION TEST RUNS AS authenticated. Row level security does
-- not apply to a table's owner unless FORCE is set, and psql connects as
-- the owner, so a test that forgets "set local role" passes whatever the
-- rules say.
--
-- NOTHING IS RECORDED WHILE A ROLE IS SET. t24_say writes to a temporary
-- table that authenticated cannot touch, which cost file 23 a whole
-- section before the rule was written down. Capture into variables,
-- reset role, then record.

\set ON_ERROR_STOP on
begin;

create temporary table t24_out (n integer, label text, got text, want text) on commit drop;

create or replace function t24_say(p_label text, p_got text, p_want text)
returns void language plpgsql as $$
begin
  insert into t24_out values ((select coalesce(max(n), 0) + 1 from t24_out), p_label, p_got, p_want);
end $$;

create or replace function t24_be(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end $$;

-- CALLED THROUGH EXECUTE, so a database that has not had file 24 reports
-- a failed check instead of dying on a missing function or relation.
create or replace function t24_badges(p_user uuid)
returns text language plpgsql as $$
declare v_n integer;
begin
  if to_regclass('public.lms_module_badges') is null then
    return 'no such record';
  end if;
  execute 'select count(*) from lms_module_badges where user_id = $1' into v_n using p_user;
  return v_n::text;
exception when others then
  return 'error: ' || left(sqlerrm, 40);
end $$;

create or replace function t24_studio_path(p_path uuid)
returns text language plpgsql as $$
declare v_out jsonb;
begin
  if to_regprocedure('public.lms_studio_path(uuid)') is null then
    return 'no such function';
  end if;
  execute 'select lms_studio_path($1)' into v_out using p_path;
  return coalesce((v_out->'exam'->>'id' is not null)::text, 'null');
exception when others then
  return 'error: ' || left(sqlerrm, 40);
end $$;

create or replace function t24_strip(p_user uuid)
returns text language plpgsql as $$
begin
  if to_regclass('public.lms_module_badges') is null then
    return 'no such record';
  end if;
  execute 'delete from lms_module_badges where user_id = $1' using p_user;
  return 'removed';
exception when others then
  return 'error: ' || left(sqlerrm, 40);
end $$;

create or replace function t24_backfill()
returns text language plpgsql as $$
begin
  if to_regclass('public.lms_module_badges') is null then
    return 'no such record';
  end if;
  execute '
    insert into lms_module_badges (user_id, module_id, awarded_at)
    select p.user_id, m.id, coalesce(max(p.completed_at), now())
      from lms_lesson_progress p
      join lms_lessons l on l.id = p.lesson_id
      join lms_modules m on m.id = l.module_id
     where p.completed
     group by p.user_id, m.id
    having count(*) = (select count(*) from lms_lessons l2 where l2.module_id = m.id)
    on conflict (user_id, module_id) do nothing';
  return 'ran';
exception when others then
  return 'error: ' || left(sqlerrm, 40);
end $$;

create or replace function t24_learners(p_course uuid)
returns text language plpgsql as $$
declare v_n integer;
begin
  if to_regprocedure('public.lms_staff_learners(text, text, text, integer, integer, uuid)') is null then
    return 'no course filter';
  end if;
  execute 'select count(*) from lms_staff_learners($1, $2, $3, $4, $5, $6)'
    into v_n using '', 'all', null::text, 100, 0, p_course;
  return v_n::text;
exception when others then
  return 'error: ' || left(sqlerrm, 40);
end $$;

-- ---------------------------------------------------------------------
-- The ground: one published course, one module, two reading lessons, an
-- administrator and two learners. Built as the owner, because the
-- question is what a LEARNER can do, not what a builder can.
-- ---------------------------------------------------------------------
insert into auth.users (id, email, created_at, email_confirmed_at) values
  ('24a10000-0000-0000-0000-00000000000a', 't24-learner-a@example.com', now(), now()),
  ('24a10000-0000-0000-0000-00000000000b', 't24-learner-b@example.com', now(), now()),
  ('24a10000-0000-0000-0000-00000000000d', 't24-admin@example.com',     now(), now());

update lms_profiles set role = 'learner', email_verified_at = now(), full_name = 'Learner A'
 where id = '24a10000-0000-0000-0000-00000000000a';
update lms_profiles set role = 'learner', email_verified_at = now(), full_name = 'Learner B'
 where id = '24a10000-0000-0000-0000-00000000000b';
update lms_profiles set role = 'admin', email_verified_at = now(), full_name = 'Admin'
 where id = '24a10000-0000-0000-0000-00000000000d';

insert into lms_courses (id, slug, title, summary, status, price_kobo, published_at)
values ('24c10000-0000-0000-0000-00000000000c', 't24-course', 'T24 Course', 'x',
        'published', 0, now());
insert into lms_modules (id, course_id, title, position)
values ('24b10000-0000-0000-0000-00000000000b', '24c10000-0000-0000-0000-00000000000c',
        'T24 Module One', 1);
insert into lms_lessons (id, module_id, title, type, position, content_md) values
  ('24e10000-0000-0000-0000-000000000001', '24b10000-0000-0000-0000-00000000000b',
   'T24 Lesson One', 'reading', 1, 'x'),
  ('24e10000-0000-0000-0000-000000000002', '24b10000-0000-0000-0000-00000000000b',
   'T24 Lesson Two', 'reading', 2, 'x');

-- All three hold the course, which is the live shape: two learners and
-- one administrator who gave themselves access to look at it.
insert into lms_entitlements (user_id, course_id, source, status) values
  ('24a10000-0000-0000-0000-00000000000a', '24c10000-0000-0000-0000-00000000000c', 'free', 'active'),
  ('24a10000-0000-0000-0000-00000000000b', '24c10000-0000-0000-0000-00000000000c', 'free', 'active'),
  ('24a10000-0000-0000-0000-00000000000d', '24c10000-0000-0000-0000-00000000000c', 'free', 'active');

-- ---------------------------------------------------------------------
-- 1. The award, and its timing
-- ---------------------------------------------------------------------
do $$
declare v_done text;
begin
  perform t24_be('24a10000-0000-0000-0000-00000000000a');
  set local role authenticated;
  select completed::text into v_done
    from lms_complete_lesson('24e10000-0000-0000-0000-000000000001');
  reset role;
  perform t24_say('1a the first lesson of two is completed', v_done, 'true');
  perform t24_say('1b and no badge yet, because the module is not finished',
    t24_badges('24a10000-0000-0000-0000-00000000000a'), '0');
end $$;

do $$
declare v_done text;
begin
  perform t24_be('24a10000-0000-0000-0000-00000000000a');
  set local role authenticated;
  select completed::text into v_done
    from lms_complete_lesson('24e10000-0000-0000-0000-000000000002');
  reset role;
  perform t24_say('1c the last lesson is completed', v_done, 'true');
  perform t24_say('1d and the badge is there, in the same transaction',
    t24_badges('24a10000-0000-0000-0000-00000000000a'), '1');
end $$;

-- ---------------------------------------------------------------------
-- 2. A learner cannot award themselves one
-- ---------------------------------------------------------------------
do $$
declare v_said text;
begin
  perform t24_be('24a10000-0000-0000-0000-00000000000b');
  set local role authenticated;
  begin
    insert into lms_module_badges (user_id, module_id)
    values ('24a10000-0000-0000-0000-00000000000b', '24b10000-0000-0000-0000-00000000000b');
    v_said := 'ALLOWED';
  exception when others then
    v_said := 'refused';
  end;
  reset role;
  perform t24_say('2a a learner writing a badge by hand is refused', v_said, 'refused');
  perform t24_say('2b and holds none, having finished nothing',
    t24_badges('24a10000-0000-0000-0000-00000000000b'), '0');
end $$;

do $$
declare v_said text;
begin
  perform t24_be('24a10000-0000-0000-0000-00000000000a');
  set local role authenticated;
  begin
    update lms_module_badges set awarded_at = now() - interval '400 days'
     where user_id = '24a10000-0000-0000-0000-00000000000a';
    v_said := 'ALLOWED';
  exception when others then
    v_said := 'refused';
  end;
  reset role;
  perform t24_say('2c and cannot back date the one they do hold', v_said, 'refused');
end $$;

-- ---------------------------------------------------------------------
-- 3. A badge once earned stays earned
--
-- THE CHECK THAT RULES OUT THE OBVIOUS IMPLEMENTATION. Comparing
-- lessons done against lessons passes every other check in this file
-- and fails this one, by taking a badge back off somebody who did
-- nothing wrong.
-- ---------------------------------------------------------------------
-- THROUGH THE ROUTE A REAL ONE WOULD TAKE. lms_guard_lesson refuses a
-- lesson added to a live course, so a course has to be taken down to
-- change its shape and put back up. That is precisely how a module
-- gains a lesson after somebody has finished it, and why this case is
-- worth a check rather than a hypothetical.
-- NOBODY SIGNED IN FOR THE STRUCTURAL EDIT. lms_guard_course lets a
-- change through when auth.uid() is null or the caller is an
-- administrator, and the block above left a learner's identity set for
-- the whole transaction, so without this the guard refuses and the file
-- stops. The identity is set again by the next block that needs one.
select t24_be(null);

update lms_courses set status = 'draft'
 where id = '24c10000-0000-0000-0000-00000000000c';

insert into lms_lessons (id, module_id, title, type, position, content_md)
values ('24e10000-0000-0000-0000-000000000003', '24b10000-0000-0000-0000-00000000000b',
        'T24 Lesson Three', 'reading', 3, 'x');

update lms_courses set status = 'published'
 where id = '24c10000-0000-0000-0000-00000000000c';

do $$
declare v_badge text; v_done text; v_total text;
begin
  perform t24_say('3a a lesson is added to a module already finished',
    (select count(*)::text from lms_lessons
      where module_id = '24b10000-0000-0000-0000-00000000000b'), '3');
  perform t24_say('3b the badge is still held',
    t24_badges('24a10000-0000-0000-0000-00000000000a'), '1');

  perform t24_be('24a10000-0000-0000-0000-00000000000a');
  set local role authenticated;
  select (m->>'badge_awarded_at' is not null)::text, m->>'lessons_done', m->>'lesson_count'
    into v_badge, v_done, v_total
    from lms_my_course('t24-course') c, lateral jsonb_array_elements(c.modules) as m
   limit 1;
  reset role;
  perform t24_say('3c and the page still shows it', coalesce(v_badge, 'no module'), 'true');
  perform t24_say('3d beside an honest count of the lessons',
    coalesce(v_done, '?') || ' of ' || coalesce(v_total, '?'), '2 of 3');
end $$;

-- ---------------------------------------------------------------------
-- 4. A badge is not a certificate
-- ---------------------------------------------------------------------
do $$ begin
  perform t24_say('4a no certificate was issued by any of this',
    (select count(*)::text from certificates ct
       join lms_profiles pr on pr.participant_id = ct.participant_id
      where pr.id = '24a10000-0000-0000-0000-00000000000a'), '0');
  perform t24_say('4b and the badge record carries nothing certificate shaped',
    (select count(*)::text from information_schema.columns
      where table_schema = 'public' and table_name = 'lms_module_badges'
        and column_name in ('certificate_number', 'programme_id', 'revoked')), '0');
end $$;

-- ---------------------------------------------------------------------
-- 5. The two counts, which is what sent somebody looking for a fault
-- ---------------------------------------------------------------------
do $$
declare v_counted text; v_holders text;
begin
  perform t24_be('24a10000-0000-0000-0000-00000000000d');
  set local role authenticated;
  select c->>'learners' into v_counted
    from (select lms_studio_overview() as j) s,
         lateral jsonb_array_elements(s.j->'courses') as c
   where c->>'slug' = 't24-course';
  reset role;

  select count(*)::text into v_holders from lms_entitlements e
   where e.course_id = '24c10000-0000-0000-0000-00000000000c' and e.status = 'active';

  perform t24_say('5a three people hold the course', v_holders, '3');
  perform t24_say('5b but only the two learners are counted as learners',
    coalesce(v_counted, 'no course'), '2');
end $$;

do $$ begin
  perform t24_be('24a10000-0000-0000-0000-00000000000d');
  perform t24_say('5c the learner list narrowed to that course says the same',
    t24_learners('24c10000-0000-0000-0000-00000000000c'), '2');
  perform t24_say('5d and a course nobody holds returns nobody',
    t24_learners('24c10000-0000-0000-0000-0000000000ff'), '0');
end $$;

-- ---------------------------------------------------------------------
-- 6. The control room can reach a path exam
-- ---------------------------------------------------------------------
do $$
declare v_path uuid; v_said text;
begin
  perform t24_be('24a10000-0000-0000-0000-00000000000d');
  set local role authenticated;
  select lms_create_path('T24 Path', 'The T24 Certificate') into v_path;
  reset role;
  perform t24_say('6a an administrator can make a path', (v_path is not null)::text, 'true');

  perform t24_be('24a10000-0000-0000-0000-00000000000d');
  perform t24_say('6b and can find the exam that path has',
    t24_studio_path(v_path), 'true');

  perform t24_be('24a10000-0000-0000-0000-00000000000a');
  set local role authenticated;
  begin
    perform lms_studio_path(v_path);
    v_said := 'ALLOWED';
  exception when others then
    v_said := 'refused';
  end;
  reset role;
  perform t24_say('6c but a learner asking the same question is refused', v_said, 'refused');
end $$;

-- ---------------------------------------------------------------------
-- 7. The backfill answers for work already done
-- ---------------------------------------------------------------------
do $$
declare v_done text;
begin
  -- Learner B finishes every lesson, then the badge is taken away by
  -- hand to stand for a database where the award never happened.
  perform t24_be('24a10000-0000-0000-0000-00000000000b');
  set local role authenticated;
  select completed::text into v_done from lms_complete_lesson('24e10000-0000-0000-0000-000000000001');
  select completed::text into v_done from lms_complete_lesson('24e10000-0000-0000-0000-000000000002');
  select completed::text into v_done from lms_complete_lesson('24e10000-0000-0000-0000-000000000003');
  reset role;
  perform t24_say('7a a second learner finishes the whole module', v_done, 'true');
  perform t24_say('7b and is awarded a badge',
    t24_badges('24a10000-0000-0000-0000-00000000000b'), '1');

  -- BOTH THROUGH EXECUTE, so a database without file 24 reports a
  -- failed check rather than dying here and hiding every check above.
  perform t24_strip('24a10000-0000-0000-0000-00000000000b');
  perform t24_say('7c with it removed, they are owed one',
    t24_badges('24a10000-0000-0000-0000-00000000000b'), '0');

  perform t24_backfill();

  perform t24_say('7d and the backfill, run again, gives it back',
    t24_badges('24a10000-0000-0000-0000-00000000000b'), '1');
end $$;

-- ------------------------------------------------------------- results
\pset tuples_only off
\pset format aligned
select n as "#", label as "what was checked",
       case when got is not distinct from want then 'pass' else 'FAIL' end as "result",
       got as "got", want as "wanted"
  from t24_out order by n;

select case when count(*) = 0 then 'ALL PASS'
            else count(*) || ' FAILED' end as "summary"
  from t24_out where got is distinct from want;

rollback;
