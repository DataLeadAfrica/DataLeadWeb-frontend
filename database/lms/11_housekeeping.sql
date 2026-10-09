-- =====================================================================
-- 11  QUIZ SAFETY AND HOUSEKEEPING                   (6 October 2026)
--
-- Run this after file 10. Two unrelated jobs, in one file because both
-- are small and both touch the same two tables.
--
-- PART A, quiz safety. An attempt with nothing to mark must never be
-- treated as a pass, and a course or a set of questions must not go live
-- while any of its checks is empty.
--
-- PART B, housekeeping. Watch slices are the bulk of the data and they
-- stop being useful the moment a lesson is complete, so they are thrown
-- away then, keeping only the final coverage figure. Lesson check
-- attempts go the same way, but ONLY after the pass itself has been
-- written somewhere safer, because the completion rule used to read
-- those attempts and deleting them would have locked the lesson.
--
-- PART C, permissions. The file ends by calling the tidy function from
-- file 10, because Supabase hands wide permissions to anything new.
--
-- Safe to run twice. If anything is missing it stops at step 0 and
-- tells you what, before changing a single thing.
-- =====================================================================


-- =====================================================================
-- STEP 0  Check this database is the one this file was written for.
-- =====================================================================
do $$
declare
  v_missing text[] := '{}';
  v_t text; v_c text;
  v_sig text;
begin
  foreach v_t in array array[
    'lms_lesson_progress','lms_watch_buckets','lms_quizzes','lms_questions',
    'lms_quiz_attempts','lms_lessons','lms_modules','lms_courses','lms_admin_actions']
  loop
    if not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = v_t) then
      v_missing := v_missing || ('table ' || v_t);
    end if;
  end loop;

  foreach v_c in array array[
    'lms_lesson_progress.user_id','lms_lesson_progress.lesson_id',
    'lms_lesson_progress.completed','lms_lesson_progress.completed_at',
    'lms_watch_buckets.bucket_index','lms_watch_buckets.first_seen_at',
    'lms_lessons.duration_seconds','lms_lessons.bucket_seconds','lms_lessons.coverage_percent',
    'lms_quizzes.lesson_id','lms_quizzes.module_id','lms_quizzes.status',
    'lms_questions.active','lms_quiz_attempts.served_question_ids','lms_quiz_attempts.passed']
  loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = split_part(v_c, '.', 1)
                      and column_name = split_part(v_c, '.', 2)) then
      v_missing := v_missing || ('column ' || v_c);
    end if;
  end loop;

  -- file 10 must have been run: this file calls its tidy function
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'lms_tidy_table_privileges') then
    v_missing := v_missing || 'function lms_tidy_table_privileges() from file 10';
  end if;

  -- the four functions this file replaces must be the shape it expects
  for v_t, v_sig in
    select x.nm, x.sig from (values
      ('lms_submit_quiz','p_attempt uuid, p_answers jsonb|TABLE(kind text, correct_count integer, question_count integer, score integer, max_score integer, percent numeric, passed boolean, pass_mark integer, feedback text)'),
      ('lms_complete_lesson','p_lesson uuid|TABLE(completed boolean, reason text)'),
      ('lms_course_blockers','p_course uuid|TABLE(ok boolean, label text)'),
      ('lms_watch_coverage','p_lesson uuid|numeric')
    ) as x(nm, sig)
  loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_t
         and pg_get_function_identity_arguments(p.oid) = split_part(v_sig,'|',1)
         and pg_get_function_result(p.oid) = split_part(v_sig,'|',2)) then
      v_missing := v_missing ||
        ('function ' || v_t || ' is not the shape this file expects. Found: ' ||
         coalesce((select '(' || pg_get_function_identity_arguments(p.oid) || ') returns ' ||
                          pg_get_function_result(p.oid)
                     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = v_t limit 1), 'nothing'));
    end if;
  end loop;

  if array_length(v_missing, 1) is not null then
    raise exception E'This database is not ready for file 11. Missing or different:\n  %\n\nRun files 01 to 07 and then file 10 first. Nothing has been changed.',
      array_to_string(v_missing, E'\n  ');
  end if;
  raise notice 'Step 0: everything file 11 needs is present.';
end $$;


-- =====================================================================
-- STEP 1  Three columns on the progress row.
--
-- final_coverage   how much of the video was watched, kept after the
--                  slices themselves are thrown away
-- check_passed     whether the lesson check was passed. This used to be
--                  worked out by looking for a passed attempt, which is
--                  why attempts could not be deleted
-- check_passed_at  when
-- =====================================================================
alter table lms_lesson_progress add column if not exists final_coverage  numeric(5,2);
alter table lms_lesson_progress add column if not exists check_passed    boolean not null default false;
alter table lms_lesson_progress add column if not exists check_passed_at timestamptz;


-- =====================================================================
-- STEP 2  Backfill, so nobody who has already passed a check is locked
--         out by step 4. Run before anything starts deleting attempts.
-- =====================================================================
do $$
declare v_n integer;
begin
  update lms_lesson_progress p
     set check_passed = true,
         check_passed_at = coalesce(p.check_passed_at, a.submitted_at, now())
    from lms_quiz_attempts a
    join lms_quizzes q on q.id = a.quiz_id
   where q.lesson_id = p.lesson_id
     and a.user_id = p.user_id
     and a.passed
     and not p.check_passed;
  get diagnostics v_n = row_count;
  raise notice 'Step 2: wrote the check pass onto % progress row(s) from attempts already on record.', v_n;

  -- somebody may have passed a check without a progress row existing yet
  insert into lms_lesson_progress (user_id, lesson_id, check_passed, check_passed_at)
  select distinct a.user_id, q.lesson_id, true, min(a.submitted_at)
    from lms_quiz_attempts a join lms_quizzes q on q.id = a.quiz_id
   where a.passed and q.lesson_id is not null
     and not exists (select 1 from lms_lesson_progress p
                      where p.user_id = a.user_id and p.lesson_id = q.lesson_id)
   group by a.user_id, q.lesson_id
  on conflict (user_id, lesson_id) do nothing;
  get diagnostics v_n = row_count;
  raise notice 'Step 2: created % progress row(s) for passes that had none.', v_n;
end $$;


-- =====================================================================
-- STEP 3  Marking. PART A items 1 and 2, plus writing the pass down.
--
-- The rule that was wrong: when an attempt had nothing to mark, the
-- count comparison "0 correct out of 0" was true, so a lesson check
-- told the learner "All 0 correct. On you go." The attempt was also
-- stamped as failed, which used up one of their tries.
--
-- An attempt can end up with nothing to mark whenever the questions it
-- froze have gone. File 10 stopped the import deleting them, but an
-- administrator can still delete a question outright, so the marking
-- rule itself has to cope.
-- =====================================================================
create or replace function lms_submit_quiz(p_attempt uuid, p_answers jsonb)
returns table (kind text, correct_count integer, question_count integer,
               score integer, max_score integer, percent numeric,
               passed boolean, pass_mark integer, feedback text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_a lms_quiz_attempts%rowtype; v_q lms_quizzes%rowtype;
  v_score integer := 0; v_max integer := 0; v_right integer := 0; v_n integer := 0;
  v_pct numeric; v_pass boolean; v_kind text; v_msg text;
  r record; v_given jsonb; v_ok boolean;
begin
  if v_uid is null then return; end if;
  select * into v_a from lms_quiz_attempts
   where id = p_attempt and user_id = v_uid and status = 'in_progress';
  if not found then return; end if;
  select * into v_q from lms_quizzes where id = v_a.quiz_id;
  v_kind := case when v_q.lesson_id is not null then 'check' else 'quiz' end;

  -- NOTHING TO MARK. Leave the attempt exactly as it is, in progress, so
  -- no try is used up, and say so plainly.
  select count(*) into v_n from lms_questions q where q.id = any(v_a.served_question_ids);
  if v_n = 0 then
    return query select v_kind, 0, 0, 0, 0, 0::numeric, false, v_q.pass_percent,
      'These questions are not available at the moment, so nothing has been marked and nothing has been recorded. Please tell your tutor.';
    return;
  end if;

  v_n := 0;
  for r in select q.id, q.type, q.marks from lms_questions q
            where q.id = any(v_a.served_question_ids)
  loop
    v_n := v_n + 1;
    v_max := v_max + r.marks;
    v_given := p_answers -> r.id::text;
    v_ok := false;

    if r.type = 'short_text' then
      v_ok := exists (select 1 from lms_options o
        where o.question_id = r.id and o.is_correct
          and lower(btrim(o.label)) = lower(btrim(coalesce(v_given #>> '{}', ''))));
    elsif r.type = 'multi' then
      v_ok := (select coalesce(
        (select array_agg(o.id::text order by o.id::text)
           from lms_options o where o.question_id = r.id and o.is_correct)
        = (select array_agg(x order by x) from jsonb_array_elements_text(
             case when jsonb_typeof(v_given) = 'array' then v_given
                  when v_given is null then '[]'::jsonb
                  else jsonb_build_array(v_given #>> '{}') end) x), false));
    else
      v_ok := exists (select 1 from lms_options o
        where o.question_id = r.id and o.is_correct
          and o.id::text = coalesce(v_given #>> '{}', ''));
    end if;

    if v_ok then v_score := v_score + r.marks; v_right := v_right + 1; end if;
  end loop;

  v_pct  := case when v_max = 0 then 0 else round(100.0 * v_score / v_max, 2) end;
  -- belt and braces: no marks on offer can never be a pass
  v_pass := v_max > 0 and v_pct >= v_q.pass_percent;

  -- A check speaks in counts. A quiz speaks in marks.
  if v_kind = 'check' then
    v_msg := case
      when v_right = v_n then 'All ' || v_n || ' correct. On you go.'
      else v_right || ' of ' || v_n || ' correct. Have another look at the ones you missed.'
    end;
  else
    v_msg := case
      when v_pass then 'Passed with ' || v_pct || ' percent.'
      else 'Not this time. You scored ' || v_pct || ' percent and need ' || v_q.pass_percent || '.'
    end;
  end if;

  update lms_quiz_attempts
     set answers = coalesce(p_answers, '{}'::jsonb),
         score = v_score, max_score = v_max, percent = v_pct, passed = v_pass,
         status = (case when v_pass then 'passed' else 'failed' end)::lms_attempt_status,
         submitted_at = now()
   where id = p_attempt;

  -- Write the pass onto the progress row. This is what makes it safe to
  -- delete a lesson check attempt later: the fact of the pass no longer
  -- lives only in the attempts table.
  if v_pass and v_q.lesson_id is not null then
    insert into lms_lesson_progress (user_id, lesson_id, check_passed, check_passed_at)
    values (v_uid, v_q.lesson_id, true, now())
    on conflict (user_id, lesson_id) do update
      set check_passed = true,
          check_passed_at = coalesce(lms_lesson_progress.check_passed_at, now()),
          updated_at = now();
  end if;

  return query select v_kind, v_right, v_n, v_score, v_max, v_pct, v_pass,
                      v_q.pass_percent, v_msg;
end $$;

grant execute on function lms_submit_quiz(uuid,jsonb) to authenticated;


-- =====================================================================
-- STEP 4  Completion reads the progress row, not the attempts table.
--
-- This is the change that makes step 8 safe. The only difference from
-- the version in 05 is the three lines that used to look for a passed
-- attempt.
-- =====================================================================
create or replace function lms_complete_lesson(p_lesson uuid)
returns table (completed boolean, reason text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_type lms_lesson_type; v_need integer;
  v_cov numeric; v_quiz uuid; v_ok boolean;
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
  if v_quiz is not null then
    select coalesce(p.check_passed, false) into v_ok
      from lms_lesson_progress p
     where p.user_id = v_uid and p.lesson_id = p_lesson;
    if not coalesce(v_ok, false) then
      return query select false, 'Answer the questions for this lesson first.'; return;
    end if;
  end if;

  insert into lms_lesson_progress (user_id, lesson_id, completed, completed_at)
  values (v_uid, p_lesson, true, now())
  on conflict (user_id, lesson_id) do update
    set completed = true, completed_at = coalesce(lms_lesson_progress.completed_at, now()),
        updated_at = now();

  return query select true, 'Lesson complete.';
end $$;

grant execute on function lms_complete_lesson(uuid) to authenticated;


-- =====================================================================
-- STEP 5  Coverage survives the slices being thrown away.
-- =====================================================================
create or replace function lms_watch_coverage(p_lesson uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  select case
    when p.completed and p.final_coverage is not null then p.final_coverage
    when l.duration_seconds is null then 0
    else round(100.0 * (select count(*) from lms_watch_buckets b
                         where b.user_id = auth.uid() and b.lesson_id = l.id)
               / greatest(1, ceil(l.duration_seconds::numeric / l.bucket_seconds)), 2)
  end
  from lms_lessons l
  left join lms_lesson_progress p
    on p.lesson_id = l.id and p.user_id = auth.uid()
 where l.id = p_lesson
$$;

grant execute on function lms_watch_coverage(uuid) to authenticated;


-- =====================================================================
-- STEP 6  Nothing goes live with an empty set of questions.
--
-- Two places, because there are two ways in: publishing the course, and
-- publishing the set of questions on its own.
-- =====================================================================
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
           and (le.video_ref is null or le.duration_seconds is null)),
  -- every set of questions attached to this course, by either route,
  -- counted for how many live questions it holds
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
  union all select (select n from v) = 0, 'Every video lesson has its video'
  union all select (select n from emptyq) = 0,
    case when (select n from emptyq) = 0
         then 'Every set of questions has at least one question'
         else 'Every set of questions has at least one question. Still empty: '
              || (select names from emptyq)
              || '. Add a question, or delete the empty set.'
    end
$$;

grant execute on function lms_course_blockers(uuid) to authenticated, anon;

-- And the direct route: a set of questions cannot be published empty.
-- This one applies to everybody, the administrator included, because an
-- empty live quiz is a mistake whoever makes it.
create or replace function lms_guard_quiz_not_empty() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if not exists (select 1 from lms_questions q where q.quiz_id = new.id and q.active) then
      raise exception 'This set of questions has no questions in it yet, so it cannot go live. Add at least one question first.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists t_guard_quiz_has_questions on lms_quizzes;
create trigger t_guard_quiz_has_questions before insert or update on lms_quizzes
  for each row execute function lms_guard_quiz_not_empty();

-- The trigger stops NEW empty sets going live. It cannot fix one that is
-- already live, and this file will not quietly unpublish learner-visible
-- content or invent questions, so it reports instead.
do $$
declare v_n integer; v_names text;
begin
  select count(*), string_agg(coalesce(nullif(btrim(q.title),''),'untitled'), ', ')
    into v_n, v_names
    from lms_quizzes q
   where q.status = 'published'
     and not exists (select 1 from lms_questions x where x.quiz_id = q.id and x.active);
  if v_n > 0 then
    raise notice 'Step 6: WARNING. % set(s) of questions are already live with no questions in them: %. A learner cannot start one, so they can never finish that lesson. Add a question to each, or delete them. This file has not changed them.', v_n, v_names;
  else
    raise notice 'Step 6: no set of questions is live with nothing in it.';
  end if;
end $$;


-- =====================================================================
-- STEP 7  Throw the watch slices away when the lesson is complete.
--
-- The slices are the bulk of the data. A ten minute video in ten second
-- slices is sixty rows per learner per lesson, and once the lesson is
-- complete the only thing anybody needs from them is the single number
-- saying how much was watched.
--
-- Two triggers, because the coverage has to be worked out while the
-- slices still exist, and the deleting has to happen after the row is
-- written.
-- =====================================================================
create or replace function lms_progress_keep_coverage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.completed and (tg_op = 'INSERT' or not coalesce(old.completed, false))
     and new.final_coverage is null then
    select case when l.duration_seconds is null then 0
                else round(100.0 * (select count(*) from lms_watch_buckets b
                                     where b.user_id = new.user_id and b.lesson_id = new.lesson_id)
                           / greatest(1, ceil(l.duration_seconds::numeric / l.bucket_seconds)), 2)
           end
      into new.final_coverage
      from lms_lessons l where l.id = new.lesson_id;
  end if;
  return new;
end $$;

drop trigger if exists t_progress_keep_coverage on lms_lesson_progress;
create trigger t_progress_keep_coverage before insert or update on lms_lesson_progress
  for each row execute function lms_progress_keep_coverage();

create or replace function lms_progress_tidy_up() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.completed and (tg_op = 'INSERT' or not coalesce(old.completed, false)) then
    -- the slices have done their job
    delete from lms_watch_buckets
     where user_id = new.user_id and lesson_id = new.lesson_id;

    -- and so have this lesson's check attempts. The pass is on the
    -- progress row, which is what step 4 now reads. MODULE quiz
    -- attempts are untouched: they are the real assessment record.
    delete from lms_quiz_attempts a
     where a.user_id = new.user_id
       and a.quiz_id in (select q.id from lms_quizzes q where q.lesson_id = new.lesson_id);
  end if;
  return null;
end $$;

drop trigger if exists t_progress_tidy_up on lms_lesson_progress;
create trigger t_progress_tidy_up after insert or update on lms_lesson_progress
  for each row execute function lms_progress_tidy_up();


-- =====================================================================
-- STEP 8  The nightly prune, for lessons nobody ever finished.
--
-- Completed lessons are dealt with by step 7. What is left is somebody
-- who started a video, stopped, and never came back. Those slices sit
-- there forever otherwise.
--
-- It works per learner per lesson, using the NEWEST slice in the group,
-- so a lesson somebody is slowly working through does not have its
-- early slices taken away while they are still going.
--
-- WHAT A LEARNER LOSES: the credit for the part of that video they had
-- already watched. If they come back after ninety days of no activity on
-- it, the non-skippable bar starts again from zero and they have to
-- watch it through to unlock the next lesson. Their place in the video
-- is NOT lost: last_position_seconds stays on the progress row, so the
-- player still resumes where they stopped. Nothing else is touched: no
-- progress row, no completed lesson, no quiz attempt, no certificate.
--
-- This does not overlap with anything else. The only other scheduled
-- cleaning in this database is inside mail_fetch_pending, which deletes
-- unsent sign in emails older than an hour and sent ones older than a
-- day, from mail_outbox. It never touches watch slices.
-- =====================================================================
create or replace function lms_prune_watch_buckets(p_days integer default 90)
returns table (slices_removed integer, lessons_affected integer)
language plpgsql security definer set search_path = public as $$
declare v_slices integer := 0; v_lessons integer := 0;
begin
  with stale as (
    select b.user_id, b.lesson_id
      from lms_watch_buckets b
      left join lms_lesson_progress p
        on p.user_id = b.user_id and p.lesson_id = b.lesson_id
     group by b.user_id, b.lesson_id, p.completed
    having max(b.first_seen_at) < now() - make_interval(days => greatest(1, p_days))
       and not coalesce(bool_or(p.completed), false)
  ), gone as (
    delete from lms_watch_buckets b
     using stale s
     where b.user_id = s.user_id and b.lesson_id = s.lesson_id
     returning b.user_id, b.lesson_id
  )
  select count(*), count(distinct (user_id, lesson_id)) into v_slices, v_lessons from gone;

  insert into lms_admin_actions (actor_id, action, subject_type, detail)
  values (null, 'prune_watch_buckets', 'system',
          jsonb_build_object('slices_removed', v_slices, 'lessons_affected', v_lessons,
                             'older_than_days', greatest(1, p_days)));

  return query select v_slices, v_lessons;
end $$;

revoke all on function lms_prune_watch_buckets(integer) from public, anon, authenticated;

do $$
declare v_has boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_has;
  if not v_has then
    raise notice 'Step 8: pg_cron is NOT installed, so no nightly prune was scheduled. The function exists and can be run by hand: select * from lms_prune_watch_buckets();';
  else
    begin
      execute $c$ select cron.unschedule('lms-prune-watch-buckets') $c$;
    exception when others then null;
    end;
    execute $c$ select cron.schedule('lms-prune-watch-buckets', '42 2 * * *',
                                     'select lms_prune_watch_buckets(90)') $c$;
    raise notice 'Step 8: nightly prune scheduled for 02:42 every day.';
  end if;
end $$;

create or replace function lms_prune_job_status()
returns text language plpgsql stable security definer set search_path = public as $$
declare v_n integer;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return 'pg_cron is not installed, so there is no nightly prune';
  end if;
  execute 'select count(*) from cron.job where jobname = ''lms-prune-watch-buckets''' into v_n;
  if v_n > 0 then return 'scheduled'; end if;
  return 'pg_cron is installed but the prune job is missing';
end $$;

revoke all on function lms_prune_job_status() from public, anon, authenticated;


-- =====================================================================
-- STEP 9  The storage report. Administrator only.
--
--   select * from lms_storage_report();
--
-- The first row is the whole database against the 500 MB the free plan
-- allows. The rest is one row per Academy table, biggest first.
-- =====================================================================
create or replace function lms_storage_report()
returns table (item text, pretty_size text, bytes bigint, row_count bigint, pct_of_500mb numeric)
language plpgsql stable security definer set search_path = public as $$
declare r record; v_bytes bigint; v_rows bigint; v_limit bigint := 500 * 1024 * 1024;
begin
  if auth.uid() is not null and not lms_is_admin() then
    raise exception 'Only the administrator can read the storage report.';
  end if;

  v_bytes := pg_database_size(current_database());
  return query select 'WHOLE DATABASE'::text, pg_size_pretty(v_bytes), v_bytes, null::bigint,
                      round(100.0 * v_bytes / v_limit, 2);

  for r in
    select c.relname, pg_total_relation_size(c.oid) as sz
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'lms\_%'
     order by pg_total_relation_size(c.oid) desc, c.relname
  loop
    execute format('select count(*) from public.%I', r.relname) into v_rows;
    return query select r.relname::text, pg_size_pretty(r.sz), r.sz, v_rows,
                        round(100.0 * r.sz / v_limit, 2);
  end loop;
end $$;

grant execute on function lms_storage_report() to authenticated;


-- =====================================================================
-- STEP 10  PART C. Permissions stay tight.
--
-- Supabase grants every privilege on anything new in the public schema
-- to anon and authenticated. Nothing in this file creates a table, but
-- calling this costs nothing and makes the rule habitual: EVERY future
-- file that creates an lms_ table must end with this line.
-- =====================================================================
do $$
declare v_n integer;
begin
  select tables_tidied into v_n from lms_tidy_table_privileges();
  raise notice 'Step 10: checked permissions on % Academy tables and views.', v_n;
end $$;

do $$ begin raise notice 'File 11 finished. Now run 11_verify.sql.'; end $$;
