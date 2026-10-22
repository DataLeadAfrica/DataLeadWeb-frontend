-- =====================================================================
-- FILE 24. Module badges, and two control room counts.
--
-- PASTE 24_module_badges_EDITOR.sql, NOT THIS ONE. The two hold the
-- same statements and a test keeps them in step. The plain English is
-- in docs/lms/PHASE-6E-PLAIN.md and 24_verify.sql checks the result.
--
-- THE PATH EXAM IS NOT IN HERE, AND NEEDS NOTHING. File 16 built the
-- whole server side of it and the docs did not credit it. Writing a
-- path exam question, reading the bank, retiring a question, the
-- learner's path page and the claim all handle a path owned quiz
-- already, each guarded to administrators. What was missing was two
-- links in the browser, and those are in this package as front end
-- changes with no SQL behind them.
--
-- WHAT A BADGE IS. A mark of having finished a module, shown to the
-- learner who earned it. It is NOT a certificate: no number, no row in
-- certificates, nothing on /verify, nothing a programme points at. The
-- certification system is not touched by this file at all.
--
-- WHAT EARNS ONE. Every lesson in the module completed. There is no
-- module exam and there will not be one: file 16 abolished module
-- quizzes, and lms_complete_lesson already refuses a lesson whose check
-- has not been passed, so "every lesson completed" already carries the
-- checks with it.
--
-- WHY A TRIGGER RATHER THAN A LINE IN lms_complete_lesson. The badge
-- has to be awarded in the same transaction as the last requirement, so
-- that a learner cannot be left having finished a module with no badge
-- because something failed in between. A trigger on the progress record
-- does that, and it does it whichever function wrote the row, so a
-- later file that completes a lesson some other way cannot forget to
-- award the badge. The cost is that the award is not visible by reading
-- lms_complete_lesson alone, which is what this paragraph is for.
--
-- A BADGE ONCE EARNED STAYS EARNED. Nothing here ever deletes one, and
-- a module that gains a lesson after somebody finished it does not take
-- their badge back. That is why the page reads the table rather than
-- comparing lessons done against lessons, which would quietly un-award
-- it.
--
-- THE TWO COUNTS. The Overview and the Courses table were counting
-- every active entitlement as a learner, which on a database whose only
-- accounts are two administrators reported two learners on a course and
-- an empty Learners tab beside it. The same fault was fixed once before
-- in this very function, for "new learners", and the comment above that
-- one records it. The Learners tab also gains a course filter, so the
-- number and the list can be checked against each other.
-- =====================================================================

-- -------------------------------------------------------------- step 0
-- Files 01 to 23 first.
do $$
declare v_missing text[] := '{}';
begin
  if to_regclass('public.lms_modules') is null then
    v_missing := v_missing || 'lms_modules (file 02)'::text;
  end if;
  if to_regclass('public.lms_lesson_progress') is null then
    v_missing := v_missing || 'lms_lesson_progress (file 04)'::text;
  end if;
  if to_regprocedure('public.lms_my_course(text)') is null then
    v_missing := v_missing || 'lms_my_course (file 15)'::text;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'lms_quizzes'
                    and column_name = 'path_id') then
    v_missing := v_missing || 'lms_quizzes.path_id (file 16)'::text;
  end if;
  if to_regprocedure('public.lms_staff_learners(text, text, text, integer, integer)') is null
     and to_regprocedure('public.lms_staff_learners(text, text, text, integer, integer, uuid)') is null then
    v_missing := v_missing || 'lms_staff_learners (file 17)'::text;
  end if;
  if to_regprocedure('public.lms_programme_title_follows(uuid, text)') is null then
    v_missing := v_missing || 'lms_programme_title_follows (file 23)'::text;
  end if;
  if array_length(v_missing, 1) is not null then
    raise exception 'File 24 cannot run yet. Missing: %', array_to_string(v_missing, ', ');
  end if;
  raise notice 'Step 0: files 01 to 23 are in place.';
end $$;

-- -------------------------------------------------------------- step 1
-- The badge table.
--
-- READ ONLY TO THE LEARNER, exactly as file 23 left the progress tables.
-- A learner reads their own badges and writes none: the only thing that
-- inserts here is the trigger in step 2, which runs as the owner. A
-- policy cannot restrict columns, and the lesson of file 23 is that a
-- write policy on a learner's own row is a write policy on every column
-- of it, so there is no write policy here at all.
create table if not exists lms_module_badges (
  user_id    uuid not null references auth.users(id)  on delete cascade,
  module_id  uuid not null references lms_modules(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

alter table lms_module_badges enable row level security;

drop policy if exists p_badge_self_read on lms_module_badges;
create policy p_badge_self_read on lms_module_badges
  for select to authenticated using (user_id = auth.uid());

grant select on lms_module_badges to authenticated;
revoke insert, update, delete on lms_module_badges from authenticated, anon;

-- -------------------------------------------------------------- step 2
-- The award, in the same transaction as the last lesson.
create or replace function lms_award_module_badge()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_module uuid;
begin
  if not coalesce(new.completed, false) then
    return null;
  end if;

  select l.module_id into v_module from lms_lessons l where l.id = new.lesson_id;
  if v_module is null then
    return null;
  end if;

  -- Any lesson in the module this learner has not completed means no
  -- badge yet. A module with no lessons at all awards nothing, which is
  -- what the "exists a lesson" test below gives for free.
  if not exists (select 1 from lms_lessons l2 where l2.module_id = v_module) then
    return null;
  end if;
  if exists (
    select 1 from lms_lessons l3
     where l3.module_id = v_module
       and not exists (
         select 1 from lms_lesson_progress p3
          where p3.lesson_id = l3.id
            and p3.user_id = new.user_id
            and p3.completed)
  ) then
    return null;
  end if;

  insert into lms_module_badges (user_id, module_id)
  values (new.user_id, v_module)
  on conflict (user_id, module_id) do nothing;

  return null;
end $$;

revoke execute on function lms_award_module_badge() from public, anon, authenticated;

drop trigger if exists t_award_module_badge on lms_lesson_progress;
create trigger t_award_module_badge
after insert or update of completed on lms_lesson_progress
for each row when (new.completed)
execute function lms_award_module_badge();

-- -------------------------------------------------------------- step 3
-- The backfill, for modules somebody has already finished.
--
-- Dated to the last lesson they completed rather than to today, because
-- a badge for work done in September should not say October. Nothing is
-- taken away and nothing is overwritten: a badge that somehow exists
-- already keeps the date it has.
insert into lms_module_badges (user_id, module_id, awarded_at)
select p.user_id, m.id, coalesce(max(p.completed_at), now())
  from lms_lesson_progress p
  join lms_lessons l on l.id = p.lesson_id
  join lms_modules m on m.id = l.module_id
 where p.completed
 group by p.user_id, m.id
having count(*) = (select count(*) from lms_lessons l2 where l2.module_id = m.id)
on conflict (user_id, module_id) do nothing;

do $$
declare v_n integer;
begin
  select count(*) into v_n from lms_module_badges;
  raise notice 'Step 3: % module badge(s) now held, backfill included.', v_n;
end $$;

-- -------------------------------------------------------------- step 4
-- The learner's course page carries the badge.
CREATE OR REPLACE FUNCTION public.lms_my_course(p_slug text)
 RETURNS TABLE(course_id uuid, slug text, title text, summary text, tool text, level text, cover_code text, lesson_count integer, lessons_done integer, quiz_count integer, quizzes_passed integer, percent numeric, resume_lesson_id uuid, resume_lesson_title text, resume_second integer, certificate_number text, certificate_issued_on date, modules jsonb, exam jsonb, paths jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid(); v_c lms_courses%rowtype;
  v_exam_id uuid; v_exam jsonb;
begin
  if v_uid is null then return; end if;

  select * into v_c from lms_courses where lms_courses.slug = p_slug and status = 'published';
  if not found then return; end if;

  -- A free course is open to anybody signed in. A paid one needs an
  -- entitlement. Both rules belong to the server, and this is the only
  -- gate on the whole function: everything below it is already private
  -- to this learner.
  if not (lms_has_course_access(v_c.id) or v_c.price_kobo = 0) then return; end if;

  -- Read before the big query. lms_exam_status returns a TABLE, and a
  -- set returning function cannot sit inside a select list like this.
  -- QUALIFIED, and it has to be. course_id is one of this function's
  -- own OUT columns, so an unqualified course_id here is ambiguous and
  -- the function fails at run time with "column reference course_id is
  -- ambiguous", which creates perfectly well and only shows up when
  -- somebody opens a course.
  select z.id into v_exam_id from lms_quizzes z
   where z.course_id = v_c.id and z.status = 'published' limit 1;
  if v_exam_id is not null then
    select to_jsonb(x) into v_exam from lms_exam_status(v_exam_id) x;
  end if;

  return query
  with lesson as (
    select le.id, le.title, le.position as lpos, le.type, le.duration_seconds,
           le.coverage_percent, mo.id as module_id, mo.position as mpos,
           row_number() over (order by mo.position, le.position) as seq
      from lms_lessons le
      join lms_modules mo on mo.id = le.module_id
     where mo.course_id = v_c.id
  ),
  state as (
    select l.*,
           coalesce(p.completed, false) as completed,
           coalesce(p.check_passed, false) as check_passed,
           coalesce(p.last_position_seconds, 0) as last_position,
           case
             when coalesce(p.completed, false) and p.final_coverage is not null
               then p.final_coverage
             when l.duration_seconds is null then 0::numeric
             else round(100.0 * (select count(*) from lms_watch_buckets b
                                  where b.user_id = v_uid and b.lesson_id = l.id)
                        / greatest(1, ceil(l.duration_seconds::numeric
                                           / (select bucket_seconds from lms_lessons
                                               where id = l.id))), 2)
           end as coverage,
           exists (select 1 from lms_quizzes z
                    where z.lesson_id = l.id and z.status = 'published') as has_check
      from lesson l
      left join lms_lesson_progress p on p.lesson_id = l.id and p.user_id = v_uid
  ),
  unlocked as (
    -- open if it is the first lesson, or the one before it is complete
    select s.*,
           coalesce(lag(s.completed) over (order by s.seq), true) as is_unlocked
      from state s
  ),
  -- QUIZ COUNT NOW MEANS THE EXAM, and that is the whole change to
  -- these two numbers. There is one set of questions that counts in a
  -- course and it is at the end, so the count is 1 when there is a
  -- published exam and 0 before staff have made one. The percentage
  -- underneath it is unchanged: lessons plus the exam, out of lessons
  -- plus the exam.
  exam as (
    select z.id,
           (select bool_or(coalesce(a.passed, false)) from lms_quiz_attempts a
             where a.user_id = v_uid and a.quiz_id = z.id) as passed
      from lms_quizzes z
     where z.course_id = v_c.id and z.status = 'published'
     limit 1
  ),
  totals as (
    select (select count(*) from unlocked)::integer as n_lessons,
           (select count(*) from unlocked where completed)::integer as n_done,
           (select count(*) from exam)::integer as n_quiz,
           (select count(*) from exam where passed)::integer as n_passed
  ),
  resume as (
    -- the first lesson that is not finished and is open to them
    select u.id, u.title, u.last_position
      from unlocked u
     where not u.completed and u.is_unlocked
     order by u.seq limit 1
  ),
  cert as (
    select c.certificate_number as num, c.completed_on as on_date
      from certificates c
      join lms_profiles pr on pr.participant_id = c.participant_id
     where pr.id = v_uid
       and c.programme_id = v_c.programme_id
       and c.module_id is null
       and not c.revoked
     limit 1
  ),
  built as (
    select mo.position as mpos, mo.title as mtitle, mo.summary as msummary,
           jsonb_build_object(
             'position', mo.position,
             'title', mo.title,
             'summary', coalesce(mo.summary, ''),
             'seconds', coalesce((select sum(u.duration_seconds) from unlocked u
                                   where u.module_id = mo.id), 0),
             'lesson_count', (select count(*) from unlocked u where u.module_id = mo.id),
             'lessons_done', (select count(*) from unlocked u
                               where u.module_id = mo.id and u.completed),
             'lessons', coalesce((
                select jsonb_agg(jsonb_build_object(
                         'id', u.id,
                         'position', u.lpos,
                         'title', u.title,
                         'type', u.type,
                         'seconds', coalesce(u.duration_seconds, 0),
                         'coverage_needed', u.coverage_percent,
                         'completed', u.completed,
                         'check_passed', u.check_passed,
                         'has_check', u.has_check,
                         'coverage', u.coverage,
                         'unlocked', u.is_unlocked,
                         'last_position', u.last_position)
                       order by u.lpos)
                  from unlocked u where u.module_id = mo.id), '[]'::jsonb),
             -- THE MODULE QUIZ IS GONE FROM HERE. File 16 stops new
             -- ones being made, and the old rows stay as history, but
             -- no learner page lists them any more: the test course has
             -- one, and a learner who could see it would be looking at
             -- a quiz nothing else on the site mentions. The one set of
             -- questions that counts is now the course exam, at the
             -- end, and it is a column of its own rather than a thing
             -- hanging off a module.
             -- THE MODULE BADGE. Null until the module is finished,
             -- then the moment it was awarded. Read from the table
             -- rather than worked out from lessons_done, because a
             -- badge once earned stays earned: a module that gains a
             -- lesson afterwards is not a badge taken back.
             'badge_awarded_at', (select b.awarded_at from lms_module_badges b
                                   where b.module_id = mo.id and b.user_id = v_uid),
             'quiz', null
           ) as js
      from lms_modules mo
     where mo.course_id = v_c.id
  )
  select v_c.id, v_c.slug, v_c.title, v_c.summary, v_c.tool, v_c.level::text, v_c.cover_code,
         t.n_lessons, t.n_done, t.n_quiz, t.n_passed,
         case when t.n_lessons + t.n_quiz = 0 then 0::numeric
              else round(100.0 * (t.n_done + t.n_passed) / (t.n_lessons + t.n_quiz), 0) end,
         (select r.id from resume r), (select r.title from resume r),
         (select r.last_position from resume r),
         (select num from cert), (select on_date from cert),
         coalesce((select jsonb_agg(b.js order by b.mpos) from built b), '[]'::jsonb),
         v_exam,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'slug', pa.slug,
                    'name', pa.name,
                    'total', (select count(*) from lms_path_courses x
                               where x.path_id = pa.id),
                    -- Counted the same way the path page counts it: a
                    -- course is done when its certificate is held,
                    -- wherever it was earned.
                    'done', (select count(*) from lms_path_courses x
                               join lms_courses xc on xc.id = x.course_id
                              where x.path_id = pa.id
                                and exists (
                                  select 1 from certificates ct
                                    join lms_profiles pr on pr.participant_id = ct.participant_id
                                   where pr.id = v_uid
                                     and ct.programme_id = xc.programme_id
                                     and ct.module_id is null
                                     and not ct.revoked)))
                  order by pa.position)
             from lms_path_courses pc
             join lms_paths pa on pa.id = pc.path_id
            where pc.course_id = v_c.id and pa.status = 'published'), '[]'::jsonb)
    from totals t;
end $function$;

-- -------------------------------------------------------------- step 5
-- The Overview and the Courses table count learners, not access.
CREATE OR REPLACE FUNCTION public.lms_studio_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_out jsonb; v_admin boolean := lms_is_admin();
begin
  if not lms_is_staff() then
    raise exception 'Staff only.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'is_admin', v_admin,
    'name', (select p.full_name from lms_profiles p where p.id = auth.uid()),
    'week', jsonb_build_object(
      -- LEARNERS, not every row in auth.users. As written in file 17 it
      -- counted staff and unconfirmed sign ups too, so on a database
      -- with two administrators and nobody else it said 2 new learners.
      --
      -- THE CONFIRMED TEST IS GONE as of file 19, and that is not a
      -- loosening. With Supabase Confirm email off, email_confirmed_at
      -- is set at insert for everybody, so the test excluded nobody and
      -- only looked like a filter. Counting proven addresses instead
      -- would be a different number from the one this tile means, which
      -- is how many people signed up this week.
      'new_learners', (select count(*)
                         from auth.users u
                         join lms_profiles p on p.id = u.id
                        where u.created_at >= current_date - 7
                          and p.role = 'learner'),
      'active', (select count(distinct w.user_id) from lms_watch_days w where w.day >= current_date - 7),
      'minutes', (select coalesce(round(sum(w.seconds) / 60.0), 0) from lms_watch_days w
                   where w.day >= current_date - 7),
      'certificates', (select count(*) from certificates ct
                        where ct.issued_at >= (date_trunc('month', now() at time zone 'Africa/Lagos')) at time zone 'Africa/Lagos')
    ),
    'courses', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'slug', c.slug, 'title', c.title,
               'state', lms_course_state(c.id),
               'cover_code', c.cover_code, 'area', c.area, 'tool', c.tool,
               'learners', (select count(*) from lms_entitlements e
                             join lms_profiles pl on pl.id = e.user_id
                            where e.course_id = c.id and e.status = 'active'
                              and pl.role = 'learner'),
               'updated_at', c.updated_at) order by c.updated_at desc), '[]'::jsonb)
        from lms_courses c
       where v_admin or c.created_by = auth.uid()
    ),
    -- The needs-you queue, most urgent first. Each item carries the one
    -- button that deals with it, which is why it is a list of objects
    -- and not a count.
    'queue', (
      select coalesce(jsonb_agg(q order by q.ord), '[]'::jsonb) from (
        select 1 as ord, 'review' as kind,
               c.title || ' is ready for review' as heading,
               'Sent by ' || coalesce(pr.full_name, 'a facilitator') || '.' as detail,
               'Review and publish' as button, c.id as subject
          from lms_courses c
          left join lms_profiles pr on pr.id = c.sent_for_review_by
         where c.sent_for_review_at is not null and v_admin
        union all
        select 2, 'blocked',
               c.title || ' cannot be published yet',
               (select count(*)::text from lms_publish_checks(c.id) b where not b.passes)
                 || ' of 9 checks fail.',
               'Open the builder', c.id
          from lms_courses c
         where c.status = 'draft' and c.sent_for_review_at is null
           and (v_admin or c.created_by = auth.uid())
           and exists (select 1 from lms_publish_checks(c.id) b where not b.passes)
      ) q
    )
  ) into v_out;
  return v_out;
end $function$;

-- -------------------------------------------------------------- step 6
-- The Learners tab takes a course.
--
-- DROPPED FIRST, because the signature gains a parameter and a
-- create or replace cannot change one. A drop throws the grants away
-- with the function, so they are restated underneath: this one is
-- reachable by authenticated and by nobody else, and a new function
-- is executable by PUBLIC the moment it exists. That is the file 21
-- lesson, and file 22 had to learn it again.
drop function if exists lms_staff_learners(text, text, text, integer, integer);
drop function if exists lms_staff_learners(text, text, text, integer, integer, uuid);

CREATE OR REPLACE FUNCTION public.lms_staff_learners(p_search text DEFAULT ''::text, p_filter text DEFAULT 'all'::text, p_access text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_course uuid DEFAULT NULL::uuid)
 RETURNS TABLE(user_id uuid, full_name text, email text, joined timestamp with time zone, course_count integer, furthest_course text, furthest_percent integer, last_active timestamp with time zone, access_source text, certificates integer, state text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can see the learner list.' using errcode = '42501';
  end if;

  return query
  with base as (
    select p.id,
           p.full_name,
           u.email::text as email,
           u.created_at as joined,
           (select count(*) from lms_entitlements e
             where e.user_id = p.id and e.status = 'active')::integer as course_count,
           (select max(w.day) from lms_watch_days w where w.user_id = p.id) as last_day,
           (select count(*) from certificates ct
              join lms_profiles pr on pr.participant_id = ct.participant_id
             where pr.id = p.id)::integer as certs,
           -- how they got in: the strongest source they hold, because
           -- somebody with a scholarship AND the free courses is a
           -- scholarship learner, not a free one
           (select e.source::text from lms_entitlements e
             where e.user_id = p.id and e.status = 'active'
             order by case e.source
                        when 'purchase' then 1 when 'roster' then 2
                        when 'scholarship' then 3 when 'manual' then 4 else 5 end
             limit 1) as src,
           exists (
             select 1 from lms_quiz_attempts a
               join lms_quizzes q on q.id = a.quiz_id
              where a.user_id = p.id and q.course_id is not null
              group by a.quiz_id, q.max_attempts, q.retake_after_minutes
             having count(*) >= max(q.max_attempts)
                and bool_and(not coalesce(a.passed, false))
                and max(a.submitted_at) > now() - make_interval(mins => max(q.retake_after_minutes))
           ) as waiting
      from lms_profiles p
      join auth.users u on u.id = p.id
     where p.role = 'learner'
  ),
  shaped as (
    select b.*,
           case
             when b.certs > 0 then 'finished'
             when b.waiting then 'waiting'
             when b.last_day >= (current_date - 7) then 'active'
             when b.last_day is null or b.last_day < (current_date - 21) then 'quiet'
             else 'on the way'
           end as state
      from base b
  )
  select s.id, s.full_name, s.email, s.joined, s.course_count,
         (select c.title from lms_lesson_progress g
            join lms_lessons l on l.id = g.lesson_id
            join lms_modules m on m.id = l.module_id
            join lms_courses c on c.id = m.course_id
           where g.user_id = s.id order by g.updated_at desc limit 1),
         (select round(lms_course_progress(m.course_id))::integer
            from lms_lesson_progress g
            join lms_lessons l on l.id = g.lesson_id
            join lms_modules m on m.id = l.module_id
           where g.user_id = s.id order by g.updated_at desc limit 1),
         (s.last_day)::timestamptz, s.src, s.certs, s.state
    from shaped s
   where (coalesce(btrim(p_search), '') = ''
          or s.full_name ilike '%' || btrim(p_search) || '%'
          or s.email     ilike '%' || btrim(p_search) || '%')
     and (p_filter is null or p_filter = 'all' or s.state = p_filter)
     and (p_access is null or s.src = p_access)
     -- ONE COURSE, asked by access rather than by progress, because
     -- the count beside a course on the Courses table is its active
     -- entitlements and the two must agree. Somebody who holds the
     -- course and has not opened it is on this list, which is the
     -- answer to "who has this course".
     and (p_course is null or exists (
           select 1 from lms_entitlements e
            where e.user_id = s.id and e.course_id = p_course
              and e.status = 'active'))
   order by s.joined desc
   limit greatest(1, least(coalesce(p_limit, 100), 500))
  offset greatest(0, coalesce(p_offset, 0));
end $function$;

revoke execute on function lms_staff_learners(text, text, text, integer, integer, uuid)
  from public, anon;
grant execute on function lms_staff_learners(text, text, text, integer, integer, uuid)
  to authenticated;

-- -------------------------------------------------------------- step 7
-- The control room can find a path's exam.
--
-- THE ONE THING THE PATH EXAM WAS MISSING SERVER SIDE, and it is a
-- lookup rather than a capability: lms_studio_questions, lms_save_question,
-- lms_paste_questions and lms_retire_question have all accepted a path
-- owned exam since file 16, but nothing told the browser which quiz a
-- path's exam IS, so there was no id to hand them.
--
-- SHAPED LIKE A COURSE ON PURPOSE. The questions screen already knows
-- how to draw a title, an exam's settings and a bank count against what
-- it needs. Returning those under the same names lets one screen serve
-- both, and a screen written twice is one that gets fixed once.
-- "modules" comes back empty because a path exam question is not tagged
-- to a lesson: the courses underneath it have their own exams for that.
create or replace function lms_studio_path(p_path uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can open a path.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', pa.id,
    'slug', pa.slug,
    'title', pa.name,
    'certificate_name', coalesce(pa.certificate_name, pa.name),
    'state', pa.status::text,
    'course_count', (select count(*) from lms_path_courses pc where pc.path_id = pa.id),
    'modules', '[]'::jsonb,
    'exam', (
      select jsonb_build_object(
               'id', q.id, 'status', q.status::text,
               'serve_count', q.serve_count,
               'minutes', q.time_limit_minutes,
               'pass_percent', q.pass_percent,
               'tries', q.max_attempts,
               'bank', (select count(*) from lms_questions qq
                         where qq.quiz_id = q.id and qq.active),
               'needed', ceil(q.serve_count * coalesce(q.bank_multiple, 1.5)))
        from lms_quizzes q where q.path_id = pa.id limit 1))
    into v_out
    from lms_paths pa
   where pa.id = p_path;

  return v_out;
end $$;

revoke execute on function lms_studio_path(uuid) from public, anon;
grant execute on function lms_studio_path(uuid) to authenticated;

-- -------------------------------------------------------------- step 8
-- What changed.
do $$
declare v_badges integer; v_learners integer; v_staff integer;
begin
  select count(*) into v_badges from lms_module_badges;
  select count(*) into v_learners from lms_profiles where role = 'learner';
  select count(*) into v_staff from lms_profiles where role <> 'learner';
  raise notice '--------------------------------------------------------';
  raise notice 'File 24 is in.';
  raise notice '  Module badges held: %', v_badges;
  raise notice '  Accounts: % learner(s), % staff.', v_learners, v_staff;
  raise notice '  The Overview and Courses figures now count learners';
  raise notice '  only, so a course whose only access holders are staff';
  raise notice '  reads 0 rather than counting the people who built it.';
  raise notice '  The Learners tab takes a course to narrow by.';
  raise notice '  The control room can reach a path exam to write it.';
  raise notice '  Run 24_verify_EDITOR.sql next. Eight rows, all yes.';
  raise notice '--------------------------------------------------------';
end $$;
