-- GENERATED. Do not edit.
--
-- Made by scripts/lms/make-editor-sql.mjs from the file named below.
-- The comments between the function bodies are removed. Every body is
-- byte for byte what that file holds, and a test checks it.
--
-- Paste THIS one into the Supabase SQL Editor.
--
-- source: database/lms/23_undo.sql
do $$
begin
  if coalesce(current_setting('lms.undo_23_force', true), '') <> 'yes, I mean it' then
    raise exception
      'This undo lets a learner issue themselves a certificate. It restores the policy '
      'that let them mark their own lessons complete, and the claim that never asked '
      'about the course exam. Together those two were measured issuing a real '
      'certificate number to somebody who watched one second of each lesson. If you '
      'mean it, paste this line at the top of this file, above the begin, and run the '
      'whole thing in one go, ending that line with a semicolon: '
      'select set_config(''lms.undo_23_force'', ''yes, I mean it'', false)';
  end if;
end $$;

begin;

drop policy if exists p_prog_self_write on lms_lesson_progress;
create policy p_prog_self_write on lms_lesson_progress
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant insert, update, delete on lms_lesson_progress to authenticated;

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

revoke execute on function lms_claim_course_certificate(uuid) from public, anon;
grant execute on function lms_claim_course_certificate(uuid) to authenticated;

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
end $$;

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
end $$;

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

drop function if exists lms_programme_title_follows(uuid, text);

do $$
declare v_open integer;
begin
  select count(*) into v_open from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'lms_lesson_progress'
     and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
  raise notice 'File 23 undone. Write privileges on the progress record handed back: %. '
               'A learner can mark their own lessons complete again, and a certificate '
               'no longer requires the exam. 23_verify.sql will say NO on rows 1 to 6. '
               'Programme titles that already followed are KEPT, because they are '
               'right. Re-run 23_certificate_integrity.sql to shut it.', v_open;
end $$;

commit;
