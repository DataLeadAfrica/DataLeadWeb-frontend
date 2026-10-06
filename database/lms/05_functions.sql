-- =====================================================================
-- 005  THE RULES
--
-- Anything a learner could cheat by editing their browser lives here,
-- as a SECURITY DEFINER function, and nowhere else:
--   who may open a course, whether a lesson is unlocked, how much of a
--   video was really watched, and what a quiz answer scores.
-- =====================================================================

-- ---------------------------------------------------------------- access
create or replace function lms_has_course_access(p_course uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from lms_entitlements e
     where e.user_id = auth.uid()
       and e.status = 'active'
       and (e.expires_at is null or e.expires_at > now())
       and (e.course_id is null or e.course_id = p_course)
  )
$$;

-- A free course, or the first module of a course that offers a free
-- first module, is open to any signed-in person.
create or replace function lms_lesson_is_open(p_lesson uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  with l as (
    select le.id, m.position as mpos, c.id as cid, c.price_kobo,
           c.first_module_free, c.status
      from lms_lessons le
      join lms_modules m on m.id = le.module_id
      join lms_courses c on c.id = m.course_id
     where le.id = p_lesson
  )
  select coalesce((
    select (l.status = 'published')
       and ( l.price_kobo = 0
          or (l.first_module_free and l.mpos = 1)
          or lms_has_course_access(l.cid) )
    from l), false)
$$;

-- ---------------------------------------------------------------- sign up
-- Runs when Supabase creates the account. It makes the profile, links
-- the person to their existing certification record IF their email is
-- already verified, and opens every free course.
create or replace function lms_handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_part uuid;
begin
  insert into lms_profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  if new.email_confirmed_at is not null then
    perform lms_link_participant(new.id, new.email);
  end if;

  perform lms_grant_free_courses(new.id);
  return new;
end $$;

-- Linking is only ever done on a PROVEN address. Doing it on a typed
-- one would let anybody claim somebody else's certificates.
create or replace function lms_link_participant(p_user uuid, p_email text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_part uuid; v_norm text := lower(btrim(coalesce(p_email,'')));
begin
  if v_norm = '' then return false; end if;
  if exists (select 1 from lms_profiles where id = p_user and participant_id is not null)
    then return true; end if;

  select p.id into v_part from participants p where p.email_norm = v_norm limit 1;
  if v_part is null then return false; end if;
  -- never steal a participant already linked to another account
  if exists (select 1 from lms_profiles where participant_id = v_part) then return false; end if;

  update lms_profiles
     set participant_id = v_part, linked_at = now()
   where id = p_user;
  return true;
end $$;

create or replace function lms_grant_free_courses(p_user uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer := 0;
begin
  insert into lms_entitlements (user_id, course_id, source)
  select p_user, c.id, 'free'
    from lms_courses c
   where c.status = 'published' and c.price_kobo = 0
     and not exists (
       select 1 from lms_entitlements e
        where e.user_id = p_user and e.course_id = c.id and e.status = 'active');
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Called by the signed-in person. Opens the whole catalogue if their
-- verified email belongs to a participant with an active enrolment.
create or replace function lms_claim_bootcamp_access()
returns table (granted boolean, message text)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text; v_part uuid; v_ends date;
begin
  if v_uid is null then
    return query select false, 'Please sign in first.'; return;
  end if;
  select email, email_confirmed_at into v_email, v_ends
    from auth.users where id = v_uid;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    return query select false, 'Please confirm your email address first.'; return;
  end if;

  perform lms_link_participant(v_uid, v_email);
  select participant_id into v_part from lms_profiles where id = v_uid;
  if v_part is null then
    return query select false, 'We could not find a bootcamp enrolment for this email address.'; return;
  end if;

  select max(e.ends_on) into v_ends
    from participant_enrolments e
   where e.participant_id = v_part and e.status = 'active';

  if not exists (select 1 from participant_enrolments e
                  where e.participant_id = v_part and e.status = 'active') then
    return query select false, 'That enrolment is not active.'; return;
  end if;

  insert into lms_entitlements (user_id, course_id, source, expires_at)
  values (v_uid, null, 'roster',
          case when v_ends is null then null else (v_ends + 1)::timestamptz end)
  on conflict do nothing;

  return query select true, 'Your bootcamp access is open. Every course is available to you.';
end $$;

-- ---------------------------------------------------------------- watching
-- The only way a bucket is ever written. Rejects buckets outside the
-- video, and rejects a flood of calls that could fake a full watch.
create or replace function lms_record_watch(p_lesson uuid, p_bucket integer, p_position integer default null)
returns table (coverage numeric, unlocked boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_dur integer; v_bs integer; v_need integer; v_total integer; v_have integer;
  v_recent integer;
begin
  if v_uid is null then return; end if;
  if not lms_lesson_is_open(p_lesson) then return; end if;

  select duration_seconds, bucket_seconds, coverage_percent
    into v_dur, v_bs, v_need
    from lms_lessons where id = p_lesson;
  if v_dur is null then return; end if;

  v_total := greatest(1, ceil(v_dur::numeric / v_bs)::int);
  if p_bucket < 0 or p_bucket >= v_total then return; end if;

  -- A real player sends about one bucket per bucket_seconds. Many more
  -- than that in the last minute is a script, so stop recording.
  select count(*) into v_recent
    from lms_watch_buckets
   where user_id = v_uid and lesson_id = p_lesson
     and first_seen_at > now() - interval '1 minute';
  if v_recent > (60 / v_bs) + 3 then
    return query select
      round(100.0 * (select count(*) from lms_watch_buckets
                      where user_id=v_uid and lesson_id=p_lesson) / v_total, 2),
      false;
    return;
  end if;

  insert into lms_watch_buckets (user_id, lesson_id, bucket_index)
  values (v_uid, p_lesson, p_bucket)
  on conflict do nothing;

  insert into lms_lesson_progress (user_id, lesson_id, last_position_seconds)
  values (v_uid, p_lesson, coalesce(p_position, 0))
  on conflict (user_id, lesson_id) do update
    set last_position_seconds = greatest(lms_lesson_progress.last_position_seconds,
                                         coalesce(excluded.last_position_seconds,0)),
        updated_at = now();

  select count(*) into v_have
    from lms_watch_buckets where user_id = v_uid and lesson_id = p_lesson;

  return query select round(100.0 * v_have / v_total, 2), (100.0 * v_have / v_total) >= v_need;
end $$;

create or replace function lms_watch_coverage(p_lesson uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  select case
    when l.duration_seconds is null then 0
    else round(100.0 * (select count(*) from lms_watch_buckets b
                         where b.user_id = auth.uid() and b.lesson_id = l.id)
               / greatest(1, ceil(l.duration_seconds::numeric / l.bucket_seconds)), 2)
  end
  from lms_lessons l where l.id = p_lesson
$$;

-- A lesson opens when the one before it is complete. The first lesson
-- of a course is always open to anyone who has access to the course.
create or replace function lms_is_lesson_unlocked(p_lesson uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_prev uuid;
begin
  if auth.uid() is null then return false; end if;
  if not lms_lesson_is_open(p_lesson) then return false; end if;

  select prev.id into v_prev
    from lms_lessons cur
    join lms_modules cm on cm.id = cur.module_id
    join lms_modules pm on pm.course_id = cm.course_id
    join lms_lessons prev on prev.module_id = pm.id
   where cur.id = p_lesson
     and (pm.position, prev.position) < (cm.position, cur.position)
   order by pm.position desc, prev.position desc
   limit 1;

  if v_prev is null then return true; end if;
  return exists (select 1 from lms_lesson_progress
                  where user_id = auth.uid() and lesson_id = v_prev and completed);
end $$;

-- Marks a lesson done once the watching and the quiz both pass.
create or replace function lms_complete_lesson(p_lesson uuid)
returns table (completed boolean, reason text)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_type lms_lesson_type; v_need integer; v_cov numeric; v_quiz uuid;
begin
  if v_uid is null then return query select false, 'Please sign in.'; return; end if;
  if not lms_lesson_is_open(p_lesson) then return query select false, 'You do not have access to this lesson.'; return; end if;
  if not lms_is_lesson_unlocked(p_lesson) then return query select false, 'Finish the lesson before this one first.'; return; end if;

  select type, coverage_percent into v_type, v_need from lms_lessons where id = p_lesson;

  if v_type = 'video' then
    v_cov := lms_watch_coverage(p_lesson);
    if v_cov < v_need then
      return query select false, 'Watch the whole lesson first. You are at '||v_cov||' percent.'; return;
    end if;
  end if;

  select id into v_quiz from lms_quizzes where lesson_id = p_lesson and status = 'published';
  if v_quiz is not null and not exists (
      select 1 from lms_quiz_attempts
       where user_id = v_uid and quiz_id = v_quiz and passed) then
    return query select false, 'Answer the questions for this lesson first.'; return;
  end if;

  insert into lms_lesson_progress (user_id, lesson_id, completed, completed_at)
  values (v_uid, p_lesson, true, now())
  on conflict (user_id, lesson_id) do update
    set completed = true, completed_at = coalesce(lms_lesson_progress.completed_at, now()), updated_at = now();

  return query select true, 'Lesson complete.';
end $$;

-- ---------------------------------------------------------------- quizzes
-- Serves the questions WITHOUT the answers. is_correct never leaves the
-- server, so the answers are not sitting in the browser to be read.
create or replace function lms_start_quiz(p_quiz uuid)
returns table (attempt_id uuid, question_id uuid, prompt text, qtype lms_question_type,
               marks integer, option_id uuid, option_label text, option_position integer)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_q lms_quizzes%rowtype;
  v_course uuid; v_used integer; v_open uuid; v_ids uuid[]; v_last timestamptz;
begin
  if v_uid is null then return; end if;
  select * into v_q from lms_quizzes where id = p_quiz and status = 'published';
  if not found then return; end if;

  select c.id into v_course from lms_courses c
    join lms_modules m on m.course_id = c.id
    left join lms_lessons l on l.module_id = m.id
   where m.id = coalesce(v_q.module_id, (select module_id from lms_lessons where id = v_q.lesson_id))
   limit 1;
  if v_course is null or not (lms_has_course_access(v_course)
      or exists (select 1 from lms_courses where id=v_course and price_kobo=0)) then return; end if;

  select id, served_question_ids into v_open, v_ids
    from lms_quiz_attempts
   where user_id = v_uid and quiz_id = p_quiz and status = 'in_progress'
   order by started_at desc limit 1;

  if v_open is null then
    if exists (select 1 from lms_quiz_attempts where user_id=v_uid and quiz_id=p_quiz and passed) then
      return;  -- already passed, nothing to retake
    end if;
    select count(*), max(submitted_at) into v_used, v_last
      from lms_quiz_attempts where user_id=v_uid and quiz_id=p_quiz and status <> 'abandoned';
    if v_used >= v_q.max_attempts then return; end if;
    if v_q.retake_after_minutes > 0 and v_last is not null
       and v_last > now() - make_interval(mins => v_q.retake_after_minutes) then return; end if;

    select array_agg(q.id) into v_ids from (
      select id from lms_questions
       where quiz_id = p_quiz and active
       order by case when v_q.shuffle then random() end, position
       limit coalesce(v_q.serve_count, 1000)
    ) q;
    if v_ids is null then return; end if;

    insert into lms_quiz_attempts (user_id, quiz_id, attempt_no, served_question_ids)
    values (v_uid, p_quiz, coalesce(v_used,0) + 1, v_ids)
    returning id into v_open;
  end if;

  -- Short answer questions come back with no option rows, which is
  -- correct: there is nothing to choose from. They must still appear,
  -- or the learner never sees the question at all.
  return query
    select v_open, q.id, q.prompt, q.type, q.marks, o.id, o.label, o.position
      from lms_questions q
      left join lms_options o
        on o.question_id = q.id and q.type <> 'short_text'
     where q.id = any(v_ids)
     order by q.position, o.position nulls first;
end $$;

-- Marks the attempt. All comparison happens here, never in the browser.
create or replace function lms_submit_quiz(p_attempt uuid, p_answers jsonb)
returns table (score integer, max_score integer, percent numeric, passed boolean, pass_mark integer)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_a lms_quiz_attempts%rowtype; v_q lms_quizzes%rowtype;
  v_score integer := 0; v_max integer := 0; v_pct numeric; v_pass boolean;
  r record; v_given jsonb; v_ok boolean;
begin
  if v_uid is null then return; end if;
  select * into v_a from lms_quiz_attempts
   where id = p_attempt and user_id = v_uid and status = 'in_progress';
  if not found then return; end if;
  select * into v_q from lms_quizzes where id = v_a.quiz_id;

  for r in select q.id, q.type, q.marks from lms_questions q
            where q.id = any(v_a.served_question_ids)
  loop
    v_max := v_max + r.marks;
    v_given := p_answers -> r.id::text;
    v_ok := false;

    if r.type = 'short_text' then
      v_ok := exists (
        select 1 from lms_options o
         where o.question_id = r.id and o.is_correct
           and lower(btrim(o.label)) = lower(btrim(coalesce(v_given #>> '{}', ''))));

    elsif r.type = 'multi' then
      -- every correct option chosen, and nothing else
      v_ok := (
        select coalesce(
          (select array_agg(o.id::text order by o.id::text)
             from lms_options o where o.question_id = r.id and o.is_correct)
          = (select array_agg(x order by x) from jsonb_array_elements_text(
               case when jsonb_typeof(v_given) = 'array' then v_given
                    when v_given is null then '[]'::jsonb
                    else jsonb_build_array(v_given #>> '{}') end) x)
        , false));

    else  -- single, boolean
      v_ok := exists (
        select 1 from lms_options o
         where o.question_id = r.id and o.is_correct
           and o.id::text = coalesce(v_given #>> '{}', ''));
    end if;

    if v_ok then v_score := v_score + r.marks; end if;
  end loop;

  v_pct  := case when v_max = 0 then 0 else round(100.0 * v_score / v_max, 2) end;
  v_pass := v_pct >= v_q.pass_percent;

  update lms_quiz_attempts
     set answers = coalesce(p_answers, '{}'::jsonb),
         score = v_score, max_score = v_max, percent = v_pct, passed = v_pass,
         status = (case when v_pass then 'passed' else 'failed' end)::lms_attempt_status,
         submitted_at = now()
   where id = p_attempt;

  return query select v_score, v_max, v_pct, v_pass, v_q.pass_percent;
end $$;

-- ---------------------------------------------------------------- publishing
-- The same checks the control room shows, enforced here so a course can
-- never be published by calling the API directly.
create or replace function lms_course_blockers(p_course uuid)
returns table (ok boolean, label text)
language sql stable security definer set search_path = public as $$
  with c as (select * from lms_courses where id = p_course),
  m as (select count(*) n from lms_modules where course_id = p_course),
  l as (select count(*) n from lms_lessons le
          join lms_modules mo on mo.id = le.module_id where mo.course_id = p_course),
  v as (select count(*) n from lms_lessons le
          join lms_modules mo on mo.id = le.module_id
         where mo.course_id = p_course and le.type = 'video'
           and (le.video_ref is null or le.duration_seconds is null))
  select btrim(coalesce((select title from c),'')) <> '', 'Has a title'
  union all select btrim(coalesce((select summary from c),'')) <> '', 'Has a short description'
  union all select btrim(coalesce((select tool from c),'')) <> '', 'Has a tool'
  union all select (select n from m) > 0, 'Has at least one module'
  union all select (select n from l) > 0, 'Has at least one lesson'
  union all select (select n from v) = 0, 'Every video lesson has its video'
$$;

create or replace function lms_publish_course(p_course uuid)
returns table (published boolean, message text)
language plpgsql security definer set search_path = public as $$
declare v_bad integer;
begin
  if not lms_is_admin() then
    return query select false, 'Only an administrator can publish a course.'; return;
  end if;
  select count(*) into v_bad from lms_course_blockers(p_course) where not ok;
  if v_bad > 0 then
    return query select false, 'This course is not ready yet. '||v_bad||' thing(s) still missing.'; return;
  end if;
  update lms_courses
     set status = 'published', published_at = coalesce(published_at, now())
   where id = p_course;

  -- If it is free, open it to everyone who already has an account.
  -- Without this, only people who sign up AFTER today would get it.
  insert into lms_entitlements (user_id, course_id, source)
  select p.id, p_course, 'free'
    from lms_profiles p
   where exists (select 1 from lms_courses c where c.id = p_course and c.price_kobo = 0)
     and not exists (select 1 from lms_entitlements e
                      where e.user_id = p.id and e.course_id = p_course and e.status = 'active');

  insert into lms_admin_actions (actor_id, action, subject_type, subject_id)
  values (auth.uid(), 'publish_course', 'course', p_course);
  return query select true, 'Published.';
end $$;

create or replace function lms_unpublish_course(p_course uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then return false; end if;
  update lms_courses set status = 'draft' where id = p_course;
  insert into lms_admin_actions (actor_id, action, subject_type, subject_id)
  values (auth.uid(), 'unpublish_course', 'course', p_course);
  return true;   -- entitlements are untouched: nobody loses what they hold
end $$;

-- ---------------------------------------------------------------- views
create or replace view lms_course_cards as
  select c.id, c.slug, c.title, c.tool, c.area, c.level, c.summary, c.cover_code,
         c.price_kobo, c.first_module_free, c.status, c.published_at,
         (select count(*) from lms_modules m where m.course_id = c.id) as module_count,
         (select count(*) from lms_lessons l join lms_modules m on m.id = l.module_id
           where m.course_id = c.id) as lesson_count,
         coalesce((select sum(l.duration_seconds) from lms_lessons l
           join lms_modules m on m.id = l.module_id where m.course_id = c.id), 0) as total_seconds
    from lms_courses c;

create or replace function lms_course_progress(p_course uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  with t as (select count(*) n from lms_lessons l join lms_modules m on m.id=l.module_id
              where m.course_id = p_course),
       d as (select count(*) n from lms_lesson_progress p
              join lms_lessons l on l.id = p.lesson_id
              join lms_modules m on m.id = l.module_id
             where m.course_id = p_course and p.user_id = auth.uid() and p.completed)
  select case when (select n from t) = 0 then 0
              else round(100.0 * (select n from d) / (select n from t), 1) end
$$;
