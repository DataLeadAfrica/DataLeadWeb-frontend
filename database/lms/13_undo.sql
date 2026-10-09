-- =====================================================================
-- UNDO file 13. Only if something has gone wrong.
--
-- READ THIS FIRST. Certificates that have already been issued are NOT
-- removed, and must not be. Somebody finished a course and was given a
-- qualification. Taking it back because we are rolling back a piece of
-- code would be dishonest, and the /verify page may already have been
-- shared with an employer.
--
-- To withdraw one deliberately, use the staff console, which records a
-- reason. That is a different act from undoing a file.
--
-- To see what was issued by the Academy before you undo anything:
--
--   select certificate_number, completed_on, issued_at
--     from certificates where issued_by = 'Data-Lead Academy'
--    order by issued_at;
-- =====================================================================

drop function if exists lms_claim_course_certificate(uuid);
drop function if exists lms_set_lesson_duration(uuid, integer);

-- The publish checklist goes back to the version from file 11, without
-- the programme item and without naming the lessons that are missing.
create or replace function lms_course_blockers(p_course uuid)
returns table(ok boolean, label text)
language sql stable security definer set search_path = public as $function$
  with c as (select * from lms_courses where id = p_course),
  m as (select count(*) n from lms_modules where course_id = p_course),
  l as (select count(*) n from lms_lessons le
          join lms_modules mo on mo.id = le.module_id where mo.course_id = p_course),
  v as (select count(*) n from lms_lessons le
          join lms_modules mo on mo.id = le.module_id
         where mo.course_id = p_course and le.type = 'video'
           and (le.video_ref is null or le.duration_seconds is null)),
  emptyq as (
    select count(*) n,
           string_agg(coalesce(nullif(btrim(q.title),''),'untitled'), ', '
                      order by q.title) as names
      from lms_quizzes q
     where (q.lesson_id in (select le.id from lms_lessons le
                             join lms_modules mo on mo.id = le.module_id
                            where mo.course_id = p_course)
            or q.module_id in (select id from lms_modules where course_id = p_course))
       and not exists (select 1 from lms_questions qq
                        where qq.quiz_id = q.id and qq.active))
  select btrim(coalesce((select title from c),'')) <> '', 'Has a title'
  union all select btrim(coalesce((select summary from c),'')) <> '', 'Has a short description'
  union all select btrim(coalesce((select tool from c),'')) <> '', 'Has a tool'
  union all select (select n from m) > 0, 'Has at least one module'
  union all select (select n from l) > 0, 'Has at least one lesson'
  union all select (select n from v) = 0, 'Every video lesson has its video'
  union all select (select n from emptyq) = 0,
    case when (select n from emptyq) = 0
         then 'Every set of questions has at least one question'
         else 'Every set of questions has at least one question. Still empty: '
              || (select names from emptyq)
              || '. Add a question, or delete the empty set.'
    end
$function$;

-- ---------------- what is left in place on purpose ----------------
-- Every certificate already issued. See the note at the top.
