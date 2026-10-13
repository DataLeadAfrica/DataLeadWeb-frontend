-- =====================================================================
-- show-test-course.sql
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
--   update lms_courses set status = 'draft' where slug = 'p4-test-course';
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
