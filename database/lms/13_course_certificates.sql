-- =====================================================================
-- FILE 13. A certificate when an Academy course is finished, and the
--          rule that stops a learner shrinking a video to skip it.
--
-- Run this in the Supabase SQL editor, after files 01 to 07, 10, 11
-- and 12. It is safe to run twice. Read every notice it prints.
--
-- WHAT IT DOES, in one paragraph each.
--
-- PART A. Finishing an Academy course does nothing today. A learner can
-- watch every lesson and pass every quiz and there is no certificate at
-- the end, because nothing turns "finished" into a row in the
-- certificates table. This adds lms_claim_course_certificate, which
-- checks the work is really done and then issues the certificate through
-- the course's programme, reusing the same numbering the staff console
-- and the assessment portal already use. The /verify page keeps working
-- with no change at all, because it is the same kind of row.
--
-- PART B. The non skippable rule works on a percentage: watch 92 percent
-- of duration_seconds and the next lesson opens. So whoever controls
-- duration_seconds controls the rule. Set a two hour video to 10 seconds
-- and one slice is the whole course. Today a learner cannot reach that
-- column, which is correct, and this file proves it with a test rather
-- than assuming it. It then adds the ONLY way it may be corrected: a
-- function that refuses anybody who is not staff.
-- =====================================================================


-- =====================================================================
-- STEP 0  Check this database is the one this file was written for.
--         Nothing is changed until every check has passed.
-- =====================================================================
do $$
declare
  v_missing text[] := '{}';
  v_nm text;
begin
  -- the Academy pieces from files 10, 11 and 12
  foreach v_nm in array array['lms_tidy_table_privileges','lms_is_admin','lms_is_staff',
                              'lms_course_blockers','lms_publish_course','lms_has_course_access',
                              'lms_link_participant','lms_my_role','request_sign_in_code'] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = v_nm) then
      v_missing := v_missing || ('function ' || v_nm || ', from file 10, 11 or 12')::text;
    end if;
  end loop;

  -- the certification pieces this file writes into. If any of these is
  -- different from what is expected, STOP: writing a wrong row into the
  -- certificates table is not something a verify file can undo.
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'make_certificate_number') then
    v_missing := v_missing || 'function make_certificate_number, which is what numbers a certificate'::text;
  end if;

  foreach v_nm in array array['certificate_number','participant_id','programme_id','module_id',
                              'completed_on','issued_by','revoked'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name='certificates' and column_name=v_nm) then
      v_missing := v_missing || ('certificates.' || v_nm)::text;
    end if;
  end loop;

  foreach v_nm in array array['code','slug','title'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name='programmes' and column_name=v_nm) then
      v_missing := v_missing || ('programmes.' || v_nm)::text;
    end if;
  end loop;

  foreach v_nm in array array['full_name','email','email_norm'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name='participants' and column_name=v_nm) then
      v_missing := v_missing || ('participants.' || v_nm)::text;
    end if;
  end loop;

  -- certificate_number must be unique, or "safe to run twice" is a lie
  if not exists (
    select 1 from pg_constraint con join pg_class c on c.oid = con.conrelid
     where c.relname = 'certificates' and con.contype = 'u'
       and pg_get_constraintdef(con.oid) ilike '%certificate_number%') then
    v_missing := v_missing || 'a UNIQUE rule on certificates.certificate_number'::text;
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception E'This database is not ready for file 13. Missing or different:\n  %\n\nNothing has been changed.',
      array_to_string(v_missing, E'\n  ');
  end if;
  raise notice 'Step 0: everything file 13 needs is present.';
end $$;


-- =====================================================================
-- STEP 1  PART B. The video length rule.
--
-- 1a. The publish checklist already refused a course whose video lesson
--     had no length, and it turns out it could not do otherwise: the
--     table itself carries a check constraint saying a video lesson has
--     its provider, its reference and its length TOGETHER, or all three
--     empty. So "missing video" and "missing length" are always the same
--     lessons, and an earlier draft of this file that split them into two
--     checklist items would have printed the same thing twice.
--
--     What was actually missing is which lessons. The item now names
--     them, so a facilitator does not have to hunt.
--
-- 1b. A new item, and this one is real: the course must have a
--     programme. Without one there is nothing to issue a certificate
--     against, and a learner would reach the end of a paid course and
--     find there is no certificate. Better to refuse at publishing time,
--     when somebody can still fix it.
-- =====================================================================
create or replace function lms_course_blockers(p_course uuid)
returns table(ok boolean, label text)
language sql stable security definer set search_path = public as $function$
  with c as (select * from lms_courses where id = p_course),
  m as (select count(*) n from lms_modules where course_id = p_course),
  l as (select count(*) n from lms_lessons le
          join lms_modules mo on mo.id = le.module_id where mo.course_id = p_course),
  -- a video lesson that is not filled in. The table constraint means the
  -- video and the length arrive together, so one test finds both.
  novid as (select count(*) n,
                   string_agg(coalesce(nullif(btrim(le.title),''),'untitled'), ', ' order by le.title) as names
              from lms_lessons le
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
  union all select (select n from novid) = 0,
    case when (select n from novid) = 0
         then 'Every video lesson has its video and its length'
         else 'Every video lesson has its video and its length. Still missing: '
              || (select names from novid)
              || '. Without the length the non skippable rule cannot work.'
    end
  union all select (select programme_id from c) is not null,
    case when (select programme_id from c) is not null
         then 'Has a programme, so a certificate can be issued'
         else 'Has a programme, so a certificate can be issued. '
              || 'Set lms_courses.programme_id, or a learner will finish this course '
              || 'and find there is no certificate at the end.'
    end
  union all select (select n from emptyq) = 0,
    case when (select n from emptyq) = 0
         then 'Every set of questions has at least one question'
         else 'Every set of questions has at least one question. Still empty: '
              || (select names from emptyq)
              || '. Add a question, or delete the empty set.'
    end
$function$;


-- ---------------------------------------------------------------------
-- 1c. The ONLY way a lesson's length may be corrected from a page.
--
-- READ THIS BEFORE CHANGING IT. This function is the new risk in file
-- 13, and it is worth being plain about why.
--
-- The non skippable rule is: watch coverage_percent of duration_seconds
-- and the next lesson opens. Coverage is a percentage of this number.
-- So anybody who can write this number can defeat the whole mechanism:
-- set a two hour video to 10 seconds and one slice is 100 percent.
--
-- A learner cannot reach the column today, because the policy that
-- allows editing a lesson at all requires lms_can_edit(). But this
-- function is SECURITY DEFINER, which means it runs with the owner's
-- permissions and the policy does not apply to it. So the check below
-- is the ONLY thing standing between a learner and that column, and if
-- it is ever removed or loosened the non skippable rule quietly stops
-- working with nothing to show for it.
--
-- Tests U2 and U3 exist for exactly this and must never be deleted.
-- ---------------------------------------------------------------------
create or replace function lms_set_lesson_duration(p_lesson uuid, p_seconds integer)
returns table(ok boolean, message text)
language plpgsql security definer set search_path = public as $function$
declare
  v_course uuid;
  v_status lms_status;
  v_old integer;
begin
  -- THE check. Everything else in this function is detail.
  if not (auth.uid() is null or lms_is_staff()) then
    return query select false,
      'Only a facilitator or the administrator can set how long a lesson is.'; return;
  end if;

  if p_seconds is null or p_seconds < 1 or p_seconds > 86400 then
    return query select false,
      'A length must be between 1 second and 24 hours. Give it in seconds.'; return;
  end if;

  select mo.course_id, lms_course_status_of_module(mo.id), le.duration_seconds
    into v_course, v_status, v_old
    from lms_lessons le join lms_modules mo on mo.id = le.module_id
   where le.id = p_lesson;

  if v_course is null then
    return query select false, 'There is no lesson with that id.'; return;
  end if;

  -- A live course is changed by the administrator only, matching the
  -- guard that already protects every other lesson column.
  if v_status = 'published' and not (auth.uid() is null or lms_is_admin()) then
    return query select false,
      'That course is live. Ask the administrator to unpublish it first.'; return;
  end if;

  update lms_lessons set duration_seconds = p_seconds where id = p_lesson;

  return query select true,
    case when v_old is null then 'Length set to ' || p_seconds || ' seconds.'
         else 'Length changed from ' || v_old || ' to ' || p_seconds || ' seconds.' end;
end $function$;


-- =====================================================================
-- STEP 2  PART A. A certificate when the course is finished.
--
-- WHAT COUNTS AS FINISHED. Both of these, with no exceptions:
--   every lesson in the course is marked complete for this learner
--   every PUBLISHED module quiz in the course has a passed attempt
--
-- Lesson checks are not in that list on purpose. A lesson is not marked
-- complete until its check is passed, so they are already counted once;
-- counting them twice would mean a learner who passed a check before the
-- rules changed could be stuck forever.
--
-- SAFE TO CALL TWICE. It looks for an existing certificate for this
-- participant and programme first and hands back the same number. The
-- page can call it on every visit to the last lesson without making a
-- second certificate.
--
-- A REVOKED CERTIFICATE IS NOT QUIETLY REISSUED. If one was issued and
-- later withdrawn, finishing the course again does not undo that.
-- Withdrawing a certificate is a deliberate act by a person, and a
-- function that silently reverses it would make the revoke button a lie.
-- It says so and stops.
-- =====================================================================
create or replace function lms_claim_course_certificate(p_course uuid)
returns table(issued boolean, certificate_number text, message text)
language plpgsql security definer set search_path = public, extensions as $function$
declare
  v_uid       uuid := auth.uid();
  v_course    lms_courses%rowtype;
  v_prog      programmes%rowtype;
  v_part      uuid;
  v_email     text;
  v_name      text;
  v_lessons   integer;
  v_done      integer;
  v_quizzes   integer;
  v_passed    integer;
  v_existing  text;
  v_revoked   boolean;
  v_number    text;
begin
  if v_uid is null then
    return query select false, null::text, 'Please sign in.'; return;
  end if;

  select * into v_course from lms_courses where id = p_course;
  if not found then
    return query select false, null::text, 'There is no course with that id.'; return;
  end if;

  if not lms_has_course_access(p_course) then
    return query select false, null::text, 'You do not have access to this course.'; return;
  end if;

  if v_course.programme_id is null then
    return query select false, null::text,
      'This course has no programme attached, so no certificate can be issued for it yet. '
      || 'Please tell us and we will put it right.'; return;
  end if;

  select * into v_prog from programmes where id = v_course.programme_id;
  if not found then
    return query select false, null::text,
      'This course points at a programme that no longer exists.'; return;
  end if;

  -- ---------------- is the work actually finished ----------------
  select count(*) into v_lessons
    from lms_lessons le join lms_modules mo on mo.id = le.module_id
   where mo.course_id = p_course;

  if v_lessons = 0 then
    return query select false, null::text, 'This course has no lessons yet.'; return;
  end if;

  select count(*) into v_done
    from lms_lesson_progress pr
    join lms_lessons le on le.id = pr.lesson_id
    join lms_modules mo on mo.id = le.module_id
   where mo.course_id = p_course and pr.user_id = v_uid and pr.completed;

  if v_done < v_lessons then
    return query select false, null::text,
      'Not finished yet. You have completed ' || v_done || ' of ' || v_lessons || ' lessons.'; return;
  end if;

  select count(*) into v_quizzes
    from lms_quizzes q join lms_modules mo on mo.id = q.module_id
   where mo.course_id = p_course and q.status = 'published';

  select count(distinct q.id) into v_passed
    from lms_quizzes q
    join lms_modules mo on mo.id = q.module_id
    join lms_quiz_attempts a on a.quiz_id = q.id
   where mo.course_id = p_course and q.status = 'published'
     and a.user_id = v_uid and a.passed;

  if v_passed < v_quizzes then
    return query select false, null::text,
      'Not finished yet. You have passed ' || v_passed || ' of ' || v_quizzes
      || ' module quizzes.'; return;
  end if;

  -- ---------------- who is this, on the certificate side ----------------
  select participant_id, coalesce(nullif(btrim(full_name), ''), null)
    into v_part, v_name from lms_profiles where id = v_uid;

  select email into v_email from auth.users where id = v_uid;
  v_email := lower(btrim(coalesce(v_email, '')));
  if v_email = '' then
    return query select false, null::text,
      'Your account has no email address, so a certificate cannot be issued.'; return;
  end if;
  v_name := coalesce(v_name, split_part(v_email, '@', 1));

  if v_part is null then
    perform lms_link_participant(v_uid, v_email);
    select participant_id into v_part from lms_profiles where id = v_uid;
  end if;

  if v_part is null then
    select id into v_part from participants where email_norm = v_email limit 1;
  end if;

  if v_part is null then
    insert into participants (full_name, email) values (v_name, v_email)
      returning id into v_part;
    update lms_profiles set participant_id = v_part, linked_at = now() where id = v_uid;
  end if;

  -- ---------------- already got one ----------------
  -- module_id is null for an Academy course certificate, so the match
  -- uses "is not distinct from", which treats null as a value rather
  -- than as unknown. A plain = would never match and every claim would
  -- make a new certificate.
  select c.certificate_number, c.revoked into v_existing, v_revoked
    from certificates c
   where c.participant_id = v_part
     and c.programme_id   = v_course.programme_id
     and c.module_id is not distinct from null
   limit 1;

  if v_existing is not null and v_revoked then
    return query select false, v_existing,
      'A certificate for this was issued and later withdrawn. Please contact us.'; return;
  end if;

  if v_existing is not null then
    return query select false, v_existing,
      'You already have this certificate. Here it is again.'; return;
  end if;

  -- ---------------- issue it ----------------
  -- The same numbering the staff console and the assessment portal use.
  -- Called, not copied: there must be one place that decides what a
  -- certificate number looks like.
  v_number := make_certificate_number(v_prog.code, extract(year from current_date)::int, null);

  insert into certificates
    (certificate_number, participant_id, programme_id, module_id, completed_on, issued_by)
  values
    (v_number, v_part, v_course.programme_id, null, current_date, 'Data-Lead Academy');

  return query select true, v_number, 'Congratulations. Your certificate is ready.';
end $function$;


-- =====================================================================
-- STEP 3  Permissions, and the tidy up.
-- =====================================================================
-- A learner calls this one about their own course, so authenticated
-- needs it. It is security definer and judges for itself.
grant execute on function lms_claim_course_certificate(uuid) to authenticated;
revoke all on function lms_claim_course_certificate(uuid) from public, anon;

-- Staff only, and it checks. anon must not reach it at all: a signed out
-- caller is trusted by the check (that is the SQL editor), so leaving it
-- reachable from the website would hand the column to everybody.
grant execute on function lms_set_lesson_duration(uuid, integer) to authenticated;
revoke all on function lms_set_lesson_duration(uuid, integer) from public, anon;

do $$
declare v_n integer;
begin
  select tables_tidied into v_n from lms_tidy_table_privileges();
  raise notice 'Step 3: checked permissions on % Academy tables and views.', v_n;
end $$;

do $$
declare v_no_prog integer;
begin
  select count(*) into v_no_prog from lms_courses where programme_id is null;
  if v_no_prog > 0 then
    raise notice 'File 13 finished. NOTE: % course(s) have no programme_id and can no longer be published until one is set. That is the new rule, not a fault.', v_no_prog;
  else
    raise notice 'File 13 finished. Now run 13_verify.sql.';
  end if;
end $$;
