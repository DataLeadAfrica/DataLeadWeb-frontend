-- Undoes file 24. REFUSES unless you say you mean it.
--
-- PASTE 24_undo_EDITOR.sql, NOT THIS ONE.
--
-- The line that lets it run is in the refusal below, which is also
-- where file 23's undo keeps it. It is not written here because a
-- semicolon inside a comment is something the Supabase editor's
-- statement splitter has no reason to handle well, and 16_verify.sql
-- taught us not to find that out on a live database.
--
-- WHAT IT KEEPS, and the list matters more than the list of what it
-- puts back.
--
-- EVERY BADGE STAYS. The record is not dropped and not emptied. A badge
-- is a learner's own work written down, and undoing a decision about
-- how the control room counts people is no reason to throw somebody's
-- finished module away. If file 24 is applied again every badge is
-- still there, with the date it was really earned.
--
-- THE READ ONLY STATE STAYS. Nothing here hands a learner INSERT on the
-- badge record, because that was never file 24's doing to undo: it is
-- the same rule file 23 established and the same rule the progress
-- record lives by.
--
-- WHAT IT PUTS BACK is the three functions as they were at file 23, and
-- it removes the two things that had no earlier version: the trigger
-- that awards a badge, and lms_studio_path.
--
-- WHAT UNDOING THIS COSTS. Paths cannot be published again, because the
-- control room loses the only way to learn which exam a path has. The
-- Overview goes back to counting staff access as learners. New badges
-- stop being awarded, while the ones already held stay visible until
-- lms_my_course is the pre-24 one again, which this file does, so they
-- become invisible rather than lost.

do $$
begin
  if coalesce(current_setting('lms.undo_24_force', true), '') <> 'yes, I mean it' then
    raise exception
      'This undo stops module badges being awarded and takes away the only way the '
      'control room has of reaching a path exam, so no path can be published while it '
      'is undone. Every badge already earned is kept. If you mean it, paste this line '
      'at the top of this file and run the whole thing in one go, ending that line '
      'with a semicolon: '
      'select set_config(''lms.undo_24_force'', ''yes, I mean it'', false)';
  end if;
  raise notice 'Undo 24: going ahead.';
end $$;

-- ------------------------------------------------------------- step 1
-- The award stops. The badges stay.
drop trigger if exists t_award_module_badge on lms_lesson_progress;
drop function if exists lms_award_module_badge();

-- ------------------------------------------------------------- step 2
-- The control room loses its way into a path exam.
drop function if exists lms_studio_path(uuid);

-- ------------------------------------------------------------- step 3
-- The learner's course page as it was, with no badge on the module.
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

-- ------------------------------------------------------------- step 4
-- The Overview counting every active entitlement again.
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
                             where e.course_id = c.id and e.status = 'active'),
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

-- ------------------------------------------------------------- step 5
-- The learner list without a course to narrow by.
--
-- Dropped both ways round, because which one is present depends on
-- whether file 24 ran. The grants are restated underneath for the same
-- reason they were in file 24: a drop takes them with it.
drop function if exists lms_staff_learners(text, text, text, integer, integer, uuid);
drop function if exists lms_staff_learners(text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.lms_staff_learners(p_search text DEFAULT ''::text, p_filter text DEFAULT 'all'::text, p_access text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
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
   order by s.joined desc
   limit greatest(1, least(coalesce(p_limit, 100), 500))
  offset greatest(0, coalesce(p_offset, 0));
end $function$;

revoke execute on function lms_staff_learners(text, text, text, integer, integer)
  from public, anon;
grant execute on function lms_staff_learners(text, text, text, integer, integer)
  to authenticated;

-- ------------------------------------------------------------- step 6
-- What is left.
do $$
declare v_badges integer;
begin
  select count(*) into v_badges from lms_module_badges;
  raise notice '--------------------------------------------------------';
  raise notice 'File 24 is undone.';
  raise notice '  % badge(s) KEPT, and the record is still there.', v_badges;
  raise notice '  No new badge will be awarded until file 24 runs again.';
  raise notice '  A path cannot be published: the control room has no';
  raise notice '  way to reach a path exam to write its questions.';
  raise notice '  24_verify.sql now says NO on rows 2 to 7, and yes on';
  raise notice '  rows 1 and 8. That is correct: the badges are intact';
  raise notice '  and still read only, they just stop being awarded.';
  raise notice '--------------------------------------------------------';
end $$;
