-- =====================================================================
-- 15_undo.sql
--
-- PUTS THE TWO TRAPS BACK. Read this before running it.
--
-- Undoing file 15 means:
--
--   a lesson check locks the lesson, and the whole course, after twenty
--   wrong answers, for ever, with no message anywhere
--
--   a module quiz shuts the certificate away for ever after three
--   failed tries
--
--   a learner who rewinds is sent back to the furthest point they ever
--   reached, every time
--
--   a failed module quiz tells the learner which questions were wrong,
--   which is solvable by elimination across three tries
--
-- That is why this file refuses to run until you change one line, the
-- same way files 10 to 14 do.
--
-- WHAT IT DOES NOT DO: it never deletes lms_watch_days. Those rows are
-- a record of study that cannot be rebuilt from anything else, because
-- the slices they were counted from are deleted as lessons are
-- finished. The table is left exactly where it is, costing nothing, so
-- that re-running file 15 picks up a complete history rather than
-- starting a learner's chart again from zero. If you genuinely want it
-- gone, the drop is at the bottom, commented out, with a warning.
-- =====================================================================

-- ONE TRANSACTION, so the refusal below actually refuses.
--
-- The Supabase SQL editor runs a whole script as one transaction, so an
-- exception there undoes everything. psql does not, unless it is told:
-- without this, the guard raises its exception, psql prints it, and
-- then cheerfully runs every statement after it anyway. Wrapping the
-- file means the guard works the same way whichever you use.
begin;

do $$
declare
  -- CHANGE THIS LINE to exactly: 'yes, put the traps back'
  v_i_really_mean_it text := 'no';
begin
  if v_i_really_mean_it <> 'yes, put the traps back' then
    raise exception E'\n\n  15_undo.sql has not been run.\n\n'
      '  Undoing file 15 puts back two faults that permanently lock\n'
      '  learners out of courses they have paid for, with no message\n'
      '  and no way out except hand written SQL.\n\n'
      '  If you are sure, open this file and change v_i_really_mean_it\n'
      '  to:  ''yes, put the traps back''\n';
  end if;
  raise notice 'Undo confirmed. Putting file 15 back the way it was.';
end $$;

-- ------------------------------------------------- the new functions go
drop function if exists lms_my_course(text);
drop function if exists lms_my_week();
drop function if exists lms_my_courses();
drop function if exists lms_my_certificates();
drop function if exists lms_quiz_status(uuid);

-- ------------------------------------------------- the replaced ones go back
-- Each of these is the definition as it stood before file 15, copied
-- from the file that last defined it, so this undo restores the real
-- previous behaviour rather than an approximation of it.

-- lms_record_watch, as file 05 left it: furthest position, no daily count
create or replace function lms_record_watch(p_lesson uuid, p_bucket integer,
                                            p_position integer default null)
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
grant execute on function lms_record_watch(uuid, integer, integer) to authenticated;

-- lms_start_quiz, as file 05 left it: a hard try limit on both kinds
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
      return;
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

  return query
    select v_open, q.id, q.prompt, q.type, q.marks, o.id, o.label, o.position
      from lms_questions q
      left join lms_options o
        on o.question_id = q.id and q.type <> 'short_text'
     where q.id = any(v_ids)
     order by q.position, o.position nulls first;
end $$;
grant execute on function lms_start_quiz(uuid) to authenticated;

-- lms_attempt_marks, as file 07 left it: the rule backwards both ways
create or replace function lms_attempt_marks(p_attempt uuid)
returns table (question_id uuid, prompt text, was_right boolean, explanation text)
language plpgsql security definer set search_path = public as $$
declare v_a lms_quiz_attempts%rowtype; v_given jsonb; r record; v_ok boolean;
begin
  select * into v_a from lms_quiz_attempts where id = p_attempt and user_id = auth.uid();
  if not found or v_a.submitted_at is null then return; end if;

  for r in select q.id, q.prompt, q.type, q.explanation from lms_questions q
            where q.id = any(v_a.served_question_ids) order by q.position
  loop
    v_given := v_a.answers -> r.id::text;
    if r.type = 'short_text' then
      v_ok := exists (select 1 from lms_options o where o.question_id=r.id and o.is_correct
        and lower(btrim(o.label)) = lower(btrim(coalesce(v_given #>> '{}',''))));
    elsif r.type = 'multi' then
      v_ok := (select coalesce((select array_agg(o.id::text order by o.id::text)
          from lms_options o where o.question_id=r.id and o.is_correct)
        = (select array_agg(x order by x) from jsonb_array_elements_text(
             case when jsonb_typeof(v_given) = 'array' then v_given
                  when v_given is null then '[]'::jsonb
                  else jsonb_build_array(v_given #>> '{}') end) x), false));
    else
      v_ok := exists (select 1 from lms_options o where o.question_id=r.id and o.is_correct
        and o.id::text = coalesce(v_given #>> '{}',''));
    end if;
    return query select r.id, r.prompt, v_ok, case when v_ok then r.explanation else '' end;
  end loop;
end $$;
grant execute on function lms_attempt_marks(uuid) to authenticated;

-- ------------------------------------------------- the table stays
-- lms_watch_days is NOT dropped. See the note at the top of this file.
-- If you really want it gone, uncomment the next line, knowing that the
-- study history in it cannot be rebuilt from anything else.
--
-- drop table if exists lms_watch_days;

-- The revoke on lms_watch_buckets is left in place too. It was never
-- part of the two traps, nothing legitimate needs those grants, and
-- putting them back would be undoing a tightening rather than undoing
-- this file.

do $$ begin
  raise notice 'File 15 undone. The two traps are back. lms_watch_days was kept.';
end $$;

commit;
