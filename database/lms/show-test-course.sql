-- =====================================================================
-- show-test-course.sql
--
-- SUPERSEDED. DO NOT RUN THIS.
--
-- Dr Ayoola retired it on 15 October 2026. The Phase 4 test course it
-- puts on the site is out of date: the restructure in file 16 moved and
-- renamed enough that the course no longer represents what a course is,
-- so putting it in front of anybody would be showing them something
-- wrong rather than something unfinished.
--
-- WHAT REPLACED IT. The first real course built in the control room is
-- the live test now. That is a better test than this file ever was,
-- because it exercises the thing people will actually use: the builder,
-- the nine publish checks, the lesson checks, the exam and the
-- certificate programme, in the order a facilitator meets them.
--
-- The file is kept rather than deleted so that anybody who finds it
-- referred to in an older document can see what it did and why it
-- stopped. Everything below this line is the file as it was.
--
-- ---------------------------------------------------------------------
--
-- ONCE FILE 17 HAS BEEN RUN, THIS FILE IS REFUSED. Measured, not
-- guessed: file 17 makes lms_publish_course run the nine publish
-- checks, and the Phase 4 test course fails three of them.
--
--   7  Every video lesson has a lesson check     3 of 3 have no check
--   8  Has a certificate programme               it has none
--   9  The course exam has enough questions      it has no exam
--
-- The last line then reads:
--
--   published | message
--   f         | This course is not ready yet, followed by the three
--               checks above, named in order.
--
-- THAT IS THE CHECKS WORKING, NOT A FAULT. The test course was never a
-- finished course: it is three lessons with no checks, no exam and no
-- programme, which is exactly what it was for. A gate that let it
-- through would let anything through.
--
-- SO WHEN DO YOU RUN THIS? Before file 17, and not after. If the test
-- course is needed live once file 17 is in, there are two honest ways:
--
--   1. Finish it. Give it a programme, write a check on each lesson and
--      fill its exam bank, and it will publish like any other course.
--      That is a day's work for a course nobody is meant to take.
--
--   2. Put it live by hand, which skips the checks on purpose:
--
--        update lms_courses
--           set status = 'published', published_at = coalesce(published_at, now())
--         where slug = 'p4-test-course'
--
--      Nothing is logged by that, because nothing called the function
--      that logs. Use it for a test and hide the course again after,
--      with the line further down.
--
-- Publishes the Phase 4 test course again, so the Phase 5 test can be
-- run. It was hidden on 12 October because the Academy had reached the
-- live site by accident and anybody could have signed up for it and
-- earned a real certificate.
--
-- IT RUNS AS THE FIRST ADMINISTRATOR. The SQL Editor is not signed in
-- as anybody, and lms_publish_course refuses anybody who is not an
-- administrator, so the two set_config lines borrow the first
-- administrator's identity for the length of this transaction. They are
-- local to it: nothing is left set afterwards.
--
-- ONE TRANSACTION, so either the whole thing happens or none of it
-- does. Safe to run twice.
--
-- The last line should say: p4-test-course | published
--
-- HIDE IT AGAIN when the test is finished:
--   update lms_courses set status = 'draft' where slug = 'p4-test-course'
-- =====================================================================

begin;
select set_config('request.jwt.claim.sub', a.id::text, true),
       set_config('request.jwt.claims',
                  json_build_object('sub', a.id, 'role', 'authenticated')::text, true)
  from (select id from lms_profiles where role = 'admin' order by id limit 1) a;
do $$
begin
  if not exists (select 1 from lms_profiles where role = 'admin') then
    raise exception 'No administrator account found. Nothing has been changed.';
  end if;
  if not exists (select 1 from lms_courses where slug = 'p4-test-course') then
    raise exception 'The test course was not found. Nothing has been changed.';
  end if;
end $$;
select * from lms_publish_course((select id from lms_courses where slug = 'p4-test-course'));
select slug, status from lms_courses where slug = 'p4-test-course';
commit;
