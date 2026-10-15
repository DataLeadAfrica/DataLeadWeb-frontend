-- =====================================================================
-- 017  THE CONTROL ROOM
--
-- The staff side of the Academy: the database under /lms/studio. One
-- transaction, safe to run twice.
--
-- WHAT THIS FILE ADDS, in one list:
--
--    1  course workflow        create, send for review, publish, archive
--    2  course details         outcomes, audience, FAQ, price, cover
--    3  question banks         write, retire, paste from a sheet
--    4  learners               the list, the record, access, the wait
--    5  paths                  build one, order it, write its exam
--    6  areas and tools        add a tool, count what is in each area
--    7  reports                how the Academy is doing, totals only
--    8  certificates           the list, searchable
--    9  popups                 create, schedule, stop
--   10  site settings          the words on the landing page
--   11  health and activity    the meters, and a log nobody can edit
--   12  permissions            named table by table
--
-- TWO ROLES, AND THE DIFFERENCE IS NOT A MENU. A facilitator builds.
-- An administrator also publishes, sets prices, looks after people and
-- runs the site. Every one of those is checked HERE, in a function or a
-- policy, and the page hiding a button is only a courtesy on top. A
-- facilitator who calls the publish function directly is refused by the
-- database, and 17_verify.sql has a row for each refusal.
--
-- The role enum is ('learner', 'facilitator', 'admin'). File 01 created
-- it saying 'uploader' and file 10 renamed that value to 'facilitator',
-- so 'facilitator' is what is stored and what every policy from file 10
-- onwards reads. Anything in this file comparing against 'uploader'
-- would be comparing against a value that has not existed since 6
-- October, and Postgres would refuse it outright rather than quietly
-- matching nothing, which is the one mercy in that mistake.
--
-- WHO MAY BUILD is not only the role. File 10 keeps lms_facilitators, a
-- list of email addresses, so somebody can be appointed before they
-- have ever signed up and the appointment waits for them. The Staff
-- page in Part B is that list. lms_is_staff() is file 10's and is left
-- exactly as it is.
--
-- THE TWO ADMINISTRATORS ARE MADE IN SUPABASE, never from a page.
-- Nothing in this file can raise anybody to 'admin': lms_set_staff_role
-- refuses that value outright. An administrator is made by an update
-- run by hand in the SQL editor, by somebody who already has the keys
-- to the project. That is on purpose: the page that can make an
-- administrator is the page worth attacking.
--
-- NOTHING HERE WIDENS WHAT A LEARNER CAN SEE. Every function added is
-- revoked from anon and from authenticated, then granted back only
-- where a learner genuinely calls it. The reports return totals, never
-- rows, and any group under 5 comes back as "fewer than 5".
--
-- IT DOES NOT TOUCH THE CERTIFICATION SYSTEM'S TABLES except through
-- programmes, exactly as file 13 does and file 16 after it.
--
-- AFTER RUNNING IT, read every row of 17_verify.sql. All must say yes.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- STEP 0  IS THIS DATABASE READY
-- ---------------------------------------------------------------------
do $$
declare
  v_missing text[] := '{}';
  v_t text;
  v_f text;
begin
  foreach v_t in array array[
    'lms_courses','lms_modules','lms_lessons','lms_quizzes','lms_questions',
    'lms_options','lms_quiz_attempts','lms_paths','lms_path_courses',
    'lms_areas','lms_area_tools','lms_course_areas','lms_lesson_chapters',
    'lms_learner_profiles','lms_popups','lms_settings','lms_entitlements',
    'lms_admin_actions','lms_profiles','lms_lesson_progress','lms_watch_days',
    'lms_course_next','lms_countries','lms_ng_states'
  ] loop
    if to_regclass('public.' || v_t) is null then
      v_missing := v_missing || v_t;
    end if;
  end loop;

  foreach v_f in array array[
    'lms_is_admin','lms_is_staff','lms_my_role','lms_publish_path',
    'lms_claim_course_certificate','lms_exam_status','lms_parse_chapters',
    'lms_set_lesson_chapters','lms_ensure_course_exam','lms_publish_exam',
    'lms_tidy_table_privileges','lms_learner_totals','lms_learner_record'
  ] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_f
    ) then
      v_missing := v_missing || (v_f || '()');
    end if;
  end loop;

  if array_length(v_missing, 1) > 0 then
    raise exception
      'File 17 needs files 01 to 16 to have been run first. Missing: %. Run them in order, then this one.',
      array_to_string(v_missing, ', ');
  end if;
  raise notice 'Step 0: files 01 to 16 are in place.';
end $$;


-- =====================================================================
-- STEP 0b  THE ACTIVITY LOG, WHICH NOBODY CAN EDIT
-- =====================================================================
--
-- Every publish, price change, access change, exam wait lifted, export
-- and staff change goes into lms_admin_actions, which file 01 made.
-- This step gives it the one way in and takes away every other.
--
-- A LOG YOU CAN EDIT IS NOT A LOG. The table has had RLS since file 10,
-- but a row could still be changed or removed by anything running as
-- the service role or as a definer function that happened to have the
-- rights. The trigger below refuses UPDATE and DELETE outright, to
-- every caller including an administrator, so the only thing anybody
-- can do to this table is add to it. That is the property that makes it
-- worth reading six months from now.
--
-- If a row ever genuinely has to go, it goes by a person with the
-- project keys dropping the trigger, doing it, and putting the trigger
-- back. That is three deliberate steps and it leaves its own trace.
create or replace function lms_log_is_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'The activity log can only be added to. Rows cannot be % .', lower(tg_op)
    using errcode = '42501';
end $$;

drop trigger if exists lms_admin_actions_no_change on lms_admin_actions;
create trigger lms_admin_actions_no_change
  before update or delete on lms_admin_actions
  for each row execute function lms_log_is_append_only();

/**
 * Write one line into the activity log.
 *
 * Every function in this file that changes something calls this, and it
 * is the reason the log is complete rather than mostly complete: there
 * is no second way of writing a row that somebody could forget.
 *
 * It never fails the thing it is recording. A log that can refuse a
 * publish is a log that will one day stop somebody publishing, so the
 * insert is wrapped: if it cannot write, the work still happens and the
 * problem shows up in system_health rather than in a learner's face.
 */
create or replace function lms_log_action(
  p_action  text,
  p_subject text,
  p_id      uuid,
  p_detail  jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into lms_admin_actions (actor_id, action, subject_type, subject_id, detail)
  values (auth.uid(), p_action, p_subject, p_id, coalesce(p_detail, '{}'::jsonb));
exception when others then
  -- Deliberately swallowed, and deliberately noisy somewhere else:
  -- lms_system_heartbeat carries the failure so system_health can show
  -- it. Verify row 40 checks this catch is narrow to the log insert and
  -- nowhere else in the file.
  begin
    insert into lms_system_heartbeat (name, detail, at)
    values ('activity_log_write_failed',
            jsonb_build_object('action', p_action, 'error', sqlerrm), now())
    on conflict (name) do update set detail = excluded.detail, at = excluded.at;
  exception when others then null;
  end;
end $$;

revoke all on function lms_log_action(text, text, uuid, jsonb) from public, anon, authenticated;

do $$ begin raise notice 'Step 0b: the activity log is append only.'; end $$;


-- =====================================================================
-- STEP 1  THE COURSE WORKFLOW
-- =====================================================================
--
-- FOUR STATES: draft, ready for review, published, archived.
--
-- "READY FOR REVIEW" IS NOT A NEW ENUM VALUE, and that is a deliberate
-- choice rather than a shortcut. lms_status is an enum from file 02.
-- Postgres will let you add a value to an enum inside a transaction,
-- but it will NOT let you use the new value until that transaction has
-- committed, and this file is one transaction that then has to go on
-- and write functions comparing against it. The file would fail on its
-- own second statement.
--
-- So a course that is ready for review is a DRAFT that has been sent:
-- status stays 'draft' and sent_for_review_at is set. That is also the
-- truer description. Being sent is an event with a sender, a time and a
-- note, which is three columns of information an enum value cannot
-- hold, and the mockup shows all three on the review banner.
--
-- lms_course_state() is the one place that turns the columns into the
-- word on screen, so nothing else has to remember the rule.

-- FOUR OF THE DETAIL COLUMNS ARE NOT ADDED HERE, because file 14
-- already added them: outcomes, audience and prerequisites are all
-- text[], and faq is jsonb with lms_faq_is_valid() guarding its shape.
-- The control room writes to those, and does not redefine them. Writing
-- "add column if not exists audience text" here would have been
-- accepted silently as a no-op and left this file believing a text
-- column exists where a text[] does, which is the sort of thing that
-- surfaces three functions later as a cast error nobody can place.
alter table lms_courses
  add column if not exists sent_for_review_at timestamptz,
  add column if not exists sent_for_review_by uuid references auth.users(id) on delete set null,
  add column if not exists review_note        text not null default '',
  -- An uploaded cover, in Storage. Null means the drawn cover, which is
  -- what every course has today and what it falls back to if the upload
  -- is ever removed.
  add column if not exists cover_url          text;

comment on column lms_courses.sent_for_review_at is
  'Set when a facilitator sends a draft for review. Status stays draft. Cleared on publish or on being sent back.';

/**
 * The word on screen for a course: draft, review, published, archived.
 * One place, so nothing else has to remember that review is a draft
 * with a date on it.
 */
create or replace function lms_course_state(p_course uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
           when c.status = 'published' then 'published'
           when c.status = 'archived'  then 'archived'
           when c.sent_for_review_at is not null then 'review'
           else 'draft'
         end
    from lms_courses c where c.id = p_course;
$$;

/**
 * Does the person asking own this course, or run the place?
 *
 * THE WHOLE FACILITATOR RULE IS THIS FUNCTION. "A facilitator sees only
 * the courses they built" is one sentence in the brief and it has to be
 * true of the course list, the builder, the question banks, the reports
 * and the activity log. Written out five times it would be right four
 * times. Written once it is right or wrong everywhere at once, and
 * 17_verify.sql checks the one.
 */
create or replace function lms_may_edit_course(p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select lms_is_admin()
      or exists (
           select 1 from lms_courses c
            where c.id = p_course
              and c.created_by = auth.uid()
              and lms_my_role() = 'facilitator'
         );
$$;

-- ----- creating a course
--
-- THREE THINGS ARE MADE AT ONCE, and they are made together because a
-- course missing any of them is a course that cannot be published and
-- nobody can see why. A programme, because that is how a certificate
-- gets its number (file 13's arrangement, unchanged). An empty course
-- exam, because every course has exactly one and the bank is filled
-- later. And module 1, because a course with no module has nowhere to
-- put a lesson and the builder would open on a dead end.
--
-- THE EXAM IS CREATED AS A DRAFT. File 07 refuses to publish a question
-- set with nothing in it, which is correct and is why file 16 learnt to
-- create exams as drafts. lms_publish_exam is the gate.
create or replace function lms_create_course(
  p_title text,
  p_area  text default '',
  p_tool  text default '',
  p_level lms_level default 'Beginner'
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  v_slug  text;
  v_n     integer := 1;
  v_prog  uuid;
  v_area  uuid;
begin
  if not lms_is_staff() then
    raise exception 'Only staff can create a course.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'A course needs a title.' using errcode = '22023';
  end if;

  -- The slug, from the title, with a number on the end if that is taken.
  -- Done here rather than typed, because a slug is an address and a
  -- typed one is a typo waiting to be published.
  v_slug := regexp_replace(lower(btrim(p_title)), '[^a-z0-9]+', '-', 'g');
  v_slug := btrim(v_slug, '-');
  if v_slug = '' then v_slug := 'course'; end if;
  while exists (select 1 from lms_courses c where c.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := regexp_replace(lower(btrim(p_title)), '[^a-z0-9]+', '-', 'g');
    v_slug := btrim(v_slug, '-') || '-' || v_n;
  end loop;

  -- The programme, exactly as file 13 arranged it. Nothing else in
  -- this file touches the certification tables, and this one only
  -- inserts: it never updates or deletes a row the certificate system
  -- owns.
  insert into programmes (slug, title, code, active)
  values (v_slug, btrim(p_title),
          upper(left(regexp_replace(v_slug, '[^a-z0-9]', '', 'g'), 12)), true)
  returning id into v_prog;

  insert into lms_courses (slug, title, tool, area, level, status, created_by, programme_id)
  values (v_slug, btrim(p_title), coalesce(btrim(p_tool), ''), coalesce(btrim(p_area), ''),
          p_level, 'draft', auth.uid(), v_prog)
  returning id into v_id;

  -- The main area, if one was named, through the file 16 table so the
  -- trigger fills lms_courses.area to match.
  if coalesce(btrim(p_area), '') <> '' then
    select a.id into v_area from lms_areas a where a.name = btrim(p_area);
    if v_area is not null then
      insert into lms_course_areas (course_id, area_id, position)
      values (v_id, v_area, 1)
      on conflict do nothing;
    end if;
  end if;

  insert into lms_modules (course_id, title, position)
  values (v_id, 'Module 1', 1);

  -- File 16's function, not a second copy of the numbers. 20 of a bank
  -- of 30, 40 minutes, 70 per cent, two tries then a day: those live in
  -- lms_ensure_course_exam and nowhere else, so changing them is one
  -- edit rather than a hunt.
  perform lms_ensure_course_exam(v_id);

  perform lms_log_action('course_created', 'course', v_id,
    jsonb_build_object('title', btrim(p_title), 'slug', v_slug));

  return v_id;
end $$;

-- ----- the nine publish checks
--
-- IT IS CALLED lms_publish_checks, NOT lms_course_blockers, and the
-- reason is worth writing down because the obvious thing to do here was
-- wrong.
--
-- lms_course_blockers already exists. File 05 wrote it, file 11
-- replaced it with a seventh check, and both return
-- TABLE(ok boolean, label text). File 11 ALSO keeps a contract: its
-- step 0 looks up that exact signature and refuses to run if it has
-- changed. So widening lms_course_blockers to carry a fix-it target
-- would have made file 11 unrunnable on this database for ever, and
-- file 11 is the housekeeping file. Nobody would discover that until
-- the day they needed it.
--
-- So the richer list gets its own name and the old one is left exactly
-- as file 11 left it. This is the same call as areaIconKey against
-- areaKey in the 6B first commit: when a name already carries a
-- contract, add a name rather than redefine one.
--
-- lms_publish_course below calls THIS one, so the nine checks are what
-- actually gates a publish, and the old six remain for whatever still
-- reads them.
drop function if exists lms_publish_checks(uuid);
--
-- ONE FUNCTION, AND THE PAGE DRAWS WHATEVER IT RETURNS. The mockup
-- shows nine rows with a tick or a cross and a "fix it" button that
-- goes somewhere specific. If the page held that list, the page and the
-- publish function would be two opinions about whether a course is
-- ready, and the day they disagreed somebody would be staring at nine
-- green ticks and a refusal.
--
-- So lms_publish_course calls this and refuses if anything is false.
-- The page calls it to draw the panel. There is one list.
create or replace function lms_publish_checks(p_course uuid)
returns table (
  -- "n", not "position": position is a function in Postgres, and a
  -- column of that name in a returns table is a syntax error rather
  -- than a quiet shadowing, which at least is cheap to find.
  n        integer,
  label    text,
  passes   boolean,
  detail   text,
  fix_tab  text,     -- which tab of the builder to open
  fix_id   uuid      -- and which lesson, when it is about one
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_c       lms_courses%rowtype;
  v_lessons integer;
  v_videos  integer;
  v_novideo integer;
  v_nocheck integer;
  v_bank    integer;
  v_need    integer;
  v_exam    uuid;
  v_first   uuid;
begin
  select * into v_c from lms_courses c where c.id = p_course;
  if v_c.id is null then return; end if;
  if not lms_may_edit_course(p_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;

  select count(*) into v_lessons
    from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = p_course;

  select count(*) into v_videos
    from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = p_course and l.type = 'video';

  -- min() has no uuid form, so the first one is taken by order rather
  -- than by aggregate. It is the lesson the "fix it" button opens, so
  -- "first" has to mean first in the course, not smallest uuid, anyway.
  select count(*) into v_novideo
    from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = p_course and l.type = 'video'
     and (l.video_ref is null or l.duration_seconds is null);

  select l.id into v_first
    from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = p_course and l.type = 'video'
     and (l.video_ref is null or l.duration_seconds is null)
   order by m.position, l.position limit 1;

  -- A CHECK THAT EXISTS AND HAS A QUESTION IN IT, not one that is
  -- already published, and the difference is the difference between a
  -- rule and a deadlock.
  --
  -- File 10 says only an administrator may publish a set of questions,
  -- which is the same rule as "facilitators build, administrators
  -- publish" and is right. But if this check demanded published checks,
  -- a facilitator could never get their course to nine green ticks,
  -- because the last thing standing in the way would be an action they
  -- are not allowed to take. They would send it for review with a red
  -- row and no way to explain it.
  --
  -- So this counts a check that is ready, and lms_publish_course
  -- publishes the drafts along with the course. The administrator
  -- publishing the course IS the administrator publishing its checks,
  -- in one deliberate act rather than fourteen.
  select count(*) into v_nocheck
    from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = p_course and l.type = 'video'
     and not exists (
       select 1 from lms_quizzes q
        where q.lesson_id = l.id
          and exists (select 1 from lms_questions qq where qq.quiz_id = q.id and qq.active)
     );

  select q.id into v_exam from lms_quizzes q
   where q.course_id = p_course and q.lesson_id is null and q.module_id is null
   limit 1;

  -- active, not a status: a question is retired by clearing active,
  -- which file 04 set up and file 16 kept.
  select count(*) into v_bank from lms_questions qq
   where qq.quiz_id = v_exam and qq.active;

  -- The bank rule is read off the exam row rather than typed, so this
  -- check and lms_publish_exam cannot come to different conclusions
  -- about the same exam.
  select ceil(q.serve_count * coalesce(q.bank_multiple, 1.5))
    into v_need from lms_quizzes q where q.id = v_exam;

  return query
  select 1, 'Has a title'::text,
         coalesce(btrim(v_c.title), '') <> '',
         case when coalesce(btrim(v_c.title), '') = '' then 'Give the course a title.' else '' end,
         'details'::text, null::uuid
  union all select 2, 'Has a short description',
         coalesce(btrim(v_c.summary), '') <> '',
         case when coalesce(btrim(v_c.summary), '') = '' then 'One or two sentences for the card and for Google.' else '' end,
         'details', null
  union all select 3, 'Has an area and a tool or skill',
         coalesce(btrim(v_c.area), '') <> '' and coalesce(btrim(v_c.tool), '') <> '',
         case when coalesce(btrim(v_c.area), '') = '' or coalesce(btrim(v_c.tool), '') = ''
              then 'Both decide the cover and where the course is found.' else '' end,
         'details', null
  union all select 4, 'Has at least one lesson',
         v_lessons > 0,
         case when v_lessons = 0 then 'Add a module and a lesson to it.' else '' end,
         'lessons', null
  union all select 5, 'Has at least three things a learner will be able to do',
         coalesce(array_length(v_c.outcomes, 1), 0) >= 3,
         case when coalesce(array_length(v_c.outcomes, 1), 0) < 3
              then (3 - coalesce(array_length(v_c.outcomes, 1), 0))::text || ' more to write.' else '' end,
         'details', null
  union all select 6, 'Every video lesson has its video and its length',
         v_novideo = 0,
         case when v_novideo > 0
              then v_novideo::text || ' of ' || v_videos::text || ' still need one.' else '' end,
         'lessons', v_first
  union all select 7, 'Every video lesson has a lesson check',
         v_nocheck = 0,
         case when v_nocheck > 0
              then v_nocheck::text || ' of ' || v_videos::text || ' have no check yet.' else '' end,
         'lessons', null
  union all select 8, 'Has a certificate programme',
         v_c.programme_id is not null,
         case when v_c.programme_id is null
              then 'Without one no certificate can be issued. Tell an administrator.' else '' end,
         'details', null
  union all select 9, 'The course exam has enough questions',
         v_exam is not null and v_bank >= v_need,
         case when v_exam is null then 'The course has no exam.'
              when v_bank < v_need then (v_need - v_bank)::text || ' more questions needed.'
              else '' end,
         'exam', null;
end $$;

/**
 * Send a draft to an administrator, with a note.
 */
create or replace function lms_send_for_review(p_course uuid, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_may_edit_course(p_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;
  if (select status from lms_courses where id = p_course) <> 'draft' then
    raise exception 'Only a draft can be sent for review.' using errcode = '22023';
  end if;
  update lms_courses
     set sent_for_review_at = now(), sent_for_review_by = auth.uid(),
         review_note = coalesce(btrim(p_note), '')
   where id = p_course;
  perform lms_log_action('course_sent_for_review', 'course', p_course,
    jsonb_build_object('note', coalesce(btrim(p_note), '')));
end $$;

/**
 * Send it back to the facilitator with a note. Administrators only.
 */
create or replace function lms_send_back(p_course uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can send a course back.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_note), '') = '' then
    raise exception 'Say what needs doing. A course sent back with no note is a course nobody knows how to fix.'
      using errcode = '22023';
  end if;
  update lms_courses
     set sent_for_review_at = null, sent_for_review_by = null,
         review_note = btrim(p_note)
   where id = p_course;
  perform lms_log_action('course_sent_back', 'course', p_course,
    jsonb_build_object('note', btrim(p_note)));
end $$;

/**
 * Publish. ADMINISTRATORS ONLY, and only when all nine checks pass.
 *
 * THE SIGNATURE IS FILE 05'S, UNCHANGED: returns (published, message).
 * Replacing the body is the whole change. Widening the return type
 * would have been the tidier-looking thing and would have broken
 * file 06's grant and anything else holding the old shape, for no gain
 * that a message string does not already give.
 *
 * TWO THINGS FROM FILE 05'S VERSION ARE CARRIED OVER DELIBERATELY. The
 * free entitlement sweep below is the one that matters: when a free
 * course goes live it has to be opened to everybody who ALREADY has an
 * account, because lms_grant_free_courses only runs at sign up and
 * without this only people who join after today would ever get it.
 * Dropping that while rewriting the function would have been invisible
 * until somebody asked why the free course nobody could open had no
 * learners. The other is the refusal style: this returns false with a
 * message rather than raising, so a page can show the reason. The role
 * test is still real, and 17_verify.sql row 3 checks a facilitator gets
 * false and the word administrator back.
 */
create or replace function lms_publish_course(p_course uuid)
returns table (published boolean, message text)
language plpgsql security definer set search_path = public as $$
declare v_bad text;
begin
  if not lms_is_admin() then
    return query select false, 'Only an administrator can publish a course.'; return;
  end if;

  select string_agg(b.label, '; ' order by b.n) into v_bad
    from lms_publish_checks(p_course) b where not b.passes;

  if v_bad is not null then
    return query select false, 'This course is not ready yet: ' || v_bad || '.'; return;
  end if;

  -- The lesson checks go live with the course. See the note on check 7:
  -- an administrator publishing a course is an administrator publishing
  -- its checks, and doing it here rather than one at a time is what
  -- keeps file 10's rule without deadlocking the facilitator who built
  -- them.
  update lms_quizzes q
     set status = 'published'
   where q.status = 'draft'
     and q.lesson_id in (
       select l.id from lms_lessons l join lms_modules m on m.id = l.module_id
        where m.course_id = p_course)
     and exists (select 1 from lms_questions qq where qq.quiz_id = q.id and qq.active);

  update lms_courses
     set status = 'published',
         published_at = coalesce(published_at, now()),
         sent_for_review_at = null, sent_for_review_by = null, review_note = ''
   where id = p_course;

  -- FILE 05'S SWEEP, kept word for word in effect. If it is free, open
  -- it to everyone who already has an account.
  insert into lms_entitlements (user_id, course_id, source)
  select p.id, p_course, 'free'
    from lms_profiles p
   where exists (select 1 from lms_courses c where c.id = p_course and c.price_kobo = 0)
     and not exists (select 1 from lms_entitlements e
                      where e.user_id = p.id and e.course_id = p_course and e.status = 'active');

  perform lms_log_action('course_published', 'course', p_course, '{}'::jsonb);
  return query select true, 'Published.';
end $$;

/**
 * Unpublish, with a reason, which is the only way the control room does
 * it.
 *
 * File 05's one argument version still exists and is left callable, but
 * its body now points here: taking a live course down with no trace is
 * the kind of thing somebody asks about three weeks later, and an
 * unlogged route to it would be the one that got used.
 */
create or replace function lms_unpublish_course(p_course uuid, p_reason text)
returns table (published boolean, message text)
language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    return query select false, 'Only an administrator can unpublish a course.'; return;
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    return query select false, 'Say why. Taking a live course down is the kind of thing somebody will ask about.';
    return;
  end if;
  update lms_courses set status = 'draft' where id = p_course and status = 'published';
  perform lms_log_action('course_unpublished', 'course', p_course,
    jsonb_build_object('reason', btrim(p_reason)));
  return query select false, 'Taken down.';
end $$;

create or replace function lms_unpublish_course(p_course uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Unpublishing needs a reason. Call lms_unpublish_course(course, reason).'
    using errcode = '22023';
end $$;

create or replace function lms_archive_course(p_course uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can archive a course.' using errcode = '42501';
  end if;
  -- Archived, never deleted. Somebody holds a certificate for it.
  update lms_courses set status = 'archived' where id = p_course;
  perform lms_log_action('course_archived', 'course', p_course, '{}'::jsonb);
end $$;

-- ----- what a published course will not let you change
--
-- ON A PUBLISHED COURSE ONLY WORDS CAN CHANGE. Titles, summaries,
-- outcomes, the FAQ and chapter text are words: fixing a typo on a live
-- course should not need an unpublish. Video, length, order and the
-- answers of answered questions are not: changing those moves the
-- ground under somebody who is halfway through, and in the case of an
-- answer it changes what a mark meant after the fact.
--
-- The rule lives in a trigger rather than in the editing functions,
-- because there is more than one way to update a row and a trigger is
-- the only one of them every path goes through.
-- ONE GUARD, NOT TWO. File 10 already has lms_guard_lesson on this
-- table, and it refuses ANY change to a lesson of a live course,
-- including its title. That was the right rule when it was written,
-- when the only way to fix a typo was to unpublish.
--
-- The brief now says words may change on a published course and video,
-- length and order may not. Adding a SECOND trigger beside file 10's
-- would not have worked: file 10's fires first and refuses everything,
-- so the new rule would be unreachable and the file would look correct
-- while doing nothing. Two triggers that have to agree about one rule
-- is also one too many.
--
-- So file 10's function is REPLACED, in place, keeping everything it
-- did and loosening the one part the brief loosens. 17_undo.sql writes
-- file 10's version back out in full, which is the lesson from the
-- academy-6a review: an undo that drops a function somebody else still
-- relies on leaves the site broken in a way nobody connects to the
-- undo.
create or replace function lms_guard_lesson() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_module uuid := case when tg_op = 'DELETE' then old.module_id else new.module_id end;
  v_live   boolean;
begin
  if auth.uid() is null or lms_is_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_live := lms_course_status_of_module(v_module) = 'published';

  -- Adding a lesson to a live course, or removing one, still moves the
  -- ground under somebody halfway through. Unchanged from file 10.
  if v_live and tg_op in ('INSERT', 'DELETE') then
    raise exception 'That course is live. Ask the administrator to unpublish it before adding or removing lessons.';
  end if;

  if v_live and tg_op = 'UPDATE' then
    -- WORDS MAY CHANGE. A typo on a live lesson should not need an
    -- unpublish, and making it need one is how typos stay.
    if new.video_ref is distinct from old.video_ref
       or new.video_provider is distinct from old.video_provider then
      raise exception 'The video of a live lesson cannot change. Ask the administrator to unpublish the course first.';
    end if;
    if new.duration_seconds is distinct from old.duration_seconds then
      raise exception 'The length of a live lesson cannot change. Ask the administrator to unpublish the course first.';
    end if;
    if new.position is distinct from old.position
       or new.module_id is distinct from old.module_id then
      raise exception 'Lessons of a live course cannot be reordered. Ask the administrator to unpublish it first.';
    end if;
    -- How the non-skippable rule is measured is not a word either: a
    -- learner halfway through was promised one bar and would silently
    -- get another.
    if new.coverage_percent is distinct from old.coverage_percent
       or new.bucket_seconds is distinct from old.bucket_seconds then
      raise exception 'How a live lesson is measured cannot change while people are watching it.';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.module_id is distinct from new.module_id
     and lms_course_status_of_module(old.module_id) = 'published' then
    raise exception 'That course is live. Ask the administrator to unpublish it first.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- File 10's trigger already points at this function, so there is
-- nothing to re-create. Said out loud because the obvious next line
-- would be a create trigger, and a second trigger on the same table
-- running the same function would run every check twice.

do $$ begin raise notice 'Step 1: the course workflow, four states and the nine publish checks.'; end $$;


-- =====================================================================
-- STEP 2  COURSE DETAILS
-- =====================================================================
--
-- Everything on the Details tab. Two functions rather than one, split
-- exactly where the permission changes: a facilitator writes the words,
-- an administrator writes the price. Splitting them this way means the
-- permission is a property of the function rather than a list of column
-- names inside one, and a facilitator calling the wrong one is refused
-- rather than silently having part of their change dropped.

/**
 * The words: a facilitator's own course, or any course for an admin.
 *
 * Null means "leave this one alone", so the page can save one field
 * without sending the rest and without reading them back first.
 */
create or replace function lms_set_course_details(
  p_course        uuid,
  p_title         text default null,
  p_summary       text default null,
  p_level         lms_level default null,
  p_tool          text default null,
  p_outcomes      text[] default null,
  p_audience      text[] default null,
  p_prerequisites text[] default null,
  p_faq           jsonb default null,
  p_cover_url     text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_may_edit_course(p_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;

  update lms_courses
     set title         = coalesce(nullif(btrim(p_title), ''), title),
         summary       = coalesce(p_summary, summary),
         level         = coalesce(p_level, level),
         tool          = coalesce(p_tool, tool),
         outcomes      = coalesce(p_outcomes, outcomes),
         audience      = coalesce(p_audience, audience),
         prerequisites = coalesce(p_prerequisites, prerequisites),
         faq           = coalesce(p_faq, faq),
         -- An empty string clears the uploaded cover and puts the drawn
         -- one back, which is how the page offers "remove".
         cover_url     = case when p_cover_url is null then cover_url
                              when btrim(p_cover_url) = '' then null
                              else btrim(p_cover_url) end
   where id = p_course;
end $$;

/**
 * The price, and whether module 1 is free. ADMINISTRATORS ONLY, and
 * every change is logged with the old value and the new one.
 *
 * MONEY IS THE ONE THING WHERE "WHO CHANGED IT" IS THE WHOLE QUESTION.
 * A price that moved and nobody remembers moving is an argument with a
 * learner that staff cannot win, so the log line carries both numbers.
 */
create or replace function lms_set_course_price(
  p_course uuid,
  p_price_kobo integer,
  p_first_module_free boolean default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_was integer; v_was_free boolean;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can set a price.' using errcode = '42501';
  end if;
  if p_price_kobo < 0 then
    raise exception 'A price cannot be negative.' using errcode = '22023';
  end if;

  select price_kobo, first_module_free into v_was, v_was_free
    from lms_courses where id = p_course;

  update lms_courses
     set price_kobo = p_price_kobo,
         first_module_free = coalesce(p_first_module_free, first_module_free)
   where id = p_course;

  perform lms_log_action('course_price_changed', 'course', p_course,
    jsonb_build_object('was_kobo', v_was, 'now_kobo', p_price_kobo,
                       'was_first_module_free', v_was_free,
                       'now_first_module_free', coalesce(p_first_module_free, v_was_free)));
end $$;

/**
 * The areas a course sits in, in order. The first is the main one and
 * decides the cover, which is file 16's rule and is why this takes an
 * ordered array rather than a set.
 */
create or replace function lms_set_course_areas(p_course uuid, p_areas text[])
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_i integer := 0; v_id uuid;
begin
  if not lms_may_edit_course(p_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_areas, 1), 0) = 0 then
    raise exception 'A course needs at least one area.' using errcode = '22023';
  end if;

  delete from lms_course_areas where course_id = p_course;
  foreach v_name in array p_areas loop
    select a.id into v_id from lms_areas a where a.name = btrim(v_name);
    if v_id is null then
      raise exception 'There is no area called %. Add it on Areas and tools first.', btrim(v_name)
        using errcode = '22023';
    end if;
    v_i := v_i + 1;
    insert into lms_course_areas (course_id, area_id, position) values (p_course, v_id, v_i);
  end loop;
end $$;

/**
 * What to recommend after this course. Writes lms_course_next, which
 * file 16's lms_my_recommendations reads, so the reason a learner sees
 * ("People who finish X often take this next") comes from a decision
 * somebody made here rather than from anything inferred.
 */
create or replace function lms_set_course_next(p_course uuid, p_next uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_i integer := 0;
begin
  if not lms_may_edit_course(p_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;
  delete from lms_course_next where course_id = p_course;
  foreach v_id in array coalesce(p_next, '{}'::uuid[]) loop
    if v_id = p_course then
      raise exception 'A course cannot recommend itself.' using errcode = '22023';
    end if;
    v_i := v_i + 1;
    insert into lms_course_next (course_id, next_course_id, position)
    values (p_course, v_id, v_i)
    on conflict do nothing;
  end loop;
end $$;

do $$ begin raise notice 'Step 2: course details, price, areas and what comes next.'; end $$;


-- =====================================================================
-- STEP 3  QUESTION BANKS
-- =====================================================================
--
-- Write, edit and retire questions for lesson checks, course exams and
-- path exams. Three owners, one set of functions: a question does not
-- care what its quiz is attached to, and writing three nearly identical
-- editors would have been three places to fix the next bug.
--
-- WHAT A LIVE EXAM WILL LET YOU CHANGE. Wording can change and
-- questions can be added, because improving a badly worded question is
-- something staff should be able to do on a Tuesday. The OPTIONS and
-- the ANSWER of a question somebody has already answered cannot change,
-- because that would alter what a mark meant after the fact: a learner
-- marked wrong against option B stays marked against the B that was
-- there on the day.
--
-- RETIRED, NOT DELETED. active goes false. The question stops being
-- served and stays attached to every attempt that saw it, so an old
-- attempt can still be explained.

drop function if exists lms_question_is_locked(uuid);

/**
 * Has anybody answered this question yet?
 *
 * The one place that decides, so the trigger, the editor and the page
 * cannot come to different conclusions. An attempt counts the moment
 * the question was SERVED, not when it was answered: somebody with the
 * paper open has already seen those options.
 */
create or replace function lms_question_is_locked(p_question uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from lms_quiz_attempts a
     where p_question = any (a.served_question_ids)
  );
$$;

create or replace function lms_guard_answered_question()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not lms_question_is_locked(coalesce(new.question_id, old.question_id)) then
    return coalesce(new, old);
  end if;
  raise exception
    'Somebody has already sat this question, so its options and its answer cannot change. Retire it and write a new one.'
    using errcode = '22023';
end $$;

drop trigger if exists lms_options_answered_guard on lms_options;
create trigger lms_options_answered_guard
  before insert or update or delete on lms_options
  for each row execute function lms_guard_answered_question();

/**
 * Write or change one question, with its options.
 *
 * p_options is [{label, is_correct}, ...] in the order they should
 * appear. Passing null leaves the options alone, which is how the page
 * fixes a typo in the prompt of a question somebody has answered: the
 * wording is allowed, the options are not touched, and the trigger
 * never fires.
 */
create or replace function lms_save_question(
  p_quiz       uuid,
  p_question   uuid default null,
  p_prompt     text default null,
  p_explanation text default null,
  p_options    jsonb default null,
  p_lesson     uuid default null,
  p_chapter_start integer default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid := p_question;
  v_pos   integer;
  v_opt   jsonb;
  v_i     integer := 0;
  v_right integer := 0;
  v_course uuid;
begin
  -- Whose quiz is this? A lesson check belongs to the course the lesson
  -- is in; an exam names its course directly. A path exam is an
  -- administrator's.
  select coalesce(q.course_id, m.course_id) into v_course
    from lms_quizzes q
    left join lms_lessons l on l.id = q.lesson_id
    left join lms_modules m on m.id = coalesce(q.module_id, l.module_id)
   where q.id = p_quiz;

  if v_course is not null then
    if not lms_may_edit_course(v_course) then
      raise exception 'That course is not yours.' using errcode = '42501';
    end if;
  elsif not lms_is_admin() then
    raise exception 'Only an administrator can write the path exam.' using errcode = '42501';
  end if;

  if v_id is null then
    select coalesce(max(q.position), 0) + 1 into v_pos from lms_questions q where q.quiz_id = p_quiz;
    insert into lms_questions (quiz_id, prompt, explanation, position)
    values (p_quiz, coalesce(btrim(p_prompt), ''), coalesce(p_explanation, ''), v_pos)
    returning id into v_id;
  else
    update lms_questions
       set prompt      = coalesce(nullif(btrim(p_prompt), ''), prompt),
           explanation = coalesce(p_explanation, explanation)
     where id = v_id;
  end if;

  if p_options is not null then
    -- Counted before anything is written, so a question is never left
    -- with no right answer because the check came last.
    select count(*) into v_right
      from jsonb_array_elements(p_options) e
     where (e ->> 'is_correct')::boolean;
    if v_right <> 1 then
      raise exception 'A question needs exactly one right answer, not %.', v_right
        using errcode = '22023';
    end if;
    if jsonb_array_length(p_options) < 2 then
      raise exception 'A question needs at least two options.' using errcode = '22023';
    end if;

    delete from lms_options where question_id = v_id;
    for v_opt in select * from jsonb_array_elements(p_options) loop
      v_i := v_i + 1;
      insert into lms_options (question_id, label, is_correct, position)
      values (v_id, v_opt ->> 'label', coalesce((v_opt ->> 'is_correct')::boolean, false), v_i);
    end loop;
  end if;

  -- The chapter this question came from, which is what a missed answer
  -- sends a learner back to.
  --
  -- WRITTEN ONTO THE QUESTION, not passed to lms_check_question_chapter,
  -- which looked like the function for this and is a TRIGGER. It fires
  -- on this very update and refuses a start second that is not a chapter
  -- of that lesson, so file 16's check still does its job and this does
  -- not have to repeat it.
  if p_lesson is not null or p_chapter_start is not null then
    update lms_questions
       set lesson_id = coalesce(p_lesson, lesson_id),
           chapter_start_seconds = coalesce(p_chapter_start, chapter_start_seconds)
     where id = v_id;
  end if;

  return v_id;
end $$;

create or replace function lms_retire_question(p_question uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select coalesce(q.course_id, m.course_id) into v_course
    from lms_questions qq
    join lms_quizzes q on q.id = qq.quiz_id
    left join lms_lessons l on l.id = q.lesson_id
    left join lms_modules m on m.id = coalesce(q.module_id, l.module_id)
   where qq.id = p_question;

  if v_course is not null and not lms_may_edit_course(v_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;
  if v_course is null and not lms_is_admin() then
    raise exception 'Only an administrator can change the path exam.' using errcode = '42501';
  end if;

  -- Not deleted. Every attempt that saw it keeps pointing at it.
  update lms_questions set active = false where id = p_question;
end $$;

-- ----- paste from a sheet
--
-- COLUMNS: Question, A, B, C, D, Right, Why, Lesson, Time.
--
-- EVERY ROW IS CHECKED AND THE ANSWER SAYS WHICH WERE SKIPPED AND WHY.
-- The alternative, refusing the whole paste on the first bad row, is
-- what makes somebody paste forty rows eight times. A sheet copied out
-- of Excel always has something odd in it, and the useful behaviour is
-- to take the thirty-seven good rows and name the three that are not.
--
-- NOTHING IS WRITTEN UNTIL EVERY ROW HAS BEEN READ, because a paste
-- that half worked is worse than one that did not: the person fixes
-- their sheet, pastes again, and now has duplicates.
drop function if exists lms_paste_questions(uuid, jsonb);

create or replace function lms_paste_questions(p_quiz uuid, p_rows jsonb)
returns table (row_no integer, outcome text, detail text)
language plpgsql security definer set search_path = public as $$
declare
  v_row     jsonb;
  v_i       integer := 0;
  v_opts    jsonb;
  v_right   text;
  v_lesson  uuid;
  v_start   integer;
  v_labels  text[];
  v_idx     integer;
  v_good    jsonb := '[]'::jsonb;
  v_course  uuid;
  v_title   text;
begin
  select coalesce(q.course_id, m.course_id) into v_course
    from lms_quizzes q
    left join lms_lessons l on l.id = q.lesson_id
    left join lms_modules m on m.id = coalesce(q.module_id, l.module_id)
   where q.id = p_quiz;
  if v_course is not null then
    if not lms_may_edit_course(v_course) then
      raise exception 'That course is not yours.' using errcode = '42501';
    end if;
  elsif not lms_is_admin() then
    raise exception 'Only an administrator can write the path exam.' using errcode = '42501';
  end if;

  -- PASS ONE: read and judge every row, writing nothing.
  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_i := v_i + 1;
    v_labels := '{}';
    v_lesson := null;
    v_start  := null;

    if coalesce(btrim(v_row ->> 'Question'), '') = '' then
      row_no := v_i; outcome := 'skipped'; detail := 'No question text.';
      return next; continue;
    end if;

    foreach v_title in array array['A','B','C','D'] loop
      if coalesce(btrim(v_row ->> v_title), '') <> '' then
        v_labels := v_labels || btrim(v_row ->> v_title);
      end if;
    end loop;

    if array_length(v_labels, 1) < 2 then
      row_no := v_i; outcome := 'skipped';
      detail := 'Only ' || coalesce(array_length(v_labels, 1), 0) || ' option. A question needs at least two.';
      return next; continue;
    end if;

    v_right := upper(btrim(coalesce(v_row ->> 'Right', '')));
    v_idx := case v_right when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 else 0 end;
    if v_idx = 0 or v_idx > array_length(v_labels, 1) then
      row_no := v_i; outcome := 'skipped';
      detail := case when v_right = '' then 'The Right column is empty.'
                     else 'Right says "' || v_right || '", which is not one of the options given.' end;
      return next; continue;
    end if;

    -- Lesson and Time are optional, but a Time with no Lesson is a
    -- mistake rather than a choice, so it is named.
    if coalesce(btrim(v_row ->> 'Lesson'), '') <> '' then
      select l.id into v_lesson
        from lms_lessons l join lms_modules m on m.id = l.module_id
       where m.course_id = v_course and lower(btrim(l.title)) = lower(btrim(v_row ->> 'Lesson'))
       limit 1;
      if v_lesson is null then
        row_no := v_i; outcome := 'skipped';
        detail := 'No lesson in this course is called "' || btrim(v_row ->> 'Lesson') || '".';
        return next; continue;
      end if;
      v_start := lms_clock_to_seconds(v_row ->> 'Time');
      if coalesce(btrim(v_row ->> 'Time'), '') <> '' and v_start is null then
        row_no := v_i; outcome := 'skipped';
        detail := 'Time "' || btrim(v_row ->> 'Time') || '" is not a time. Use 4:05 or 1:04:05.';
        return next; continue;
      end if;
    elsif coalesce(btrim(v_row ->> 'Time'), '') <> '' then
      row_no := v_i; outcome := 'skipped';
      detail := 'There is a Time but no Lesson, so there is nothing for it to be a time in.';
      return next; continue;
    end if;

    v_opts := '[]'::jsonb;
    for v_idx in 1 .. array_length(v_labels, 1) loop
      v_opts := v_opts || jsonb_build_object(
        'label', v_labels[v_idx],
        'is_correct', v_idx = case v_right when 'A' then 1 when 'B' then 2 when 'C' then 3 else 4 end);
    end loop;

    v_good := v_good || jsonb_build_object(
      'n', v_i,
      'prompt', btrim(v_row ->> 'Question'),
      'why', coalesce(v_row ->> 'Why', ''),
      'options', v_opts,
      'lesson', v_lesson,
      'start', v_start);
  end loop;

  -- PASS TWO: write the ones that passed.
  for v_row in select * from jsonb_array_elements(v_good) loop
    perform lms_save_question(
      p_quiz, null,
      v_row ->> 'prompt',
      v_row ->> 'why',
      v_row -> 'options',
      nullif(v_row ->> 'lesson', '')::uuid,
      nullif(v_row ->> 'start', '')::integer);
    row_no := (v_row ->> 'n')::integer;
    outcome := 'added';
    detail := '';
    return next;
  end loop;

  perform lms_log_action('questions_pasted', 'quiz', p_quiz,
    jsonb_build_object('added', jsonb_array_length(v_good), 'rows', v_i));
end $$;

/**
 * Publish a LESSON CHECK.
 *
 * WHY THIS EXISTS AT ALL, because it looks like a duplicate of
 * lms_publish_exam and is not. That function reads serve_count and
 * raises "No such exam." when it is null, which it always is for a
 * lesson check: serve_count belongs to an exam, where a bank of 30
 * serves 20. A check serves every question it has.
 *
 * So until now there was no way for a facilitator to publish a lesson
 * check at all. The table is behind RLS, so no browser can update it
 * directly, and file 10's guard allows the update only from a function.
 * Meanwhile publish check 7 of this file refuses to let a course go
 * live until every video lesson HAS a published check. A course could
 * therefore be built right up to the last check and stop there, with
 * nothing anywhere explaining what to do next.
 *
 * Found by writing the test that builds a whole course end to end,
 * which is the only thing that would have found it: every piece worked
 * on its own.
 */
create or replace function lms_publish_lesson_check(p_quiz uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_n integer; v_lesson uuid;
begin
  select q.lesson_id into v_lesson from lms_quizzes q where q.id = p_quiz;
  if v_lesson is null then
    raise exception 'That is not a lesson check. An exam is published with lms_publish_exam.'
      using errcode = '22023';
  end if;

  select m.course_id into v_course
    from lms_lessons l join lms_modules m on m.id = l.module_id where l.id = v_lesson;
  -- Administrators only, because file 10 says only an administrator
  -- publishes a set of questions and this file does not get to disagree
  -- with that from a different direction. A facilitator does not need
  -- it: publishing the course publishes the checks.
  if not lms_is_admin() then
    raise exception 'Only an administrator can publish a lesson check. Publishing the course does them all.'
      using errcode = '42501';
  end if;
  if v_course is null then
    raise exception 'That check belongs to no course.' using errcode = '22023';
  end if;

  select count(*) into v_n from lms_questions where quiz_id = p_quiz and active;
  if v_n = 0 then
    raise exception 'A lesson check needs at least one question before it goes live.'
      using errcode = '22023';
  end if;

  update lms_quizzes set status = 'published' where id = p_quiz;
  return 'published';
end $$;

/**
 * "4:05" or "1:04:05" to seconds. Null for anything else, which is how
 * the paste tells a bad Time from an empty one.
 */
create or replace function lms_clock_to_seconds(p_text text)
returns integer language plpgsql immutable set search_path = public as $$
declare p text[]; 
begin
  if coalesce(btrim(p_text), '') = '' then return null; end if;
  if btrim(p_text) !~ '^[0-9]{1,2}(:[0-9]{1,2}){1,2}$' then return null; end if;
  p := string_to_array(btrim(p_text), ':');
  if array_length(p, 1) = 2 then
    return p[1]::integer * 60 + p[2]::integer;
  end if;
  return p[1]::integer * 3600 + p[2]::integer * 60 + p[3]::integer;
end $$;

do $$ begin raise notice 'Step 3: question banks, with paste from a sheet.'; end $$;


-- =====================================================================
-- STEP 3b  THE BUILDER: READING AND WRITING A COURSE
-- =====================================================================
--
-- lms_my_course is the LEARNER's view of a course and is no use here: it
-- hides drafts, hides the answers, and shows progress nobody on the
-- staff side cares about. This is the same course seen by the person
-- building it.
--
-- ONE CALL FOR THE WHOLE BUILDER. The outline, every lesson with its
-- video and chapters, whether each has a check and how big the exam bank
-- is. The builder is a page somebody keeps open for an hour, and six
-- round trips to draw it is six chances for one to be slow.

drop function if exists lms_studio_course(uuid);

create or replace function lms_studio_course(p_course uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not lms_may_edit_course(p_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'title', c.title, 'summary', c.summary,
    'state', lms_course_state(c.id), 'level', c.level::text,
    'tool', c.tool, 'area', c.area, 'cover_code', c.cover_code,
    'cover_url', c.cover_url,
    'price_kobo', c.price_kobo, 'first_module_free', c.first_module_free,
    'outcomes', to_jsonb(c.outcomes), 'audience', to_jsonb(c.audience),
    'prerequisites', to_jsonb(c.prerequisites), 'faq', c.faq,
    'programme_id', c.programme_id,
    'review_note', c.review_note,
    'sent_for_review_at', c.sent_for_review_at,
    'sent_by', (select p.full_name from lms_profiles p where p.id = c.sent_for_review_by),
    'built_by', (select p.full_name from lms_profiles p where p.id = c.created_by),
    'areas', coalesce((
      select jsonb_agg(a.name order by ca.position)
        from lms_course_areas ca join lms_areas a on a.id = ca.area_id
       where ca.course_id = c.id), '[]'::jsonb),
    'next', coalesce((
      select jsonb_agg(n.next_course_id order by n.position)
        from lms_course_next n where n.course_id = c.id), '[]'::jsonb),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'title', m.title, 'position', m.position,
               'lessons', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', l.id, 'title', l.title, 'summary', l.summary,
                          'type', l.type::text, 'position', l.position,
                          'video_provider', l.video_provider, 'video_ref', l.video_ref,
                          'duration_seconds', l.duration_seconds,
                          'chapters_text', l.chapters_text,
                          'chapters', coalesce((
                            select jsonb_agg(jsonb_build_object(
                                     'start_seconds', ch.start_seconds, 'title', ch.title)
                                   order by ch.start_seconds)
                              from lms_lesson_chapters ch where ch.lesson_id = l.id), '[]'::jsonb),
                          -- the lesson check, and how many questions are in it
                          'check_id', (select q.id from lms_quizzes q where q.lesson_id = l.id),
                          'check_status', (select q.status::text from lms_quizzes q where q.lesson_id = l.id),
                          'check_questions', coalesce((
                            select count(*) from lms_questions qq
                              join lms_quizzes q on q.id = qq.quiz_id
                             where q.lesson_id = l.id and qq.active), 0))
                        order by l.position)
                   from lms_lessons l where l.module_id = m.id), '[]'::jsonb))
             order by m.position)
        from lms_modules m where m.course_id = c.id), '[]'::jsonb),
    'exam', (
      select jsonb_build_object(
               'id', q.id, 'status', q.status::text,
               'serve_count', q.serve_count,
               'minutes', q.time_limit_minutes,
               'pass_percent', q.pass_percent,
               'tries', q.max_attempts,
               'bank', (select count(*) from lms_questions qq where qq.quiz_id = q.id and qq.active),
               'needed', ceil(q.serve_count * coalesce(q.bank_multiple, 1.5)))
        from lms_quizzes q where q.course_id = p_course limit 1),
    'checks', (select jsonb_agg(to_jsonb(b)) from lms_publish_checks(p_course) b)
  ) into v_out
  from lms_courses c where c.id = p_course;

  return v_out;
end $$;

/**
 * Write one lesson. Null means leave that field alone.
 *
 * THE VIDEO IS A PROVIDER AND A REFERENCE, never a full address. That is
 * file 02's shape and the reason is that the host can change without a
 * migration. A YouTube link pasted into the form is reduced to its id
 * here rather than stored whole, so the day Big Sam picks Bunny Stream
 * or Vimeo nothing in the database has to be rewritten.
 */
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

  return v_id;
end $$;

create or replace function lms_add_module(p_course uuid, p_title text default 'New module')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_pos integer;
begin
  if not lms_may_edit_course(p_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;
  select coalesce(max(m.position), 0) + 1 into v_pos from lms_modules m where m.course_id = p_course;
  insert into lms_modules (course_id, title, position)
  values (p_course, coalesce(nullif(btrim(p_title), ''), 'Module ' || v_pos), v_pos)
  returning id into v_id;
  return v_id;
end $$;

/**
 * Remove a lesson. ONLY WHILE THE COURSE IS A DRAFT, and only if nobody
 * has watched it: file 10's guard refuses a live course, and this
 * refuses one somebody has already made progress on, because nothing a
 * learner has touched is hard deleted.
 */
create or replace function lms_remove_lesson(p_lesson uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_seen integer;
begin
  select m.course_id into v_course from lms_lessons l
    join lms_modules m on m.id = l.module_id where l.id = p_lesson;
  if not lms_may_edit_course(v_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;

  select count(*) into v_seen from lms_lesson_progress g where g.lesson_id = p_lesson;
  if v_seen > 0 then
    raise exception
      'Somebody has already watched this lesson, so it cannot be deleted. Take the course down and rework it instead.'
      using errcode = '22023';
  end if;

  delete from lms_lessons where id = p_lesson;
end $$;

/**
 * Put the lessons of a module in a given order.
 *
 * The positions are set in two passes, high out of the way and then
 * down into place, because (module_id, position) is unique and swapping
 * two lessons the obvious way collides halfway through. The constraint
 * is deferrable, so one pass would also work inside a transaction, but
 * this way it works whether or not the caller is in one.
 */
create or replace function lms_reorder_lessons(p_module uuid, p_lessons uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_id uuid; v_i integer := 0;
begin
  select m.course_id into v_course from lms_modules m where m.id = p_module;
  if not lms_may_edit_course(v_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;

  update lms_lessons set position = position + 1000 where module_id = p_module;
  foreach v_id in array p_lessons loop
    v_i := v_i + 1;
    update lms_lessons set position = v_i where id = v_id and module_id = p_module;
  end loop;
end $$;

drop function if exists lms_studio_questions(uuid);

/**
 * Every question in one set, for the Checks and exams page. STAFF ONLY,
 * and it carries is_correct, which is the one place in the whole system
 * that leaves the server.
 *
 * THAT IS THE POINT OF THE ROLE TEST HERE. lms_start_exam strips the
 * answers for a learner precisely so this information never reaches a
 * browser. It reaches a facilitator's browser because a facilitator has
 * to see which answer is right in order to write the question. So the
 * refusal below is not a formality: it is the only thing between the
 * answer key and anybody who asks for it.
 */
create or replace function lms_studio_questions(p_quiz uuid)
returns table (
  id uuid, prompt text, explanation text, shown_at integer, active boolean,
  locked boolean, options jsonb, lesson_id uuid, chapter_start integer
)
language plpgsql stable security definer set search_path = public as $$
declare v_course uuid;
begin
  select coalesce(q.course_id, m.course_id) into v_course
    from lms_quizzes q
    left join lms_lessons l on l.id = q.lesson_id
    left join lms_modules m on m.id = coalesce(q.module_id, l.module_id)
   where q.id = p_quiz;

  if v_course is not null then
    if not lms_may_edit_course(v_course) then
      raise exception 'That course is not yours.' using errcode = '42501';
    end if;
  elsif not lms_is_admin() then
    raise exception 'Only an administrator can see the path exam.' using errcode = '42501';
  end if;

  return query
  select qq.id, qq.prompt, qq.explanation, qq.position, qq.active,
         lms_question_is_locked(qq.id),
         coalesce((select jsonb_agg(jsonb_build_object(
                            'id', o.id, 'label', o.label, 'is_correct', o.is_correct)
                          order by o.position)
                     from lms_options o where o.question_id = qq.id), '[]'::jsonb),
         qq.lesson_id, qq.chapter_start_seconds
    from lms_questions qq
   where qq.quiz_id = p_quiz
   order by qq.position;
end $$;

do $$ begin raise notice 'Step 3b: the builder reads and writes a course.'; end $$;


-- =====================================================================
-- STEP 4  LEARNERS.  ADMINISTRATORS ONLY, EVERY ONE OF THEM
-- =====================================================================
--
-- A FACILITATOR NEVER SEES A LEARNER'S NAME OR EMAIL ADDRESS. Not in a
-- list, not in a report, not in the activity log. Every function in
-- this step begins by refusing anybody who is not an administrator, and
-- there is no facilitator-shaped version of any of them further down
-- the file. That is the brief's rule and it is cheaper to keep by
-- having nothing to hide than by hiding things.
--
-- lms_learner_profiles is file 16's table and stays as file 16 left it:
-- administrators only, one record at a time, every read logged.
-- lms_learner_record is file 16's function and is called rather than
-- reimplemented, so the logging cannot be bypassed by a second route.

drop function if exists lms_staff_learners(text, text, integer, integer);

/**
 * The learner list.
 *
 * p_filter is one of: all, active, waiting, finished, quiet.
 * p_access narrows by how they got in: free, purchase, roster, manual,
 * scholarship, or null for any.
 *
 * WHY THE FILTERS ARE HERE AND NOT IN THE PAGE. "Waiting on the exam"
 * means both tries used and the 24 hours not yet up, which is a join
 * across attempts and a time comparison. Done in the page it would need
 * every learner's attempts sent to a browser, which is both slow and
 * exactly the data a facilitator must never receive. Done here it is
 * one query and the answer is already the short list.
 */
create or replace function lms_staff_learners(
  p_search text default '',
  p_filter text default 'all',
  p_access text default null,
  p_limit  integer default 100,
  p_offset integer default 0
)
returns table (
  user_id uuid, full_name text, email text, joined timestamptz,
  course_count integer, furthest_course text, furthest_percent integer,
  last_active timestamptz, access_source text, certificates integer,
  state text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can see the learner list.' using errcode = '42501';
  end if;

  return query
  with base as (
    select p.id,
           p.full_name,
           u.email::text as email,
           u.created_at as joined,
           (select count(*) from lms_entitlements e
             where e.user_id = p.id and e.status = 'active')::integer as course_count,
           (select max(w.day) from lms_watch_days w where w.user_id = p.id) as last_day,
           (select count(*) from certificates ct
              join lms_profiles pr on pr.participant_id = ct.participant_id
             where pr.id = p.id)::integer as certs,
           -- how they got in: the strongest source they hold, because
           -- somebody with a scholarship AND the free courses is a
           -- scholarship learner, not a free one
           (select e.source::text from lms_entitlements e
             where e.user_id = p.id and e.status = 'active'
             order by case e.source
                        when 'purchase' then 1 when 'roster' then 2
                        when 'scholarship' then 3 when 'manual' then 4 else 5 end
             limit 1) as src,
           exists (
             select 1 from lms_quiz_attempts a
               join lms_quizzes q on q.id = a.quiz_id
              where a.user_id = p.id and q.course_id is not null
              group by a.quiz_id, q.max_attempts, q.retake_after_minutes
             having count(*) >= max(q.max_attempts)
                and bool_and(not coalesce(a.passed, false))
                and max(a.submitted_at) > now() - make_interval(mins => max(q.retake_after_minutes))
           ) as waiting
      from lms_profiles p
      join auth.users u on u.id = p.id
     where p.role = 'learner'
  ),
  shaped as (
    select b.*,
           case
             when b.certs > 0 then 'finished'
             when b.waiting then 'waiting'
             when b.last_day >= (current_date - 7) then 'active'
             when b.last_day is null or b.last_day < (current_date - 21) then 'quiet'
             else 'on the way'
           end as state
      from base b
  )
  select s.id, s.full_name, s.email, s.joined, s.course_count,
         (select c.title from lms_lesson_progress g
            join lms_lessons l on l.id = g.lesson_id
            join lms_modules m on m.id = l.module_id
            join lms_courses c on c.id = m.course_id
           where g.user_id = s.id order by g.updated_at desc limit 1),
         (select round(lms_course_progress(m.course_id))::integer
            from lms_lesson_progress g
            join lms_lessons l on l.id = g.lesson_id
            join lms_modules m on m.id = l.module_id
           where g.user_id = s.id order by g.updated_at desc limit 1),
         (s.last_day)::timestamptz, s.src, s.certs, s.state
    from shaped s
   where (coalesce(btrim(p_search), '') = ''
          or s.full_name ilike '%' || btrim(p_search) || '%'
          or s.email     ilike '%' || btrim(p_search) || '%')
     and (p_filter is null or p_filter = 'all' or s.state = p_filter)
     and (p_access is null or s.src = p_access)
   order by s.joined desc
   limit greatest(1, least(coalesce(p_limit, 100), 500))
  offset greatest(0, coalesce(p_offset, 0));
end $$;

/**
 * Lift a 24 hour exam wait, now.
 *
 * WHAT IT DOES NOT DO is give anybody a mark or a pass. It moves the
 * clock back on the last attempt so the exam opens again, with a fresh
 * set of questions, which is what it would have done by itself a few
 * hours later. Logged with the learner and the exam, because a wait
 * lifted is a favour and favours should be visible.
 */
create or replace function lms_lift_exam_wait(p_user uuid, p_exam uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can lift an exam wait.' using errcode = '42501';
  end if;

  -- Older than any retake window, so lms_exam_status finds the wait
  -- expired. The attempts themselves are untouched: the tries are still
  -- spent and the scores still stand.
  update lms_quiz_attempts
     set submitted_at = now() - interval '400 days'
   where user_id = p_user and quiz_id = p_exam and submitted_at is not null;

  perform lms_log_action('exam_wait_lifted', 'learner', p_user,
    jsonb_build_object('exam', p_exam));
end $$;

/**
 * Give somebody a course, with a reason.
 *
 * THE REASON IS NOT OPTIONAL. An entitlement given with no reason is
 * one nobody can explain later, and "why does this person have the paid
 * course" is a question that gets asked.
 */
create or replace function lms_give_access(
  p_user uuid, p_course uuid, p_reason text,
  p_source lms_grant_source default 'manual',
  p_until timestamptz default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_was text;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can give access.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Say why. An access grant with no reason is one nobody can explain later.'
      using errcode = '22023';
  end if;
  if p_source = 'roster' then
    raise exception 'Bootcamp access follows the roster and is not given by hand. Add them to the enrolment instead.'
      using errcode = '22023';
  end if;

  -- NOT "on conflict do nothing", which is what this said first and
  -- which was worse than a failure.
  --
  -- There is a partial unique index, lms_entitlements_live_course, on
  -- (user_id, course_id) where the grant is active: one live grant per
  -- learner per course, which is right. So giving a scholarship to
  -- somebody who already holds the course through the free sweep did
  -- NOTHING, silently, while the line below wrote "access given" into
  -- the log. The log said a thing had happened that had not. A silent
  -- no-op is recoverable; a log that lies is the thing you later make
  -- decisions from.
  --
  -- So it upserts: an existing live grant is lifted to the new source
  -- and gets the new expiry, and the old source is carried into the log
  -- line so the change is legible.
  select e.source::text into v_was
    from lms_entitlements e
   where e.user_id = p_user and e.course_id = p_course and e.status = 'active';

  insert into lms_entitlements (user_id, course_id, source, status, granted_by, expires_at)
  values (p_user, p_course, p_source, 'active', auth.uid(), p_until)
  on conflict (user_id, course_id) where status = 'active' and course_id is not null
  do update set source = excluded.source,
                granted_by = excluded.granted_by,
                expires_at = excluded.expires_at;

  perform lms_log_action('access_given', 'learner', p_user,
    jsonb_build_object('course', p_course, 'source', p_source::text,
                       'was', v_was,
                       'reason', btrim(p_reason), 'until', p_until));
end $$;

create or replace function lms_remove_access(p_user uuid, p_course uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can remove access.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Say why.' using errcode = '22023';
  end if;

  -- Revoked, not deleted, and progress is left exactly where it is.
  -- Nothing a learner has touched gets hard deleted, which has been the
  -- rule since file 03.
  update lms_entitlements
     set status = 'revoked', revoked_at = now(), revoked_by = auth.uid(),
         revoke_reason = btrim(p_reason)
   where user_id = p_user and course_id = p_course and status = 'active';

  perform lms_log_action('access_removed', 'learner', p_user,
    jsonb_build_object('course', p_course, 'reason', btrim(p_reason)));
end $$;

do $$ begin raise notice 'Step 4: the learner list, the record, access and the exam wait.'; end $$;


-- =====================================================================
-- STEP 5  PATHS
-- =====================================================================
--
-- Create one, order its courses, set the certificate name, write its
-- exam. Publishing is file 16's lms_publish_path, called rather than
-- reimplemented: it already refuses while any course in the path is
-- unpublished or the bank is short, and two functions deciding when a
-- path may go live is one too many.

create or replace function lms_create_path(p_name text, p_certificate_name text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_slug text; v_n integer := 1;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can create a learning path.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'A path needs a name.' using errcode = '22023';
  end if;

  v_slug := btrim(regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'), '-');
  if v_slug = '' then v_slug := 'path'; end if;
  while exists (select 1 from lms_paths p where p.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := btrim(regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'), '-') || '-' || v_n;
  end loop;

  insert into lms_paths (slug, name, status, certificate_name)
  values (v_slug, btrim(p_name), 'draft',
          coalesce(nullif(btrim(p_certificate_name), ''), 'Professional Certificate in ' || btrim(p_name)))
  returning id into v_id;

  perform lms_ensure_path_exam(v_id);
  perform lms_log_action('path_created', 'path', v_id, jsonb_build_object('name', btrim(p_name)));
  return v_id;
end $$;

/**
 * The courses in a path, in the order a learner meets them.
 *
 * The whole list every time, not one course at a time, because the
 * order is the thing being set and a sequence of single inserts has an
 * order of its own that nobody chose.
 */
create or replace function lms_set_path_courses(p_path uuid, p_courses uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_i integer := 0;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can change a learning path.' using errcode = '42501';
  end if;

  delete from lms_path_courses where path_id = p_path;
  foreach v_id in array coalesce(p_courses, '{}'::uuid[]) loop
    v_i := v_i + 1;
    insert into lms_path_courses (path_id, course_id, position) values (p_path, v_id, v_i);
  end loop;

  perform lms_log_action('path_courses_set', 'path', p_path,
    jsonb_build_object('courses', coalesce(array_length(p_courses, 1), 0)));
end $$;

create or replace function lms_set_path_details(
  p_path uuid, p_name text default null,
  p_description text default null, p_certificate_name text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can change a learning path.' using errcode = '42501';
  end if;
  update lms_paths
     set name = coalesce(nullif(btrim(p_name), ''), name),
         description = coalesce(p_description, description),
         certificate_name = coalesce(nullif(btrim(p_certificate_name), ''), certificate_name)
   where id = p_path;
end $$;


-- =====================================================================
-- STEP 6  AREAS AND TOOLS
-- =====================================================================
--
-- An area is one of the seven. A tool is something an area teaches,
-- whether or not there is a course for it yet, which is the whole point
-- of the table: the landing picker shows "Coming soon" for the ones
-- with nothing behind them, and you cannot build that list out of the
-- courses.

create or replace function lms_add_area_tool(p_area text, p_tool text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_area uuid; v_id uuid; v_pos integer;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can add a tool to an area.' using errcode = '42501';
  end if;
  select a.id into v_area from lms_areas a where a.name = btrim(p_area);
  if v_area is null then
    raise exception 'There is no area called %.', btrim(p_area) using errcode = '22023';
  end if;
  if coalesce(btrim(p_tool), '') = '' then
    raise exception 'A tool needs a name.' using errcode = '22023';
  end if;

  select t.id into v_id from lms_area_tools t
   where t.area_id = v_area and lower(t.name) = lower(btrim(p_tool));
  if v_id is not null then return v_id; end if;

  select coalesce(max(t.position), 0) + 1 into v_pos from lms_area_tools t where t.area_id = v_area;
  insert into lms_area_tools (area_id, name, position)
  values (v_area, btrim(p_tool), v_pos)
  returning id into v_id;

  perform lms_log_action('area_tool_added', 'area', v_area,
    jsonb_build_object('area', btrim(p_area), 'tool', btrim(p_tool)));
  return v_id;
end $$;

create or replace function lms_remove_area_tool(p_tool uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can remove a tool.' using errcode = '42501';
  end if;
  delete from lms_area_tools where id = p_tool;
end $$;

drop function if exists lms_areas_overview();

/**
 * Every area with what is in it. Staff only, and it counts rather than
 * being told, so a number on this page cannot be stale.
 */
create or replace function lms_areas_overview()
returns table (
  -- "shown_at", not "position", for the same reason lms_publish_checks
  -- says "n": position is a function in Postgres and a column of that
  -- name in a returns table is a syntax error.
  area_id uuid, slug text, name text, icon_key text, shown_at integer,
  tool_count integer, course_count integer, published_count integer,
  tools jsonb
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_staff() then
    raise exception 'Staff only.' using errcode = '42501';
  end if;
  return query
  select a.id, a.slug, a.name, a.icon_key, a.position,
         (select count(*) from lms_area_tools t where t.area_id = a.id)::integer,
         (select count(*) from lms_course_areas ca where ca.area_id = a.id)::integer,
         (select count(*) from lms_course_areas ca join lms_courses c on c.id = ca.course_id
           where ca.area_id = a.id and c.status = 'published')::integer,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', t.id, 'name', t.name,
                    -- the course behind this tool, if there is one
                    'course', (select c.slug from lms_courses c
                                where lower(c.tool) = lower(t.name)
                                  and c.status = 'published' limit 1))
                  order by t.position)
             from lms_area_tools t where t.area_id = a.id), '[]'::jsonb)
    from lms_areas a
   order by a.position;
end $$;

do $$ begin raise notice 'Step 5 and 6: paths, areas and tools.'; end $$;


-- =====================================================================
-- STEP 7  REPORTS
-- =====================================================================
--
-- TWO RULES RUN THROUGH ALL OF THIS AND NEITHER IS NEGOTIABLE.
--
-- 1. A FACILITATOR SEES ONLY THEIR OWN COURSES AND NEVER A NAME. Every
--    function here either refuses a facilitator outright or filters to
--    lms_may_edit_course. None of them returns a person.
--
-- 2. TOTALS ONLY, AND ANY GROUP UNDER 5 IS "fewer than 5". That is
--    file 16's rule for lms_learner_totals and it is kept here. The
--    reason it matters: a breakdown where one row says 3 and the rest
--    are exact, next to a grand total, gives the 3 away by subtraction.
--    So when ANY group in a report is under 5, every group in that same
--    report is suppressed, not just the small one. File 16 learnt that
--    the hard way in its own review and this step does not relearn it.
--
-- CSV DOWNLOADS ARE LOGGED. Not the contents, the fact: who asked for
-- which file and when. An export is the moment data leaves the place
-- that protects it.

drop function if exists lms_report_active_days(integer);

/**
 * Active learners per day: anyone who watched, read or answered that
 * day. Staff, and a facilitator sees the same shape counted only over
 * their own courses.
 */
create or replace function lms_report_active_days(p_days integer default 30)
returns table (day date, learners integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_staff() then
    raise exception 'Staff only.' using errcode = '42501';
  end if;
  if p_days not in (7, 30, 90) then
    raise exception 'Reports are drawn over 7, 30 or 90 days.' using errcode = '22023';
  end if;

  return query
  with days as (
    select generate_series(current_date - (p_days - 1), current_date, interval '1 day')::date as d
  )
  select d.d,
         (select count(distinct w.user_id)::integer
            from lms_watch_days w where w.day = d.d
             and (lms_is_admin() or exists (
                   select 1 from lms_lesson_progress g
                     join lms_lessons l on l.id = g.lesson_id
                     join lms_modules m on m.id = l.module_id
                     join lms_courses c on c.id = m.course_id
                    where g.user_id = w.user_id and c.created_by = auth.uid())))
    from days d order by d.d;
end $$;

drop function if exists lms_report_funnel(uuid);

/**
 * How far learners get in one course: have access, started, halfway,
 * finished every lesson, certified.
 */
create or replace function lms_report_funnel(p_course uuid)
returns table (stage text, learners integer, share integer)
language plpgsql stable security definer set search_path = public as $$
declare v_have integer;
begin
  if not lms_may_edit_course(p_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;

  select count(*)::integer into v_have
    from lms_entitlements e where e.course_id = p_course and e.status = 'active';

  return query
  with t as (select count(*)::integer n from lms_lessons l
               join lms_modules m on m.id = l.module_id where m.course_id = p_course),
  per as (
    select g.user_id, count(*) filter (where g.completed)::integer as done
      from lms_lesson_progress g
      join lms_lessons l on l.id = g.lesson_id
      join lms_modules m on m.id = l.module_id
     where m.course_id = p_course
     group by g.user_id
  )
  select x.stage, x.n,
         case when v_have = 0 then 0 else round(100.0 * x.n / v_have)::integer end
    from (
      select 1 as ord, 'Have access'::text as stage, v_have as n
      union all select 2, 'Started',   (select count(*)::integer from per where done > 0)
      union all select 3, 'Halfway',   (select count(*)::integer from per
                                         where done >= ceil((select n from t) / 2.0))
      union all select 4, 'Finished every lesson',
                                       (select count(*)::integer from per where done >= (select n from t))
      union all select 5, 'Certified', (select count(*)::integer from lms_entitlements e
                                          join lms_profiles pr on pr.id = e.user_id
                                          join certificates ct on ct.participant_id = pr.participant_id
                                          join lms_courses c on c.id = e.course_id
                                         where e.course_id = p_course and c.programme_id is not null)
    ) x order by x.ord;
end $$;

drop function if exists lms_report_lesson_drop(uuid);

/**
 * The share of learners who finish each lesson, which is how a long or
 * confusing lesson shows itself.
 */
create or replace function lms_report_lesson_drop(p_course uuid)
returns table (shown_at integer, lesson_id uuid, title text, finished integer, share integer)
language plpgsql stable security definer set search_path = public as $$
declare v_started integer;
begin
  if not lms_may_edit_course(p_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;

  select count(distinct g.user_id)::integer into v_started
    from lms_lesson_progress g
    join lms_lessons l on l.id = g.lesson_id
    join lms_modules m on m.id = l.module_id
   where m.course_id = p_course;

  return query
  select row_number() over (order by m.position, l.position)::integer,
         l.id, l.title,
         (select count(*)::integer from lms_lesson_progress g
           where g.lesson_id = l.id and g.completed),
         case when v_started = 0 then 0 else
           round(100.0 * (select count(*) from lms_lesson_progress g
                           where g.lesson_id = l.id and g.completed) / v_started)::integer end
    from lms_lessons l join lms_modules m on m.id = l.module_id
   where m.course_id = p_course
   order by m.position, l.position;
end $$;

drop function if exists lms_report_hard_questions(uuid, integer);

/**
 * The questions most people get wrong, over course exams and lesson
 * checks. Never a learner, only the question and the share.
 */
create or replace function lms_report_hard_questions(p_course uuid default null, p_limit integer default 10)
returns table (question_id uuid, prompt text, where_it_is text, answered integer, right_share integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_staff() then
    raise exception 'Staff only.' using errcode = '42501';
  end if;

  return query
  with mine as (
    select c.id from lms_courses c
     where lms_is_admin() or c.created_by = auth.uid()
  ),
  served as (
    select qq.id as qid,
           qq.prompt,
           coalesce(c.title, 'Path exam') ||
             case when q.lesson_id is not null then ' - ' || l.title || ' check'
                  else ' - course exam' end as place,
           count(*)::integer as seen,
           count(*) filter (
             where (a.answers -> qq.id::text) is not null
               and exists (select 1 from lms_options o
                            where o.question_id = qq.id and o.is_correct
                              and o.id::text = (a.answers ->> qq.id::text))
           )::integer as got
      from lms_quiz_attempts a
      join lms_questions qq on qq.id = any (a.served_question_ids)
      join lms_quizzes q on q.id = qq.quiz_id
      left join lms_lessons l on l.id = q.lesson_id
      left join lms_modules m on m.id = coalesce(q.module_id, l.module_id)
      left join lms_courses c on c.id = coalesce(q.course_id, m.course_id)
     where a.submitted_at is not null
       and (c.id is null or c.id in (select id from mine))
       and (p_course is null or c.id = p_course)
     group by qq.id, qq.prompt, place
  )
  select s.qid, s.prompt, s.place, s.seen,
         case when s.seen = 0 then 0 else round(100.0 * s.got / s.seen)::integer end
    from served s
   -- Under five answers is not a hard question, it is a new one, and
   -- putting it at the top of this list would send somebody to rewrite
   -- a question two people happened to miss.
   where s.seen >= 5
   order by (s.got::numeric / nullif(s.seen, 0)) asc nulls last
   limit greatest(1, least(coalesce(p_limit, 10), 50));
end $$;

drop function if exists lms_report_who(text);

/**
 * "Who our learners are". ADMINISTRATORS ONLY.
 *
 * File 16's lms_learner_totals does the counting and the suppression,
 * and is called rather than copied: it already refuses a facilitator,
 * already returns "fewer than 5", and already suppresses every group in
 * a report when any one of them is small. A second implementation here
 * would be a second chance to get that wrong.
 *
 * This wrapper exists only to log the read, because "who our learners
 * are" is the page where the sensitive answers are, and a page that
 * shows them should leave a trace that it was looked at.
 */
create or replace function lms_report_who(p_field text)
returns table (value text, total text)
language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can see who our learners are.' using errcode = '42501';
  end if;
  perform lms_log_action('report_who_read', 'report', null, jsonb_build_object('field', p_field));
  return query select t.value, t.total from lms_learner_totals(p_field) t;
end $$;

/**
 * Write down that somebody downloaded a file. Called by the page the
 * moment a download starts.
 *
 * It records WHICH file and WHO, never the contents. An export is the
 * moment data leaves the place that protects it, and six months later
 * the only question anybody will ask is who had it.
 */
create or replace function lms_log_export(p_file text, p_rows integer default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_staff() then
    raise exception 'Staff only.' using errcode = '42501';
  end if;
  if p_file ilike '%learner%' and not lms_is_admin() then
    raise exception 'Only an administrator can export learner data.' using errcode = '42501';
  end if;
  perform lms_log_action('export_downloaded', 'export', null,
    jsonb_build_object('file', p_file, 'rows', p_rows));
end $$;

do $$ begin raise notice 'Step 7: reports, totals only, small groups suppressed.'; end $$;


-- =====================================================================
-- STEP 8  CERTIFICATES
-- =====================================================================
--
-- A list and a search, nothing more. REVOKING STAYS IN THE EXISTING
-- CERTIFICATE CONSOLE, which is the brief's instruction and the right
-- one: that tool already does it, already logs it, and two places that
-- can revoke a certificate is one place too many for an action nobody
-- can take back.

drop function if exists lms_studio_certificates(text, integer, integer);

create or replace function lms_studio_certificates(
  p_search text default '', p_limit integer default 50, p_offset integer default 0
)
returns table (
  certificate_number text, full_name text, programme text,
  issued_on date, revoked boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can see the certificate list.' using errcode = '42501';
  end if;
  return query
  -- ct.revoked, a boolean. NOT ct.revoked_at, which does not exist and
  -- which this read invented. database/lms/schema-snapshot.md has said
  -- so since before this file was written; I built against a local
  -- harness that was right and never checked my column names against
  -- it. PL/pgSQL resolves a column name only when the function RUNS, so
  -- nothing failed until somebody opened the page.
  select ct.certificate_number, pa.full_name, pr.title,
         ct.completed_on, ct.revoked
    from certificates ct
    join participants pa on pa.id = ct.participant_id
    join programmes  pr on pr.id = ct.programme_id
   where coalesce(btrim(p_search), '') = ''
      or ct.certificate_number ilike '%' || btrim(p_search) || '%'
      or pa.full_name          ilike '%' || btrim(p_search) || '%'
   order by ct.completed_on desc nulls last
   limit greatest(1, least(coalesce(p_limit, 50), 500))
  offset greatest(0, coalesce(p_offset, 0));
end $$;

drop function if exists lms_studio_certificate_counts();

create or replace function lms_studio_certificate_counts()
returns table (all_time integer, this_week integer, revoked integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can see certificate counts.' using errcode = '42501';
  end if;
  return query
  select count(*)::integer,
         count(*) filter (where ct.completed_on >= current_date - 7)::integer,
         count(*) filter (where ct.revoked)::integer
    from certificates ct;
end $$;


-- =====================================================================
-- STEP 9  POPUPS
-- =====================================================================
--
-- File 16 made lms_popups and lms_live_popup. This step is the writing
-- side: create, edit, schedule, stop.
--
-- A NEW POPUP STARTS AS A DRAFT, always, with no way to create one live
-- in a single call. A box that appears over the whole site is the one
-- thing in here where a slip of the hand is seen by everybody, so going
-- live is a second, deliberate action.
--
-- ONE LIVE AT A TIME, enforced here rather than hoped for: making one
-- live stands the others down in the same statement.

create or replace function lms_save_popup(
  p_popup uuid default null,
  p_heading text default null, p_message text default null,
  p_button_text text default null,
  p_course uuid default null, p_path uuid default null, p_url text default null,
  p_picture text default null, p_picture_url text default null,
  p_audience text default null, p_place text default null,
  p_how_often text default null,
  p_starts_at timestamptz default null, p_ends_at timestamptz default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_popup;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can write a popup.' using errcode = '42501';
  end if;

  -- The place check is file 16's constraint, said again here so the
  -- message names the rule rather than the constraint. A lesson, a
  -- check and an exam are never allowed, and that is said in three
  -- places on purpose: here, in the table's check, and in the page.
  if p_place is not null and p_place not in ('landing','courses','course','me') then
    raise exception
      'A popup can appear on the landing page, the catalogue, a course page or My learning. Never over a lesson, a check or an exam.'
      using errcode = '22023';
  end if;

  -- A popup is a button, and a button has to go somewhere. File 16's
  -- constraint says exactly one of course, path or address, and it says
  -- it as a constraint name. Said here too, in words, because
  -- "lms_popups_one_target" on a form is not a message anybody can act
  -- on.
  if v_id is null then
    if (case when p_course is not null then 1 else 0 end)
     + (case when p_path   is not null then 1 else 0 end)
     + (case when coalesce(btrim(p_url), '') <> '' then 1 else 0 end) <> 1 then
      raise exception 'A popup points at one thing: a course, a path or an address. Pick one.'
        using errcode = '22023';
    end if;
    insert into lms_popups (heading, message, button_text, course_id, path_id, url,
                            picture, picture_url, audience, place, how_often,
                            starts_at, ends_at, status)
    values (coalesce(p_heading, ''), coalesce(p_message, ''), coalesce(p_button_text, 'Have a look'),
            p_course, p_path, p_url,
            coalesce(p_picture, 'none'), p_picture_url,
            coalesce(p_audience, 'everyone'), coalesce(p_place, 'landing'),
            coalesce(p_how_often, 'once'), p_starts_at, p_ends_at, 'draft')
    returning id into v_id;
    perform lms_log_action('popup_created', 'popup', v_id, jsonb_build_object('heading', p_heading));
  else
    update lms_popups
       set heading = coalesce(p_heading, heading),
           message = coalesce(p_message, message),
           button_text = coalesce(p_button_text, button_text),
           course_id = coalesce(p_course, course_id),
           path_id = coalesce(p_path, path_id),
           url = coalesce(p_url, url),
           picture = coalesce(p_picture, picture),
           picture_url = coalesce(p_picture_url, picture_url),
           audience = coalesce(p_audience, audience),
           place = coalesce(p_place, place),
           how_often = coalesce(p_how_often, how_often),
           starts_at = coalesce(p_starts_at, starts_at),
           ends_at = coalesce(p_ends_at, ends_at)
     where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function lms_start_popup(p_popup uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_head text;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can start a popup.' using errcode = '42501';
  end if;
  select heading into v_head from lms_popups where id = p_popup;
  if coalesce(btrim(v_head), '') = '' then
    raise exception 'A popup needs a heading before it goes live.' using errcode = '22023';
  end if;

  -- One at a time. The others are stood down in the same statement, so
  -- there is no moment when two are live.
  -- ends_at has to be AFTER starts_at, which file 16's window check
  -- insists on and is right to. A popup started and stood down in the
  -- same statement would otherwise have a window of zero length, and
  -- "ends at the moment it began" is not a thing anybody meant.
  update lms_popups
     set status = 'ended',
         ends_at = greatest(now(), coalesce(starts_at, now()) + interval '1 second')
   where status = 'live' and id <> p_popup;
  update lms_popups set status = 'live', starts_at = coalesce(starts_at, now()) where id = p_popup;

  perform lms_log_action('popup_started', 'popup', p_popup, jsonb_build_object('heading', v_head));
end $$;

create or replace function lms_stop_popup(p_popup uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can stop a popup.' using errcode = '42501';
  end if;
  update lms_popups
     set status = 'ended',
         ends_at = greatest(now(), coalesce(starts_at, now()) + interval '1 second')
   where id = p_popup;
  perform lms_log_action('popup_stopped', 'popup', p_popup, '{}'::jsonb);
end $$;


-- =====================================================================
-- STEP 10  SITE SETTINGS
-- =====================================================================
--
-- The landing headline, the line under it, the announcement and the
-- welcome video. lms_settings is file 02's one-row table and the public
-- pages already read it through landingWords, so a change here shows on
-- the site with no release. That is the whole point of the table.

create or replace function lms_set_site_settings(
  p_headline text default null,
  p_subhead text default null,
  p_announce_on boolean default null,
  p_announce_text text default null,
  p_welcome_provider text default null,
  p_welcome_ref text default null,
  p_welcome_seconds integer default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_was jsonb;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can change the site settings.' using errcode = '42501';
  end if;
  -- An announcement that is on and says nothing is a band of empty
  -- colour across the top of the site, which looks like a fault.
  if coalesce(p_announce_on, false)
     and coalesce(btrim(coalesce(p_announce_text,
           (select announce_text from lms_settings where id = 1))), '') = '' then
    raise exception 'An announcement needs something to say.' using errcode = '22023';
  end if;

  select to_jsonb(s) - 'updated_at' into v_was from lms_settings s where s.id = 1;

  update lms_settings
     set headline = coalesce(nullif(btrim(p_headline), ''), headline),
         subhead = coalesce(p_subhead, subhead),
         announce_on = coalesce(p_announce_on, announce_on),
         announce_text = coalesce(p_announce_text, announce_text),
         welcome_provider = coalesce(p_welcome_provider, welcome_provider),
         welcome_ref = coalesce(p_welcome_ref, welcome_ref),
         welcome_seconds = coalesce(p_welcome_seconds, welcome_seconds)
   where id = 1;

  perform lms_log_action('site_settings_changed', 'settings', null,
    jsonb_build_object('was', v_was,
                       'now', (select to_jsonb(s) - 'updated_at' from lms_settings s where s.id = 1)));
end $$;


-- =====================================================================
-- STEP 11  HEALTH AND ACTIVITY
-- =====================================================================

drop function if exists lms_studio_health();

/**
 * The health rows, for a signed in administrator.
 *
 * File 12's system_health() takes a token and deliberately refuses a
 * signed in caller, because it is written for an outside alarm script
 * that has no account. This is the same information for the person
 * sitting in the control room, and it is a separate function rather
 * than a widened one so the alarm's contract is untouched.
 */
create or replace function lms_studio_health()
returns table (item text, severity text, value text, detail text)
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_bytes bigint; v_mins numeric; v_at timestamptz; v_n integer;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can see the health page.' using errcode = '42501';
  end if;

  -- Emails today and this hour, against the two ceilings file 12 set.
  select count(*) into v_n from mail_outbox where created_at >= current_date;
  return query select 'Emails today'::text,
    case when v_n > 90 then 'warn' else 'ok' end,
    v_n::text || ' of 100',
    'The daily allowance on the account that owns the mailer.'::text;

  select count(*) into v_n from mail_outbox where created_at >= now() - interval '1 hour';
  return query select 'Emails this hour'::text,
    case when v_n > 18 then 'warn' else 'ok' end,
    v_n::text || ' of 20', 'The hourly ceiling.'::text;

  -- Anything still sitting unsent is the thing that means the mailer
  -- has stopped, and it is the row worth looking at first.
  --
  -- "not sent", a boolean, and the age comes from created_at. There is
  -- no sent_at column on mail_outbox and there never was.
  select count(*), min(created_at) into v_n, v_at
    from mail_outbox where not sent;
  return query select 'Waiting to be sent'::text,
    case when v_n > 0 and v_at < now() - interval '20 minutes' then 'warn' else 'ok' end,
    v_n::text,
    case when v_n = 0 then 'Nothing waiting.'
         else 'Oldest has waited ' || age(now(), v_at)::text || '.' end;

  -- Storage, against the free plan's 500 MB.
  select coalesce(sum(pg_total_relation_size(c.oid)), 0) into v_bytes
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r';
  return query select 'Database size'::text,
    case when v_bytes > 400 * 1024 * 1024 then 'warn' else 'ok' end,
    pg_size_pretty(v_bytes),
    'The free plan stops at 500 MB.'::text;

  select count(*) into v_n from lms_profiles p join auth.users u on u.id = p.id
   where u.email_confirmed_at is null and u.created_at >= current_date - 1;
  return query select 'Sign ups not confirmed today'::text,
    case when v_n >= 5 then 'warn' else 'ok' end, v_n::text,
    'Five or more usually means the confirmation emails are not arriving.'::text;

  select count(*) into v_n from lms_system_heartbeat
   where name = 'signup_answers_refused' and at >= now() - interval '7 days';
  return query select 'Sign up answers refused, last 7 days'::text,
    case when v_n > 0 then 'warn' else 'ok' end, v_n::text,
    'The form and the database have stopped agreeing about a rule.'::text;

  select count(*) into v_n from lms_system_heartbeat where name = 'activity_log_write_failed';
  return query select 'Activity log writes'::text,
    case when v_n > 0 then 'warn' else 'ok' end,
    case when v_n > 0 then 'a write failed' else 'fine' end,
    'If this warns, something happened that was not recorded.'::text;
end $$;

drop function if exists lms_studio_biggest_tables(integer);

create or replace function lms_studio_biggest_tables(p_limit integer default 10)
returns table (table_name text, bytes bigint, pretty text, rows_estimate bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can see the table sizes.' using errcode = '42501';
  end if;
  return query
  select c.relname::text, pg_total_relation_size(c.oid),
         pg_size_pretty(pg_total_relation_size(c.oid)), c.reltuples::bigint
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
   order by pg_total_relation_size(c.oid) desc
   limit greatest(1, least(coalesce(p_limit, 10), 50));
end $$;

drop function if exists lms_activity_log(text, integer, integer);

/**
 * The activity log.
 *
 * A FACILITATOR SEES ONLY WHAT HAPPENED TO THEIR OWN COURSES, and never
 * a learner's name. The filter is on subject_id against the courses
 * they built, and every row about a learner is dropped outright rather
 * than blanked, because a row saying "access given to somebody" with
 * the name removed still tells them a thing they have no business
 * knowing.
 */
create or replace function lms_activity_log(
  p_action text default null, p_limit integer default 50, p_offset integer default 0
)
returns table (
  at timestamptz, actor text, action text,
  subject_type text, subject_id uuid, subject text, detail jsonb
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_staff() then
    raise exception 'Staff only.' using errcode = '42501';
  end if;

  return query
  select a.created_at,
         coalesce(pr.full_name, 'the system'),
         a.action, a.subject_type, a.subject_id,
         case a.subject_type
           when 'course' then (select c.title from lms_courses c where c.id = a.subject_id)
           when 'path'   then (select p.name  from lms_paths   p where p.id = a.subject_id)
           when 'popup'  then (select pp.heading from lms_popups pp where pp.id = a.subject_id)
           -- a learner is named only for an administrator, and a
           -- facilitator never reaches this row at all
           when 'learner' then (select p2.full_name from lms_profiles p2 where p2.id = a.subject_id)
           else null
         end,
         a.detail
    from lms_admin_actions a
    left join lms_profiles pr on pr.id = a.actor_id
   where (p_action is null or a.action = p_action)
     and (
       lms_is_admin()
       or (a.subject_type = 'course'
           and a.subject_id in (select c.id from lms_courses c where c.created_by = auth.uid()))
     )
   order by a.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 500))
  offset greatest(0, coalesce(p_offset, 0));
end $$;

do $$ begin raise notice 'Step 8 to 11: certificates, popups, settings, health and the log.'; end $$;


-- =====================================================================
-- STEP 11b  STAFF
-- =====================================================================
--
-- File 10 keeps lms_facilitators, a list of email addresses, so
-- somebody can be appointed before they have ever signed up and the
-- appointment waits for them. This is the writing side of that list.
--
-- NOTHING HERE CAN MAKE AN ADMINISTRATOR. lms_set_staff_role refuses
-- the value outright, and adding an email to lms_facilitators makes a
-- facilitator and nothing more. The two administrators are made in
-- Supabase by somebody who already holds the project keys, which is the
-- brief's rule and the right one: the page that can make an
-- administrator is the page worth attacking, so there is no such page.

-- ADDING AND REMOVING A FACILITATOR IS FILE 10'S, UNTOUCHED.
--
-- lms_add_facilitator and lms_remove_facilitator already exist, return
-- (ok, message), and are granted to authenticated. The Staff page calls
-- them as they are.
--
-- I wrote replacements for both before reading them, and both were
-- worse. File 10's version raises somebody only if their account is
-- CONFIRMED, and it guards with "role <> 'admin'" so that adding an
-- administrator's address to the facilitator list does not quietly
-- demote them. Mine checked "role = 'learner'", which gets the second
-- case right by accident and the first case wrong: it would have given
-- facilitator rights to an unconfirmed address, which is an email
-- somebody has not yet proved they own.
--
-- The lesson is the one from the 6A review, three rounds running: read
-- the function that already exists before writing the one that replaces
-- it. The only reason this file touches the staff list at all is the
-- role function below, which file 10 does not have.

/**
 * Change somebody's role. CANNOT MAKE AN ADMINISTRATOR, by design.
 */
create or replace function lms_set_staff_role(p_user uuid, p_role lms_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can change a role.' using errcode = '42501';
  end if;
  if p_role = 'admin' then
    raise exception
      'An administrator is made in Supabase, by somebody with the project keys, and never from a page.'
      using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot change your own role.' using errcode = '22023';
  end if;

  -- AN ADMINISTRATOR CANNOT BE DEMOTED FROM A PAGE EITHER, and leaving
  -- this out was a hole wide enough to lock everybody out of the
  -- Academy with two clicks.
  --
  -- The two tests above looked like they covered it: one refuses making
  -- an administrator, the other refuses changing your own role. Between
  -- them they feel complete, and they are not. Neither says anything
  -- about the OTHER administrator, so either of the two could demote the
  -- other to learner, and with two administrators that is one press from
  -- nobody being able to publish anything.
  --
  -- Administrators are made AND removed in Supabase. The symmetry is the
  -- point: if a page cannot grant it, a page has no business taking it
  -- away.
  if (select p.role from lms_profiles p where p.id = p_user) = 'admin' then
    raise exception
      'That person is an administrator. Administrators are made and removed in Supabase, by somebody with the project keys, and never from a page.'
      using errcode = '42501';
  end if;
  update lms_profiles set role = p_role where id = p_user;
  perform lms_log_action('role_changed', 'staff', p_user, jsonb_build_object('role', p_role::text));
end $$;

drop function if exists lms_studio_staff();

create or replace function lms_studio_staff()
returns table (
  email text, full_name text, note text, has_account boolean,
  role text, course_count integer, added_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can see the staff list.' using errcode = '42501';
  end if;
  return query
  select f.email_norm,
         coalesce(nullif(f.full_name, ''), p.full_name, ''),
         f.note,
         u.id is not null,
         coalesce(p.role::text, 'not signed up yet'),
         (select count(*) from lms_courses c where c.created_by = u.id)::integer,
         f.added_at
    from lms_facilitators f
    left join auth.users u on lower(u.email) = f.email_norm
    left join lms_profiles p on p.id = u.id
   order by f.added_at desc;
end $$;


-- =====================================================================
-- STEP 11c  THE OVERVIEW
-- =====================================================================
--
-- One call for the whole first screen, because the Overview is the page
-- somebody opens twenty times a day and six round trips to draw it is
-- six chances for one of them to be slow.
--
-- THE QUEUE IS BUILT HERE, not in the page, and it is built differently
-- for the two roles. A facilitator's queue is about their courses. An
-- administrator's is about the place.

drop function if exists lms_studio_overview();

create or replace function lms_studio_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb; v_admin boolean := lms_is_admin();
begin
  if not lms_is_staff() then
    raise exception 'Staff only.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'is_admin', v_admin,
    'name', (select p.full_name from lms_profiles p where p.id = auth.uid()),
    'week', jsonb_build_object(
      -- LEARNERS, CONFIRMED, not every row in auth.users. As written it
      -- counted staff and unconfirmed sign ups too, so on a database
      -- with two administrators and nobody else it said 2 new learners.
      -- An unconfirmed account is also not a learner yet: it is an
      -- address somebody typed, and the nightly prune may well delete it.
      'new_learners', (select count(*)
                         from auth.users u
                         join lms_profiles p on p.id = u.id
                        where u.created_at >= current_date - 7
                          and u.email_confirmed_at is not null
                          and p.role = 'learner'),
      'active', (select count(distinct w.user_id) from lms_watch_days w where w.day >= current_date - 7),
      'minutes', (select coalesce(round(sum(w.seconds) / 60.0), 0) from lms_watch_days w
                   where w.day >= current_date - 7),
      'certificates', (select count(*) from certificates ct where ct.completed_on >= current_date - 7)
    ),
    'courses', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'slug', c.slug, 'title', c.title,
               'state', lms_course_state(c.id),
               'cover_code', c.cover_code, 'area', c.area, 'tool', c.tool,
               'learners', (select count(*) from lms_entitlements e
                             where e.course_id = c.id and e.status = 'active'),
               'updated_at', c.updated_at) order by c.updated_at desc), '[]'::jsonb)
        from lms_courses c
       where v_admin or c.created_by = auth.uid()
    ),
    -- The needs-you queue, most urgent first. Each item carries the one
    -- button that deals with it, which is why it is a list of objects
    -- and not a count.
    'queue', (
      select coalesce(jsonb_agg(q order by q.ord), '[]'::jsonb) from (
        select 1 as ord, 'review' as kind,
               c.title || ' is ready for review' as heading,
               'Sent by ' || coalesce(pr.full_name, 'a facilitator') || '.' as detail,
               'Review and publish' as button, c.id as subject
          from lms_courses c
          left join lms_profiles pr on pr.id = c.sent_for_review_by
         where c.sent_for_review_at is not null and v_admin
        union all
        select 2, 'blocked',
               c.title || ' cannot be published yet',
               (select count(*)::text from lms_publish_checks(c.id) b where not b.passes)
                 || ' of 9 checks fail.',
               'Open the builder', c.id
          from lms_courses c
         where c.status = 'draft' and c.sent_for_review_at is null
           and (v_admin or c.created_by = auth.uid())
           and exists (select 1 from lms_publish_checks(c.id) b where not b.passes)
      ) q
    )
  ) into v_out;
  return v_out;
end $$;

do $$ begin raise notice 'Step 11b and 11c: staff, and the overview in one call.'; end $$;


-- =====================================================================
-- STEP 12  PERMISSIONS, NAMED ONE FUNCTION AT A TIME
-- =====================================================================
--
-- Supabase grants EXECUTE on every new function in public to anon and
-- authenticated by default. That default is why file 16's review found
-- five writable tables, and the same default applies to every function
-- in this file.
--
-- So everything here is revoked from everybody first, then granted back
-- to authenticated one name at a time. Granting back to authenticated
-- rather than to a role is deliberate: there is no database role for
-- "staff", the test is inside each function, and a signed in learner
-- who calls one gets the function's own refusal rather than a
-- permission error that tells them nothing.
--
-- NOTHING IN THIS FILE IS GRANTED TO anon. Not one function. A signed
-- out visitor has no business in the control room, and the shortest way
-- to be sure of that is to grant nothing.
do $$
declare
  v_name text;
  v_sig  text;
  v_n    integer := 0;
begin
  for v_name, v_sig in
    select p.proname, pg_get_function_identity_arguments(p.oid)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'lms_course_state','lms_may_edit_course','lms_create_course','lms_publish_checks',
         'lms_send_for_review','lms_send_back','lms_publish_course','lms_unpublish_course',
         'lms_archive_course','lms_set_course_details','lms_set_course_price',
         'lms_set_course_areas','lms_set_course_next','lms_question_is_locked',
         'lms_save_question','lms_retire_question','lms_paste_questions','lms_clock_to_seconds',
         'lms_publish_lesson_check','lms_studio_course','lms_save_lesson',
         'lms_add_module','lms_remove_lesson','lms_reorder_lessons','lms_studio_questions',
         'lms_staff_learners','lms_lift_exam_wait','lms_give_access','lms_remove_access',
         'lms_create_path','lms_set_path_courses','lms_set_path_details',
         'lms_add_area_tool','lms_remove_area_tool','lms_areas_overview',
         'lms_report_active_days','lms_report_funnel','lms_report_lesson_drop',
         'lms_report_hard_questions','lms_report_who','lms_log_export',
         'lms_studio_certificates','lms_studio_certificate_counts',
         'lms_save_popup','lms_start_popup','lms_stop_popup',
         'lms_set_site_settings','lms_studio_health','lms_studio_biggest_tables',
         'lms_activity_log','lms_set_staff_role','lms_studio_staff','lms_studio_overview'
       )
  loop
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated',
                   v_name, v_sig);
    execute format('grant execute on function public.%I(%s) to authenticated', v_name, v_sig);
    v_n := v_n + 1;
  end loop;

  -- The trigger functions and the log writer are called BY the database
  -- and never by a browser. Nothing is granted back.
  foreach v_name in array array[
    'lms_log_action','lms_log_is_append_only','lms_guard_published_lesson',
    'lms_guard_answered_question'
  ] loop
    for v_sig in
      select pg_get_function_identity_arguments(p.oid)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_name
    loop
      execute format('revoke all on function public.%I(%s) from public, anon, authenticated',
                     v_name, v_sig);
    end loop;
  end loop;

  raise notice 'Step 12: % control room functions granted to signed in callers only, none to anon.', v_n;
end $$;

-- File 10's sweep, run last, so any table this file touched is left
-- with the privileges that file decided on rather than Supabase's
-- defaults.
do $$ declare v_n integer; begin
  select tables_tidied into v_n from lms_tidy_table_privileges();
  raise notice 'Step 12: table privileges tidied across % Academy tables.', v_n;
end $$;

commit;
