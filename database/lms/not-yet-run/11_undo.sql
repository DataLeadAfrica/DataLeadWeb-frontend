-- =====================================================================
-- UNDO file 11. Only if something has gone wrong.
--
-- READ THIS FIRST. There is one thing this undo cannot put back.
--
-- File 11 deletes a learner's lesson check attempts once they finish the
-- lesson, and that is safe ONLY because file 11 also changed
-- lms_complete_lesson to read the pass from lms_lesson_progress instead
-- of from the attempts table.
--
-- Those attempts are gone. If you revert lms_complete_lesson to the
-- version in 05_functions.sql, it will start looking for a passed
-- attempt again, find none, and refuse to let those learners finish
-- lessons they have ALREADY finished. There is no way back from that
-- except restoring a backup.
--
-- So this file does NOT revert lms_complete_lesson, and it does NOT drop
-- the three progress columns. It removes the automatic deleting, the
-- prune, the report and the empty-questions rules, and leaves the two
-- things that keep existing learners working. The last section explains
-- what to do if you want a full revert anyway.
-- =====================================================================

-- ---------------- the nightly prune ----------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute $c$ select cron.unschedule('lms-prune-watch-buckets') $c$;
      raise notice 'nightly prune unscheduled.';
    exception when others then
      raise notice 'there was no nightly prune to unschedule.';
    end;
  end if;
end $$;

drop function if exists lms_prune_watch_buckets(integer);
drop function if exists lms_prune_job_status();

-- ---------------- the storage report ----------------
drop function if exists lms_storage_report();

-- ---------------- the automatic deleting ----------------
-- After this, completing a lesson keeps its watch slices and its check
-- attempts, the way it did before file 11. Storage starts growing again.
drop trigger if exists t_progress_tidy_up on lms_lesson_progress;
drop function if exists lms_progress_tidy_up();

-- The coverage figure keeps being recorded, because lms_watch_coverage
-- reads it and attempts have already been deleted for some learners.
-- To stop recording it too, uncomment these two lines:
-- drop trigger if exists t_progress_keep_coverage on lms_lesson_progress;
-- drop function if exists lms_progress_keep_coverage();

-- ---------------- the empty questions rules ----------------
drop trigger if exists t_guard_quiz_has_questions on lms_quizzes;
drop function if exists lms_guard_quiz_not_empty();

-- lms_course_blockers goes back to the six checks from 05, without the
-- seventh about empty sets of questions.
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
grant execute on function lms_course_blockers(uuid) to authenticated, anon;

-- ---------------- what is deliberately left in place ----------------
-- lms_complete_lesson        reads check_passed. Reverting it would lock
--                            out every learner whose attempts have gone.
-- lms_watch_coverage         reads final_coverage when a lesson is
--                            complete. Reverting it would report zero
--                            coverage for every completed lesson.
-- lms_submit_quiz            refuses an attempt with nothing to mark and
--                            writes the pass onto the progress row. Both
--                            are improvements with no down side, and the
--                            second is what keeps completion working.
-- final_coverage, check_passed, check_passed_at
--                            hold real data now. Dropping them loses it.
-- The tightened table permissions from file 10 are untouched.

-- =====================================================================
-- IF YOU REALLY WANT A FULL REVERT
--
-- Only do this on a database where NO lesson check attempt has been
-- deleted yet, which in practice means one where no learner has
-- completed a lesson since file 11 was run. Check first:
--
--   select count(*) from lms_lesson_progress p
--    where p.completed
--      and exists (select 1 from lms_quizzes q
--                   where q.lesson_id = p.lesson_id and q.status = 'published')
--      and not exists (select 1 from lms_quiz_attempts a
--                       join lms_quizzes q2 on q2.id = a.quiz_id
--                      where a.user_id = p.user_id and q2.lesson_id = p.lesson_id);
--
-- If that returns 0, nobody depends on the new behaviour and you can
-- re-run 05_functions.sql and then 07_quizzes.sql to restore the four
-- replaced functions, then drop the three columns.
--
-- If it returns anything above 0, that many learner-lessons would break.
-- Stop and ask.
-- =====================================================================
