-- =====================================================================
-- FILE 23. A learner could issue themselves a certificate.
--
-- PASTE 23_certificate_integrity_EDITOR.sql, NOT THIS ONE. The two hold
-- the same statements and a test keeps them in step. The plain English
-- is in docs/lms/PHASE-6E-PLAIN.md and 23_verify.sql checks the result.
--
-- RUN THIS BEFORE FILE 24. It is small, it is urgent, and it takes
-- nothing away from anybody who is doing the work honestly. The module
-- badges in file 24 are earned from the very flag this file protects, so
-- a badge would be fakeable the same way until this has run.
--
-- THREE FAULTS, ALL ABOUT CERTIFICATES, ALL LIVE. The first two compose:
-- on a database built from 01 to 22 a learner watched ONE SECOND of each
-- lesson, ran ONE update, and was issued certificate number
-- CH5-2026-GEN-30167E, having never once opened the exam. The third is
-- separate and quieter: the certificate prints a title that stopped
-- following the course the moment it was created.
--
-- FAULT A: A LEARNER COULD MARK THEIR OWN LESSONS COMPLETE.
--
-- File 06 created p_prog_self_write, a FOR UPDATE policy on
-- lms_lesson_progress with "user_id = auth.uid()" and no restriction on
-- which columns. A policy cannot limit columns, so that is UPDATE on all
-- of them, including "completed" and "check_passed". Every rule
-- lms_complete_lesson enforces, the coverage percentage and the lesson
-- check, could be stepped around with one statement. On the honest route
-- the same learner was told "Watch the whole lesson first. You are at
-- 1.67 percent."
--
-- The row has to exist first and a direct insert is refused, but
-- lms_record_watch creates the row, so one second of playback was the
-- whole entry fee.
--
-- NOTHING NEEDED THAT POLICY. Every write to lms_lesson_progress goes
-- through a security definer function: lms_record_watch,
-- lms_complete_lesson and lms_submit_quiz. Nothing in src/ or api/
-- writes the table directly, which was checked rather than assumed. The
-- comment two lines below the offending policy in file 06 says of the
-- watch record "read your own, but never write one: only
-- lms_record_watch". The progress table was meant to be the same.
--
-- FAULT B: A COURSE CERTIFICATE DID NOT REQUIRE THE COURSE EXAM.
--
-- lms_claim_course_certificate counted quizzes joined through
-- lms_modules, which is MODULE quizzes. File 16 abolished those. So the
-- count was 0 for every modern course, the test read "0 < 0" and passed
-- trivially, and the function never looked at q.course_id at all, which
-- is where a course exam lives. This one is independent of fault A: the
-- exam was optional for an honest learner too.
--
-- FAULT C: THE CERTIFICATE TITLE NEVER FOLLOWED THE COURSE TITLE.
--
-- lms_create_course copies the course title into programmes.title once,
-- at creation, and NOTHING in database/lms has ever updated a programme
-- row again. The certificate prints programmes.title: both
-- src/lib/certificates.ts and the Verify page read programme_title.
--
-- Big Sam's Power BI course was created with the title "power-bi", so
-- every certificate for it would have said "power-bi" however the course
-- was renamed afterwards. Confirmed by renaming a course and watching
-- the programme title stay where it was. Paths have the same fault
-- through certificate_name.
--
-- The title now follows, but ONLY WHILE NO CERTIFICATE HAS BEEN ISSUED
-- for that programme, live or revoked. Once one exists the title stays
-- exactly as it was and the builder says so beside the title field.
-- Rewording certificates that are already in somebody's hands is a
-- decision for a person, not a side effect of an edit.
--
-- The slug never changes, because certificateConfig.ts keys partner
-- logos and templates by it. And only ever a programme row that an
-- Academy course or path points at: never a certification row.
--
-- WHAT IS NOT CHANGED. No learner loses anything. Nobody's existing
-- certificate is touched, reworded or revoked: a certificate already
-- issued stays exactly as it is, because it may be a real person's real
-- achievement and this file cannot tell which. Anybody who claimed one
-- the wrong way is a question for an administrator and the log, not for
-- a migration.
-- =====================================================================

-- -------------------------------------------------------------- step 0
-- Files 01 to 22 first.
do $$
declare v_missing text[] := '{}';
begin
  if to_regprocedure('public.lms_claim_course_certificate(uuid)') is null then
    v_missing := v_missing || 'lms_claim_course_certificate (file 13)'::text;
  end if;
  if to_regclass('public.lms_lesson_progress') is null then
    v_missing := v_missing || 'lms_lesson_progress (file 04)'::text;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'lms_quizzes'
                    and column_name = 'course_id') then
    v_missing := v_missing || 'lms_quizzes.course_id (file 16)'::text;
  end if;
  if to_regprocedure('public.lms_set_course_details(uuid, text, text, lms_level, text, text[], text[], text[], jsonb, text)') is null then
    v_missing := v_missing || 'lms_set_course_details (file 17)'::text;
  end if;
  if to_regprocedure('public.lms_set_path_details(uuid, text, text, text)') is null then
    v_missing := v_missing || 'lms_set_path_details (file 17)'::text;
  end if;
  if to_regclass('public.programmes') is null then
    v_missing := v_missing || 'programmes (the certification system)'::text;
  end if;
  if array_length(v_missing, 1) is not null then
    raise exception 'File 23 cannot run yet. Missing: %', array_to_string(v_missing, ', ');
  end if;
  raise notice 'Step 0: files 01 to 22 are in place.';
end $$;

-- -------------------------------------------------------------- step 1
-- FAULT A. The policy goes, and so do the privileges behind it.
--
-- BOTH HALVES ARE NEEDED. Dropping the policy alone leaves authenticated
-- holding INSERT, UPDATE and DELETE on the table, which is what RLS was
-- the only thing standing in front of. Revoking alone leaves a policy
-- that would come back to life the moment somebody re-granted. So the
-- policy is dropped and the privileges are taken back, and the SELECT
-- policy is left exactly as it was so a learner still sees their own
-- progress.
drop policy if exists p_prog_self_write on lms_lesson_progress;

revoke insert, update, delete on lms_lesson_progress from authenticated;
revoke insert, update, delete on lms_lesson_progress from anon;

-- The same question asked of the two tables beside it, because a fault
-- like this is rarely alone. Both were already SELECT only and these
-- statements change nothing today: they are here so that a later hand
-- re-granting the lot does not quietly reopen all three.
revoke insert, update, delete on lms_watch_buckets from authenticated, anon;
revoke insert, update, delete on lms_quiz_attempts from authenticated, anon;

do $$
declare v_pol integer; v_priv integer;
begin
  select count(*) into v_pol from pg_policy
   where polrelid = to_regclass('public.lms_lesson_progress') and polcmd <> 'r';
  select count(*) into v_priv from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'lms_lesson_progress'
     and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
  raise notice 'Step 1: policies on the progress record that are not read only: %. '
               'Write privileges held by a learner or a visitor: %. Both should be 0.',
               v_pol, v_priv;
end $$;

-- -------------------------------------------------------------- step 2
-- FAULT B. The certificate asks about the course exam.
--
-- The body below is file 13's, with the quiz block corrected and nothing
-- else touched. A test compares it against file 13's copy line by line so
-- the two cannot drift apart in any other way.
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

  -- THE COURSE EXAM, which this used to ignore completely.
  --
  -- It counted quizzes joined through lms_modules, which is MODULE
  -- quizzes. File 16 abolished those, so the count was 0 for every
  -- modern course, the test below read "0 < 0" and passed trivially, and
  -- the function never looked at q.course_id at all, which is where a
  -- course exam lives. The exam was optional for an honest learner too.
  --
  -- A course exam is the quiz owned by the course itself, and there is
  -- at most one: lms_quizzes_one_owner_ck allows exactly one owner per
  -- quiz and lms_ensure_course_exam makes one per course. A course whose
  -- exam is still a draft has nothing to pass, which is the same answer
  -- as before and the right one: a draft exam cannot be sat.
  select count(*) into v_quizzes
    from lms_quizzes q
   where q.course_id = p_course and q.status = 'published';

  select count(distinct q.id) into v_passed
    from lms_quizzes q
    join lms_quiz_attempts a on a.quiz_id = q.id
   where q.course_id = p_course and q.status = 'published'
     and a.user_id = v_uid and a.passed;

  if v_passed < v_quizzes then
    return query select false, null::text,
      'Not finished yet. The course exam is still to pass.'; return;
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

revoke execute on function lms_claim_course_certificate(uuid) from public, anon;
grant execute on function lms_claim_course_certificate(uuid) to authenticated;

-- -------------------------------------------------------------- step 3
-- FAULT C. One rule for when a certificate title may follow.
--
-- Three refusals, and each matters:
--
--   a programme nothing points at is left alone, so a certification row
--   is never touched by this,
--
--   a programme with ANY certificate against it is left alone, live or
--   revoked, because the words are already in somebody's hands,
--
--   an empty title is ignored rather than written, so a save that
--   passes nothing cannot blank a certificate.
--
-- Returning whether it followed lets a caller tell, and lets the tests
-- assert the refusal rather than infer it.
--
-- NOT GRANTED TO ANYBODY. The two save functions reach it as their
-- owner, and a new function is executable by PUBLIC the moment it
-- exists, so public is named first.
create or replace function lms_programme_title_follows(p_programme uuid, p_title text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_issued integer;
begin
  if p_programme is null or coalesce(btrim(p_title), '') = '' then
    return false;
  end if;

  -- Only a programme an Academy course or path points at.
  if not exists (select 1 from lms_courses c where c.programme_id = p_programme)
     and not exists (select 1 from lms_paths p where p.programme_id = p_programme) then
    return false;
  end if;

  -- And only while nothing has been issued against it. A revoked
  -- certificate counts: it was printed, somebody holds the paper, and a
  -- revocation may yet be reversed.
  select count(*) into v_issued from certificates ct where ct.programme_id = p_programme;
  if v_issued > 0 then
    return false;
  end if;

  update programmes set title = btrim(p_title) where id = p_programme;
  return true;
end $$;

revoke execute on function lms_programme_title_follows(uuid, text)
  from public, anon, authenticated;

-- -------------------------------------------------------------- step 4
-- Saving a course's details makes its certificate follow the title.
-- File 17's body with one call added at the end and nothing else
-- touched. A test diffs it against file 17's copy.
create or replace function lms_set_course_details(
  p_course        uuid,
  p_title         text default null,
  p_summary       text default null,
  p_level         lms_level default null,
  p_tool          text default null,
  p_outcomes      text[] default null,
  p_audience      text[] default null,
  p_prerequisites text[] default null,
  p_faq           jsonb default null,
  p_cover_url     text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_may_edit_course(p_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;

  update lms_courses
     set title         = coalesce(nullif(btrim(p_title), ''), title),
         summary       = coalesce(p_summary, summary),
         level         = coalesce(p_level, level),
         tool          = coalesce(p_tool, tool),
         outcomes      = coalesce(p_outcomes, outcomes),
         audience      = coalesce(p_audience, audience),
         prerequisites = coalesce(p_prerequisites, prerequisites),
         faq           = coalesce(p_faq, faq),
         -- An empty string clears the uploaded cover and puts the drawn
         -- one back, which is how the page offers "remove".
         cover_url     = case when p_cover_url is null then cover_url
                              when btrim(p_cover_url) = '' then null
                              else btrim(p_cover_url) end
   where id = p_course;

  -- AND THE CERTIFICATE FOLLOWS THE TITLE, while it still may.
  --
  -- lms_create_course copied the title into programmes.title once, at
  -- creation, and nothing ever updated it again. Big Sam's Power BI
  -- course was created as "power-bi", so every certificate for it would
  -- have printed "power-bi" however the course was renamed afterwards.
  -- The certificate shows programmes.title: certificates.ts and the
  -- Verify page both print programme_title.
  --
  -- The helper refuses once a certificate exists, so this is safe to
  -- call on every save and the decision lives in one place.
  perform lms_programme_title_follows(
    (select c.programme_id from lms_courses c where c.id = p_course),
    (select c.title        from lms_courses c where c.id = p_course));
end $$;

-- -------------------------------------------------------------- step 5
-- And a path's, through its certificate name.
create or replace function lms_set_path_details(
  p_path uuid, p_name text default null,
  p_description text default null, p_certificate_name text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can change a learning path.' using errcode = '42501';
  end if;
  update lms_paths
     set name = coalesce(nullif(btrim(p_name), ''), name),
         description = coalesce(p_description, description),
         certificate_name = coalesce(nullif(btrim(p_certificate_name), ''), certificate_name)
   where id = p_path;

  -- A path's programme is titled with its CERTIFICATE NAME, not its
  -- name, because that is the line printed on the certificate. Same
  -- rule: it follows until a certificate exists, then it stops.
  perform lms_programme_title_follows(
    (select p.programme_id     from lms_paths p where p.id = p_path),
    (select p.certificate_name from lms_paths p where p.id = p_path));
end $$;

-- -------------------------------------------------------------- step 6
-- The builder is told what the certificate says and how many are out,
-- so it can say plainly that renaming will not reword them.
create or replace function lms_studio_course(p_course uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not lms_may_edit_course(p_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'title', c.title, 'summary', c.summary,
    'state', lms_course_state(c.id), 'level', c.level::text,
    'tool', c.tool, 'area', c.area, 'cover_code', c.cover_code,
    'cover_url', c.cover_url,
    'price_kobo', c.price_kobo, 'first_module_free', c.first_module_free,
    'outcomes', to_jsonb(c.outcomes), 'audience', to_jsonb(c.audience),
    'prerequisites', to_jsonb(c.prerequisites), 'faq', c.faq,
    'programme_id', c.programme_id,
    -- WHAT THE CERTIFICATE SAYS, and how many are already out.
    -- The Details page needs both to tell somebody that renaming the
    -- course will not reword certificates already issued.
    'certificate_title', (select pr.title from programmes pr
                           where pr.id = c.programme_id),
    'certificates_issued', (select count(*) from certificates ct
                             where ct.programme_id = c.programme_id),
    'review_note', c.review_note,
    'sent_for_review_at', c.sent_for_review_at,
    'sent_by', (select p.full_name from lms_profiles p where p.id = c.sent_for_review_by),
    'built_by', (select p.full_name from lms_profiles p where p.id = c.created_by),
    'areas', coalesce((
      select jsonb_agg(a.name order by ca.position)
        from lms_course_areas ca join lms_areas a on a.id = ca.area_id
       where ca.course_id = c.id), '[]'::jsonb),
    'next', coalesce((
      select jsonb_agg(n.next_course_id order by n.position)
        from lms_course_next n where n.course_id = c.id), '[]'::jsonb),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'title', m.title, 'position', m.position,
               'lessons', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', l.id, 'title', l.title, 'summary', l.summary,
                          'type', l.type::text, 'position', l.position,
                          'video_provider', l.video_provider, 'video_ref', l.video_ref,
                          'duration_seconds', l.duration_seconds,
                          'chapters_text', l.chapters_text,
                          'chapters', coalesce((
                            select jsonb_agg(jsonb_build_object(
                                     'start_seconds', ch.start_seconds, 'title', ch.title)
                                   order by ch.start_seconds)
                              from lms_lesson_chapters ch where ch.lesson_id = l.id), '[]'::jsonb),
                          -- the lesson check, and how many questions are in it
                          'check_id', (select q.id from lms_quizzes q where q.lesson_id = l.id),
                          'check_status', (select q.status::text from lms_quizzes q where q.lesson_id = l.id),
                          'check_questions', coalesce((
                            select count(*) from lms_questions qq
                              join lms_quizzes q on q.id = qq.quiz_id
                             where q.lesson_id = l.id and qq.active), 0))
                        order by l.position)
                   from lms_lessons l where l.module_id = m.id), '[]'::jsonb))
             order by m.position)
        from lms_modules m where m.course_id = c.id), '[]'::jsonb),
    'exam', (
      select jsonb_build_object(
               'id', q.id, 'status', q.status::text,
               'serve_count', q.serve_count,
               'minutes', q.time_limit_minutes,
               'pass_percent', q.pass_percent,
               'tries', q.max_attempts,
               'bank', (select count(*) from lms_questions qq where qq.quiz_id = q.id and qq.active),
               'needed', ceil(q.serve_count * coalesce(q.bank_multiple, 1.5)))
        from lms_quizzes q where q.course_id = p_course limit 1),
    'checks', (select jsonb_agg(to_jsonb(b)) from lms_publish_checks(p_course) b)
  ) into v_out
  from lms_courses c where c.id = p_course;

  return v_out;
end $$;

revoke execute on function lms_studio_course(uuid) from public, anon;
grant execute on function lms_studio_course(uuid) to authenticated;

-- -------------------------------------------------------------- step 7
-- What this leaves behind, said out loud.
do $$
declare v_exams integer; v_src text;
begin
  select count(*) into v_exams from lms_quizzes q
   where q.course_id is not null and q.status = 'published';
  select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
    into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'lms_claim_course_certificate';
  raise notice 'File 23 done. The claim now asks about the course exam: %. '
               'Published course exams it can ask about: %. No certificate already '
               'issued has been touched. Run 23_verify.sql.',
               case when v_src like '%q.course_id = p_course%' then 'yes' else 'NO' end,
               v_exams;
end $$;
