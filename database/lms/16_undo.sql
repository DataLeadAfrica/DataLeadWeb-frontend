-- =====================================================================
-- 16_undo.sql
--
-- Puts the database back as file 15 left it. Run this only if file 16
-- has to be taken off again.
--
-- IT REFUSES IF ANY LEARNER HAS USED THE NEW THINGS. Specifically, if
-- anybody has filled in the About you form or sat a course or path
-- exam, this stops and changes nothing, because undoing would throw
-- away answers and exam results that cannot be got back.
--
-- To override, you have to mean it:
--   select set_config('lms.undo_16_force', 'yes, delete learner answers', true);
-- in the same session, before running this file.
--
-- WRAPPED IN ONE TRANSACTION. The guard raises, and because everything
-- is inside begin/commit the raise rolls the whole thing back. Without
-- the transaction, psql would keep going after the error and take half
-- the file off.
--
-- WHAT IT CANNOT PUT BACK. coverage_percent was raised to 100 on every
-- lesson. This file sets it back to 92, which is the number file 15
-- used, not necessarily the number each lesson had before. If any
-- lesson had its own figure, set it again afterwards.
-- =====================================================================

begin;

do $$
declare
  v_profiles integer := 0;
  v_exams    integer := 0;
  v_force    text := current_setting('lms.undo_16_force', true);
begin
  if to_regclass('public.lms_learner_profiles') is not null then
    execute 'select count(*) from lms_learner_profiles' into v_profiles;
  end if;

  select count(*) into v_exams
    from lms_quiz_attempts a
    join lms_quizzes q on q.id = a.quiz_id
   where q.course_id is not null or q.path_id is not null;

  if (v_profiles > 0 or v_exams > 0)
     and coalesce(v_force, '') <> 'yes, delete learner answers' then
    raise exception E'Refusing to undo file 16.\n  % learner(s) have filled in About you.\n  % exam attempt(s) have been sat.\nUndoing would throw both away for good.\nIf that is really what you want, run this first, in the same session:\n  select set_config(''lms.undo_16_force'', ''yes, delete learner answers'', true);',
      v_profiles, v_exams;
  end if;
  raise notice 'Undo: % learner answer row(s) and % exam attempt(s) will go.', v_profiles, v_exams;
end $$;

-- ----- the three functions Part B grew go back to what they were
--
-- PUT BACK, NOT JUST DROPPED, and this is the same lesson as the public
-- catalogue further down. File 16 replaced two existing functions and
-- added a third. Dropping the new versions and stopping there would
-- leave a database where every lesson page and every course page fails:
-- lms_open_lesson would still be the file 16 version, calling a
-- lms_lesson_watch_state that this undo has just removed, and
-- lms_my_course would still be reading a lms_quizzes.course_id that is
-- no longer a column.
--
-- So file 14's lms_open_lesson and file 15's lms_my_course are written
-- out here in full, and the new one is dropped.

drop function if exists lms_my_path(text);

drop function if exists lms_open_lesson(uuid);
create or replace function lms_open_lesson(p_lesson uuid)
returns table (
  lesson_id uuid,
  title text,
  video_provider text,
  video_ref text,
  content_md text,
  duration_seconds integer,
  bucket_seconds integer,
  coverage_percent integer
)
language sql stable security definer set search_path = public as $$
  select l.id, l.title, l.video_provider, l.video_ref, l.content_md,
         l.duration_seconds, l.bucket_seconds, l.coverage_percent
    from lms_lessons l
   where l.id = p_lesson
     and lms_lesson_is_open(p_lesson)
$$;

revoke all on function lms_open_lesson(uuid) from public, anon;
grant execute on function lms_open_lesson(uuid) to authenticated;

drop function if exists lms_my_course(text);
create or replace function lms_my_course(p_slug text)
returns table (
  course_id        uuid,
  slug             text,
  title            text,
  summary          text,
  tool             text,
  level            text,
  cover_code       text,
  lesson_count     integer,
  lessons_done     integer,
  quiz_count       integer,
  quizzes_passed   integer,
  percent          numeric,
  resume_lesson_id uuid,
  resume_lesson_title text,
  resume_second    integer,
  certificate_number text,
  certificate_issued_on date,
  modules          jsonb
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_c lms_courses%rowtype;
begin
  if v_uid is null then return; end if;

  select * into v_c from lms_courses where lms_courses.slug = p_slug and status = 'published';
  if not found then return; end if;

  -- A free course is open to anybody signed in. A paid one needs an
  -- entitlement. Both rules belong to the server, and this is the only
  -- gate on the whole function: everything below it is already private
  -- to this learner.
  if not (lms_has_course_access(v_c.id) or v_c.price_kobo = 0) then return; end if;

  return query
  with lesson as (
    select le.id, le.title, le.position as lpos, le.type, le.duration_seconds,
           le.coverage_percent, mo.id as module_id, mo.position as mpos,
           row_number() over (order by mo.position, le.position) as seq
      from lms_lessons le
      join lms_modules mo on mo.id = le.module_id
     where mo.course_id = v_c.id
  ),
  state as (
    select l.*,
           coalesce(p.completed, false) as completed,
           coalesce(p.check_passed, false) as check_passed,
           coalesce(p.last_position_seconds, 0) as last_position,
           case
             when coalesce(p.completed, false) and p.final_coverage is not null
               then p.final_coverage
             when l.duration_seconds is null then 0::numeric
             else round(100.0 * (select count(*) from lms_watch_buckets b
                                  where b.user_id = v_uid and b.lesson_id = l.id)
                        / greatest(1, ceil(l.duration_seconds::numeric
                                           / (select bucket_seconds from lms_lessons
                                               where id = l.id))), 2)
           end as coverage,
           exists (select 1 from lms_quizzes z
                    where z.lesson_id = l.id and z.status = 'published') as has_check
      from lesson l
      left join lms_lesson_progress p on p.lesson_id = l.id and p.user_id = v_uid
  ),
  unlocked as (
    -- open if it is the first lesson, or the one before it is complete
    select s.*,
           coalesce(lag(s.completed) over (order by s.seq), true) as is_unlocked
      from state s
  ),
  modquiz as (
    select z.id, z.module_id, z.title, z.pass_percent,
           (select count(*) from lms_questions q where q.quiz_id = z.id and q.active) as q_count,
           z.max_attempts,
           (select count(*) from lms_quiz_attempts a
             where a.user_id = v_uid and a.quiz_id = z.id and a.status <> 'abandoned') as tries,
           (select bool_or(coalesce(a.passed,false)) from lms_quiz_attempts a
             where a.user_id = v_uid and a.quiz_id = z.id) as passed,
           (select max(a.percent) from lms_quiz_attempts a
             where a.user_id = v_uid and a.quiz_id = z.id) as best,
           (select max(a.submitted_at) from lms_quiz_attempts a
             where a.user_id = v_uid and a.quiz_id = z.id and a.status <> 'abandoned') as last_try
      from lms_quizzes z
      join lms_modules mo on mo.id = z.module_id
     where mo.course_id = v_c.id and z.status = 'published'
  ),
  totals as (
    select (select count(*) from unlocked)::integer as n_lessons,
           (select count(*) from unlocked where completed)::integer as n_done,
           (select count(*) from modquiz)::integer as n_quiz,
           (select count(*) from modquiz where passed)::integer as n_passed
  ),
  resume as (
    -- the first lesson that is not finished and is open to them
    select u.id, u.title, u.last_position
      from unlocked u
     where not u.completed and u.is_unlocked
     order by u.seq limit 1
  ),
  cert as (
    select c.certificate_number as num, c.completed_on as on_date
      from certificates c
      join lms_profiles pr on pr.participant_id = c.participant_id
     where pr.id = v_uid
       and c.programme_id = v_c.programme_id
       and c.module_id is null
       and not c.revoked
     limit 1
  ),
  built as (
    select mo.position as mpos, mo.title as mtitle, mo.summary as msummary,
           jsonb_build_object(
             'position', mo.position,
             'title', mo.title,
             'summary', coalesce(mo.summary, ''),
             'seconds', coalesce((select sum(u.duration_seconds) from unlocked u
                                   where u.module_id = mo.id), 0),
             'lesson_count', (select count(*) from unlocked u where u.module_id = mo.id),
             'lessons_done', (select count(*) from unlocked u
                               where u.module_id = mo.id and u.completed),
             'lessons', coalesce((
                select jsonb_agg(jsonb_build_object(
                         'id', u.id,
                         'position', u.lpos,
                         'title', u.title,
                         'type', u.type,
                         'seconds', coalesce(u.duration_seconds, 0),
                         'coverage_needed', u.coverage_percent,
                         'completed', u.completed,
                         'check_passed', u.check_passed,
                         'has_check', u.has_check,
                         'coverage', u.coverage,
                         'unlocked', u.is_unlocked,
                         'last_position', u.last_position)
                       order by u.lpos)
                  from unlocked u where u.module_id = mo.id), '[]'::jsonb),
             'quiz', (select jsonb_build_object(
                         'id', z.id,
                         'title', z.title,
                         'pass_mark', z.pass_percent,
                         'question_count', z.q_count,
                         'tries_allowed', z.max_attempts,
                         -- Same correction as lms_quiz_status: a block that divides
             -- exactly is FULL, not empty, until the 24 hours are up.
             'tries_used',
               case when z.tries > 0
                     and z.tries % greatest(1, z.max_attempts) = 0
                     and not coalesce(z.passed, false)
                     and now() < z.last_try + interval '24 hours'
                    then z.max_attempts
                    else z.tries % greatest(1, z.max_attempts) end,
                         'passed', coalesce(z.passed, false),
                         'best_percent', z.best,
                         'next_opens_at',
                           case when not coalesce(z.passed,false)
                                 and z.tries > 0
                                 and z.tries % greatest(1, z.max_attempts) = 0
                                 and now() < z.last_try + interval '24 hours'
                                then z.last_try + interval '24 hours' end)
                       from modquiz z where z.module_id = mo.id)
           ) as js
      from lms_modules mo
     where mo.course_id = v_c.id
  )
  select v_c.id, v_c.slug, v_c.title, v_c.summary, v_c.tool, v_c.level::text, v_c.cover_code,
         t.n_lessons, t.n_done, t.n_quiz, t.n_passed,
         case when t.n_lessons + t.n_quiz = 0 then 0::numeric
              else round(100.0 * (t.n_done + t.n_passed) / (t.n_lessons + t.n_quiz), 0) end,
         (select r.id from resume r), (select r.title from resume r),
         (select r.last_position from resume r),
         (select num from cert), (select on_date from cert),
         coalesce((select jsonb_agg(b.js order by b.mpos) from built b), '[]'::jsonb)
    from totals t;
end $$;

revoke all on function lms_my_course(text) from public, anon;
grant execute on function lms_my_course(text) to authenticated;

-- ----- the round two review fixes come off
--
-- Taken off in the opposite order to the way they went on.

-- The question bank goes back to the file 06 policy. THIS REOPENS THE
-- HOLE Dr Ayoola found: p_q_public lets anybody signed in read every
-- question of every published quiz, with its explanation. It is safe
-- only because by the time this line runs the lines further down have
-- already deleted every exam and every exam question, so the only
-- questions left are the lesson checks that file 06 meant to be
-- readable. If exams are ever put back WITHOUT file 16, that policy has
-- to be tightened again first.
drop policy if exists p_q_staff_only on lms_questions;
drop policy if exists p_q_public on lms_questions;
create policy p_q_public on lms_questions
  for select to authenticated
  using (exists (select 1 from lms_quizzes q
                  where q.id = lms_questions.quiz_id and q.status = 'published'));

drop policy if exists p_quiz_learner_checks on lms_quizzes;
drop policy if exists p_quiz_public on lms_quizzes;
create policy p_quiz_public on lms_quizzes
  for select to authenticated
  using (status = 'published');

-- The nightly prune of abandoned sign ups.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute $c$ select cron.unschedule('lms-prune-unconfirmed-signups') $c$;
    exception when others then null;
    end;
  end if;
end $$;
drop function if exists lms_prune_unconfirmed_signups(integer);

-- The country and state lists. The two keys first, or the tables cannot
-- be dropped. Nobody's stored country or state is changed: the columns
-- go back to being free text holding exactly what they held.
alter table lms_learner_profiles
  drop constraint if exists lp_country_fk,
  drop constraint if exists lp_state_fk;
drop table if exists lms_ng_states;
drop table if exists lms_countries;

-- The second trigger, the one for accounts that are made already
-- confirmed, and the metadata strip.
drop trigger  if exists lms_users_created_confirmed on auth.users;
drop function if exists lms_strip_signup_metadata(uuid);

-- system_health goes back to the file 12 version, without the refused
-- sign up row. Written out in full, because file 12 builds its rows
-- inside one function body with no extension point, so there is no
-- patch to reverse.
create or replace function system_health(p_token text)
returns table (item text, severity text, value text, detail text)
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  v_rows record;
  v_out  text[][];
  v_worst text := 'ok';
  v_mins numeric; v_bytes bigint; v_limit bigint := 500*1024*1024;
  v_at timestamptz; v_n integer; v_sev text; v_val text; v_det text;
  v_jobs jsonb := '[]'::jsonb; j jsonb; v_has_cron boolean; v_has_details boolean;
  v_result text[];
begin
  -- A signed in person is never the alarm script. The script calls this
  -- with the public key and no signed in user.
  if auth.uid() is not null and not lms_is_admin() then
    return query select 'TOKEN'::text, 'alarm'::text, 'rejected'::text,
      'Only the alarm script or the administrator may run this.'::text;
    return;
  end if;
  if not lms_health_token_ok(p_token) then
    return query select 'TOKEN'::text, 'alarm'::text, 'rejected'::text,
      'The token is wrong, too short, or has never been set. Set it with lms_set_health_token.'::text;
    return;
  end if;

  create temporary table if not exists _h (ord integer, item text, severity text, value text, detail text)
    on commit drop;
  -- "where true" is not decoration. Supabase runs calls that arrive through
  -- the API with a protection that REFUSES any delete or update without a
  -- where clause, as error 21000, "DELETE requires a WHERE clause". A bare
  -- "delete from _h" is rejected and the whole health check returns 400,
  -- which the alarm then reports as the database being unreachable.
  -- The table is "on commit drop" and each API call is its own transaction,
  -- so this line only matters when the function is called twice inside one
  -- transaction, which is what happens in the SQL editor.
  delete from _h where true;

  -- 1. the oldest email still waiting to be sent
  select round(extract(epoch from (now() - min(created_at)))/60.0, 1)
    into v_mins from mail_outbox where sent = false;
  if v_mins is null then
    insert into _h values (1,'oldest unsent email','ok','none waiting','The outbox is empty.');
  else
    v_sev := case when v_mins > 20 then 'alarm' when v_mins > 7 then 'warn' else 'ok' end;
    insert into _h values (1,'oldest unsent email', v_sev, v_mins || ' minutes',
      'A sign in code waiting this long means the mailer is behind or stopped. Anything unsent for an hour is deleted, and that person never gets in.');
  end if;

  -- 2. when the mailer last collected its post
  select at into v_at from lms_system_heartbeat where name = 'mailer_fetch';
  if v_at is null then
    insert into _h values (2,'mailer last fetched','alarm','never recorded',
      'The mailer has not called in since this check was installed. If sign in is working, it may simply not have run yet.');
  else
    v_mins := round(extract(epoch from (now() - v_at))/60.0, 1);
    v_sev := case when v_mins > 60 then 'alarm' when v_mins > 30 then 'warn' else 'ok' end;
    insert into _h values (2,'mailer last fetched', v_sev, v_mins || ' minutes ago',
      'The Apps Script mailer calls mail_fetch_pending on a timer. Silence here means sign in codes are not going out.');
  end if;

  -- 3. database size against the free allowance
  v_bytes := pg_database_size(current_database());
  v_sev := case when v_bytes > v_limit * 0.90 then 'alarm'
                when v_bytes > v_limit * 0.75 then 'warn' else 'ok' end;
  insert into _h values (3,'database size', v_sev,
    pg_size_pretty(v_bytes) || ' of 500 MB (' || round(100.0*v_bytes/v_limit,1) || ' percent)',
    'The free plan allows 500 MB. select * from lms_storage_report() breaks it down by table.');

  -- 4. the scheduled jobs
  select exists (select 1 from pg_extension where extname='pg_cron') into v_has_cron;
  if not v_has_cron then
    insert into _h values (4,'scheduled jobs','warn','pg_cron is not installed',
      'The nightly access sweep and the watch slice prune exist as functions but nothing runs them. Turn pg_cron on, then run files 10 and 11 again.');
  else
    begin
      execute $q$
        select coalesce(jsonb_agg(jsonb_build_object(
                 'jobname', j.jobname, 'active', j.active,
                 'last_start', d.start_time, 'last_status', d.status)), '[]'::jsonb)
          from cron.job j
          left join lateral (select start_time, status from cron.job_run_details r
                              where r.jobid = j.jobid order by r.start_time desc limit 1) d on true
      $q$ into v_jobs;
      v_has_details := true;
    exception when others then
      begin
        execute $q$ select coalesce(jsonb_agg(jsonb_build_object(
                     'jobname', j.jobname, 'active', j.active)), '[]'::jsonb) from cron.job $q$
          into v_jobs;
        v_has_details := false;
      exception when others then
        v_jobs := '[]'::jsonb; v_has_details := false;
      end;
    end;

    if jsonb_array_length(v_jobs) = 0 then
      insert into _h values (4,'scheduled jobs','warn','pg_cron is on but no job is scheduled',
        'Run files 10 and 11 again now that pg_cron is available, so the nightly jobs get created.');
    else
      v_n := 4;
      for j in select * from jsonb_array_elements(v_jobs) loop
        v_n := v_n + 1;
        if not coalesce((j->>'active')::boolean, false) then
          v_sev := 'alarm'; v_val := 'switched off';
        elsif not v_has_details then
          v_sev := 'warn'; v_val := 'on, but this database cannot report its last run';
        elsif (j->>'last_start') is null then
          v_sev := 'warn'; v_val := 'on, never run yet';
        elsif (j->>'last_status') <> 'succeeded' then
          v_sev := 'alarm'; v_val := 'last run ' || (j->>'last_status') ||
                   ' at ' || to_char((j->>'last_start')::timestamptz, 'YYYY-MM-DD HH24:MI');
        elsif (j->>'last_start')::timestamptz < now() - interval '48 hours' then
          v_sev := 'alarm'; v_val := 'last succeeded ' ||
                   to_char((j->>'last_start')::timestamptz, 'YYYY-MM-DD HH24:MI') || ', too long ago';
        else
          v_sev := 'ok'; v_val := 'succeeded ' ||
                   to_char((j->>'last_start')::timestamptz, 'YYYY-MM-DD HH24:MI');
        end if;
        insert into _h values (v_n, 'scheduled job: ' || coalesce(j->>'jobname','unnamed'),
          v_sev, v_val, 'A job that stops running stops closing access for people who have left.');
      end loop;
    end if;
  end if;

  -- 5. sign ups still waiting to confirm
  select count(*) into v_n from auth.users
   where email_confirmed_at is null and created_at > now() - interval '24 hours';
  v_sev := case when v_n >= 5 then 'warn' else 'ok' end;
  insert into _h values (100,'unconfirmed sign ups, last 24 hours', v_sev, v_n::text,
    'A pile of these usually means confirmation emails are not arriving. A few is normal: people change their minds.');

  -- 6. the email allowance. This is the counter the site wide ceiling in
  -- step 1 reads, so seeing it here is how a flood becomes visible. The
  -- page tells nobody they were refused, on purpose, so this is the only
  -- place it shows.
  select count(*) into v_n from sign_in_attempts
   where outcome = 'sent' and at > now() - interval '24 hours';
  v_sev := case when v_n >= mail_limit_per_day() then 'alarm'
                when v_n >= (mail_limit_per_day() * 7) / 10 then 'warn' else 'ok' end;
  insert into _h values (110,'emails sent, last 24 hours', v_sev,
    v_n::text || ' of ' || mail_limit_per_day()::text || ' allowed',
    'The ceiling protects the day''s Gmail allowance, which Google locks for 24 hours if it runs out. Raise it in mail_limits if the mailer moves to a Workspace account.');

  -- 7. lookups that produced no code. A handful is ordinary: people mistype
  -- their address or forget which one they enrolled with. Hundreds is
  -- somebody working through a list of addresses.
  select count(*) into v_n from sign_in_attempts
   where outcome in ('not_enrolled','rate_limited_email','rate_limited_ip','rate_limited_site')
     and at > now() - interval '1 hour';
  v_sev := case when v_n >= 200 then 'alarm' when v_n >= 50 then 'warn' else 'ok' end;
  insert into _h values (120,'sign in attempts that sent nothing, last hour', v_sev, v_n::text,
    'Mostly mistyped addresses. A sudden pile is somebody testing a list of addresses to see who is enrolled.');

  -- every reference to the temporary table is qualified, because this
  -- function's own output columns are called item, severity and value too
  select case when bool_or(h.severity='alarm') then 'alarm'
              when bool_or(h.severity='warn') then 'warn' else 'ok' end
    into v_worst from _h h;

  return query select 'OVERALL'::text, v_worst,
    (select count(*)::text || ' checks, ' ||
            count(*) filter (where h.severity='alarm')::text || ' alarm, ' ||
            count(*) filter (where h.severity='warn')::text || ' warn' from _h h),
    'Look at this row first. If it says ok, nothing below needs reading.'::text;
  return query select h.item, h.severity, h.value, h.detail from _h h order by h.ord;
end $$;

-- ----- the public reads go back to the file 14 shape
--
-- PUT BACK, NOT JUST DROPPED. An earlier version of this file dropped
-- the two and stopped there, which left a database with no catalogue
-- and no course page at all: every public Academy page went blank, and
-- file 16 then refused to run again because its own readiness check
-- could not find them. The file 14 versions are written out here in
-- full so an undo lands somewhere that works.
drop function if exists lms_public_landing();
drop function if exists lms_public_catalogue();
drop function if exists lms_public_course(text);

create or replace function lms_public_catalogue()
returns table (
  id uuid,
  slug text,
  title text,
  summary text,
  tool text,
  area text,
  level lms_level,
  cover_code text,
  price_kobo integer,
  first_module_free boolean,
  published_at timestamptz,
  updated_at timestamptz,
  module_count integer,
  lesson_count integer,
  quiz_count integer,
  total_seconds integer
)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.title, c.summary, c.tool, c.area, c.level, c.cover_code,
         c.price_kobo, c.first_module_free, c.published_at, c.updated_at,
         (select count(*)::integer from lms_modules m where m.course_id = c.id),
         (select count(*)::integer from lms_lessons l
            join lms_modules m on m.id = l.module_id where m.course_id = c.id),
         (select count(*)::integer from lms_quizzes q
            join lms_modules m on m.id = q.module_id
           where m.course_id = c.id and q.status = 'published'),
         coalesce((select sum(l.duration_seconds)::integer from lms_lessons l
            join lms_modules m on m.id = l.module_id where m.course_id = c.id), 0)
    from lms_courses c
   where c.status = 'published'
   order by c.published_at desc nulls last, c.title
$$;

revoke all on function lms_public_catalogue() from public;
grant execute on function lms_public_catalogue() to anon, authenticated;

create or replace function lms_public_course(p_slug text)
returns table (
  id uuid,
  slug text,
  title text,
  summary text,
  tool text,
  area text,
  level lms_level,
  cover_code text,
  price_kobo integer,
  first_module_free boolean,
  outcomes text[],
  audience text[],
  prerequisites text[],
  faq jsonb,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  updated_at timestamptz,
  module_count integer,
  lesson_count integer,
  quiz_count integer,
  total_seconds integer,
  modules jsonb
)
language sql stable security definer set search_path = public as $$
  with c as (
    select * from lms_courses where slug = p_slug and status = 'published'
  ),
  mods as (
    select m.id, m.position, m.title, m.summary,
           coalesce((select sum(l.duration_seconds)::integer from lms_lessons l
                      where l.module_id = m.id), 0) as seconds,
           (select count(*)::integer from lms_lessons l where l.module_id = m.id) as lessons,
           (select count(*)::integer from lms_quizzes q
             where q.module_id = m.id and q.status = 'published') as quizzes,
           -- A free module is the first one of a course that says so.
           (select first_module_free from c) and m.position = 1 as free,
           coalesce((
             select jsonb_agg(jsonb_build_object(
                      'position', l.position,
                      'title', l.title,
                      'type', l.type,
                      'seconds', l.duration_seconds)
                    order by l.position)
               from lms_lessons l where l.module_id = m.id), '[]'::jsonb) as lesson_list
      from lms_modules m
     where m.course_id = (select id from c)
  )
  select c.id, c.slug, c.title, c.summary, c.tool, c.area, c.level, c.cover_code,
         c.price_kobo, c.first_module_free,
         c.outcomes, c.audience, c.prerequisites, c.faq,
         c.seo_title, c.seo_description,
         c.published_at, c.updated_at,
         (select count(*)::integer from mods),
         coalesce((select sum(lessons)::integer from mods), 0),
         coalesce((select sum(quizzes)::integer from mods), 0),
         coalesce((select sum(seconds)::integer from mods), 0),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'position', mods.position,
                    'title', mods.title,
                    'summary', mods.summary,
                    'seconds', mods.seconds,
                    'lessons', mods.lessons,
                    'quizzes', mods.quizzes,
                    'free', mods.free,
                    'lesson_list', mods.lesson_list)
                  order by mods.position)
             from mods), '[]'::jsonb)
    from c
$$;

revoke all on function lms_public_course(text) from public;
grant execute on function lms_public_course(text) to anon, authenticated;

-- ----- popups, recommendations, the learner answers
drop function if exists lms_popup_shown(uuid);
drop function if exists lms_live_popup(text);
drop table    if exists lms_popup_seen;
drop table    if exists lms_popups;

drop function if exists lms_my_recommendations();
drop table    if exists lms_course_next;

drop function if exists lms_learner_totals(text);
drop function if exists lms_learner_record(uuid);
drop function if exists lms_my_profile();
drop trigger  if exists lms_users_email_confirmed on auth.users;
drop function if exists lms_on_email_confirmed();
drop function if exists lms_apply_signup_answers(uuid);
drop table    if exists lms_learner_profiles;

-- ----- the exams
drop function if exists lms_exam_rewatch(uuid);
drop function if exists lms_submit_exam(uuid, jsonb);
drop function if exists lms_start_exam(uuid);
drop function if exists lms_exam_status(uuid);
drop function if exists lms_ensure_path_exam(uuid);
drop function if exists lms_ensure_course_exam(uuid);

-- The exam rows themselves, and their attempts. A lesson check and the
-- old module quizzes are left exactly as they are.
delete from lms_quiz_attempts a
 using lms_quizzes q
 where q.id = a.quiz_id and (q.course_id is not null or q.path_id is not null);
delete from lms_questions
 where quiz_id in (select id from lms_quizzes where course_id is not null or path_id is not null);
delete from lms_quizzes where course_id is not null or path_id is not null;

drop index if exists lms_quizzes_one_per_course;
drop index if exists lms_quizzes_one_per_path;
alter table lms_quizzes drop constraint if exists lms_quizzes_one_owner_ck;
-- File 07's own version goes back, now that a course exam can no longer
-- exist to be refused by it.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lms_quizzes_one_owner') then
    alter table lms_quizzes add constraint lms_quizzes_one_owner check (
      (lesson_id is not null and module_id is null) or
      (lesson_id is null and module_id is not null));
  end if;
end $$;
alter table lms_quizzes
  drop column if exists course_id,
  drop column if exists path_id,
  drop column if exists time_limit_minutes,
  drop column if exists bank_multiple;
alter table lms_quiz_attempts drop column if exists deadline_at;

-- ----- module quizzes can be made again
drop trigger  if exists lms_quizzes_no_module on lms_quizzes;
drop function if exists lms_no_new_module_quiz();

-- ----- lesson checks go back to the file 15 answer
drop function if exists lms_attempt_marks(uuid);
create or replace function lms_attempt_marks(p_attempt uuid)
returns table (question_id uuid, prompt text, was_right boolean, explanation text)
language sql
stable
security definer
set search_path = public
as $$
  select qq.id, qq.prompt,
         (
           select coalesce(array_agg(o.id order by o.id), '{}')
             from lms_options o where o.question_id = qq.id and o.is_correct
         ) = (
           select coalesce(array_agg(x::uuid order by x::uuid), '{}')
             from jsonb_array_elements_text(coalesce(a.answers -> qq.id::text, '[]'::jsonb)) as t(x)
         ),
         qq.explanation
    from lms_quiz_attempts a
    join lms_questions qq on qq.id = any (a.served_question_ids)
   where a.id = p_attempt
     and (a.user_id = auth.uid() or lms_is_staff())
   order by qq.prompt;
$$;
revoke all on function lms_attempt_marks(uuid) from public, anon, authenticated;
grant execute on function lms_attempt_marks(uuid) to authenticated;

drop trigger  if exists lms_questions_chapter_ck on lms_questions;
drop function if exists lms_check_question_chapter();
alter table lms_questions
  drop column if exists chapter_start_seconds,
  drop column if exists lesson_id;

-- ----- the watch rules
drop function if exists lms_lesson_watch_state(uuid);
alter table lms_lessons alter column coverage_percent set default 92;
update lms_lessons set coverage_percent = 92 where coverage_percent = 100;

-- ----- chapters
drop function if exists lms_set_lesson_chapters(uuid, text);
drop function if exists lms_parse_chapters(text);
drop table    if exists lms_lesson_chapters;
alter table lms_lessons drop column if exists chapters_text;

-- ----- paths
drop function if exists lms_publish_path(uuid);
drop function if exists lms_path_blockers(uuid);
alter table lms_paths
  drop column if exists certificate_name,
  drop column if exists programme_id,
  drop column if exists summary_minutes;

-- ----- areas and tools. The trigger first, or dropping the rows would
-- blank every course area word on the way out.
drop trigger  if exists lms_course_areas_sync on lms_course_areas;
drop function if exists lms_sync_course_area();
drop table    if exists lms_area_tools;
drop table    if exists lms_course_areas;
drop table    if exists lms_areas;

alter table lms_courses drop constraint if exists lms_courses_kind_ck;
alter table lms_courses drop column if exists kind;

do $$ begin
  raise notice 'Undo: file 16 is off. lms_courses.area is unchanged and still holds the area name.';
  raise notice 'Undo: country and state are free text again, and the stored values were left exactly as they were.';
  raise notice 'Undo: the question bank is back on the file 06 policy. Every exam and exam question has just been deleted, so the only questions a learner can now read are the lesson checks, which is what file 06 intended.';
end $$;

commit;
