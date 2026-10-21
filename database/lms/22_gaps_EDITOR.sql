-- GENERATED. Do not edit.
--
-- Made by scripts/lms/make-editor-sql.mjs from the file named below.
-- The comments between the function bodies are removed. Every body is
-- byte for byte what that file holds, and a test checks it.
--
-- Paste THIS one into the Supabase SQL Editor.
--
-- source: database/lms/22_gaps.sql
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
