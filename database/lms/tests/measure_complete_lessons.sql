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
-- every learner completes every lesson. On m_after the triggers fire.
set role postgres;
select set_config('request.jwt.claim.sub','',false);
insert into lms_lesson_progress (user_id, lesson_id, last_position_seconds, completed, completed_at, check_passed)
select ('aaaa0000-0000-0000-0000-' || lpad(u::text,12,'0'))::uuid,
       ('99999999-0000-0000-0001-' || lpad(l::text,12,'0'))::uuid, 600, true, now(), true
  from generate_series(1,20) u, generate_series(1,30) l
on conflict (user_id, lesson_id) do nothing;
reset role;
