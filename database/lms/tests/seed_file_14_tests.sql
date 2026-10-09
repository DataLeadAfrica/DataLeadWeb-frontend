-- ===========================================================================
-- SEED FOR THE FILE 14 TESTS
--
-- Run this, then tests/file_14_tests.sql.
--
-- Everything it makes is prefixed t14- or ...14@example.com, and the undo
-- at the bottom of this file removes exactly that and nothing else.
--
-- Three courses, because the tests need three shapes:
--   t14-published   finished and published. 2 modules, 3 lessons, 1 quiz,
--                   900 seconds, first module free, 3 outcomes and an FAQ
--   t14-draft       not published, and carrying a video reference, which is
--                   the thing a stranger must never see
--   t14-thin        a draft with no summary and no outcomes, to prove the
--                   publish checklist refuses it
-- ===========================================================================

-- --------------------------------------------------------------- clean up
delete from lms_entitlements where course_id in
  (select id from lms_courses where slug like 't14-%');
delete from lms_quizzes where module_id in
  (select m.id from lms_modules m join lms_courses c on c.id = m.course_id
    where c.slug like 't14-%');
delete from lms_lessons where module_id in
  (select m.id from lms_modules m join lms_courses c on c.id = m.course_id
    where c.slug like 't14-%');
delete from lms_modules where course_id in
  (select id from lms_courses where slug like 't14-%');
delete from lms_courses where slug like 't14-%';
delete from lms_profiles where id in
  (select id from auth.users where email like '%14@example.com');
delete from auth.users where email like '%14@example.com';

-- ----------------------------------------------------------- a programme
-- A course cannot be published without one, which has been a rule since
-- file 13. The local harness starts with none, so make one.
insert into programmes (slug, title, code, template_key, active)
select 't14-programme', 'T14 test programme', 'T14', 'default', true
 where not exists (select 1 from programmes where slug = 't14-programme');

-- ------------------------------------------------------------------ people
insert into auth.users (id, email, email_confirmed_at)
values (gen_random_uuid(), 'nobody14@example.com', now()),
       (gen_random_uuid(), 'buyer14@example.com', now()),
       (gen_random_uuid(), 'admin14@example.com', now());

-- The sign up hook from file 06 already makes a profile row for each new
-- auth user, so this fills them in rather than inserting again.
insert into lms_profiles (id, full_name, role)
select id,
       case when email like 'nobody%' then 'Nobody Fourteen'
            when email like 'buyer%'  then 'Buyer Fourteen'
            else 'Admin Fourteen' end,
       case when email like 'admin%' then 'admin'::lms_role else 'learner'::lms_role end
  from auth.users where email like '%14@example.com'
on conflict (id) do update
   set full_name = excluded.full_name, role = excluded.role;

-- --------------------------------------------------- the published course
-- 900 seconds in total: 300 + 300 in module 1, 300 in module 2.
with c as (
  insert into lms_courses (slug, title, tool, area, level, summary, cover_code,
                           price_kobo, first_module_free, status, published_at)
  values ('t14-published', 'T14 published course', 'STATA', 'Analysis', 'Beginner',
          'A finished course used by the file 14 tests.', 'T4',
          1000000, true, 'published', now() - interval '2 days')
  returning id
), m1 as (
  insert into lms_modules (course_id, title, position)
  select id, 'T14 module one', 1 from c returning id
), m2 as (
  insert into lms_modules (course_id, title, position)
  select id, 'T14 module two', 2 from c returning id
), l1 as (
  insert into lms_lessons (module_id, title, type, position, video_provider,
                           video_ref, duration_seconds, bucket_seconds,
                           coverage_percent, content_md)
  select id, 'T14 lesson one', 'video', 1, 'youtube', 'VIDEOONE', 300, 10, 92,
         'Notes for lesson one.' from m1 returning id
), l2 as (
  insert into lms_lessons (module_id, title, type, position, video_provider,
                           video_ref, duration_seconds, bucket_seconds,
                           coverage_percent, content_md)
  select id, 'T14 lesson two', 'video', 2, 'youtube', 'VIDEOTWO', 300, 10, 92,
         'Notes for lesson two.' from m1 returning id
), l3 as (
  insert into lms_lessons (module_id, title, type, position, video_provider,
                           video_ref, duration_seconds, bucket_seconds,
                           coverage_percent, content_md)
  select id, 'T14 lesson three', 'video', 1, 'youtube', 'VIDEOTHREE', 300, 10, 92,
         'Notes for lesson three.' from m2 returning id
)
insert into lms_quizzes (module_id, title, pass_percent, status)
select id, 'T14 module one quiz', 70, 'draft' from m1;

-- A quiz cannot go live until it has a question, which is a rule from
-- file 07. One question, then publish it.
with q as (
  select qz.id from lms_quizzes qz
    join lms_modules m on m.id = qz.module_id
    join lms_courses c on c.id = m.course_id
   where c.slug = 't14-published'
)
insert into lms_questions (quiz_id, prompt, type, position)
select id, 'Is this a test question?', 'boolean', 1 from q;

update lms_quizzes set status = 'published'
 where module_id in (select m.id from lms_modules m
                       join lms_courses c on c.id = m.course_id
                      where c.slug = 't14-published');

-- The Phase 3 columns. Wrapped, because this seed has to run BEFORE file 14
-- as well as after: the tests are written to fail first, and before file 14
-- these six columns do not exist yet.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_name = 'lms_courses' and column_name = 'outcomes') then
    update lms_courses set
      outcomes = array[
        'Import a survey export and label every variable',
        'Find and fix skipped and out of range answers',
        'Build the tables a report needs'],
      audience = array['Researchers working with survey data',
                       'Students writing a thesis'],
      prerequisites = array['No experience needed', 'About two hours a week'],
      faq = '[{"question":"Do I need the software installed?",
                "answer":"For the practice files, yes. You can watch every lesson without it."},
               {"question":"Can I watch a lesson again?",
                "answer":"Yes, as many times as you like."}]'::jsonb,
      seo_title = 'Learn T14 Online | Data-Lead Academy',
      seo_description =
        'Three video lessons at your own pace, with a certificate anyone can check.'
    where slug = 't14-published';
  else
    raise notice 'file 14 has not been applied yet, so the six new columns were skipped';
  end if;
end $$;

-- ------------------------------------------------------- the draft course
with c as (
  insert into lms_courses (slug, title, tool, area, level, summary, cover_code,
                           price_kobo, first_module_free, status)
  values ('t14-draft', 'T14 draft course', 'Python', 'Programming', 'Beginner',
          'An unfinished course that nobody outside should be able to see.', 'T4',
          1000000, false, 'draft')
  returning id
), m as (
  insert into lms_modules (course_id, title, position)
  select id, 'T14 draft module', 1 from c returning id
)
insert into lms_lessons (module_id, title, type, position, video_provider,
                         video_ref, duration_seconds, bucket_seconds,
                         coverage_percent, content_md)
select id, 'T14 draft lesson', 'video', 1, 'youtube', 'DRAFTVIDEO', 600, 10, 92,
       'Draft notes nobody should read yet.' from m;

-- -------------------------------------------------------- the thin course
-- No summary and no outcomes, so the publish checklist has something to
-- refuse. It still gets a lesson, so the OTHER blockers do not fire and
-- hide the two this is here to prove.
with c as (
  insert into lms_courses (slug, title, tool, area, level, summary, cover_code,
                           price_kobo, first_module_free, status, programme_id)
  values ('t14-thin', 'T14 thin course', 'Excel', 'Analysis', 'Beginner',
          '', 'T4', 0, false, 'draft',
          (select id from programmes order by created_at limit 1))
  returning id
), m as (
  insert into lms_modules (course_id, title, position)
  select id, 'T14 thin module', 1 from c returning id
)
insert into lms_lessons (module_id, title, type, position, video_provider,
                         video_ref, duration_seconds, bucket_seconds,
                         coverage_percent)
select id, 'T14 thin lesson', 'video', 1, 'youtube', 'THINVIDEO', 300, 10, 92 from m;

-- The published course needs a programme too, which has been a publish
-- blocker since file 13.
update lms_courses
   set programme_id = (select id from programmes order by created_at limit 1)
 where slug in ('t14-published', 't14-draft');

-- ------------------------------------------------------- who has paid
insert into lms_entitlements (user_id, course_id, source, status, granted_at)
select u.id, c.id, 'purchase', 'active', now()
  from auth.users u, lms_courses c
 where u.email = 'buyer14@example.com' and c.slug = 't14-published';

\echo 'seed for file 14 ready: 3 courses, 3 people, 1 entitlement'
