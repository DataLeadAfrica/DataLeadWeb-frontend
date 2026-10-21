-- Undoes file 22. PASTE 22_undo_EDITOR.sql, NOT THIS ONE.
--
-- IT REFUSES UNLESS YOU SAY YOU MEAN IT, like the undos for 19, 20 and
-- 21, because two of the three things it puts back were faults rather
-- than choices.
--
-- Running this restores:
--
--   lms_create_path WITHOUT a programme, so the next path made cannot
--   ever issue a certificate. That is the fault, not a preference.
--
--   The certificate tile counting completed_on over a rolling seven
--   days. completed_on is the day the training ENDED, so the tile goes
--   back to answering a question nobody asked.
--
--   lms_studio_overview as file 19 left it, with the same tile.
--
-- WHAT IS KEPT, DELIBERATELY:
--
--   THE DRAFT EXAMS from step 1 stay. By the time anybody undoes this,
--   somebody may have written questions into one, and throwing a
--   facilitator's work away to undo a count is not a trade worth making.
--   A draft exam with an empty bank cannot be sat and cannot be
--   published, so leaving it costs nothing.
--
--   THE PATH PROGRAMMES from step 2 stay. A programme is a certificate
--   system row, and a certificate may already point at one. Deleting it
--   would orphan a real person's certificate, and nothing a learner has
--   touched gets hard deleted.
--
-- So this undo is about the three function definitions and nothing else.
-- The data it created is harmless and stays.

do $$
begin
  if coalesce(current_setting('lms.undo_22_force', true), '') <> 'yes, I mean it' then
    raise exception
      'This undo restores a lms_create_path that makes paths which can never issue a '
      'certificate, and a certificate tile that counts the wrong column over the wrong '
      'window. If you mean it, paste this line at the top of this file, above the begin, '
      'and run the whole thing in one go, ending that line with a semicolon: '
      'select set_config(''lms.undo_22_force'', ''yes, I mean it'', false)';
  end if;
end $$;

begin;

-- ------------------------------------------------------------ step 1 of 6
-- lms_create_path, as file 17 wrote it, with no programme.
create or replace function lms_create_path(p_name text, p_certificate_name text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_slug text; v_n integer := 1;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can create a learning path.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'A path needs a name.' using errcode = '22023';
  end if;

  v_slug := btrim(regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'), '-');
  if v_slug = '' then v_slug := 'path'; end if;
  while exists (select 1 from lms_paths p where p.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := btrim(regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'), '-') || '-' || v_n;
  end loop;

  insert into lms_paths (slug, name, status, certificate_name)
  values (v_slug, btrim(p_name), 'draft',
          coalesce(nullif(btrim(p_certificate_name), ''), 'Professional Certificate in ' || btrim(p_name)))
  returning id into v_id;

  perform lms_ensure_path_exam(v_id);
  perform lms_log_action('path_created', 'path', v_id, jsonb_build_object('name', btrim(p_name)));
  return v_id;
end $$;

-- ------------------------------------------------------------ step 2 of 6
-- The certificate counts, back to completed_on over seven days. Dropped
-- first, because the returned column goes from this_month to this_week
-- and a return type cannot be changed in place. The grants go with the
-- dropped function, so they are restated after it.
drop function if exists lms_studio_certificate_counts();

create or replace function lms_studio_certificate_counts()
returns table (all_time integer, this_week integer, revoked integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can see certificate counts.' using errcode = '42501';
  end if;
  return query
  select count(*)::integer,
         count(*) filter (where ct.completed_on >= current_date - 7)::integer,
         count(*) filter (where ct.revoked)::integer
    from certificates ct;
end $$;

revoke execute on function lms_studio_certificate_counts() from public, anon;
grant execute on function lms_studio_certificate_counts() to authenticated;

-- ------------------------------------------------------------ step 3 of 6
-- The Overview, as file 19 left it.
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
      'certificates', (select count(*) from certificates ct where ct.completed_on >= current_date - 7)
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

-- ------------------------------------------------------------ step 4 of 6
-- Archiving, back to the version that asks for no reason, and the way
-- back removed. Both are dropped first because the arguments change.
--
-- lms_restore_course is dropped rather than restored, because file 22
-- invented it and there is no earlier version to go back to. Any course
-- already brought back to draft STAYS a draft: that is a status a course
-- is allowed to be, and re-archiving somebody's course to tidy up after
-- an undo would be a worse thing to do than leaving it.
drop function if exists lms_archive_course(uuid, text);
drop function if exists lms_restore_course(uuid, text);

create or replace function lms_archive_course(p_course uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can archive a course.' using errcode = '42501';
  end if;
  -- Archived, never deleted. Somebody holds a certificate for it.
  update lms_courses set status = 'archived' where id = p_course;
  perform lms_log_action('course_archived', 'course', p_course, '{}'::jsonb);
end $$;

revoke execute on function lms_archive_course(uuid) from public, anon;
grant execute on function lms_archive_course(uuid) to authenticated;

-- ------------------------------------------------------------ step 5 of 6
-- lms_create_course, as file 17 wrote it, making its own slug and code
-- and checking neither against programmes.
--
-- READ THIS BEFORE RUNNING IT. That is the fault, not a preference. A
-- course created afterwards can take a certification programme's slug
-- and code, and certificateConfig.ts keys partner logos and certificate
-- templates by programme slug.
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
  v_n     integer := 1;
  v_prog  uuid;
  v_area  uuid;
begin
  if not lms_is_staff() then
    raise exception 'Only staff can create a course.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'A course needs a title.' using errcode = '22023';
  end if;

  -- The slug, from the title, with a number on the end if that is taken.
  -- Done here rather than typed, because a slug is an address and a
  -- typed one is a typo waiting to be published.
  v_slug := regexp_replace(lower(btrim(p_title)), '[^a-z0-9]+', '-', 'g');
  v_slug := btrim(v_slug, '-');
  if v_slug = '' then v_slug := 'course'; end if;
  while exists (select 1 from lms_courses c where c.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := regexp_replace(lower(btrim(p_title)), '[^a-z0-9]+', '-', 'g');
    v_slug := btrim(v_slug, '-') || '-' || v_n;
  end loop;

  -- The programme, exactly as file 13 arranged it. Nothing else in
  -- this file touches the certification tables, and this one only
  -- inserts: it never updates or deletes a row the certificate system
  -- owns.
  insert into programmes (slug, title, code, active)
  values (v_slug, btrim(p_title),
          upper(left(regexp_replace(v_slug, '[^a-z0-9]', '', 'g'), 12)), true)
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

-- ------------------------------------------------------------ step 6 of 6
-- And the helper goes, since nothing calls it any more.
--
-- The programmes it already made are KEPT, slug, code and all. A
-- programme may already have a certificate pointing at it, and renaming
-- or deleting one to undo a migration would orphan a real person's
-- certificate. Nothing a learner has touched gets hard deleted.
drop function if exists lms_free_programme_identity(text, text);

do $$
declare v_noprog integer;
begin
  select count(*) into v_noprog from lms_paths p where p.programme_id is null;
  raise notice 'File 22 undone. The three functions are back as files 17 and 19 '
               'left them. The draft exams and the path programmes are KEPT on '
               'purpose, so paths with no programme: % (the backfill is not '
               'reversed). 22_verify.sql will now say NO on rows 4 to 9, 11 to 14, 16 and 17. '
               'Re-run 22_gaps.sql to put them back.', v_noprog;
end $$;

commit;
