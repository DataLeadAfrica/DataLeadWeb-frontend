-- =====================================================================
-- FILE 22. The gaps Big Sam found building his first course.
--
-- PASTE 22_gaps_EDITOR.sql, NOT THIS ONE. The two hold the same
-- statements and a test keeps them in step. The plain English is in
-- docs/lms/PHASE-6E-PLAIN.md, and 22_verify.sql checks the result.
--
-- THIS IS THE FIRST OF THREE. Phase 6E was split so a fault in one part
-- cannot hold up the rest:
--
--   file 22, this one   the seven gaps, which are all small and all real
--   file 23             module badges and the path exam, end to end
--   file 24             the lesson video player
--
-- WHAT IS IN HERE. Three database changes. The other four gaps are in
-- the pages and need no SQL, and one of them was already fixed by 6D.
--
--   1. Every course that is not archived gets a draft exam if it has
--      none. Courses made before file 17 have no exam at all, so the
--      Course exam page had no quiz id to work with.
--
--   2. lms_create_path creates the path's programme, as
--      lms_create_course already does for a course, and every existing
--      path without one is given one. Without a programme,
--      lms_claim_path_certificate refuses, so no path certificate could
--      ever be issued.
--
--   3. The certificate tile counts by issued_at, from the first of the
--      month in Lagos time, instead of by completed_on over a rolling
--      seven days. completed_on is when the training ENDED, often weeks
--      before the certificate was issued, so the old number answered a
--      question nobody asked.
--
-- WHAT IS NOT IN HERE. The path exam cannot be written from the control
-- room yet and no path can be published. That is file 23, and it is a
-- bigger piece of work than this one. This file makes the programme
-- right so that file 23 has something to build on, and so that the
-- backfill has already run by the time it matters.
-- =====================================================================

-- -------------------------------------------------------------- step 0
-- Files 01 to 21 first.
do $$
declare v_missing text[] := '{}';
begin
  if to_regprocedure('public.lms_ensure_course_exam(uuid)') is null then
    v_missing := v_missing || 'lms_ensure_course_exam (file 16)'::text;
  end if;
  if to_regprocedure('public.lms_create_path(text, text)') is null then
    v_missing := v_missing || 'lms_create_path (file 17)'::text;
  end if;
  if to_regprocedure('public.lms_studio_certificate_counts()') is null then
    v_missing := v_missing || 'lms_studio_certificate_counts (file 17)'::text;
  end if;
  if to_regprocedure('public.lms_studio_overview()') is null then
    v_missing := v_missing || 'lms_studio_overview (file 17, changed by file 19)'::text;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'lms_paths'
                    and column_name = 'programme_id') then
    v_missing := v_missing || 'lms_paths.programme_id (file 16)'::text;
  end if;
  if array_length(v_missing, 1) is not null then
    raise exception 'File 22 cannot run yet. Missing: %', array_to_string(v_missing, ', ');
  end if;
  raise notice 'Step 0: files 01 to 21 are in place.';
end $$;

-- -------------------------------------------------------------- step 1
-- A DRAFT EXAM FOR EVERY COURSE THAT HAS NONE.
--
-- Courses made before file 17 never got one. The Course exam page takes
-- its quiz id from the course's exam, found nothing, and sent an empty
-- string, so writing a question answered "invalid input syntax for type
-- uuid". Big Sam's Phase 4 test course is one of these. The 6D guard on
-- the Questions page already stops the empty string reaching the
-- database and says so in words instead, and this is the other half:
-- giving the course the exam it should have had.
--
-- THE NUMBERS ARE NOT TYPED HERE TWICE. 70 per cent, 2 tries, 20 served
-- of a bank of 1.5 times that, a day's wait, shuffled, 40 minutes: they
-- live in lms_ensure_course_exam and this copies them because it cannot
-- call it. That function guards itself with lms_is_staff(), which asks
-- auth.uid() who you are, and in the SQL editor there is no signed in
-- caller at all, so calling it would raise "Only staff can set up an
-- exam." A test checks the two agree, so a change to the function's
-- numbers cannot leave this line behind.
--
-- SAFE TWICE. The insert is guarded by "has no exam", so a second run
-- inserts nothing. Archived courses are left alone: nobody is going to
-- sit their exam, and giving them one would put them back in the way of
-- every report that counts drafts.
do $$
declare v_made integer;
begin
  with wanted as (
    select c.id
      from lms_courses c
     where c.status <> 'archived'
       and not exists (select 1 from lms_quizzes q where q.course_id = c.id)
  )
  insert into lms_quizzes (course_id, title, pass_percent, max_attempts, serve_count,
                           retake_after_minutes, shuffle, status, time_limit_minutes,
                           bank_multiple)
  select w.id, 'Course exam', 70, 2, 20, 1440, true, 'draft', 40, 1.5
    from wanted w;
  get diagnostics v_made = row_count;

  if v_made = 0 then
    raise notice 'Step 1: every course that is not archived already had an exam.';
  else
    raise notice 'Step 1: % course(s) that had no exam now have a draft one. '
                 'Each still needs its questions written before it can be published.', v_made;
  end if;
end $$;

-- -------------------------------------------------------------- step 2
-- A PROGRAMME NAME THAT IS FREE EVERYWHERE, NOT JUST IN OUR OWN TABLE.
--
-- THE FAULT THIS FIXES, which lms_create_course has carried since file
-- 17 and lms_create_path inherited. Both made the programme slug from
-- the title and checked it against their own table only, never against
-- programmes. The certification system's programmes predate the Academy
-- and nothing in the Academy knew they were there.
--
-- The review proved it: a certification programme with slug
-- 'digital-marketing-web-design' and code DMWD was put in programmes,
-- then lms_create_path('Digital Marketing Web Design') succeeded, and
-- programmes held two rows with that slug.
--
-- WHY THAT IS NOT COSMETIC. src/lib/certificateConfig.ts keys partner
-- logos and certificate templates BY PROGRAMME SLUG. So on live it is
-- one of two things and neither is acceptable: if there is a unique rule
-- on programmes.slug the path cannot be created at all and step 3 of
-- this file stops dead, and if there is not, an Academy path certificate
-- quietly borrows a bootcamp's logos. The code matters the same way,
-- because make_certificate_number is handed the code and the number goes
-- on the certificate.
--
-- It is a live risk for the path Big Sam most wants. The backfill gives
-- the "Data Analytics" path a programme with slug data-analytics, and
-- the Courses page sells a Data Analytics bootcamp, so a certification
-- programme with that slug is likely. This fix does not depend on what
-- happens to be there today.
--
-- WHAT IT DOES. One helper, used by all three places that make a
-- programme: lms_create_course, lms_create_path and the backfill in step
-- 4. A slug free in programmes AND in the Academy's own table, and a
-- code free in programmes, with -2, -3 and so on as the slug already
-- did.
--
-- INSERTS ONLY. Nothing here reads a certification row to change it,
-- renames one, or reuses one. An existing programme is left exactly as
-- it is and the Academy moves out of its way instead.
--
-- NOT GRANTED TO ANYBODY. It is reached only by the three security
-- definer functions that call it, which run as their owner. A new
-- function is executable by PUBLIC the moment it exists, so public is
-- named first, and 21_verify row 8 would go NO if this were left open.
create or replace function lms_free_programme_identity(p_title text, p_for text)
returns table (out_slug text, out_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_base  text;
  v_slug  text;
  v_cbase text;
  v_code  text;
  v_n     integer;
begin
  if p_for not in ('course', 'path') then
    raise exception 'lms_free_programme_identity expects course or path, not %', p_for
      using errcode = '22023';
  end if;

  v_base := btrim(regexp_replace(lower(btrim(coalesce(p_title, ''))),
                                 '[^a-z0-9]+', '-', 'g'), '-');
  if v_base = '' then v_base := p_for; end if;

  -- THE SLUG. Free in programmes, and free in whichever Academy table
  -- this is for. A course and a path may still share a slug with each
  -- other, exactly as before: they are separate addresses in separate
  -- tables and changing that is a different decision.
  v_slug := v_base;
  v_n := 1;
  loop
    exit when not exists (select 1 from programmes pr where pr.slug = v_slug)
          and (p_for <> 'course'
               or not exists (select 1 from lms_courses c where c.slug = v_slug))
          and (p_for <> 'path'
               or not exists (select 1 from lms_paths p where p.slug = v_slug));
    v_n := v_n + 1;
    if v_n > 500 then
      raise exception 'Could not find a free programme slug near %', v_base
        using errcode = '22023';
    end if;
    v_slug := v_base || '-' || v_n;
  end loop;

  -- THE CODE. Derived from the slug as it always was, then moved along
  -- until it is free in programmes.
  --
  -- The number is appended with no dash and the stem is shortened to
  -- make room, so the code stays twelve characters. The code goes into
  -- make_certificate_number, which builds CODE-YEAR-MODULE-RANDOM, and a
  -- dash inside the code would put a fifth part in a number that is read
  -- by people and split by eye.
  v_cbase := upper(left(regexp_replace(v_slug, '[^a-z0-9]', '', 'g'), 12));
  if v_cbase = '' then v_cbase := upper(p_for); end if;
  v_code := v_cbase;
  v_n := 1;
  loop
    exit when not exists (select 1 from programmes pr where pr.code = v_code);
    v_n := v_n + 1;
    if v_n > 500 then
      raise exception 'Could not find a free programme code near %', v_cbase
        using errcode = '22023';
    end if;
    v_code := left(v_cbase, greatest(1, 12 - length(v_n::text))) || v_n::text;
  end loop;

  return query select v_slug, v_code;
end $$;

revoke execute on function lms_free_programme_identity(text, text)
  from public, anon, authenticated;

do $$
declare v_dup integer;
begin
  select count(*) into v_dup from (
    select slug from programmes group by slug having count(*) > 1
    union all
    select code from programmes group by code having count(*) > 1
  ) d;
  raise notice 'Step 2: the programme name helper is in place. Programme slugs or '
               'codes already shared by more than one row: %. This file never '
               'changes an existing programme, so any already there stay and '
               '22_verify row 15 names them.', v_dup;
end $$;

-- -------------------------------------------------------------- step 3
-- EVERY PATH GETS A PROGRAMME, AND NEW ONES GET ONE WHEN THEY ARE MADE.
--
-- lms_create_course has always inserted a programme and pointed the
-- course at it. lms_create_path never did, so lms_claim_path_certificate
-- answered "This path has no programme attached, so no Professional
-- Certificate can be issued for it yet." No path certificate could ever
-- be issued, however much work a learner did.
--
-- The programme's title is the path's CERTIFICATE NAME, not its name,
-- because the programme title is what a certificate is issued against
-- and what somebody reads on it. A path called "Data Analytics" carries
-- "Professional Certificate in Data Analytics", and that is the line
-- that belongs on the certificate.
--
-- The code is derived exactly as lms_create_course derives it. Two
-- programmes CAN end up with the same code, because a path and a course
-- may share a slug: the two slug columns are in different tables and
-- neither knows about the other. That is already true between courses
-- and it is harmless, because make_certificate_number ends every number
-- with six random characters and the unique rule is on the number.
create or replace function lms_create_path(p_name text, p_certificate_name text default '')
returns uuid language plpgsql security definer set search_path = public as
$$
declare
  v_id    uuid;
  v_slug  text;
  v_code  text;
  v_cert  text;
  v_prog  uuid;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can create a learning path.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'A path needs a name.' using errcode = '22023';
  end if;

  -- The slug and the code together, from the helper in step 2, so
  -- neither can land on a certification programme's.
  select h.out_slug, h.out_code into v_slug, v_code
    from lms_free_programme_identity(p_name, 'path') h;

  v_cert := coalesce(nullif(btrim(p_certificate_name), ''),
                     'Professional Certificate in ' || btrim(p_name));

  -- The programme, as file 13 arranged it and as lms_create_course
  -- does. Only ever an insert: nothing here updates or deletes a row
  -- the certificate system owns.
  insert into programmes (slug, title, code, active)
  values (v_slug, v_cert, v_code, true)
  returning id into v_prog;

  insert into lms_paths (slug, name, status, certificate_name, programme_id)
  values (v_slug, btrim(p_name), 'draft', v_cert, v_prog)
  returning id into v_id;

  perform lms_ensure_path_exam(v_id);
  perform lms_log_action('path_created', 'path', v_id,
    jsonb_build_object('name', btrim(p_name), 'programme', v_prog));
  return v_id;
end $$;

-- SAFE TWICE, because it only touches a path whose programme_id is
-- null. A path that already has one is left exactly as it is, including
-- one joined by hand.
do $$
declare
  r       record;
  v_prog  uuid;
  v_pslug text;
  v_pcode text;
  v_done  integer := 0;
begin
  for r in
    select p.id, p.slug, p.name, p.certificate_name
      from lms_paths p
     where p.programme_id is null
     order by p.slug
  loop
    -- THE SAME HELPER, so a path whose slug a bootcamp already holds
    -- gets a programme of its own rather than a second row with that
    -- slug. The path's own slug stays exactly as it is: it is an
    -- address a learner may already have, and only the PROGRAMME moves
    -- out of the way.
    select h.out_slug, h.out_code into v_pslug, v_pcode
      from lms_free_programme_identity(r.name, 'path') h;

    insert into programmes (slug, title, code, active)
    values (v_pslug,
            coalesce(nullif(btrim(r.certificate_name), ''),
                     'Professional Certificate in ' || r.name),
            v_pcode, true)
    returning id into v_prog;

    update lms_paths set programme_id = v_prog where id = r.id;
    v_done := v_done + 1;
  end loop;

  if v_done = 0 then
    raise notice 'Step 3: every path already had a programme.';
  else
    raise notice 'Step 3: % path(s) without a programme now have one, so a path '
                 'certificate can be issued once file 23 lets the exam be written.', v_done;
  end if;
end $$;

-- -------------------------------------------------------------- step 4
-- AND A COURSE, WHICH HAS HAD THE SAME FAULT SINCE FILE 17.
--
-- lms_create_course has always inserted a programme, and has always
-- checked the slug against lms_courses only. So a course called "Data
-- Analytics" would take the slug data-analytics in programmes even if a
-- bootcamp already held it, with the same two consequences as a path:
-- either a duplicate key error on live, or a certificate quietly
-- borrowing another programme's partner logos.
--
-- The body below is file 17's with the slug and code block replaced and
-- nothing else touched. A test compares it against file 17's copy so the
-- two cannot drift apart in any other way.
--
-- create or replace, not drop, so the grants survive.
create or replace function lms_create_course(
  p_title text,
  p_area  text default '',
  p_tool  text default '',
  p_level lms_level default 'Beginner'
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  v_slug  text;
  v_code  text;
  v_prog  uuid;
  v_area  uuid;
begin
  if not lms_is_staff() then
    raise exception 'Only staff can create a course.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'A course needs a title.' using errcode = '22023';
  end if;

  -- The slug and the code, from the helper in step 2.
  --
  -- THIS IS THE ONLY CHANGE TO THIS FUNCTION. It used to make the slug
  -- from the title and check it against lms_courses alone, so a course
  -- could take a certification programme's slug and code, and had been
  -- able to since file 17. The helper checks programmes as well. A slug
  -- is still an address derived from the title rather than typed, for
  -- the same reason as before: a typed one is a typo waiting to be
  -- published.
  select h.out_slug, h.out_code into v_slug, v_code
    from lms_free_programme_identity(p_title, 'course') h;

  -- The programme, exactly as file 13 arranged it. Nothing else in
  -- this file touches the certification tables, and this one only
  -- inserts: it never updates or deletes a row the certificate system
  -- owns.
  insert into programmes (slug, title, code, active)
  values (v_slug, btrim(p_title), v_code, true)
  returning id into v_prog;

  insert into lms_courses (slug, title, tool, area, level, status, created_by, programme_id)
  values (v_slug, btrim(p_title), coalesce(btrim(p_tool), ''), coalesce(btrim(p_area), ''),
          p_level, 'draft', auth.uid(), v_prog)
  returning id into v_id;

  -- The main area, if one was named, through the file 16 table so the
  -- trigger fills lms_courses.area to match.
  if coalesce(btrim(p_area), '') <> '' then
    select a.id into v_area from lms_areas a where a.name = btrim(p_area);
    if v_area is not null then
      insert into lms_course_areas (course_id, area_id, position)
      values (v_id, v_area, 1)
      on conflict do nothing;
    end if;
  end if;

  insert into lms_modules (course_id, title, position)
  values (v_id, 'Module 1', 1);

  -- File 16's function, not a second copy of the numbers. 20 of a bank
  -- of 30, 40 minutes, 70 per cent, two tries then a day: those live in
  -- lms_ensure_course_exam and nowhere else, so changing them is one
  -- edit rather than a hunt.
  perform lms_ensure_course_exam(v_id);

  perform lms_log_action('course_created', 'course', v_id,
    jsonb_build_object('title', btrim(p_title), 'slug', v_slug));

  return v_id;
end $$;

revoke execute on function lms_create_course(text, text, text, lms_level) from public, anon;
grant execute on function lms_create_course(text, text, text, lms_level) to authenticated;

-- -------------------------------------------------------------- step 5
-- THE CERTIFICATE TILE COUNTS THE RIGHT COLUMN, OVER THE RIGHT WINDOW.
--
-- It counted certificates.completed_on over a rolling seven days.
-- completed_on is the day the TRAINING ended, which is often weeks
-- before anybody issued the certificate, so the tile was not answering
-- "how many certificates went out recently" and was not answering
-- anything else either. Big Sam wants this calendar month, by when the
-- certificate was issued.
--
-- THE MONTH IS A LAGOS MONTH. date_trunc on a Lagos wall clock, turned
-- back into an instant, so the tile rolls over at midnight in Abuja and
-- not at one in the morning. The server runs on UTC, where the two are
-- an hour apart, and on the first of the month that hour is the whole
-- difference between a tile that reads 0 and one that reads correctly.
--
-- THE OTHER THREE TILES ARE UNCHANGED AND ARE ALL A ROLLING SEVEN DAYS,
-- not a calendar week. None of them is wrong, they were just labelled as
-- though the week meant something. The pages now say "7 days" on each.
-- The changelog lists all four.
--
-- DROPPED AND REMADE, not replaced. The returned column was called
-- this_week and is now this_month, and Postgres will not let create or
-- replace change a function's return type. The grants go with the old
-- function when it is dropped and a new function is executable by
-- PUBLIC, so they are restated below. That is the file 21 lesson and it
-- applies here for the same reason.
drop function if exists lms_studio_certificate_counts();

create or replace function lms_studio_certificate_counts()
returns table (all_time integer, this_month integer, revoked integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can see certificate counts.' using errcode = '42501';
  end if;
  return query
  select count(*)::integer,
         count(*) filter (
           where ct.issued_at >= (date_trunc('month', now() at time zone 'Africa/Lagos'))
                                 at time zone 'Africa/Lagos'
         )::integer,
         count(*) filter (where ct.revoked)::integer
    from certificates ct;
end $$;

revoke execute on function lms_studio_certificate_counts() from public, anon;
grant execute on function lms_studio_certificate_counts() to authenticated;

-- And the same tile on the Overview. This function is created by file 17
-- and rewritten by file 19, so this is its third and current form: the
-- body below is file 19's, with the one certificates line changed. A
-- test compares it against file 19's copy line by line so the two cannot
-- drift apart in any other way.
--
-- create or replace, not drop: the shape of what it returns has not
-- changed, so the grants survive. Restated anyway, because a reader
-- should not have to know which of the two rules applies.
create or replace function lms_studio_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
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
end $$;

revoke execute on function lms_studio_overview() from public, anon;
grant execute on function lms_studio_overview() to authenticated;

-- -------------------------------------------------------------- step 6
-- ARCHIVING A COURSE, WITH A REASON, AND A WAY BACK.
--
-- lms_archive_course has existed since file 17 and nothing has ever
-- called it, so Big Sam archived a test course by writing SQL by hand.
-- The wrapper in src/lib/studio.ts was there all along: what was missing
-- was any button, and two things the function itself needed.
--
--   IT TOOK NO REASON. It logged 'course_archived' with an empty detail,
--   so the log said a course was archived and never why.
--
--   IT WOULD ARCHIVE A PUBLISHED COURSE. A learner part way through
--   would have had it vanish underneath them. Unpublishing first is a
--   separate, deliberate act, and it already has its own function with
--   its own blockers, so this one now refuses and says so.
--
-- AND THERE WAS NO WAY BACK. Nothing turned an archived course into a
-- draft again, so an archive was final in practice even though the row
-- was still there. lms_restore_course is the other half, and it restores
-- to DRAFT rather than to published: coming back into view is a staff
-- decision and republishing is another one, with the publish checklist
-- in between.
--
-- NEVER A DELETE, in either direction. Somebody may hold a certificate
-- for the course.
--
-- Dropped and remade because the reason is a new argument and leaving
-- the old one in place would make two functions of the same name, which
-- lms_unpublish_course already suffers from. The grants go with the
-- dropped function, so they are restated.
drop function if exists lms_archive_course(uuid);

create or replace function lms_archive_course(p_course uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status lms_status; v_title text;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can archive a course.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Archiving a course needs a reason, so the log says why.'
      using errcode = '22023';
  end if;

  select c.status, c.title into v_status, v_title from lms_courses c where c.id = p_course;
  if v_status is null then
    raise exception 'No such course.' using errcode = '22023';
  end if;
  if v_status = 'published' then
    raise exception 'This course is live. Unpublish it first, then archive it: a learner part '
                    'way through should not have it disappear underneath them.'
      using errcode = '22023';
  end if;
  if v_status = 'archived' then
    return;   -- already there, and saying so twice is not an error
  end if;

  -- Archived, never deleted. Somebody holds a certificate for it.
  update lms_courses set status = 'archived' where id = p_course;
  perform lms_log_action('course_archived', 'course', p_course,
    jsonb_build_object('reason', btrim(p_reason), 'was', v_status::text, 'title', v_title));
end $$;

revoke execute on function lms_archive_course(uuid, text) from public, anon;
grant execute on function lms_archive_course(uuid, text) to authenticated;

create or replace function lms_restore_course(p_course uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status lms_status; v_title text;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can bring a course back.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Bringing a course back needs a reason, so the log says why.'
      using errcode = '22023';
  end if;

  select c.status, c.title into v_status, v_title from lms_courses c where c.id = p_course;
  if v_status is null then
    raise exception 'No such course.' using errcode = '22023';
  end if;
  if v_status <> 'archived' then
    raise exception 'This course is not archived, so there is nothing to bring back.'
      using errcode = '22023';
  end if;

  -- BACK TO DRAFT, never straight to published. Coming into view again
  -- is one decision and going live is another, with the publish
  -- checklist standing between them.
  update lms_courses set status = 'draft' where id = p_course;
  perform lms_log_action('course_restored', 'course', p_course,
    jsonb_build_object('reason', btrim(p_reason), 'title', v_title));
end $$;

revoke execute on function lms_restore_course(uuid, text) from public, anon;
grant execute on function lms_restore_course(uuid, text) to authenticated;

-- -------------------------------------------------------------- step 7
-- What this leaves behind, said out loud.
do $$
declare v_noexam integer; v_noprog integer; v_month integer;
begin
  select count(*) into v_noexam from lms_courses c
   where c.status <> 'archived'
     and not exists (select 1 from lms_quizzes q where q.course_id = c.id);
  select count(*) into v_noprog from lms_paths p where p.programme_id is null;
  select count(*) into v_month from certificates ct
   where ct.issued_at >= (date_trunc('month', now() at time zone 'Africa/Lagos'))
                         at time zone 'Africa/Lagos';
  raise notice 'File 22 done. Courses with no exam: % (should be 0). Paths with no '
               'programme: % (should be 0). Certificates issued this month in Lagos '
               'time: %, which is what the tile will now show. Run 22_verify.sql.',
               v_noexam, v_noprog, v_month;
end $$;
