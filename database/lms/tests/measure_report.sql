-- =====================================================================
-- DO NOT RUN THIS ON SUPABASE. LOCAL POSTGRESQL ONLY.
--
-- The seed files in this folder begin by DELETING every participant,
-- certificate, enrolment, programme and user account, because a test
-- database has to start from a known empty state. On the live database
-- that is not a test, it is the end of the certification system.
--
-- Nothing in this folder ever needs running by hand. It is committed so
-- the repository holds the evidence that the numbered files were tested,
-- and so somebody can re-run it on a local copy years from now.
-- =====================================================================
set role postgres;
select set_config('request.jwt.claim.sub','',false);
analyze;
select 'watch slices' as what, count(*)::text as rows from lms_watch_buckets
union all select 'progress rows', count(*)::text from lms_lesson_progress
union all select 'lesson check attempts', count(*)::text from lms_quiz_attempts a
  join lms_quizzes q on q.id=a.quiz_id where q.lesson_id is not null
union all select 'module quiz attempts', count(*)::text from lms_quiz_attempts a
  join lms_quizzes q on q.id=a.quiz_id where q.module_id is not null
union all select 'LEARNER DATA BYTES', (
  pg_total_relation_size('lms_watch_buckets') + pg_total_relation_size('lms_lesson_progress')
  + pg_total_relation_size('lms_quiz_attempts'))::text
union all select 'WHOLE DATABASE', pg_size_pretty(pg_database_size(current_database()))
order by 1;
reset role;
