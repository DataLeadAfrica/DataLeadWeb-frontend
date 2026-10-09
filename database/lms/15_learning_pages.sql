-- =====================================================================
-- 015  THE LEARNING PAGES
--
-- Phase 4 builds the part where people actually learn: the course
-- outline, the player, the lesson check, the module quiz and the
-- certificate moment. The database can already record watching and mark
-- answers. This file adds what those pages need and cannot get, and
-- fixes two rules that trap learners.
--
-- WHAT THIS FILE CHANGES, in one list:
--
--   1  lms_my_course      new. One call for a whole learning page
--   2  lms_quiz_status    new. Why a quiz cannot be started, in words
--   3  lms_start_quiz     replaced. A lesson check never locks anyone out
--   4  lms_start_quiz     replaced. A module quiz reopens after 24 hours
--   5  lms_attempt_marks  replaced. Feedback the right way round
--   6  lms_record_watch   replaced. Resume where they stopped
--   7  lms_watch_days     new table, plus lms_my_week
--   8  lms_my_courses     new, and lms_my_certificates
--
-- THE TWO THAT ARE NOT FEATURES. Items 3 and 4 are live faults, and
-- both are reachable by an ordinary learner having an ordinary bad day:
--
--   A lesson check is created with a 100 percent pass mark and 20 tries.
--   Twenty wrong answers and lms_start_quiz returns an empty table for
--   ever. lms_complete_lesson then refuses the lesson, the next lesson
--   never unlocks, and the course can never be finished. The learner
--   sees a button that does nothing and no explanation anywhere.
--
--   A module quiz is created with 3 tries and no retake window. Three
--   failed tries and the certificate is unreachable for ever.
--
--   Today the only way out of either is somebody writing SQL against
--   the live database.
--
-- SAFE TO RUN TWICE. Every statement is create or replace, create if
-- not exists, or guarded. Nothing is dropped that holds learner data.
--
-- AFTER RUNNING IT, read every row of 15_verify.sql.
-- =====================================================================

-- =====================================================================
-- STEP 0  Is this database ready.
--
-- Same shape as files 13 and 14: say what is missing and change nothing,
-- rather than failing half way through and leaving a database that is
-- neither one thing nor the other.
-- =====================================================================
do $$
declare v_missing text[] := '{}'; v_nm text;
begin
  foreach v_nm in array array['lms_courses','lms_modules','lms_lessons','lms_quizzes',
                              'lms_questions','lms_options','lms_quiz_attempts',
                              'lms_lesson_progress','lms_watch_buckets','lms_entitlements',
                              'lms_profiles'] loop
    if to_regclass('public.' || v_nm) is null then
      v_missing := v_missing || ('the table ' || v_nm)::text;
    end if;
  end loop;

  foreach v_nm in array array['lms_has_course_access','lms_lesson_is_open','lms_watch_coverage',
                              'lms_start_quiz','lms_submit_quiz','lms_attempt_marks',
                              'lms_record_watch','lms_complete_lesson','lms_quiz_kind',
                              'lms_tidy_table_privileges','lms_is_admin'] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = v_nm) then
      v_missing := v_missing || ('the function ' || v_nm)::text;
    end if;
  end loop;

  -- file 11 added these, and lms_my_course reads all three
  foreach v_nm in array array['final_coverage','check_passed','check_passed_at'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'lms_lesson_progress'
                      and column_name = v_nm) then
      v_missing := v_missing || ('lms_lesson_progress.' || v_nm || ', which file 11 adds')::text;
    end if;
  end loop;

  if array_length(v_missing, 1) is not null then
    raise exception E'This database is not ready for file 15. Missing:\n  %\n\nNothing has been changed.',
      array_to_string(v_missing, E'\n  ');
  end if;
  raise notice 'Step 0: everything file 15 needs is present.';
end $$;


-- =====================================================================
-- STEP 1  MINUTES WATCHED PER DAY.
--
-- WHY A TABLE RATHER THAN COUNTING THE SLICES. The obvious way to draw
-- "this week" is to count lms_watch_buckets by day. It cannot work:
-- lms_progress_tidy_up, from file 11, deletes a lesson's slices the
-- moment the lesson is completed. So a learner who finished three
-- lessons on Monday would open the page on Tuesday and see Monday at
-- zero. The harder somebody works, the less the chart shows.
--
-- So the minutes are counted once, as they happen, into a row per
-- learner per day, and nothing ever deletes them.
--
-- WHY IT IS CHEAP. One row per learner per day they watch anything.
-- A learner studying every day for a year is 365 rows of 20 bytes.
--
-- THE DAY IS AFRICA/LAGOS. Every learner this is built for is in
-- Nigeria, and a chart whose days change at 1am local time is wrong for
-- everybody looking at it. now() is timestamptz, so the conversion is
-- exact rather than an offset somebody has to remember.
-- =====================================================================
create table if not exists lms_watch_days (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  seconds    integer not null default 0 check (seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table lms_watch_days enable row level security;

-- Read your own, and that is all. There is no write policy at all: the
-- only thing that may add to this table is lms_record_watch, which is
-- SECURITY DEFINER and therefore not subject to these policies. A
-- learner who could write here could invent a month of study.
drop policy if exists p_watchdays_self on lms_watch_days;
create policy p_watchdays_self on lms_watch_days
  for select to authenticated using (user_id = auth.uid() or lms_is_admin());

grant select on lms_watch_days to authenticated;

-- AND NOTHING ELSE, explicitly.
--
-- Supabase's default privileges hand every privilege on a new public
-- table to anon and authenticated, and lms_tidy_table_privileges takes
-- insert, update and delete back from anon but not from authenticated.
-- For most tables that is fine, because row security has no write
-- policy and therefore refuses the write anyway.
--
-- This table is different in one way that matters: its whole purpose is
-- to be a record the learner cannot fake. Leaving the grant in place
-- and relying on row security alone means one missing policy, one day,
-- is a learner who can invent a month of study. The grant costs nothing
-- to remove, and SECURITY DEFINER functions run as the owner, so
-- lms_record_watch is unaffected.
--
-- lms_watch_buckets is the same kind of table and gets the same
-- treatment, for the same reason.
revoke insert, update, delete, truncate on lms_watch_days from anon, authenticated;
revoke insert, update, delete, truncate on lms_watch_buckets from anon, authenticated;


-- =====================================================================
-- STEP 2  RECORDING A WATCH. Two changes, one of them a real fault.
--
-- CHANGE ONE, the fault. The old line was
--
--   last_position_seconds = greatest(old, new)
--
-- so the furthest point ever reached was kept. Somebody who watches to
-- 7:00, rewinds to the bit they did not follow, and stops at 2:00, is
-- sent back to 7:00 next time. The one number whose whole job is "where
-- was I" was storing something else. Coverage is counted separately,
-- from the slices, so keeping the latest position costs nothing.
--
-- A null position still leaves the old one alone, because a caller that
-- does not know the position must not reset it to zero.
--
-- CHANGE TWO. A NEW slice, and only a new one, adds its seconds to
-- today's row. "New" is the row count from the insert, so the same
-- slice arriving twice, which is exactly what a second browser tab
-- does, adds nothing.
--
-- Everything else, including the throttle, is unchanged from file 05.
-- =====================================================================
create or replace function lms_record_watch(p_lesson uuid, p_bucket integer,
                                            p_position integer default null)
returns table (coverage numeric, unlocked boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_dur integer; v_bs integer; v_need integer; v_total integer; v_have integer;
  v_recent integer; v_new integer;
begin
  if v_uid is null then return; end if;
  if not lms_lesson_is_open(p_lesson) then return; end if;

  select duration_seconds, bucket_seconds, coverage_percent
    into v_dur, v_bs, v_need
    from lms_lessons where id = p_lesson;
  if v_dur is null then return; end if;

  v_total := greatest(1, ceil(v_dur::numeric / v_bs)::int);
  if p_bucket < 0 or p_bucket >= v_total then return; end if;

  -- THE ANTI-SCRIPT THROTTLE, and the number in it is not arbitrary.
  --
  -- A real player sends one slice per bucket_seconds of video, so the
  -- fastest an honest watch can produce them is at the fastest speed
  -- the player allows, which is 1.5x on a first watch. At ten second
  -- slices that is exactly nine a minute.
  --
  -- THE OLD LIMIT WAS (60 / bucket_seconds) + 3, which is nine at ten
  -- second slices: exactly what honest 1.5x produces, with three
  -- spare. That sounds like room and is not. The window is a rolling
  -- minute, so ordinary timer jitter on a phone regularly puts ten
  -- sends inside one sixty second window, and the tenth was thrown
  -- away. Watching was lost for no reason at all, at a speed the
  -- player itself offers.
  --
  -- It is now 1.5 times the one-times rate, plus the same three. At
  -- ten second slices: 9 + 3 = 12.
  --
  -- WHAT THIS COSTS IN CHEATING. The throttle is the only thing making
  -- a faked watch take about as long as a real one, and this makes a
  -- fake a third faster. That is precisely the speed up an honest
  -- learner gets from the 1.5x the player already offers, so it
  -- concedes nothing that was not already conceded. The limit now says
  -- what it always meant: nobody may record faster than somebody
  -- genuinely watching at the fastest allowed speed.
  select count(*) into v_recent
    from lms_watch_buckets
   where user_id = v_uid and lesson_id = p_lesson
     and first_seen_at > now() - interval '1 minute';
  if v_recent > ceil((60.0 / v_bs) * 1.5) + 3 then
    return query select
      round(100.0 * (select count(*) from lms_watch_buckets
                      where user_id=v_uid and lesson_id=p_lesson) / v_total, 2),
      false;
    return;
  end if;

  insert into lms_watch_buckets (user_id, lesson_id, bucket_index)
  values (v_uid, p_lesson, p_bucket)
  on conflict do nothing;
  get diagnostics v_new = row_count;

  -- Only a slice that was actually new counts towards the day. Two tabs
  -- playing the same lesson send the same slice indexes, and this is
  -- what stops that being counted twice.
  if v_new > 0 then
    insert into lms_watch_days (user_id, day, seconds)
    values (v_uid, (now() at time zone 'Africa/Lagos')::date, v_bs)
    on conflict (user_id, day) do update
      set seconds = lms_watch_days.seconds + excluded.seconds,
          updated_at = now();
  end if;

  -- The LATEST position, not the furthest. See the note above.
  insert into lms_lesson_progress (user_id, lesson_id, last_position_seconds)
  values (v_uid, p_lesson, coalesce(p_position, 0))
  on conflict (user_id, lesson_id) do update
    set last_position_seconds = coalesce(p_position,
                                         lms_lesson_progress.last_position_seconds),
        updated_at = now();

  select count(*) into v_have
    from lms_watch_buckets where user_id = v_uid and lesson_id = p_lesson;

  return query select round(100.0 * v_have / v_total, 2), (100.0 * v_have / v_total) >= v_need;
end $$;

grant execute on function lms_record_watch(uuid, integer, integer) to authenticated;


-- =====================================================================
-- STEP 3  NOBODY IS EVER LOCKED OUT.
--
-- One replacement for lms_start_quiz, carrying two different rules
-- because a lesson check and a module quiz are different things.
--
-- A LESSON CHECK IS PART OF LEARNING, NOT AN EXAM. Three questions
-- after a video, to make the lesson stick. It is created with a 100
-- percent pass mark, which is right, and 20 tries, which is not: the
-- twentieth wrong answer ends the course. So for a check, max_attempts
-- and retake_after_minutes are ignored completely. Unlimited tries, no
-- waiting. There is nothing to protect: the learner has already watched
-- the lesson, and getting the answer right eventually IS the lesson.
--
-- A MODULE QUIZ IS AN ASSESSMENT, so the tries are real. But running
-- out of them cannot be the end. After max_attempts failed tries the
-- quiz shuts for 24 hours, then opens with a FRESH set of max_attempts.
-- The wait is the whole point: it sends somebody back to the lessons
-- rather than guessing again straight away. The certificate stays
-- reachable.
--
-- HOW THE WINDOW IS WORKED OUT, without storing anything new: tries
-- used in the current window is the total number of tries modulo
-- max_attempts. When that is zero and the total is not, a block has
-- just been finished and the gate is shut until 24 hours after the last
-- try. This needs no extra column and cannot drift out of step with
-- the attempts themselves.
-- =====================================================================
create or replace function lms_start_quiz(p_quiz uuid)
returns table (attempt_id uuid, question_id uuid, prompt text, qtype lms_question_type,
               marks integer, option_id uuid, option_label text, option_position integer)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_q lms_quizzes%rowtype;
  v_course uuid; v_total integer; v_in_window integer; v_open uuid;
  v_ids uuid[]; v_last timestamptz; v_check boolean;
begin
  if v_uid is null then return; end if;
  select * into v_q from lms_quizzes where id = p_quiz and status = 'published';
  if not found then return; end if;
  v_check := v_q.lesson_id is not null;

  select c.id into v_course from lms_courses c
    join lms_modules m on m.course_id = c.id
    left join lms_lessons l on l.module_id = m.id
   where m.id = coalesce(v_q.module_id, (select module_id from lms_lessons where id = v_q.lesson_id))
   limit 1;
  if v_course is null or not (lms_has_course_access(v_course)
      or exists (select 1 from lms_courses where id=v_course and price_kobo=0)) then return; end if;

  -- An unfinished try is always the one you carry on with, for either kind.
  select id, served_question_ids into v_open, v_ids
    from lms_quiz_attempts
   where user_id = v_uid and quiz_id = p_quiz and status = 'in_progress'
   order by started_at desc limit 1;

  if v_open is null then
    -- Already passed, so there is nothing to retake. True of both kinds.
    if exists (select 1 from lms_quiz_attempts where user_id=v_uid and quiz_id=p_quiz and passed) then
      return;
    end if;

    select count(*), max(submitted_at) into v_total, v_last
      from lms_quiz_attempts where user_id=v_uid and quiz_id=p_quiz and status <> 'abandoned';
    v_total := coalesce(v_total, 0);

    -- A CHECK SKIPS ALL OF THIS. No try limit and no waiting.
    if not v_check then
      if v_q.retake_after_minutes > 0 and v_last is not null
         and v_last > now() - make_interval(mins => v_q.retake_after_minutes) then return; end if;

      v_in_window := v_total % v_q.max_attempts;
      if v_in_window = 0 and v_total > 0 then
        -- A block of tries has just been used up. Shut for 24 hours from
        -- the last one, then a fresh block begins on its own.
        if v_last is null or now() < v_last + interval '24 hours' then return; end if;
      end if;
    end if;

    select array_agg(q.id) into v_ids from (
      select id from lms_questions
       where quiz_id = p_quiz and active
       order by case when v_q.shuffle then random() end, position
       limit coalesce(v_q.serve_count, 1000)
    ) q;
    if v_ids is null then return; end if;

    insert into lms_quiz_attempts (user_id, quiz_id, attempt_no, served_question_ids)
    values (v_uid, p_quiz, v_total + 1, v_ids)
    returning id into v_open;
  end if;

  -- Short answer questions come back with no option rows, which is
  -- correct: there is nothing to choose from. They must still appear,
  -- or the learner never sees the question at all.
  --
  -- is_correct is NOT in this list and never will be. It is the one
  -- column that would make every quiz in the Academy pointless.
  return query
    select v_open, q.id, q.prompt, q.type, q.marks, o.id, o.label, o.position
      from lms_questions q
      left join lms_options o
        on o.question_id = q.id and q.type <> 'short_text'
     where q.id = any(v_ids)
     order by q.position, o.position nulls first;
end $$;

grant execute on function lms_start_quiz(uuid) to authenticated;


-- =====================================================================
-- STEP 4  WHY, IN WORDS.
--
-- lms_start_quiz returns an empty table for six different reasons: not
-- signed in, no access, not published, already passed, out of tries for
-- now, and an unfinished try already open. A page receiving an empty
-- table knows only that something is wrong, so the best it can say is
-- "something went wrong", which is the least useful sentence software
-- can produce.
--
-- This answers the same question and says which.
-- =====================================================================
create or replace function lms_quiz_status(p_quiz uuid)
returns table (
  kind            text,        -- 'check' or 'quiz'
  title           text,
  pass_mark       integer,
  question_count  integer,     -- how many will actually be served
  tries_allowed   integer,     -- 0 means unlimited, which is every check
  tries_used      integer,     -- in the current window
  tries_left      integer,     -- null when unlimited
  passed          boolean,
  best_percent    numeric,
  open_attempt_id uuid,        -- an unfinished try to carry on with
  next_opens_at   timestamptz, -- when a shut quiz opens again
  can_start       boolean,
  reason          text         -- for a person to read, when can_start is false
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_q lms_quizzes%rowtype; v_course uuid;
  v_check boolean; v_total integer; v_last timestamptz; v_in_window integer;
  v_qs integer; v_opens timestamptz; v_can boolean := true; v_why text := '';
  v_open uuid; v_passed boolean; v_best numeric;
begin
  if v_uid is null then return; end if;
  select * into v_q from lms_quizzes where id = p_quiz and status = 'published';
  if not found then return; end if;
  v_check := v_q.lesson_id is not null;

  select c.id into v_course from lms_courses c
    join lms_modules m on m.course_id = c.id
   where m.id = coalesce(v_q.module_id, (select module_id from lms_lessons where id = v_q.lesson_id))
   limit 1;
  if v_course is null or not (lms_has_course_access(v_course)
      or exists (select 1 from lms_courses where id=v_course and price_kobo=0)) then return; end if;

  select count(*) into v_qs from lms_questions where quiz_id = p_quiz and active;
  v_qs := least(v_qs, coalesce(v_q.serve_count, v_qs));

  select count(*), max(submitted_at) into v_total, v_last
    from lms_quiz_attempts where user_id = v_uid and quiz_id = p_quiz and status <> 'abandoned';
  v_total := coalesce(v_total, 0);

  select bool_or(coalesce(a.passed, false)), max(a.percent)
    into v_passed, v_best
    from lms_quiz_attempts a where a.user_id = v_uid and a.quiz_id = p_quiz;
  v_passed := coalesce(v_passed, false);

  select id into v_open from lms_quiz_attempts
   where user_id = v_uid and quiz_id = p_quiz and status = 'in_progress'
   order by started_at desc limit 1;

  if v_check then
    v_in_window := v_total;
  else
    v_in_window := v_total % v_q.max_attempts;
    if v_in_window = 0 and v_total > 0 then
      v_opens := v_last + interval '24 hours';
      if now() < v_opens then
        -- THE BLOCK IS FULL, not empty. The modulo is zero here because
        -- the tries divide exactly, and reporting that as "none used,
        -- three left" would put "3 tries left" on a quiz that refuses
        -- to start, which is the same class of lie this whole file
        -- exists to remove.
        v_in_window := v_q.max_attempts;
        v_can := false;
        v_why := 'You have used your tries for now. The quiz opens again at '
                 || to_char(v_opens at time zone 'Africa/Lagos', 'HH24:MI on DD Mon')
                 || '. The lessons in this module stay open, so you can watch any of them again first.';
      else
        -- The wait is over, so a fresh block has begun and zero used is
        -- now the truth.
        v_opens := null;
      end if;
    end if;
  end if;

  if v_passed then
    v_can := false;
    v_why := 'You have already passed this.';
    v_opens := null;
  elsif v_can and v_qs = 0 then
    v_can := false;
    v_why := 'There are no questions in this one yet. Please tell your tutor.';
  end if;

  -- An unfinished try is always startable: it is the one you carry on with.
  if v_open is not null and not v_passed then
    v_can := true; v_why := ''; v_opens := null;
  end if;

  return query select
    case when v_check then 'check' else 'quiz' end,
    v_q.title,
    v_q.pass_percent,
    v_qs,
    case when v_check then 0 else v_q.max_attempts end,
    v_in_window,
    case when v_check then null else greatest(0, v_q.max_attempts - v_in_window) end,
    v_passed,
    v_best,
    v_open,
    v_opens,
    v_can,
    v_why;
end $$;

revoke all on function lms_quiz_status(uuid) from public, anon;
grant execute on function lms_quiz_status(uuid) to authenticated;


-- =====================================================================
-- STEP 5  FEEDBACK, THE RIGHT WAY ROUND.
--
-- The old lms_attempt_marks had the rule backwards in both directions
-- at once, and the comment above it described a third thing again.
--
--   It marked every question right or wrong for ANY submitted try,
--   module quizzes included. Three tries at a ten question quiz, told
--   which ones were wrong each time, is solvable by elimination without
--   ever watching a lesson.
--
--   And it showed the explanation ONLY when the answer was right, which
--   is precisely when nobody needs it.
--
-- The rule now:
--
--   A LESSON CHECK  every question, right or wrong, with its
--                   explanation. A check is learning, and the
--                   explanation is the thing being learned
--
--   A MODULE QUIZ   nothing at all until the learner has passed it.
--                   Then the full review, explanations and all, because
--                   at that point it is revision rather than a leak
-- =====================================================================
create or replace function lms_attempt_marks(p_attempt uuid)
returns table (question_id uuid, prompt text, was_right boolean, explanation text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_a lms_quiz_attempts%rowtype; v_given jsonb; r record; v_ok boolean;
  v_check boolean; v_passed boolean;
begin
  select * into v_a from lms_quiz_attempts where id = p_attempt and user_id = auth.uid();
  if not found or v_a.submitted_at is null then return; end if;

  select (q.lesson_id is not null) into v_check from lms_quizzes q where q.id = v_a.quiz_id;

  -- A module quiz gives away nothing until it has been passed.
  if not coalesce(v_check, false) then
    select bool_or(coalesce(a.passed, false)) into v_passed
      from lms_quiz_attempts a
     where a.user_id = auth.uid() and a.quiz_id = v_a.quiz_id;
    if not coalesce(v_passed, false) then return; end if;
  end if;

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
    -- The explanation always. Being told why, when you were wrong, is
    -- the only part of this that teaches anybody anything.
    return query select r.id, r.prompt, v_ok, r.explanation;
  end loop;
end $$;

grant execute on function lms_attempt_marks(uuid) to authenticated;


-- =====================================================================
-- STEP 6  ONE CALL FOR A WHOLE LEARNING PAGE.
--
-- /lms/learn/:slug draws the ring, the resume button, every module with
-- every lesson and its state, each module quiz's status, and the
-- certificate checklist. Built from the tables directly that is a dozen
-- round trips, and on a phone on a Nigerian mobile connection a dozen
-- round trips is the difference between a page and a wait.
--
-- It is also the only way the page and the player can agree. They draw
-- the same outline, so they read it from the same place.
--
-- NEVER A VIDEO REFERENCE. Not here, not anywhere except
-- lms_open_lesson, which asks whether the lesson is open to you first.
-- There is a test that reads this function's whole output and fails if
-- a reference ever appears in it.
--
-- UNLOCKING IS WORKED OUT IN ONE PASS rather than by calling
-- lms_is_lesson_unlocked once per lesson. A lesson is open if it is the
-- first in the course or the one before it is complete, and "the one
-- before" is a window function over the lessons in order. Same answer,
-- one scan.
--
-- A COURSE EDITED WHILE SOMEBODY IS PART WAY THROUGH is the normal
-- case, not an edge case. Everything here is counted from the lessons
-- that exist NOW, and progress rows for lessons that have been removed
-- simply do not join. A learner never sees a broken page because a
-- tutor tidied a module.
-- =====================================================================
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


-- =====================================================================
-- STEP 7  THE LAST SEVEN DAYS.
--
-- Always seven rows, today last, with zero for a day nothing was
-- watched. Seven rows every time means the chart is the same width
-- whatever the week held, and a quiet Wednesday is a visible gap rather
-- than a missing bar that shifts everything along.
-- =====================================================================
create or replace function lms_my_week()
returns table (day date, seconds integer, minutes integer)
language sql stable security definer set search_path = public as $$
  select d::date,
         coalesce(w.seconds, 0),
         round(coalesce(w.seconds, 0) / 60.0)::integer
    from generate_series(
           (now() at time zone 'Africa/Lagos')::date - 6,
           (now() at time zone 'Africa/Lagos')::date,
           interval '1 day') d
    left join lms_watch_days w
      on w.day = d::date and w.user_id = auth.uid()
   where auth.uid() is not null
   order by d
$$;

revoke all on function lms_my_week() from public, anon;
grant execute on function lms_my_week() to authenticated;


-- =====================================================================
-- STEP 8  MY LEARNING.
--
-- Every course the learner can open or has already started, and every
-- certificate they hold. Two calls for the whole of /lms/me.
--
-- "Can open or has started" is deliberately generous: a course whose
-- access has lapsed still appears, so somebody does not open the page
-- and find work they did has disappeared without explanation. The
-- has_access flag says which is which and the page can say so.
-- =====================================================================
create or replace function lms_my_courses()
returns table (
  course_id        uuid,
  slug             text,
  title            text,
  cover_code       text,
  tool             text,
  level            text,
  lesson_count     integer,
  quiz_count       integer,
  lessons_done     integer,
  quizzes_passed   integer,
  percent          numeric,
  has_access       boolean,
  started          boolean,
  last_activity    timestamptz,
  resume_lesson_id uuid,
  resume_lesson_title text,
  resume_second    integer,
  certificate_number text
)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;

  return query
  with mine as (
    select c.* from lms_courses c
     where c.status = 'published'
       and (lms_has_course_access(c.id)
            or c.price_kobo = 0
            or exists (select 1 from lms_lesson_progress p
                        join lms_lessons le on le.id = p.lesson_id
                        join lms_modules mo on mo.id = le.module_id
                       where mo.course_id = c.id and p.user_id = v_uid))
  ),
  lesson as (
    select le.id, le.title, le.position as lpos, mo.course_id,
           mo.position as mpos,
           row_number() over (partition by mo.course_id
                              order by mo.position, le.position) as seq
      from lms_lessons le
      join lms_modules mo on mo.id = le.module_id
     where mo.course_id in (select id from mine)
  ),
  state as (
    select l.*, coalesce(p.completed, false) as completed,
           coalesce(p.last_position_seconds, 0) as last_position,
           p.updated_at
      from lesson l
      left join lms_lesson_progress p on p.lesson_id = l.id and p.user_id = v_uid
  ),
  unlocked as (
    select s.*, coalesce(lag(s.completed) over (partition by s.course_id order by s.seq),
                         true) as is_unlocked
      from state s
  ),
  resume as (
    select distinct on (u.course_id) u.course_id, u.id, u.title, u.last_position
      from unlocked u
     where not u.completed and u.is_unlocked
     order by u.course_id, u.seq
  ),
  quiz as (
    select mo.course_id, z.id,
           (select bool_or(coalesce(a.passed,false)) from lms_quiz_attempts a
             where a.user_id = v_uid and a.quiz_id = z.id) as passed
      from lms_quizzes z join lms_modules mo on mo.id = z.module_id
     where mo.course_id in (select id from mine) and z.status = 'published'
  )
  select m.id, m.slug, m.title, m.cover_code, m.tool, m.level::text,
         (select count(*)::integer from unlocked u where u.course_id = m.id),
         (select count(*)::integer from quiz q where q.course_id = m.id),
         (select count(*)::integer from unlocked u where u.course_id = m.id and u.completed),
         (select count(*)::integer from quiz q where q.course_id = m.id and q.passed),
         case when (select count(*) from unlocked u where u.course_id = m.id)
                 + (select count(*) from quiz q where q.course_id = m.id) = 0 then 0::numeric
              else round(100.0 *
                   ((select count(*) from unlocked u where u.course_id = m.id and u.completed)
                  + (select count(*) from quiz q where q.course_id = m.id and q.passed))
                   / ((select count(*) from unlocked u where u.course_id = m.id)
                    + (select count(*) from quiz q where q.course_id = m.id)), 0) end,
         (lms_has_course_access(m.id) or m.price_kobo = 0),
         exists (select 1 from unlocked u where u.course_id = m.id
                   and (u.completed or u.last_position > 0)),
         (select max(u.updated_at) from unlocked u where u.course_id = m.id),
         (select r.id from resume r where r.course_id = m.id),
         (select r.title from resume r where r.course_id = m.id),
         (select r.last_position from resume r where r.course_id = m.id),
         (select c.certificate_number from certificates c
            join lms_profiles pr on pr.participant_id = c.participant_id
           where pr.id = v_uid and c.programme_id = m.programme_id
             and c.module_id is null and not c.revoked limit 1)
    from mine m
   order by (select max(u.updated_at) from unlocked u where u.course_id = m.id)
            desc nulls last, m.title;
end $$;

revoke all on function lms_my_courses() from public, anon;
grant execute on function lms_my_courses() to authenticated;


-- An Academy certificate is a certificates row with no module on it,
-- for a programme that an Academy course points at. That is exactly
-- what lms_claim_course_certificate writes, and reading it back the
-- same way means the two can never disagree about what counts.
create or replace function lms_my_certificates()
returns table (
  certificate_number text,
  course_title       text,
  course_slug        text,
  issued_on          date,
  revoked            boolean
)
language sql stable security definer set search_path = public as $$
  select c.certificate_number, co.title, co.slug, c.completed_on, c.revoked
    from certificates c
    join lms_profiles pr on pr.participant_id = c.participant_id
    join lms_courses co on co.programme_id = c.programme_id
   where pr.id = auth.uid()
     and auth.uid() is not null
     and c.module_id is null
   order by c.completed_on desc, co.title
$$;

revoke all on function lms_my_certificates() from public, anon;
grant execute on function lms_my_certificates() to authenticated;


-- =====================================================================
-- STEP 9  Permissions stay tight.
--
-- Supabase grants every privilege on anything new in the public schema
-- to anon and authenticated, so a new table is wide open until this
-- runs. lms_watch_days is new, so this is not a formality here.
--
-- lms_storage_report and lms_tidy_table_privileges both work by looping
-- over every table whose name begins lms_, so the new table is picked
-- up by both with no change to either. 15_verify.sql proves it rather
-- than taking it on trust.
-- =====================================================================
do $$
declare v_n integer;
begin
  select tables_tidied into v_n from lms_tidy_table_privileges();
  raise notice 'Step 9: checked permissions on % Academy tables and views.', v_n;
end $$;

do $$ begin raise notice 'File 15 finished. Now run 15_verify.sql.'; end $$;
