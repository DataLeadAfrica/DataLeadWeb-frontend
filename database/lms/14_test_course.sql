-- =====================================================================
-- ONE REAL COURSE, for the Phase 5 test on the live database.
--
-- Run this in the Supabase SQL editor AFTER 14_public_catalogue.sql.
-- Safe to run twice: it removes its own course first.
--
-- It is left as a DRAFT. Nothing appears on the public pages until you
-- publish it, and the last section of this file shows you how, along
-- with how to take it down again afterwards.
--
-- WHAT IT IS FOR. Phase 5 needs one course that behaves like a real one,
-- so the catalogue page, the course page, the share picture, the sitemap
-- and the search engine copy can all be looked at with real words in
-- them. Everything in it is deliberately marked as a test, so that if it
-- is ever published by accident, anybody reading it can see what it is.
--
-- THE VIDEO. The three lessons point at a YouTube id that does not
-- exist. The player is Phase 4, so nothing plays this yet, and a made up
-- id is better than borrowing somebody's video. Replace them when you
-- have real recordings.
-- =====================================================================

-- ------------------------------------------------------------ clean up
delete from lms_entitlements where course_id in
  (select id from lms_courses where slug = 'test-course-do-not-share');
delete from lms_questions where quiz_id in
  (select q.id from lms_quizzes q join lms_modules m on m.id = q.module_id
    join lms_courses c on c.id = m.course_id
   where c.slug = 'test-course-do-not-share');
delete from lms_quizzes where module_id in
  (select m.id from lms_modules m join lms_courses c on c.id = m.course_id
    where c.slug = 'test-course-do-not-share');
delete from lms_lessons where module_id in
  (select m.id from lms_modules m join lms_courses c on c.id = m.course_id
    where c.slug = 'test-course-do-not-share');
delete from lms_modules where course_id in
  (select id from lms_courses where slug = 'test-course-do-not-share');
delete from lms_courses where slug = 'test-course-do-not-share';


-- ------------------------------------------------------------ the course
-- The programme is whichever one is marked active and comes first. A
-- course cannot be published without one, because that is what numbers
-- the certificate at the end.
insert into lms_courses (
  slug, title, tool, area, level, summary, cover_code,
  price_kobo, first_module_free, status, programme_id,
  outcomes, audience, prerequisites, faq, seo_title, seo_description
) values (
  'test-course-do-not-share',
  'Test course, please ignore',
  'STATA',
  'Analysis',
  'Beginner',
  'A short test course used to check the Academy pages before the real '
  || 'courses open. Nothing in it is real teaching.',
  'TC',
  1000000,            -- 10,000 naira, in kobo
  true,               -- the first module is free, so the FREE tags can be seen
  'draft',
  (select id from programmes where active order by created_at limit 1),
  array[
    'See how a course page looks with real words in it',
    'Check that the curriculum, the lengths and the free tags all appear',
    'Confirm the share picture and the search engine copy are right'
  ],
  array[
    'Whoever is testing the Academy before it opens',
    'Nobody else'
  ],
  array[
    'Nothing at all',
    'This course teaches nothing and is here to be looked at'
  ],
  '[{"question":"Is this a real course?",
     "answer":"No. It exists so the pages can be checked before the real courses open."},
    {"question":"Why can I see it?",
     "answer":"Somebody published it to test the site. It will be taken down again."}]'::jsonb,
  'Test Course | Data-Lead Academy',
  'A test course used to check the Academy pages before the real courses open. Not real teaching.'
);

-- ----------------------------------------------------------- module one
-- Free, because first_module_free is true and this is position 1.
with m as (
  insert into lms_modules (course_id, title, summary, position)
  select id, 'Getting started', 'The free first module.', 1
    from lms_courses where slug = 'test-course-do-not-share'
  returning id
)
insert into lms_lessons (module_id, title, summary, type, position,
                         video_provider, video_ref, duration_seconds,
                         bucket_seconds, coverage_percent, content_md)
select id, v.title, v.summary, 'video', v.pos, 'youtube', v.ref,
       v.secs, 10, 92, v.body
  from m, (values
    (1, 'What this test course is',
        'One minute on why this course exists.',
        'TESTVIDEO001', 380,
        'This lesson is part of a test course. It teaches nothing.'),
    (2, 'The second test lesson',
        'A slightly longer one, so the lengths differ.',
        'TESTVIDEO002', 465,
        'Still a test course. Still teaching nothing.')
  ) as v(pos, title, summary, ref, secs, body);

-- ----------------------------------------------------------- module two
-- Not free, so the course page has something behind the buy card.
with m as (
  insert into lms_modules (course_id, title, summary, position)
  select id, 'The paid part', 'Behind the buy card.', 2
    from lms_courses where slug = 'test-course-do-not-share'
  returning id
)
insert into lms_lessons (module_id, title, summary, type, position,
                         video_provider, video_ref, duration_seconds,
                         bucket_seconds, coverage_percent, content_md)
select id, 'The third test lesson',
       'The one that needs an account with access.', 'video', 1, 'youtube',
       'TESTVIDEO003', 520, 10, 92, 'A test lesson behind the buy card.'
  from m;

-- -------------------------------------------------------------- a quiz
-- One question, because a set of questions with none in it blocks the
-- course from being published.
with q as (
  insert into lms_quizzes (module_id, title, pass_percent, status)
  select m.id, 'Getting started check', 70, 'draft'
    from lms_modules m join lms_courses c on c.id = m.course_id
   where c.slug = 'test-course-do-not-share' and m.position = 1
  returning id
)
insert into lms_questions (quiz_id, prompt, type, position)
select id, 'Is this a real course?', 'boolean', 1 from q;

update lms_quizzes set status = 'published'
 where module_id in (select m.id from lms_modules m
                       join lms_courses c on c.id = m.course_id
                      where c.slug = 'test-course-do-not-share');


-- ------------------------------------------------------- what is left
-- The checklist, read back, so you can see it is ready before publishing
-- rather than finding out from an error message.
select b.ok as "ready?", b.label as "the checklist says"
  from lms_courses c, lateral lms_course_blockers(c.id) b
 where c.slug = 'test-course-do-not-share'
 order by b.ok, b.label;


-- =====================================================================
-- TO PUT IT ON THE SITE, run this one line:
--
--   select * from lms_publish_course(
--     (select id from lms_courses where slug = 'test-course-do-not-share'));
--
-- It appears at /lms/courses and at
-- /lms/courses/test-course-do-not-share within five minutes, which is
-- how long the edge function keeps its copy.
--
-- TO TAKE IT DOWN AGAIN:
--
--   select * from lms_unpublish_course(
--     (select id from lms_courses where slug = 'test-course-do-not-share'));
--
-- And to remove it completely, run the clean up block at the top of this
-- file on its own.
--
-- DO NOT leave it published. It is marked "do not share" in its own slug
-- for a reason: once a search engine has read a page it keeps the address
-- for a long time after the page has gone.
-- =====================================================================
