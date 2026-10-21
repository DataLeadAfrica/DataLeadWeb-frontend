-- ====================================================================
-- FILE 20. Every video lesson gets its check, so a course can be
-- published at all.
-- ====================================================================
--
-- Run this AFTER file 19. One transaction, safe to run twice.
--
-- THE FAULT, WHICH WAS LIVE AND WAS MINE. Nothing in the control room
-- ever created a lesson check.
--
-- Big Sam found it building the first real course. On the Questions
-- page for a lesson whose check says "NONE YET", writing a question
-- answered:
--
--   invalid input syntax for type uuid: ""
--
-- The page takes its quiz id from the lesson's check, which is null for
-- a lesson that has none, and renders the editor with an empty string.
-- Every lesson made in the builder had no check, so that was every
-- lesson.
--
-- The error is the smaller half. Publish check 7 is "every video lesson
-- has a lesson check", so no course built in the control room could be
-- published, ever. The control room's whole purpose is building a
-- course and putting it live, and it could not do it.
--
-- WHY MY 6B TESTS MISSED IT. They built their course from a fixture
-- that already had checks in place, so the path a facilitator actually
-- walks, from lms_create_course to publish, was never run end to end.
-- file_20_tests.sql now walks exactly that path and inserts nothing by
-- hand, which is the test that would have caught this on the day.
--
-- Big Sam has already run a stopgap on live that gives a draft check to
-- every video lesson without one. Step 2 is the same sweep, so a
-- rebuild lands in the same place, and it is written to be safe
-- alongside what he ran rather than instead of it.

begin;

-- -------------------------------------------------------------- step 0
do $$
declare v_missing text[] := '{}';
begin
  if to_regprocedure('public.lms_save_lesson(uuid, uuid, text, text, lms_lesson_type, text, integer, text)') is null then
    v_missing := v_missing || 'lms_save_lesson (file 17)'::text;
  end if;
  if to_regprocedure('public.lms_may_edit_course(uuid)') is null then
    v_missing := v_missing || 'lms_may_edit_course (file 17)'::text;
  end if;
  if to_regprocedure('public.lms_publish_checks(uuid)') is null then
    v_missing := v_missing || 'lms_publish_checks (file 17)'::text;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'lms_profiles'
                    and column_name = 'email_verified_at') then
    v_missing := v_missing || 'email_verified_at (file 19)'::text;
  end if;
  if array_length(v_missing, 1) is not null then
    raise exception 'File 20 cannot run yet. Missing: %', array_to_string(v_missing, ', ');
  end if;
  raise notice 'Step 0: files 01 to 19 are in place.';
end $$;

-- -------------------------------------------------------------- step 1
-- The lesson save, which now makes the check.
create or replace function lms_save_lesson(
  p_lesson uuid default null,
  p_module uuid default null,
  p_title text default null,
  p_summary text default null,
  p_type lms_lesson_type default null,
  p_video_ref text default null,
  p_duration_seconds integer default null,
  p_chapters_text text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_lesson; v_course uuid; v_pos integer; v_ref text;
begin
  select m.course_id into v_course from lms_modules m
   where m.id = coalesce(p_module, (select l.module_id from lms_lessons l where l.id = p_lesson));
  if not lms_may_edit_course(v_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;

  -- A YouTube address, in any of the forms somebody might paste, down to
  -- the eleven character id. Anything that is already just an id is left
  -- alone.
  v_ref := nullif(btrim(coalesce(p_video_ref, '')), '');
  if v_ref is not null then
    v_ref := coalesce(
      substring(v_ref from 'youtu\.be/([A-Za-z0-9_-]{6,})'),
      substring(v_ref from '[?&]v=([A-Za-z0-9_-]{6,})'),
      substring(v_ref from 'embed/([A-Za-z0-9_-]{6,})'),
      v_ref);
    if v_ref !~ '^[A-Za-z0-9_-]{6,}$' then
      raise exception '% is not a YouTube link or id.', btrim(p_video_ref) using errcode = '22023';
    end if;
  end if;

  if v_id is null then
    select coalesce(max(l.position), 0) + 1 into v_pos from lms_lessons l where l.module_id = p_module;
    insert into lms_lessons (module_id, title, summary, type, position,
                             video_provider, video_ref, duration_seconds, coverage_percent)
    values (p_module, coalesce(btrim(p_title), 'Untitled lesson'), coalesce(p_summary, ''),
            coalesce(p_type, 'video'), v_pos,
            case when v_ref is null then null else 'youtube' end, v_ref,
            p_duration_seconds, 100)
    returning id into v_id;
  else
    update lms_lessons
       set title = coalesce(nullif(btrim(p_title), ''), title),
           summary = coalesce(p_summary, summary),
           type = coalesce(p_type, type),
           video_provider = case when v_ref is null then video_provider else 'youtube' end,
           video_ref = coalesce(v_ref, video_ref),
           duration_seconds = coalesce(p_duration_seconds, duration_seconds)
     where id = v_id;
  end if;

  -- The chapters, through file 16's parser, which refuses a bad list
  -- with a message naming the line.
  if p_chapters_text is not null then
    perform lms_set_lesson_chapters(v_id, p_chapters_text);
  end if;

  -- ------------------------------------------------------------------
  -- AND A VIDEO LESSON GETS ITS CHECK, HERE, AS IT IS MADE.
  -- ------------------------------------------------------------------
  -- Nothing in the control room created one. Every lesson built in the
  -- builder therefore had no check, so the Questions page took its quiz
  -- id from a null and rendered the editor with an empty string, and
  -- lms_save_question answered "invalid input syntax for type uuid".
  --
  -- Worse than the error: publish check 7 is "every video lesson has a
  -- lesson check", so no course built in the control room could ever be
  -- published. The one thing the control room exists to do could not be
  -- done, and my 6B tests missed it because the course they built came
  -- with a check already in place.
  --
  -- WHY HERE AND NOT IN AN ensure FUNCTION THE PAGE CALLS. Check 7 is a
  -- statement about every video lesson, not about every video lesson
  -- somebody has visited. If the check were made when the Questions
  -- page opened, a facilitator who built ten lessons and opened three
  -- would see check 7 fail and be told to go and look at pages one at a
  -- time until it passed. Making it with the lesson means the thing
  -- check 7 asserts is true from the moment the lesson exists.
  --
  -- It also covers a lesson whose type is CHANGED to video later, which
  -- an ensure function hanging off one page would not.
  --
  -- A lesson that stops being a video keeps its check. It is invisible
  -- to check 7, which only looks at video lessons, and somebody may
  -- have written questions into it. Deleting a person's work to tidy up
  -- a row is the wrong trade.
  --
  -- Values are file 10's, from lms_create_quiz, so a check made here and
  -- one made there are the same thing: pass everything, twenty tries, no
  -- wait between them, shuffled, and a draft until an administrator
  -- publishes it.
  if (select l.type from lms_lessons l where l.id = v_id) = 'video'
     and not exists (select 1 from lms_quizzes q where q.lesson_id = v_id) then
    -- lesson_id ONLY. lms_quizzes_one_owner_ck allows exactly one of
    -- lesson_id, module_id, course_id and path_id to be set, so naming
    -- the course here as well is refused. The course is reached through
    -- the lesson's module, which is how every other reader of a lesson
    -- check finds it.
    insert into lms_quizzes (lesson_id, title, pass_percent,
                             max_attempts, retake_after_minutes, shuffle, status)
    values (v_id, 'Check what you remember', 100, 20, 0, true, 'draft');
  end if;

  return v_id;
end $$;

-- -------------------------------------------------------------- step 2
-- Every video lesson that already exists without a check.
--
-- The same sweep Big Sam ran by hand, so a rebuild from the numbered
-- files lands where live already is. Archived courses are left alone:
-- they are not going to be published and a check nobody will use is
-- just a row.
--
-- Safe to run twice, and safe to run after his stopgap, because it only
-- touches lessons that have no check at all.
do $$
declare v_made integer;
begin
  insert into lms_quizzes (lesson_id, title, pass_percent,
                           max_attempts, retake_after_minutes, shuffle, status)
  select l.id, 'Check what you remember', 100, 20, 0, true, 'draft'
    from lms_lessons l
    join lms_modules m on m.id = l.module_id
    join lms_courses c on c.id = m.course_id
   where l.type = 'video'
     and c.status <> 'archived'
     and not exists (select 1 from lms_quizzes q where q.lesson_id = l.id);
  get diagnostics v_made = row_count;
  raise notice 'Step 2: % video lesson(s) that had no check now have a draft one. '
               'Run again and it will be 0, which is the point.', v_made;
end $$;

-- -------------------------------------------------------------- step 3
-- lms_create_quiz: the course check it never had, and the grant it
-- should not have.
--
-- It is granted to authenticated by file 10 step 8 and guards itself
-- with lms_can_edit(), which asks "are you staff" and not "is this
-- yours". So any facilitator could attach a set of questions to any
-- lesson of anybody's course. Nothing in the site calls it, so nobody
-- has, but a function that is reachable and wrong is a fault whether or
-- not it has been used.
--
-- BOTH, NOT EITHER. Revoking alone would be undone the next time file
-- 10 is run, because its step 8 grants it again. Fixing the body alone
-- would leave a function nothing needs exposed to every signed in
-- member of staff. So the body learns the course rule and the grant
-- goes, and re-running file 10 then re-grants a function that refuses
-- somebody else's lesson anyway.
do $$
begin
  if to_regprocedure('public.lms_create_quiz(uuid, uuid, text)') is null then
    raise notice 'Step 3: lms_create_quiz is not here, so there is nothing to tighten.';
    return;
  end if;

  execute $body$
    create or replace function lms_create_quiz(p_lesson uuid, p_module uuid, p_title text default '')
    returns uuid
    language plpgsql security definer set search_path = public as $inner$
    declare v_id uuid; v_course uuid;
    begin
      if (p_lesson is null) = (p_module is null) then
        raise exception 'A set of questions belongs to either a lesson or a module, not both.';
      end if;

      -- WHOSE COURSE IS THIS. The old guard was lms_can_edit(), which
      -- is "are you staff" and lets a facilitator write into anybody's
      -- course. lms_may_edit_course is the rule the rest of the builder
      -- uses, and an administrator passes it for every course.
      select m.course_id into v_course
        from lms_modules m
       where m.id = coalesce(p_module, (select l.module_id from lms_lessons l where l.id = p_lesson));

      if v_course is null then
        raise exception 'That lesson or module does not exist.' using errcode = '22023';
      end if;
      if not lms_may_edit_course(v_course) then
        raise exception 'That course is not yours.' using errcode = '42501';
      end if;

      -- One owner only, as the table's own rule requires: whichever of
      -- the lesson or the module was given, never both and never the
      -- course alongside them.
      insert into lms_quizzes (lesson_id, module_id, title, pass_percent,
                               max_attempts, retake_after_minutes, shuffle, status)
      values (p_lesson, p_module,
              coalesce(nullif(btrim(p_title), ''),
                       case when p_lesson is not null then 'Check what you remember'
                            else 'Module quiz' end),
              100, 20, 0, true, 'draft')
      returning id into v_id;
      return v_id;
    end $inner$;
  $body$;

  -- PUBLIC FIRST, and that is the whole of it. A function is executable
  -- by PUBLIC the moment it is created, so revoking from authenticated
  -- and anon leaves every signed in caller holding the grant through
  -- PUBLIC anyway. has_function_privilege still answered yes and the
  -- test caught it.
  revoke execute on function lms_create_quiz(uuid, uuid, text) from public, anon, authenticated;
  raise notice 'Step 3: lms_create_quiz now asks whose course it is, and is no longer granted '
               'to signed in callers. Nothing in the site calls it.';
end $$;

-- -------------------------------------------------------------- step 4
do $$
declare v_without integer;
begin
  select count(*) into v_without
    from lms_lessons l
    join lms_modules m on m.id = l.module_id
    join lms_courses c on c.id = m.course_id
   where l.type = 'video' and c.status <> 'archived'
     and not exists (select 1 from lms_quizzes q where q.lesson_id = l.id);
  raise notice 'Step 4: % video lesson(s) in a course that is not archived still have no check '
               '(0 is right).', v_without;
end $$;

-- -------------------------------------------------------------- step 5
-- The one line that stopped every lesson save on live, and the grant
-- that let a facilitator rewrite anybody's chapters.
--
-- Supabase loads pg-safeupdate for API requests, so a bare "delete
-- from" inside this function failed on every save. Big Sam saw it while
-- editing "What this lesson covers". It was fixed by hand on live, and
-- this is that same fix, so a database brought up to date by the
-- numbered files lands where live already is.
--
-- The second half is the grant. This function asks lms_is_staff(),
-- which is "are you staff" and not "is this yours", so any facilitator
-- could call it directly and rewrite the chapters of a lesson in
-- anybody's live course. Nothing in src/ calls it: only lms_save_lesson
-- does, and that checks the course first. So the grant goes and is not
-- given back.
create or replace function lms_set_lesson_chapters(p_lesson uuid, p_text text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n   integer := 0;
  v_dur integer;
begin
  if not lms_is_staff() then
    raise exception 'Only staff can set a lesson''s chapters.';
  end if;
  if not exists (select 1 from lms_lessons where id = p_lesson) then
    raise exception 'No such lesson.';
  end if;

  select duration_seconds into v_dur from lms_lessons where id = p_lesson;

  -- Parse first. If it raises, nothing below runs and the old chapters
  -- are still there.
  create temporary table if not exists tmp_chapters (start_seconds integer, title text) on commit drop;
  -- "where true", not a bare delete, and this is not a matter of taste.
  --
  -- Supabase loads pg-safeupdate for API requests. It refuses any
  -- DELETE or UPDATE with no WHERE clause, inside a security definer
  -- function as much as anywhere else. lms_save_lesson calls this on
  -- every save, so a bare delete here meant EVERY LESSON SAVE ON LIVE
  -- FAILED with "DELETE requires a WHERE clause", which is what Big Sam
  -- saw while editing a lesson summary.
  --
  -- I first wrote truncate, which satisfies the guard just as well.
  -- This is the form Big Sam ran on live, and the repository matches
  -- live rather than the other way round.
  delete from tmp_chapters where true;
  insert into tmp_chapters select * from lms_parse_chapters(p_text);

  if v_dur is not null and v_dur > 0 then
    if exists (select 1 from tmp_chapters where start_seconds >= v_dur) then
      raise exception 'A chapter starts at or after the end of the video, which is % seconds long.', v_dur;
    end if;
  end if;

  delete from lms_lesson_chapters where lesson_id = p_lesson;
  insert into lms_lesson_chapters (lesson_id, start_seconds, title)
  select p_lesson, start_seconds, title from tmp_chapters;
  get diagnostics v_n = row_count;

  update lms_lessons set chapters_text = p_text, updated_at = now() where id = p_lesson;
  return v_n;
end $$;

-- And the grant, removed. PUBLIC named first, because a function is
-- executable by PUBLIC from the moment it is created and revoking the
-- two roles alone leaves the grant standing through it. That caught me
-- out on lms_create_quiz in this same file.
revoke execute on function lms_set_lesson_chapters(uuid, text) from public, anon, authenticated;

do $$
begin
  raise notice 'Step 5: lms_set_lesson_chapters clears its scratch table with a WHERE clause, '
               'and is no longer callable by a signed in browser. Only lms_save_lesson calls it, '
               'and that checks whose course it is first.';
end $$;

commit;
