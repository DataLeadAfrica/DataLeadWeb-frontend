-- GENERATED. Do not edit.
--
-- Made by scripts/lms/make-editor-sql.mjs from the file named below.
-- The comments between the function bodies are removed. Every body is
-- byte for byte what that file holds, and a test checks it.
--
-- Paste THIS one into the Supabase SQL Editor.
--
-- source: database/lms/22_undo.sql
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
