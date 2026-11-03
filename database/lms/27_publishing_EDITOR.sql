-- GENERATED. Do not edit.
--
-- Made by scripts/lms/make-editor-sql.mjs from the file named below.
-- The comments between the function bodies are removed. Every body is
-- byte for byte what that file holds, and a test checks it.
--
-- Paste THIS one into the Supabase SQL Editor.
--
-- source: database/lms/27_publishing.sql
do $$
declare v_missing text[] := '{}';
begin
  if to_regprocedure('public.lms_publish_checks(uuid)') is null then
    v_missing := v_missing || 'lms_publish_checks (file 17)'::text;
  end if;
  if to_regprocedure('public.lms_publish_exam(uuid)') is null then
    v_missing := v_missing || 'lms_publish_exam (file 16)'::text;
  end if;
  if to_regprocedure('public.lms_publish_path(uuid)') is null then
    v_missing := v_missing || 'lms_publish_path (file 16)'::text;
  end if;
  if to_regprocedure('public.lms_may_edit_quiz(uuid)') is null then
    v_missing := v_missing || 'lms_may_edit_quiz (file 26)'::text;
  end if;
  if array_length(v_missing, 1) is not null then
    raise exception 'File 27 cannot run yet. Missing: %', array_to_string(v_missing, ', ');
  end if;
  raise notice 'Step 0: files 01 to 26 are in place.';
end $$;

CREATE OR REPLACE FUNCTION public.lms_publish_exam(p_exam uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_serve integer;
  v_need  integer;
  v_bank  integer;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can publish an exam.';
  end if;
  select q.serve_count, ceil(q.serve_count * q.bank_multiple)
    into v_serve, v_need
    from lms_quizzes q where q.id = p_exam;
  if v_serve is null then
    raise exception 'No such exam.';
  end if;
  select count(*) into v_bank from lms_questions where quiz_id = p_exam and active;
  if v_bank < v_need then
    raise exception 'This exam serves % questions a try and needs a bank of at least %. It has %.',
      v_serve, v_need, v_bank;
  end if;
  update lms_quizzes set status = 'published' where id = p_exam;
  return 'published';
end $function$;

CREATE OR REPLACE FUNCTION public.lms_publish_path(p_path uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_bad text;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can publish a path.';
  end if;
  select string_agg(label, '; ') into v_bad
    from lms_path_blockers(p_path) where not ok;
  if v_bad is not null then
    raise exception 'This path is not ready: %', v_bad;
  end if;
  update lms_paths set status = 'published' where id = p_path;
  return 'published';
end $function$;

CREATE OR REPLACE FUNCTION public.lms_ensure_path_exam(p_path uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can set up an exam.';
  end if;
  select id into v_id from lms_quizzes where path_id = p_path;
  if v_id is not null then
    return v_id;
  end if;
  -- A draft until the bank is big enough. See lms_ensure_course_exam.
  insert into lms_quizzes (path_id, title, pass_percent, max_attempts, serve_count,
                           retake_after_minutes, shuffle, status, time_limit_minutes, bank_multiple)
  values (p_path, 'Path exam', 70, 2, 40, 1440, true, 'draft', 90, 1.5)
  returning id into v_id;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.lms_publish_checks(p_course uuid)
 RETURNS TABLE(n integer, label text, passes boolean, detail text, fix_tab text, fix_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_c       lms_courses%rowtype;
  v_lessons integer;
  v_videos  integer;
  v_novideo integer;
  v_nocheck integer;
  v_bank    integer;
  v_need    integer;
  v_exam    uuid;
  v_exam_st text;
  v_first   uuid;
begin
  select * into v_c from lms_courses c where c.id = p_course;
  if v_c.id is null then return; end if;
  if not lms_may_edit_course(p_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;

  select count(*) into v_lessons
    from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = p_course;

  select count(*) into v_videos
    from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = p_course and l.type = 'video';

  -- min() has no uuid form, so the first one is taken by order rather
  -- than by aggregate. It is the lesson the "fix it" button opens, so
  -- "first" has to mean first in the course, not smallest uuid, anyway.
  select count(*) into v_novideo
    from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = p_course and l.type = 'video'
     and (l.video_ref is null or l.duration_seconds is null);

  select l.id into v_first
    from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = p_course and l.type = 'video'
     and (l.video_ref is null or l.duration_seconds is null)
   order by m.position, l.position limit 1;

  -- A CHECK THAT EXISTS AND HAS A QUESTION IN IT, not one that is
  -- already published, and the difference is the difference between a
  -- rule and a deadlock.
  --
  -- File 10 says only an administrator may publish a set of questions,
  -- which is the same rule as "facilitators build, administrators
  -- publish" and is right. But if this check demanded published checks,
  -- a facilitator could never get their course to nine green ticks,
  -- because the last thing standing in the way would be an action they
  -- are not allowed to take. They would send it for review with a red
  -- row and no way to explain it.
  --
  -- So this counts a check that is ready, and lms_publish_course
  -- publishes the drafts along with the course. The administrator
  -- publishing the course IS the administrator publishing its checks,
  -- in one deliberate act rather than fourteen.
  select count(*) into v_nocheck
    from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = p_course and l.type = 'video'
     and not exists (
       select 1 from lms_quizzes q
        where q.lesson_id = l.id
          and exists (select 1 from lms_questions qq where qq.quiz_id = q.id and qq.active)
     );

  select q.id into v_exam from lms_quizzes q
   where q.course_id = p_course and q.lesson_id is null and q.module_id is null
   limit 1;

  -- active, not a status: a question is retired by clearing active,
  -- which file 04 set up and file 16 kept.
  select count(*) into v_bank from lms_questions qq
   where qq.quiz_id = v_exam and qq.active;

  -- The bank rule is read off the exam row rather than typed, so this
  -- check and lms_publish_exam cannot come to different conclusions
  -- about the same exam.
  select ceil(q.serve_count * coalesce(q.bank_multiple, 1.5))
    into v_need from lms_quizzes q where q.id = v_exam;

  -- READ FOR ROW 10, which is the row this whole file exists for.
  select q.status::text into v_exam_st from lms_quizzes q where q.id = v_exam;

  return query
  select 1, 'Has a title'::text,
         coalesce(btrim(v_c.title), '') <> '',
         case when coalesce(btrim(v_c.title), '') = '' then 'Give the course a title.' else '' end,
         'details'::text, null::uuid
  union all select 2, 'Has a short description',
         coalesce(btrim(v_c.summary), '') <> '',
         case when coalesce(btrim(v_c.summary), '') = '' then 'One or two sentences for the card and for Google.' else '' end,
         'details', null
  union all select 3, 'Has an area and a tool or skill',
         coalesce(btrim(v_c.area), '') <> '' and coalesce(btrim(v_c.tool), '') <> '',
         case when coalesce(btrim(v_c.area), '') = '' or coalesce(btrim(v_c.tool), '') = ''
              then 'Both decide the cover and where the course is found.' else '' end,
         'details', null
  union all select 4, 'Has at least one lesson',
         v_lessons > 0,
         case when v_lessons = 0 then 'Add a module and a lesson to it.' else '' end,
         'lessons', null
  union all select 5, 'Has at least three things a learner will be able to do',
         coalesce(array_length(v_c.outcomes, 1), 0) >= 3,
         case when coalesce(array_length(v_c.outcomes, 1), 0) < 3
              then (3 - coalesce(array_length(v_c.outcomes, 1), 0))::text || ' more to write.' else '' end,
         'details', null
  union all select 6, 'Every video lesson has its video and its length',
         v_novideo = 0,
         case when v_novideo > 0
              then v_novideo::text || ' of ' || v_videos::text || ' still need one.' else '' end,
         'lessons', v_first
  union all select 7, 'Every video lesson has a lesson check',
         v_nocheck = 0,
         case when v_nocheck > 0
              then v_nocheck::text || ' of ' || v_videos::text || ' have no check yet.' else '' end,
         'lessons', null
  union all select 8, 'Has a certificate programme',
         v_c.programme_id is not null,
         case when v_c.programme_id is null
              then 'Without one no certificate can be issued. Tell an administrator.' else '' end,
         'details', null
  union all select 9, 'The course exam has enough questions',
         v_exam is not null and v_bank >= v_need,
         case when v_exam is null then 'The course has no exam.'
              when v_bank < v_need then (v_need - v_bank)::text || ' more questions needed.'
              else '' end,
         'exam', null
  union all select 10, 'The course exam is published',
         v_exam is not null and v_exam_st = 'published',
         case when v_exam is null then 'The course has no exam.'
              when v_exam_st is distinct from 'published'
                then 'The questions are written but the exam is still a draft, so no learner can sit it and nobody can be certified. Publish it on the exam tab.'
              else '' end,
         'exam', null;
end $function$;

do $$
declare v_drafts integer;
begin
  select count(*) into v_drafts
    from lms_quizzes q join lms_courses c on c.id = q.course_id
   where q.lesson_id is null and q.module_id is null
     and q.status <> 'published' and c.status = 'published';

  raise notice '--------------------------------------------------------';
  raise notice 'File 27 is in.';
  raise notice '  Publishing an exam or a path is now an administrator''s';
  raise notice '  decision, matching every function beside it.';
  raise notice '  The publish checklist has a tenth row, which says when';
  raise notice '  an exam is still a draft instead of ticking nine.';
  if v_drafts > 0 then
    raise notice ' ';
    raise notice '  LOOK AT THIS: % published course(s) have an exam that', v_drafts;
    raise notice '  is still a draft. No learner on those can be certified';
    raise notice '  until somebody publishes the exam. The new checklist';
    raise notice '  row names them, and 27_verify.sql lists them.';
  else
    raise notice '  No published course has a draft exam right now.';
  end if;
  raise notice '  Run 27_verify_EDITOR.sql next. Six rows, all yes.';
  raise notice '--------------------------------------------------------';
end $$;
