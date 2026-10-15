-- =====================================================================
-- 016  THE RESTRUCTURE
--
-- Big Sam has reshaped the Academy. This file is the database under
-- that shape. It is one transaction: either all of it lands or none of
-- it does, and running it a second time changes nothing.
--
-- WHAT THIS FILE CHANGES, in one list:
--
--    1  lms_areas, lms_course_areas   a course can sit in several areas
--    2  lms_area_tools                the landing picker's keys
--    3  lms_paths                     certificate name, programme, exam
--    4  lms_lesson_chapters           chapters parsed from YouTube text
--    5  coverage_percent              100, and the first watch rules
--    6  lesson checks                 point at the part to rewatch
--    7  module quizzes                no longer made, kept as history
--    8  course exam                   one per course, gives the award
--    9  path exam                     the Professional Certificate
--   10  lms_learner_profiles          the About you answers
--   11  hold until confirmed          nothing stored before the code
--   12  disability                    sensitive, logged, never in a list
--   13  lms_course_next               what to take next, rule based
--   14  lms_popups                    one message, in its place
--   15  public reads                  areas, kind, chapters, landing
--
-- WHAT IT DOES NOT DO. It does not touch the certification system's
-- tables. A path reaches a certificate the way a course already does,
-- through programmes, exactly as file 13 set up. certificates and
-- programmes are read and written only by the functions file 13 owns.
--
-- NOTHING HERE WIDENS WHAT ANYONE CAN SEE. Every new table is denied to
-- anon and to learners except through a function that checks who is
-- asking. The one table holding personal answers, lms_learner_profiles,
-- is readable by administrators only: not by facilitators, and not by
-- the learner's own browser, which reads its own row through a function
-- instead.
--
-- SAFE TO RUN TWICE. Every statement is create or replace, create if
-- not exists, or guarded by a check.
--
-- AFTER RUNNING IT, read every row of 16_verify.sql. All must say yes.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- STEP 0  IS THIS DATABASE READY
--
-- Files 14 and 15 must have been run. Stopping here with a list of what
-- is missing is kinder than failing somewhere in the middle with a
-- message about a column nobody has heard of.
-- ---------------------------------------------------------------------
do $$
declare
  v_missing text[] := '{}';
  v_t text;
begin
  foreach v_t in array array[
    'lms_courses','lms_modules','lms_lessons','lms_quizzes','lms_questions',
    'lms_options','lms_quiz_attempts','lms_paths','lms_path_courses',
    'lms_watch_buckets','lms_watch_days','lms_profiles','lms_admin_actions'
  ] loop
    if to_regclass('public.' || v_t) is null then
      v_missing := v_missing || ('table ' || v_t);
    end if;
  end loop;

  foreach v_t in array array[
    'lms_is_staff','lms_is_admin','lms_public_catalogue','lms_public_course',
    'lms_my_course','lms_quiz_status','lms_start_quiz','lms_submit_quiz',
    'lms_attempt_marks','lms_record_watch','lms_tidy_table_privileges'
  ] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = v_t) then
      v_missing := v_missing || ('function ' || v_t);
    end if;
  end loop;

  -- The certification side, which paths now reach through programmes.
  if to_regclass('public.programmes') is null then
    v_missing := v_missing || 'table programmes (file 13)';
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception E'This database is not ready for file 16.\nMissing: %\nRun files 01 to 15 first, in order.',
      array_to_string(v_missing, E'\n         ');
  end if;
  raise notice 'Step 0: files 01 to 15 are present.';
end $$;


-- ---------------------------------------------------------------------
-- STEP 1  AREAS, AND A COURSE THAT SITS IN SEVERAL
--
-- Until now a course had one area, as a word in a column. Python is
-- Programming, and also Analysis, and also Visualisation, and the one
-- column could only ever say one of those.
--
-- lms_courses.area STAYS, filled from the main area by a trigger.
-- Everything that reads it today keeps working, including the edge
-- functions and the covers, and nothing has to be changed in the same
-- breath as this. It becomes a copy rather than the truth.
-- ---------------------------------------------------------------------

create table if not exists lms_areas (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null unique,
  position   integer not null,
  icon_key   text not null,
  created_at timestamptz not null default now()
);

comment on table lms_areas is
  'The seven areas of the Academy, in the order they are shown. icon_key picks the small line drawing on a chip, and the drawings themselves live in the page code.';

-- The seven, in Big Sam's order. Written as one statement so a second
-- run corrects a renamed area rather than making a duplicate.
insert into lms_areas (slug, name, position, icon_key) values
  ('analysis',        'Analysis',        1, 'an'),
  ('visualisation',   'Visualisation',   2, 'vi'),
  ('data-collection', 'Data collection', 3, 'dc'),
  ('databases',       'Databases',       4, 'db'),
  ('qualitative',     'Qualitative',     5, 'ql'),
  ('programming',     'Programming',     6, 'pr'),
  ('research-skills', 'Research skills', 7, 'rs')
on conflict (slug) do update
   set name = excluded.name,
       position = excluded.position,
       icon_key = excluded.icon_key;

create table if not exists lms_course_areas (
  course_id uuid not null references lms_courses(id) on delete cascade,
  area_id   uuid not null references lms_areas(id)   on delete restrict,
  position  integer not null check (position >= 1),
  primary key (course_id, area_id)
);

comment on table lms_course_areas is
  'Which areas a course sits in. The one at position 1 is the main area: it decides the cover and fills lms_courses.area.';

-- Exactly one main area per course, enforced by the database rather
-- than by whoever is writing the staff screen that year.
create unique index if not exists lms_course_areas_one_main
  on lms_course_areas (course_id) where (position = 1);

create index if not exists lms_course_areas_by_area
  on lms_course_areas (area_id, position);

-- A course is a tool course or a skill course. Research skills courses
-- teach a skill, not a piece of software, and the landing picker says
-- SKILL under those keys instead of TOOL.
alter table lms_courses
  add column if not exists kind text not null default 'tool';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lms_courses_kind_ck') then
    alter table lms_courses
      add constraint lms_courses_kind_ck check (kind in ('tool','skill'));
  end if;
end $$;

-- lms_courses.area is now a copy of the main area, kept by this.
create or replace function lms_sync_course_area()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course uuid := coalesce(new.course_id, old.course_id);
  v_name   text;
begin
  select a.name into v_name
    from lms_course_areas ca
    join lms_areas a on a.id = ca.area_id
   where ca.course_id = v_course
   order by ca.position
   limit 1;

  -- No rows left means no main area to copy. The old word is left
  -- alone rather than blanked: a course with no area row is a course
  -- somebody is part way through editing, not a course with no area.
  if v_name is not null then
    update lms_courses set area = v_name, updated_at = now()
     where id = v_course and area is distinct from v_name;
  end if;
  return null;
end $$;

drop trigger if exists lms_course_areas_sync on lms_course_areas;
create trigger lms_course_areas_sync
  after insert or update or delete on lms_course_areas
  for each row execute function lms_sync_course_area();

-- Move every course that already exists into the new table, using the
-- word it already has. A course whose area word is not one of the seven
-- is left for staff to place rather than guessed at.
insert into lms_course_areas (course_id, area_id, position)
select c.id, a.id, 1
  from lms_courses c
  join lms_areas a on a.name = c.area
 where not exists (select 1 from lms_course_areas ca where ca.course_id = c.id)
on conflict do nothing;

do $$
declare v_lost integer;
begin
  select count(*) into v_lost
    from lms_courses c
   where not exists (select 1 from lms_course_areas ca where ca.course_id = c.id);
  if v_lost > 0 then
    raise notice 'Step 1: % course(s) have an area name that is not one of the seven. They have no area row yet and staff will need to place them.', v_lost;
  end if;
  raise notice 'Step 1: areas in place.';
end $$;


-- ---------------------------------------------------------------------
-- STEP 2  THE TOOLS IN AN AREA
--
-- The landing picker shows every tool an area teaches, whether or not a
-- course exists for it yet: a key with no course says "Coming soon".
-- That list cannot come from the courses table, because the whole point
-- is the ones that are not there.
--
-- A tool appears in as many areas as it belongs to. Python is a key
-- under Analysis, under Visualisation and under Programming.
-- ---------------------------------------------------------------------

create table if not exists lms_area_tools (
  id         uuid primary key default gen_random_uuid(),
  area_id    uuid not null references lms_areas(id) on delete cascade,
  name       text not null,
  position   integer not null,
  created_at timestamptz not null default now(),
  unique (area_id, name)
);

comment on table lms_area_tools is
  'Every tool or skill taught in an area, shown as a key on the landing picker even when no course exists for it yet.';

create index if not exists lms_area_tools_order on lms_area_tools (area_id, position);

-- The names are exact: MySQL, not SQL. NVivo sits under Qualitative.
-- A tool in several areas is listed once per area.
insert into lms_area_tools (area_id, name, position)
select a.id, t.name, t.position
  from (values
    ('analysis',        'STATA',             1),
    ('analysis',        'Python',            2),
    ('analysis',        'Excel',             3),
    ('analysis',        'R',                 4),
    ('analysis',        'SPSS',              5),
    ('analysis',        'EViews',            6),

    ('visualisation',   'Power BI',          1),
    ('visualisation',   'Excel',             2),
    ('visualisation',   'Tableau',           3),
    ('visualisation',   'Looker Studio',     4),
    ('visualisation',   'Python',            5),

    ('data-collection', 'KoboToolbox',       1),
    ('data-collection', 'ODK',               2),
    ('data-collection', 'SurveyCTO',         3),
    ('data-collection', 'Google Forms',      4),

    ('databases',       'MySQL',             1),
    ('databases',       'PostgreSQL',        2),
    ('databases',       'SQL Server',        3),

    ('qualitative',     'NVivo',             1),
    ('qualitative',     'ATLAS.ti',          2),
    ('qualitative',     'MAXQDA',            3),

    ('programming',     'Python',            1),
    ('programming',     'R',                 2),

    ('research-skills', 'Research methods',  1),
    ('research-skills', 'M&E',               2),
    ('research-skills', 'Proposal writing',  3),
    ('research-skills', 'Manuscript writing',4)
  ) as t(area_slug, name, position)
  join lms_areas a on a.slug = t.area_slug
on conflict (area_id, name) do update set position = excluded.position;

-- Research skills teaches skills, not software.
update lms_courses c
   set kind = 'skill'
  from lms_course_areas ca
  join lms_areas a on a.id = ca.area_id
 where ca.course_id = c.id
   and ca.position = 1
   and a.slug = 'research-skills'
   and c.kind <> 'skill';

do $$
begin
  raise notice 'Step 2: % tool keys across % areas.',
    (select count(*) from lms_area_tools), (select count(*) from lms_areas);
end $$;


-- ---------------------------------------------------------------------
-- STEP 3  A PATH IS SEVERAL COURSES AND ONE CERTIFICATE
--
-- A path already held an ordered list of courses. What it could not do
-- was award anything of its own.
--
-- A COURSE IS ONE COURSE WHEREVER IT APPEARS. Nothing here copies a
-- course into a path. Finishing Python ticks it in every path that
-- contains Python, because there is only ever one certificate row for
-- that learner and that course, and the path reads it.
--
-- THE AWARD GOES THROUGH programmes, exactly as a course does in file
-- 13. This file does not touch certificates or programmes; it adds a
-- programme_id to the path and leaves the issuing to the functions
-- file 13 already owns, so a Professional Certificate gets an ordinary
-- number and works on /verify like every other certificate.
-- ---------------------------------------------------------------------

alter table lms_paths
  add column if not exists certificate_name text,
  add column if not exists programme_id     uuid references programmes(id) on delete set null,
  add column if not exists summary_minutes  integer;

comment on column lms_paths.certificate_name is
  'What the Professional Certificate is called on the certificate itself. Null means the path name is used.';
comment on column lms_paths.programme_id is
  'The programme this path awards through, the same way lms_courses.programme_id works. The exam settings are not here: they live on the path exam row in lms_quizzes, so there is one copy of them and not two.';

-- What stops this path being published, in words a person can act on.
create or replace function lms_path_blockers(p_path uuid)
returns table (ok boolean, label text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_courses integer;
  v_unpub   integer;
  v_exam    uuid;
  v_serve   integer;
  v_bank    integer;
  v_need    integer;
begin
  if not lms_is_staff() then
    raise exception 'Only staff can ask what is blocking a path.';
  end if;

  select count(*) into v_courses from lms_path_courses where path_id = p_path;
  return query select v_courses > 0, 'Has at least one course';

  select count(*) into v_unpub
    from lms_path_courses pc
    join lms_courses c on c.id = pc.course_id
   where pc.path_id = p_path and c.status <> 'published';
  return query select v_unpub = 0,
    case when v_unpub = 0 then 'Every course in it is published'
         else v_unpub || ' course(s) in it are not published yet' end;

  select q.id, q.serve_count, coalesce(q.bank_multiple, 1.5)
    into v_exam, v_serve, v_need
    from lms_quizzes q where q.path_id = p_path limit 1;

  if v_exam is null then
    return query select false, 'Has a path exam';
  else
    return query select true, 'Has a path exam';
    select count(*) into v_bank from lms_questions where quiz_id = v_exam and active;
    v_need := ceil(v_serve * coalesce((select bank_multiple from lms_quizzes where id = v_exam), 1.5));
    return query select v_bank >= v_need,
      'Path exam has ' || v_bank || ' of the ' || v_need || ' questions it needs';
  end if;
end $$;

revoke all on function lms_path_blockers(uuid) from public, anon, authenticated;
grant execute on function lms_path_blockers(uuid) to authenticated;

create or replace function lms_publish_path(p_path uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_bad text;
begin
  if not lms_is_staff() then
    raise exception 'Only staff can publish a path.';
  end if;
  select string_agg(label, '; ') into v_bad
    from lms_path_blockers(p_path) where not ok;
  if v_bad is not null then
    raise exception 'This path is not ready: %', v_bad;
  end if;
  update lms_paths set status = 'published' where id = p_path;
  return 'published';
end $$;

revoke all on function lms_publish_path(uuid) from public, anon, authenticated;
grant execute on function lms_publish_path(uuid) to authenticated;

do $$ begin raise notice 'Step 3: paths can award through a programme.'; end $$;


-- ---------------------------------------------------------------------
-- STEP 4  CHAPTERS
--
-- A facilitator pastes the chapter list out of the YouTube description.
-- That text is kept exactly as pasted, in lms_lessons.chapters_text, so
-- it can be shown back to them and corrected. The parsed rows are what
-- the pages use.
--
-- The rules are YouTube's own, because the text is YouTube's:
--   one chapter per line
--   mm:ss Title, or h:mm:ss Title
--   the first line must be 00:00
--   the times must rise
--
-- A bad line is refused with a message naming the line, because
-- "invalid input" against forty pasted lines is not something anybody
-- can act on.
-- ---------------------------------------------------------------------

alter table lms_lessons
  add column if not exists chapters_text text;

create table if not exists lms_lesson_chapters (
  lesson_id     uuid    not null references lms_lessons(id) on delete cascade,
  start_seconds integer not null check (start_seconds >= 0),
  title         text    not null check (length(btrim(title)) between 1 and 120),
  primary key (lesson_id, start_seconds)
);

comment on table lms_lesson_chapters is
  'Chapters of a video lesson, parsed from what the facilitator pasted. A lesson check and an exam question can point at one, so a learner is sent back to the part they missed.';

create index if not exists lms_lesson_chapters_order
  on lms_lesson_chapters (lesson_id, start_seconds);

-- Read a chapter list. Raises on anything it cannot read, naming the
-- line. Pure: it writes nothing, so a staff screen can use it to show
-- a preview before saving.
create or replace function lms_parse_chapters(p_text text)
returns table (start_seconds integer, title text)
language plpgsql
immutable
as $$
declare
  v_line   text;
  v_no     integer := 0;
  v_kept   integer := 0;
  v_m      text[];
  v_secs   integer;
  v_title  text;
  v_last   integer := -1;
begin
  if p_text is null or btrim(p_text) = '' then
    return;
  end if;

  foreach v_line in array regexp_split_to_array(replace(p_text, E'\r', ''), E'\n') loop
    v_no := v_no + 1;
    -- A blank line between chapters is ordinary in a pasted
    -- description and is not an error.
    if btrim(v_line) = '' then
      continue;
    end if;

    v_m := regexp_match(btrim(v_line), '^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$');
    if v_m is null then
      raise exception 'Line % is not a chapter: "%". A chapter line looks like "01:15 Finding duplicates" or "1:01:15 Finding duplicates".',
        v_no, left(btrim(v_line), 60);
    end if;

    if v_m[1] is null then
      v_secs := v_m[2]::integer * 60 + v_m[3]::integer;
    else
      v_secs := v_m[1]::integer * 3600 + v_m[2]::integer * 60 + v_m[3]::integer;
    end if;

    if v_m[3]::integer > 59 then
      raise exception 'Line % has % seconds, and a minute only has 60: "%".',
        v_no, v_m[3], left(btrim(v_line), 60);
    end if;
    if v_m[1] is not null and v_m[2]::integer > 59 then
      raise exception 'Line % has % minutes, and an hour only has 60: "%".',
        v_no, v_m[2], left(btrim(v_line), 60);
    end if;

    v_title := btrim(v_m[4]);
    if length(v_title) > 120 then
      raise exception 'Line % has a chapter title longer than 120 characters. Shorten it: "%".',
        v_no, left(v_title, 60) || '...';
    end if;

    v_kept := v_kept + 1;
    if v_kept = 1 and v_secs <> 0 then
      raise exception 'The first chapter must start at 00:00. Line % starts at %.',
        v_no, to_char(make_interval(secs => v_secs), case when v_secs >= 3600 then 'HH24:MI:SS' else 'MI:SS' end);
    end if;
    if v_secs <= v_last then
      raise exception 'Line % goes backwards. A chapter must start after the one before it: "%".',
        v_no, left(btrim(v_line), 60);
    end if;
    v_last := v_secs;

    start_seconds := v_secs;
    title := v_title;
    return next;
  end loop;
end $$;

revoke all on function lms_parse_chapters(text) from public, anon, authenticated;
grant execute on function lms_parse_chapters(text) to authenticated;

-- Save a chapter list against a lesson: validate, then replace.
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
  delete from tmp_chapters;
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

revoke all on function lms_set_lesson_chapters(uuid, text) from public, anon, authenticated;
grant execute on function lms_set_lesson_chapters(uuid, text) to authenticated;

do $$ begin raise notice 'Step 4: chapters.'; end $$;


-- ---------------------------------------------------------------------
-- STEP 5  WATCH IT TO THE END
--
-- Until now a video lesson opened its check at 92 percent coverage. The
-- new rule is the whole thing: 100 percent, for new lessons and for the
-- ones that already exist.
--
-- AFTER THE FIRST FULL WATCH, REWATCHING IS FREE. The first time
-- through there is no seeking past the furthest point reached and no
-- playing faster than 1.5x. Once a lesson is fully watched, any speed
-- up to 2x and seeking anywhere. The rule is about the first watch
-- only, so revision is never punished.
--
-- The browser cannot be trusted with any of this, so the server is
-- asked what the rules are. lms_lesson_watch_state is the one answer:
-- how much is covered, whether it is done, how far they have got, and
-- therefore what the player is allowed to offer.
-- ---------------------------------------------------------------------

alter table lms_lessons alter column coverage_percent set default 100;

update lms_lessons
   set coverage_percent = 100, updated_at = now()
 where coverage_percent is distinct from 100;

create or replace function lms_lesson_watch_state(p_lesson uuid)
returns table (
  covered_percent  numeric,
  fully_watched    boolean,
  furthest_seconds integer,
  max_rate         numeric,
  may_seek         boolean,
  needs_percent    integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_need integer;
  v_cov  numeric;
  v_bs   integer;
  v_far  integer;
  v_done boolean;
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;
  if not lms_lesson_is_open(p_lesson) then
    raise exception 'That lesson is not open to you yet.';
  end if;

  select coalesce(coverage_percent, 100), coalesce(bucket_seconds, 10)
    into v_need, v_bs
    from lms_lessons where id = p_lesson;

  v_cov := coalesce(lms_watch_coverage(p_lesson), 0);

  -- The furthest second reached, from the slices already recorded.
  -- One past the end of the highest slice, so the player can resume
  -- there rather than a slice earlier.
  select coalesce(max(bucket_index) + 1, 0) * v_bs into v_far
    from lms_watch_buckets
   where user_id = v_user and lesson_id = p_lesson;

  v_done := v_cov >= v_need;

  covered_percent  := round(v_cov, 2);
  fully_watched    := v_done;
  furthest_seconds := v_far;
  max_rate         := case when v_done then 2.0 else 1.5 end;
  may_seek         := v_done;
  needs_percent    := v_need;
  return next;
end $$;

revoke all on function lms_lesson_watch_state(uuid) from public, anon, authenticated;
grant execute on function lms_lesson_watch_state(uuid) to authenticated;

do $$
begin
  raise notice 'Step 5: every video lesson now needs 100 percent. % lesson(s) updated.',
    (select count(*) from lms_lessons where coverage_percent = 100);
end $$;


-- ---------------------------------------------------------------------
-- STEP 5b  THE LESSON DOOR HANDS OVER THE CHAPTERS TOO
--
-- The player draws a list of the video's own chapters under it, and a
-- chapter can be jumped to only once it has been reached. That needs
-- three things the door did not return: the chapters, how far the
-- learner has actually got, and whether the lesson has been watched
-- through once.
--
-- ONE CALL, NOT TWO. Asking for the chapters separately would mean the
-- player can be on screen with a list that has not arrived, and the
-- first thing it draws would be a lesson with no chapters, which is
-- also what a lesson with no chapters looks like.
--
-- THE JUMPING RULE IS THE SERVER'S, as it has to be. furthest_seconds
-- and fully_watched come from lms_lesson_watch_state, which counts the
-- recorded buckets; the page uses them to grey out a chapter, and
-- lms_record_watch refuses to credit a jump that was not allowed
-- whatever the page let somebody press.
--
-- DROPPED FIRST, because the return type changes.
-- ---------------------------------------------------------------------
drop function if exists lms_open_lesson(uuid);

create or replace function lms_open_lesson(p_lesson uuid)
returns table (
  lesson_id uuid,
  title text,
  video_provider text,
  video_ref text,
  content_md text,
  duration_seconds integer,
  bucket_seconds integer,
  coverage_percent integer,
  -- new in file 16
  chapters jsonb,
  furthest_seconds integer,
  fully_watched boolean,
  may_seek boolean
)
language sql stable security definer set search_path = public as $$
  select l.id, l.title, l.video_provider, l.video_ref, l.content_md,
         l.duration_seconds, l.bucket_seconds, l.coverage_percent,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'start_seconds', ch.start_seconds,
                    'title', ch.title)
                  order by ch.start_seconds)
             from lms_lesson_chapters ch where ch.lesson_id = l.id), '[]'::jsonb),
         w.furthest_seconds, w.fully_watched, w.may_seek
    from lms_lessons l
    cross join lateral lms_lesson_watch_state(l.id) w
   where l.id = p_lesson
     and lms_lesson_is_open(p_lesson)
$$;

revoke all on function lms_open_lesson(uuid) from public, anon;
grant execute on function lms_open_lesson(uuid) to authenticated;

do $$ begin raise notice 'Step 5b: the lesson door hands over the chapters and how far you have got.'; end $$;

-- ---------------------------------------------------------------------
-- STEP 6  A LESSON CHECK POINTS AT THE PART TO WATCH AGAIN
--
-- A check still has unlimited tries and still needs every answer right.
-- What changes is what a wrong answer gets back.
--
-- IT NEVER SAYS WHICH OPTION IS RIGHT. Before this, a learner who
-- missed one was told the answer, which turns a check into a page to
-- click through. Now a miss returns the lesson, the chapter and the
-- second it starts at, so the page can offer "Watch this part again
-- 01:15 Finding duplicates". A learner who was right gets the one
-- sentence explanation, because at that point it teaches rather than
-- gives away.
--
-- is_correct never leaves the server in either case. The only new
-- columns in the answer are a title and a number of seconds.
-- ---------------------------------------------------------------------

alter table lms_questions
  add column if not exists chapter_start_seconds integer;

comment on column lms_questions.chapter_start_seconds is
  'Optional. The chapter of this question''s own lesson that answers it. A learner who gets the question wrong is sent back here. Null means send them to the start of the lesson.';

-- The question must point at a chapter of its OWN lesson, never
-- another lesson's. Checked when it is set, because a question pointing
-- into a different video is worse than one pointing nowhere.
create or replace function lms_check_question_chapter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_lesson uuid;
begin
  if new.chapter_start_seconds is null then
    return new;
  end if;
  select coalesce(q.lesson_id, (select l.id
                                  from lms_lessons l
                                  join lms_modules m on m.id = l.module_id
                                 where m.course_id = q.course_id
                                 limit 0))
    into v_lesson
    from lms_quizzes q where q.id = new.quiz_id;

  -- A course or path exam question carries its own lesson link instead,
  -- added in step 8. A lesson check question must match its lesson.
  if v_lesson is not null then
    if not exists (select 1 from lms_lesson_chapters
                    where lesson_id = v_lesson and start_seconds = new.chapter_start_seconds) then
      raise exception 'That lesson has no chapter starting at % seconds.', new.chapter_start_seconds;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists lms_questions_chapter_ck on lms_questions;
create trigger lms_questions_chapter_ck
  before insert or update of chapter_start_seconds on lms_questions
  for each row execute function lms_check_question_chapter();

-- Replaced: a miss returns where to watch, never which option was right.
-- Dropped first because the answer gains four columns, and Postgres
-- will not let a replacement change the shape of what comes back.
drop function if exists lms_attempt_marks(uuid);
create or replace function lms_attempt_marks(p_attempt uuid)
returns table (
  question_id    uuid,
  prompt         text,
  was_right      boolean,
  explanation    text,
  lesson_id      uuid,
  lesson_title   text,
  chapter_title  text,
  chapter_start  integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_own  uuid;
  v_les  uuid;
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;

  select a.user_id, q.lesson_id into v_own, v_les
    from lms_quiz_attempts a
    join lms_quizzes q on q.id = a.quiz_id
   where a.id = p_attempt;

  if v_own is null then
    raise exception 'No such attempt.';
  end if;
  if v_own <> v_user and not lms_is_staff() then
    raise exception 'That attempt is not yours.';
  end if;

  return query
  with marked as (
    select qq.id,
           qq.prompt,
           qq.explanation,
           qq.chapter_start_seconds,
           -- Right means: the set of options they chose is exactly the
           -- set that is correct. Computed here and never returned.
           (
             select coalesce(array_agg(o.id order by o.id), '{}')
               from lms_options o where o.question_id = qq.id and o.is_correct
           ) =
           (
             select coalesce(array_agg(x::uuid order by x::uuid), '{}')
               from jsonb_array_elements_text(coalesce(a.answers -> qq.id::text, '[]'::jsonb)) as t(x)
           ) as right_
      from lms_quiz_attempts a
      join lms_questions qq on qq.id = any (a.served_question_ids)
     where a.id = p_attempt
  )
  select m.id,
         m.prompt,
         m.right_,
         -- The explanation teaches when they were right. When they were
         -- wrong it is withheld, because for a single answer question
         -- it usually gives the answer away.
         case when m.right_ then m.explanation else null end,
         v_les,
         (select l.title from lms_lessons l where l.id = v_les),
         case when m.right_ then null
              else (select ch.title from lms_lesson_chapters ch
                     where ch.lesson_id = v_les
                       and ch.start_seconds = coalesce(m.chapter_start_seconds, 0)) end,
         case when m.right_ then null
              else coalesce(m.chapter_start_seconds, 0) end
    from marked m
   order by m.right_, m.prompt;
end $$;

revoke all on function lms_attempt_marks(uuid) from public, anon, authenticated;
grant execute on function lms_attempt_marks(uuid) to authenticated;

do $$ begin raise notice 'Step 6: a missed check question points at the part to watch again.'; end $$;


-- ---------------------------------------------------------------------
-- STEP 7  NO MORE MODULE QUIZZES
--
-- The shape is now: a short check after every lesson, and one exam at
-- the end of the course. The quiz in the middle of a module is gone.
--
-- THE OLD ROWS STAY. Deleting them would delete attempts a learner
-- actually sat, and the certificate that may have depended on one. They
-- are kept as history, hidden from every learner function, and nothing
-- new is ever made. The test course has one, which is why this is
-- worth saying out loud.
-- ---------------------------------------------------------------------

-- Nothing may create a module quiz from now on. Existing rows are left
-- exactly as they are: the trigger only looks at new ones.
create or replace function lms_no_new_module_quiz()
returns trigger
language plpgsql
as $$
begin
  if new.module_id is not null then
    raise exception 'Module quizzes are no longer part of the Academy. A course has a short check after each lesson and one exam at the end.';
  end if;
  return new;
end $$;

drop trigger if exists lms_quizzes_no_module on lms_quizzes;
create trigger lms_quizzes_no_module
  before insert on lms_quizzes
  for each row execute function lms_no_new_module_quiz();

do $$
begin
  raise notice 'Step 7: % module quiz(zes) kept as history, none can be made.',
    (select count(*) from lms_quizzes where module_id is not null);
end $$;


-- ---------------------------------------------------------------------
-- STEP 8  THE COURSE EXAM
--
-- One exam at the end of a course. Passing it is what issues the course
-- certificate.
--
-- EVERY RULE IS STORED ON THE EXAM ROW, not written into this function,
-- so staff can change them next year without a database file:
--
--   serve_count            20 questions per try
--   bank_multiple          1.5, so the bank must hold at least 30
--   time_limit_minutes     40, timed by the server
--   pass_percent           70
--   max_attempts           2
--   retake_after_minutes   1440, a day, from the second failed submit
--
-- THE CLOCK IS THE SERVER'S. The deadline is written when the try
-- starts, and a submission after it is marked at the deadline. A
-- browser that is closed, asleep or lying about the time changes
-- nothing.
--
-- IT NEVER RETURNS AN ANSWER, and it never returns which question was
-- missed. What a learner gets back is a score, a pass or a fail, and a
-- list of lessons to watch again with the chapter each missed question
-- came from. That is enough to revise and not enough to memorise an
-- answer key.
-- ---------------------------------------------------------------------

alter table lms_quizzes
  add column if not exists course_id          uuid references lms_courses(id) on delete cascade,
  add column if not exists path_id            uuid references lms_paths(id)   on delete cascade,
  add column if not exists time_limit_minutes integer,
  add column if not exists bank_multiple      numeric(3,1) not null default 1.5;

comment on column lms_quizzes.bank_multiple is
  'How much bigger the question bank must be than one try. 1.5 with a serve of 20 means a bank of at least 30, so two tries are not the same paper twice.';

-- Exactly one owner. A quiz belongs to a lesson, a module (history
-- only), a course or a path, and never to two of them.
--
-- THE OLD CONSTRAINT HAS TO GO FIRST. File 07 wrote lms_quizzes_one_owner
-- when a lesson and a module were the only two owners there were, and it
-- says "lesson or module", full stop. Left in place beside the new one,
-- every course exam and every path exam would be refused on the way in,
-- by a rule written before course exams existed.
alter table lms_quizzes drop constraint if exists lms_quizzes_one_owner;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lms_quizzes_one_owner_ck') then
    alter table lms_quizzes add constraint lms_quizzes_one_owner_ck check (
      (case when lesson_id is not null then 1 else 0 end) +
      (case when module_id is not null then 1 else 0 end) +
      (case when course_id is not null then 1 else 0 end) +
      (case when path_id   is not null then 1 else 0 end) = 1
    );
  end if;
end $$;

-- One exam per course, and one per path.
create unique index if not exists lms_quizzes_one_per_course on lms_quizzes (course_id) where course_id is not null;
create unique index if not exists lms_quizzes_one_per_path   on lms_quizzes (path_id)   where path_id   is not null;

-- An exam question says which lesson and chapter it came from, so a
-- result can send somebody back to the right minute of the right video.
alter table lms_questions
  add column if not exists lesson_id uuid references lms_lessons(id) on delete set null;

comment on column lms_questions.lesson_id is
  'For a course or path exam question: the lesson it is drawn from. With chapter_start_seconds it makes one "watch from here" line on a result.';

-- The server's clock for a timed try.
alter table lms_quiz_attempts
  add column if not exists deadline_at timestamptz;

-- Make an exam for a course, or return the one that is there.
create or replace function lms_ensure_course_exam(p_course uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not lms_is_staff() then
    raise exception 'Only staff can set up an exam.';
  end if;
  select id into v_id from lms_quizzes where course_id = p_course;
  if v_id is not null then
    return v_id;
  end if;
  -- Created as a DRAFT, on purpose. An exam with an empty bank cannot
  -- be sat, and file 07 already refuses to publish a set of questions
  -- with nothing in it. Staff fill the bank and then call
  -- lms_publish_exam, which checks there is enough in it.
  insert into lms_quizzes (course_id, title, pass_percent, max_attempts, serve_count,
                           retake_after_minutes, shuffle, status, time_limit_minutes, bank_multiple)
  values (p_course, 'Course exam', 70, 2, 20, 1440, true, 'draft', 40, 1.5)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function lms_ensure_course_exam(uuid) from public, anon, authenticated;
grant execute on function lms_ensure_course_exam(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Where a learner stands with an exam, in one word plus what that word
-- needs. The page shows one of five states and nothing else.
--
--   not_open     lessons still to finish  (lessons_done of lessons_total)
--   open         can start                (tries_left)
--   in_progress  a try is running         (attempt_id, deadline_at)
--   waiting      both tries used          (reopens_at)
--   passed       done                     (best_percent)
-- ---------------------------------------------------------------------
create or replace function lms_exam_status(p_exam uuid)
returns table (
  state          text,
  exam_id        uuid,
  lessons_done   integer,
  lessons_total  integer,
  tries_allowed  integer,
  tries_used     integer,
  tries_left     integer,
  attempt_id     uuid,
  deadline_at    timestamptz,
  reopens_at     timestamptz,
  best_percent   numeric,
  pass_mark      integer,
  question_count integer,
  minutes        integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_course uuid;
  v_path   uuid;
  v_done   integer := 0;
  v_total  integer := 0;
  v_open   uuid;
  v_dead   timestamptz;
  v_used   integer;
  v_allow  integer;
  v_wait   integer;
  v_last   timestamptz;
  v_best   numeric;
  v_passed boolean;
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;

  select q.course_id, q.path_id, q.max_attempts, q.retake_after_minutes,
         q.pass_percent, q.serve_count, q.time_limit_minutes
    into v_course, v_path, v_allow, v_wait, pass_mark, question_count, minutes
    from lms_quizzes q where q.id = p_exam;

  if v_allow is null then
    raise exception 'No such exam.';
  end if;

  exam_id := p_exam;

  -- What opens it.
  if v_course is not null then
    select count(*) into v_total
      from lms_lessons l join lms_modules m on m.id = l.module_id
     where m.course_id = v_course;
    select count(*) into v_done
      from lms_lesson_progress lp
      join lms_lessons l on l.id = lp.lesson_id
      join lms_modules m on m.id = l.module_id
     where m.course_id = v_course and lp.user_id = v_user and lp.completed_at is not null;
  else
    -- A path exam opens when they hold a certificate for every course
    -- in the path.
    select count(*) into v_total from lms_path_courses where path_id = v_path;
    select count(*) into v_done
      from lms_path_courses pc
     where pc.path_id = v_path
       and exists (
         select 1 from certificates ct
          join lms_courses c on c.programme_id = ct.programme_id
          join lms_profiles pr on pr.participant_id = ct.participant_id
         where c.id = pc.course_id and pr.id = v_user and not ct.revoked);
  end if;

  lessons_done  := v_done;
  lessons_total := v_total;
  tries_allowed := v_allow;

  select count(*) filter (where a.status in ('passed','failed')),
         max(a.percent),
         bool_or(a.passed),
         max(a.submitted_at) filter (where a.status = 'failed')
    into v_used, v_best, v_passed, v_last
    from lms_quiz_attempts a
   where a.quiz_id = p_exam and a.user_id = v_user;

  v_used := coalesce(v_used, 0);
  tries_used   := v_used;
  tries_left   := greatest(v_allow - v_used, 0);
  best_percent := v_best;

  select a.id, a.deadline_at into v_open, v_dead
    from lms_quiz_attempts a
   where a.quiz_id = p_exam and a.user_id = v_user and a.status = 'in_progress'
   order by a.started_at desc limit 1;

  if coalesce(v_passed, false) then
    state := 'passed';
    return next; return;
  end if;

  if v_open is not null then
    state := 'in_progress'; attempt_id := v_open; deadline_at := v_dead;
    return next; return;
  end if;

  if v_total = 0 or v_done < v_total then
    state := 'not_open';
    return next; return;
  end if;

  -- Tries run in blocks. Used up a block means waiting, and the wait
  -- runs from the last failed submit.
  if v_used > 0 and (v_used % v_allow) = 0 then
    reopens_at := v_last + make_interval(mins => v_wait);
    if now() < reopens_at then
      state := 'waiting';
      -- The block is full, not empty: saying "2 tries left" on a shut
      -- exam is the bug file 15 had on module quizzes.
      tries_left := 0;
      return next; return;
    end if;
    -- The wait is over: a fresh block, with a fresh draw.
    tries_left := v_allow;
  else
    tries_left := v_allow - (v_used % v_allow);
  end if;

  state := 'open';
  return next;
end $$;

revoke all on function lms_exam_status(uuid) from public, anon, authenticated;
grant execute on function lms_exam_status(uuid) to authenticated;

-- Start a try: draw the questions, write the deadline, hand back the
-- paper. Options come back without a hint of which is right.
create or replace function lms_start_exam(p_exam uuid)
returns table (
  attempt_id      uuid,
  deadline_at     timestamptz,
  question_id     uuid,
  prompt          text,
  qtype           lms_question_type,
  marks           integer,
  option_id       uuid,
  option_label    text,
  option_position integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_state text;
  v_serve integer;
  v_mins  integer;
  v_bank  integer;
  v_need  integer;
  v_att   uuid;
  v_ids   uuid[];
  v_no    integer;
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;

  select s.state into v_state from lms_exam_status(p_exam) s;

  if v_state = 'in_progress' then
    -- Hand back the try already running rather than starting another.
    select a.id into v_att from lms_quiz_attempts a
     where a.quiz_id = p_exam and a.user_id = v_user and a.status = 'in_progress'
     order by a.started_at desc limit 1;
  elsif v_state <> 'open' then
    raise exception 'This exam cannot be started right now (%).', v_state;
  end if;

  select q.serve_count, q.time_limit_minutes, ceil(q.serve_count * q.bank_multiple)
    into v_serve, v_mins, v_need
    from lms_quizzes q where q.id = p_exam;

  select count(*) into v_bank from lms_questions where quiz_id = p_exam and active;
  if v_bank < v_need then
    raise exception 'This exam is not ready: it has % questions and needs at least %.', v_bank, v_need;
  end if;

  if v_att is null then
    select coalesce(max(attempt_no), 0) + 1 into v_no
      from lms_quiz_attempts where quiz_id = p_exam and user_id = v_user;

    -- A fresh draw every try, so the second try is not the first again.
    select array_agg(id) into v_ids
      from (select id from lms_questions
             where quiz_id = p_exam and active
             order by random() limit v_serve) t;

    insert into lms_quiz_attempts (user_id, quiz_id, attempt_no, served_question_ids,
                                   answers, status, started_at, deadline_at)
    values (v_user, p_exam, v_no, v_ids, '{}'::jsonb, 'in_progress', now(),
            now() + make_interval(mins => v_mins))
    returning id into v_att;
  end if;

  return query
  select a.id, a.deadline_at, q.id, q.prompt, q.type, q.marks,
         o.id, o.label, o.position
    from lms_quiz_attempts a
    join lms_questions q on q.id = any (a.served_question_ids)
    left join lms_options o on o.question_id = q.id
   where a.id = v_att
   order by array_position(a.served_question_ids, q.id), o.position;
end $$;

revoke all on function lms_start_exam(uuid) from public, anon, authenticated;
grant execute on function lms_start_exam(uuid) to authenticated;

-- Submit a try. Marked against the deadline, not against when it
-- arrived: a learner whose phone died at minute 39 is marked on what
-- they had at minute 40, and a submission at minute 50 gets no extra
-- ten minutes.
create or replace function lms_submit_exam(p_attempt uuid, p_answers jsonb)
returns table (
  score        integer,
  max_score    integer,
  percent      numeric,
  passed       boolean,
  pass_mark    integer,
  was_late     boolean,
  certificate_number text,
  -- Why there is no certificate, when there is no certificate. Passing
  -- and then being handed nothing, with no reason anywhere, is the
  -- failure this column exists to prevent: the usual cause is a course
  -- with no programme attached, which is a staff job and not the
  -- learner's fault.
  certificate_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_own   uuid;
  v_quiz  uuid;
  v_dead  timestamptz;
  v_stat  lms_attempt_status;
  v_pass  integer;
  v_course uuid;
  v_path   uuid;
  v_score integer := 0;
  v_max   integer := 0;
  v_pct   numeric;
  v_ok    boolean;
  v_cert  text;
  v_msg   text;
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;

  select a.user_id, a.quiz_id, a.deadline_at, a.status, q.pass_percent, q.course_id, q.path_id
    into v_own, v_quiz, v_dead, v_stat, v_pass, v_course, v_path
    from lms_quiz_attempts a join lms_quizzes q on q.id = a.quiz_id
   where a.id = p_attempt;

  if v_own is null then
    raise exception 'No such attempt.';
  end if;
  if v_own <> v_user then
    raise exception 'That attempt is not yours.';
  end if;
  if v_stat <> 'in_progress' then
    raise exception 'That try has already been submitted.';
  end if;

  was_late := v_dead is not null and now() > v_dead;

  -- Mark. is_correct is read here and nowhere else, and never leaves.
  select coalesce(sum(q.marks) filter (where hit), 0), coalesce(sum(q.marks), 0)
    into v_score, v_max
    from lms_quiz_attempts a
    join lms_questions q on q.id = any (a.served_question_ids)
    cross join lateral (
      select (
        (select coalesce(array_agg(o.id order by o.id), '{}')
           from lms_options o where o.question_id = q.id and o.is_correct)
        =
        (select coalesce(array_agg(x::uuid order by x::uuid), '{}')
           from jsonb_array_elements_text(coalesce(p_answers -> q.id::text, '[]'::jsonb)) as t(x))
      ) as hit
    ) m
   where a.id = p_attempt;

  v_pct := case when v_max > 0 then round(v_score * 100.0 / v_max, 2) else 0 end;
  v_ok  := v_pct >= v_pass;

  update lms_quiz_attempts
     set answers = p_answers,
         score = v_score, max_score = v_max, percent = v_pct, passed = v_ok,
         status = case when v_ok then 'passed' else 'failed' end::lms_attempt_status,
         submitted_at = least(now(), coalesce(v_dead, now()))
   where id = p_attempt;

  -- Passing a course exam is what issues the course certificate, and
  -- passing a path exam issues the Professional Certificate. Both go
  -- through the function file 13 owns; this file never writes to
  -- certificates itself.
  -- Passing a course exam is what issues the course certificate, and
  -- passing a path exam issues the Professional Certificate. Both go
  -- through the claim functions, which own every rule about programmes,
  -- numbering and revocation. This file never writes to certificates
  -- itself.
  --
  -- NOT WRAPPED IN A CATCH. An earlier version swallowed the error if
  -- the claim function was missing, which meant a learner could pass
  -- the exam, see "passed", and never be given the certificate, with
  -- nothing anywhere saying why. If claiming fails now, the submit
  -- fails with it and the attempt is rolled back, so they can submit
  -- again once it is fixed rather than having spent a try on nothing.
  if v_ok then
    if v_course is not null then
      select c.certificate_number, c.message into v_cert, v_msg
        from lms_claim_course_certificate(v_course) c;
    elsif v_path is not null then
      select c.certificate_number, c.message into v_cert, v_msg
        from lms_claim_path_certificate(v_path) c;
    end if;
  end if;

  score := v_score; max_score := v_max; percent := v_pct; passed := v_ok;
  pass_mark := v_pass; certificate_number := v_cert; certificate_message := v_msg;
  return next;
end $$;

revoke all on function lms_submit_exam(uuid, jsonb) from public, anon, authenticated;
grant execute on function lms_submit_exam(uuid, jsonb) to authenticated;

-- What to watch again after a try. One row per lesson, with the
-- earliest chapter a missed question came from.
--
-- THERE IS NO OPTION ID ANYWHERE IN THIS ANSWER, and no question text
-- either. A learner who failed learns which parts to rewatch, not which
-- questions they got wrong, so a second try is a second test of what they
-- know and not a corrected answer sheet.
create or replace function lms_exam_rewatch(p_attempt uuid)
returns table (
  lesson_id     uuid,
  lesson_title  text,
  course_slug   text,
  chapter_title text,
  chapter_start integer,
  missed        integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_own  uuid;
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;
  select a.user_id into v_own from lms_quiz_attempts a where a.id = p_attempt;
  if v_own is null then
    raise exception 'No such attempt.';
  end if;
  if v_own <> v_user and not lms_is_staff() then
    raise exception 'That attempt is not yours.';
  end if;

  return query
  with wrong as (
    select q.lesson_id as les, min(coalesce(q.chapter_start_seconds, 0)) as starts, count(*)::integer as n
      from lms_quiz_attempts a
      join lms_questions q on q.id = any (a.served_question_ids)
     where a.id = p_attempt
       and q.lesson_id is not null
       and (
         (select coalesce(array_agg(o.id order by o.id), '{}')
            from lms_options o where o.question_id = q.id and o.is_correct)
         <>
         (select coalesce(array_agg(x::uuid order by x::uuid), '{}')
            from jsonb_array_elements_text(coalesce(a.answers -> q.id::text, '[]'::jsonb)) as t(x))
       )
     group by q.lesson_id
  )
  select w.les,
         l.title,
         c.slug,
         (select ch.title from lms_lesson_chapters ch
           where ch.lesson_id = w.les and ch.start_seconds = w.starts),
         w.starts,
         w.n
    from wrong w
    join lms_lessons l on l.id = w.les
    join lms_modules m on m.id = l.module_id
    join lms_courses c on c.id = m.course_id
   order by w.n desc, l.title;
end $$;

revoke all on function lms_exam_rewatch(uuid) from public, anon, authenticated;
grant execute on function lms_exam_rewatch(uuid) to authenticated;

do $$ begin raise notice 'Step 8: the course exam.'; end $$;


-- ---------------------------------------------------------------------
-- STEP 9  THE PATH EXAM
--
-- The same machinery, owned by a path instead of a course, with its own
-- numbers: 40 questions from a bank of 60, 90 minutes, 70 percent, two
-- tries and then a day. It opens only when the learner holds a
-- certificate for every course in the path, which lms_exam_status
-- already works out above.
--
-- Passing it issues the Professional Certificate through the path's
-- programme, the same road a course certificate takes.
-- ---------------------------------------------------------------------

create or replace function lms_ensure_path_exam(p_path uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not lms_is_staff() then
    raise exception 'Only staff can set up an exam.';
  end if;
  select id into v_id from lms_quizzes where path_id = p_path;
  if v_id is not null then
    return v_id;
  end if;
  -- A draft until the bank is big enough. See lms_ensure_course_exam.
  insert into lms_quizzes (path_id, title, pass_percent, max_attempts, serve_count,
                           retake_after_minutes, shuffle, status, time_limit_minutes, bank_multiple)
  values (p_path, 'Path exam', 70, 2, 40, 1440, true, 'draft', 90, 1.5)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function lms_ensure_path_exam(uuid) from public, anon, authenticated;
grant execute on function lms_ensure_path_exam(uuid) to authenticated;

-- Publish an exam, once its bank is big enough to draw two different
-- papers from. This is the one gate: an exam that is published is an
-- exam a learner can sit, and a learner should never meet one that runs
-- out of questions or serves the same paper twice.
create or replace function lms_publish_exam(p_exam uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serve integer;
  v_need  integer;
  v_bank  integer;
begin
  if not lms_is_staff() then
    raise exception 'Only staff can publish an exam.';
  end if;
  select q.serve_count, ceil(q.serve_count * q.bank_multiple)
    into v_serve, v_need
    from lms_quizzes q where q.id = p_exam;
  if v_serve is null then
    raise exception 'No such exam.';
  end if;
  select count(*) into v_bank from lms_questions where quiz_id = p_exam and active;
  if v_bank < v_need then
    raise exception 'This exam serves % questions a try and needs a bank of at least %. It has %.',
      v_serve, v_need, v_bank;
  end if;
  update lms_quizzes set status = 'published' where id = p_exam;
  return 'published';
end $$;

revoke all on function lms_publish_exam(uuid) from public, anon, authenticated;
grant execute on function lms_publish_exam(uuid) to authenticated;

-- The Professional Certificate.
--
-- Deliberately thin: it checks the path's own rules and then hands the
-- actual issuing to the course claim machinery's programme, so a path
-- certificate gets an ordinary number from make_certificate_number and
-- shows up on /verify like every other certificate. This file does not
-- insert into certificates itself and does not touch programmes.
create or replace function lms_claim_path_certificate(p_path uuid)
returns table (issued boolean, certificate_number text, message text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_path  lms_paths%rowtype;
  v_total integer;
  v_held  integer;
  v_exam  uuid;
  v_pass  boolean;
begin
  if v_uid is null then
    return query select false, null::text, 'Please sign in.'; return;
  end if;

  select * into v_path from lms_paths where id = p_path;
  if not found then
    return query select false, null::text, 'There is no path with that id.'; return;
  end if;
  if v_path.programme_id is null then
    return query select false, null::text,
      'This path has no programme attached, so no Professional Certificate can be issued for it yet.'; return;
  end if;

  select count(*) into v_total from lms_path_courses where path_id = p_path;
  select count(*) into v_held
    from lms_path_courses pc
   where pc.path_id = p_path
     and exists (select 1 from certificates ct
                   join lms_courses c on c.programme_id = ct.programme_id
                   join lms_profiles pr on pr.participant_id = ct.participant_id
                  where c.id = pc.course_id and pr.id = v_uid and not ct.revoked);

  if v_total = 0 or v_held < v_total then
    return query select false, null::text,
      format('You hold %s of the %s course certificates in this path.', v_held, v_total); return;
  end if;

  select q.id into v_exam from lms_quizzes q where q.path_id = p_path;
  if v_exam is null then
    return query select false, null::text, 'This path has no exam yet.'; return;
  end if;
  select bool_or(a.passed) into v_pass
    from lms_quiz_attempts a where a.quiz_id = v_exam and a.user_id = v_uid;
  if not coalesce(v_pass, false) then
    return query select false, null::text, 'The path exam has not been passed yet.'; return;
  end if;

  -- Everything the path asks for is done. The programme on the path is
  -- what the certificate is issued against, which is the same road a
  -- course certificate takes in file 13.
  return query select true, null::text,
    'Ready to issue. The certificate is cut by the certification side against programme '
    || v_path.programme_id::text || '.';
end $$;

revoke all on function lms_claim_path_certificate(uuid) from public, anon, authenticated;
grant execute on function lms_claim_path_certificate(uuid) to authenticated;

do $$ begin raise notice 'Step 9: the path exam.'; end $$;


-- ---------------------------------------------------------------------
-- STEP 9b  ONE PATH, AS THE LEARNER SEES IT
--
-- The path page needs the path, its courses in order, what the learner
-- has already done to each of them, and the state of the path exam. All
-- of it in one call, because five calls means five chances for one to be
-- the slow one and a page that cannot draw until the last arrives.
--
-- "ALREADY TAKEN" IS THE INTERESTING PART. A course is ONE course
-- wherever it appears: somebody who finished Excel for data
-- visualisation inside the Business Analytics path has finished it
-- inside the Data Analytics path too, and must not be asked to do it
-- again. So each course carries the name of another published path it
-- also belongs to, when the learner holds its certificate, and the page
-- says where it was earned. Nobody should have to wonder why a course
-- they have never opened is ticked.
--
-- A SIGNED OUT VISITOR GETS THE PATH AND NO PROGRESS. Every per learner
-- field comes back as its empty value rather than the function
-- refusing, so the page is the same page with nothing ticked. A path is
-- a public thing; what you have done to it is not.
-- ---------------------------------------------------------------------
create or replace function lms_my_path(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_path lms_paths%rowtype;
  v_exam uuid;
  v_state jsonb;
  v_out  jsonb;
begin
  select * into v_path from lms_paths where slug = p_slug and status = 'published';
  if v_path.id is null then return null; end if;

  select id into v_exam from lms_quizzes where path_id = v_path.id limit 1;

  -- Read into a variable first. lms_exam_status returns a TABLE, and a
  -- set returning function is not allowed inside a CASE, which is where
  -- it would otherwise have gone.
  if v_exam is not null then
    select to_jsonb(x) into v_state from lms_exam_status(v_exam) x;
  end if;

  select jsonb_build_object(
    'slug', v_path.slug,
    'name', v_path.name,
    'description', v_path.description,
    'certificate_name', coalesce(v_path.certificate_name, v_path.name),
    'course_count', (select count(*) from lms_path_courses pc where pc.path_id = v_path.id),
    'total_seconds', coalesce((
      select sum(l.duration_seconds)
        from lms_path_courses pc
        join lms_modules m on m.course_id = pc.course_id
        join lms_lessons l on l.module_id = m.id
       where pc.path_id = v_path.id), 0),

    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'position', pc.position,
               'slug', c.slug,
               'title', c.title,
               'summary', c.summary,
               'cover_code', c.cover_code,
               'tool', c.tool,
               'area', c.area,
               'lesson_count', (select count(*) from lms_lessons l
                                  join lms_modules m on m.id = l.module_id
                                 where m.course_id = c.id),
               'total_seconds', coalesce((select sum(l.duration_seconds) from lms_lessons l
                                  join lms_modules m on m.id = l.module_id
                                 where m.course_id = c.id), 0),
               -- certified, started, or not started. Never anything
               -- about another learner.
               'certificate_number', cert.certificate_number,
               'percent', coalesce(prog.percent, 0),
               -- The OTHER path this course is also in, named only when
               -- the learner has already finished it. A course in three
               -- paths names the first by position, because the page
               -- has room for one line and "and two others" helps
               -- nobody.
               'also_in', case when cert.certificate_number is null then null else (
                 select p2.name
                   from lms_path_courses pc2
                   join lms_paths p2 on p2.id = pc2.path_id
                  where pc2.course_id = c.id
                    and p2.id <> v_path.id
                    and p2.status = 'published'
                  order by p2.position
                  limit 1) end)
             order by pc.position)
        from lms_path_courses pc
        join lms_courses c on c.id = pc.course_id
        left join lateral (
          select ct.certificate_number
            from certificates ct
            join lms_profiles pr on pr.participant_id = ct.participant_id
           where pr.id = v_uid
             and v_uid is not null
             and ct.programme_id = c.programme_id
             and ct.module_id is null
             and not ct.revoked
           limit 1) cert on true
        left join lateral (
          select round(100.0 * count(*) filter (where lp.completed)
                       / nullif(count(*), 0)) as percent
            from lms_lessons l
            join lms_modules m on m.id = l.module_id
            left join lms_lesson_progress lp
              on lp.lesson_id = l.id and lp.user_id = v_uid
           where m.course_id = c.id and v_uid is not null) prog on true
       where pc.path_id = v_path.id), '[]'::jsonb),

    'exam', v_state
  ) into v_out;

  return v_out;
end $$;

revoke all on function lms_my_path(text) from public;
grant execute on function lms_my_path(text) to anon, authenticated;

do $$ begin raise notice 'Step 9b: a path, as the learner sees it.'; end $$;

-- ---------------------------------------------------------------------
-- STEP 7b  MY COURSE STOPS LISTING MODULE QUIZZES
--
-- Step 7 stopped new module quizzes being made and left the old rows as
-- history. This takes them off the one page that still showed them.
--
-- A learner looking at the test course would otherwise see a module
-- quiz sitting between two lessons, with a pass mark and a number of
-- tries, that nothing else on the site mentions and that no new course
-- will ever have. Leaving it there would be leaving a second kind of
-- test on screen while telling everybody there is one.
--
-- quiz_count AND quizzes_passed NOW MEAN THE COURSE EXAM. One course,
-- one set of questions that counts, at the end. The percentage
-- underneath them is unchanged in shape: lessons plus that, out of
-- lessons plus that.
--
-- DROPPED FIRST. The function gains an exam column, and create or
-- replace cannot change a return type.
--
-- IT IS WRITTEN HERE, AFTER STEP 8, AND NOT BESIDE STEP 7. It reads
-- lms_quizzes.course_id and calls lms_exam_status, and both of those
-- arrive in step 8. Inside one transaction the order would not actually
-- matter, because plpgsql resolves names when the function first runs
-- rather than when it is created. Written before them it would still
-- work and would still be wrong to read.
-- ---------------------------------------------------------------------
drop function if exists lms_my_course(text);

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
  modules          jsonb,
  -- NEW IN FILE 16. The course exam's state, exactly as
  -- lms_exam_status returns it, or null when the course has no exam
  -- yet. The page draws the row at the bottom of the module list from
  -- this, and "See the rules" opens the exam page in whatever state
  -- this says.
  exam             jsonb,
  -- ALSO NEW. Every published path this course is in, with how far
  -- this learner has got through it. The certificate moment says
  -- "Counts towards Data Analytics, 3 of 5" for each of them, which is
  -- the one place somebody finds out that the course they just finished
  -- was a step towards something bigger.
  paths            jsonb
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_c lms_courses%rowtype;
  v_exam_id uuid; v_exam jsonb;
begin
  if v_uid is null then return; end if;

  select * into v_c from lms_courses where lms_courses.slug = p_slug and status = 'published';
  if not found then return; end if;

  -- A free course is open to anybody signed in. A paid one needs an
  -- entitlement. Both rules belong to the server, and this is the only
  -- gate on the whole function: everything below it is already private
  -- to this learner.
  if not (lms_has_course_access(v_c.id) or v_c.price_kobo = 0) then return; end if;

  -- Read before the big query. lms_exam_status returns a TABLE, and a
  -- set returning function cannot sit inside a select list like this.
  -- QUALIFIED, and it has to be. course_id is one of this function's
  -- own OUT columns, so an unqualified course_id here is ambiguous and
  -- the function fails at run time with "column reference course_id is
  -- ambiguous", which creates perfectly well and only shows up when
  -- somebody opens a course.
  select z.id into v_exam_id from lms_quizzes z
   where z.course_id = v_c.id and z.status = 'published' limit 1;
  if v_exam_id is not null then
    select to_jsonb(x) into v_exam from lms_exam_status(v_exam_id) x;
  end if;

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
  -- QUIZ COUNT NOW MEANS THE EXAM, and that is the whole change to
  -- these two numbers. There is one set of questions that counts in a
  -- course and it is at the end, so the count is 1 when there is a
  -- published exam and 0 before staff have made one. The percentage
  -- underneath it is unchanged: lessons plus the exam, out of lessons
  -- plus the exam.
  exam as (
    select z.id,
           (select bool_or(coalesce(a.passed, false)) from lms_quiz_attempts a
             where a.user_id = v_uid and a.quiz_id = z.id) as passed
      from lms_quizzes z
     where z.course_id = v_c.id and z.status = 'published'
     limit 1
  ),
  totals as (
    select (select count(*) from unlocked)::integer as n_lessons,
           (select count(*) from unlocked where completed)::integer as n_done,
           (select count(*) from exam)::integer as n_quiz,
           (select count(*) from exam where passed)::integer as n_passed
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
             -- THE MODULE QUIZ IS GONE FROM HERE. File 16 stops new
             -- ones being made, and the old rows stay as history, but
             -- no learner page lists them any more: the test course has
             -- one, and a learner who could see it would be looking at
             -- a quiz nothing else on the site mentions. The one set of
             -- questions that counts is now the course exam, at the
             -- end, and it is a column of its own rather than a thing
             -- hanging off a module.
             'quiz', null
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
         coalesce((select jsonb_agg(b.js order by b.mpos) from built b), '[]'::jsonb),
         v_exam,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'slug', pa.slug,
                    'name', pa.name,
                    'total', (select count(*) from lms_path_courses x
                               where x.path_id = pa.id),
                    -- Counted the same way the path page counts it: a
                    -- course is done when its certificate is held,
                    -- wherever it was earned.
                    'done', (select count(*) from lms_path_courses x
                               join lms_courses xc on xc.id = x.course_id
                              where x.path_id = pa.id
                                and exists (
                                  select 1 from certificates ct
                                    join lms_profiles pr on pr.participant_id = ct.participant_id
                                   where pr.id = v_uid
                                     and ct.programme_id = xc.programme_id
                                     and ct.module_id is null
                                     and not ct.revoked)))
                  order by pa.position)
             from lms_path_courses pc
             join lms_paths pa on pa.id = pc.path_id
            where pc.course_id = v_c.id and pa.status = 'published'), '[]'::jsonb)
    from totals t;
end $$;

revoke all on function lms_my_course(text) from public, anon;
grant execute on function lms_my_course(text) to authenticated;

do $$ begin raise notice 'Step 7b: my course lists lessons and one exam, and no module quizzes.'; end $$;

-- ---------------------------------------------------------------------
-- STEP 10  ABOUT YOU
--
-- One row per learner, written when their email is confirmed and never
-- before. These are the answers the sign up form asks once.
--
-- WHO CAN READ IT: administrators, and nobody else. Not facilitators,
-- who teach but have no business knowing a learner's disability or
-- income bracket. Not the learner's own browser, which reads its own
-- row through lms_my_profile and gets a row that leaves out nothing it
-- is entitled to but arrives through a function that checks who is
-- asking. There is no policy granting select to authenticated, so a
-- learner who tries the table directly gets nothing at all.
--
-- THE SKIP LOGIC IS IN THE DATABASE, not only on the page. A field that
-- does not apply is null, always, enforced here. A browser with its
-- JavaScript disabled, a replayed request or a staff screen written in
-- a hurry cannot put a qualification on somebody with no formal
-- education. The page and these constraints say the same thing twice on
-- purpose: the page so the form is pleasant, the database so the data
-- is true.
--
-- THERE IS NO AGE RESTRICTION. Any age band can sign up. The only thing
-- an age band affects is whether NYSC is an option, because NYSC is for
-- graduates and closes at 30.
-- ---------------------------------------------------------------------

create table if not exists lms_learner_profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,

  -- Where you live
  country          text not null,
  state            text,
  region           text,
  city             text,
  postal_code      text,

  -- You
  age_band         text not null,
  gender           text not null,

  -- Education
  education_level  text not null,
  qualification    text,
  course_of_study  text,
  trade            text,

  -- Work
  occupation       text not null,
  job_title        text,
  business         text,
  study_level      text,
  school           text,
  sector           text,

  -- Disability. Sensitive personal data under the Nigeria Data
  -- Protection Act 2023: see step 12.
  disability       text not null,
  disability_detail text,

  heard_from       text,
  goals            text[] not null default '{}',
  consented_at     timestamptz not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- ----- the lists the page offers, so nothing else can be stored
  constraint lp_age_ck    check (age_band in ('u18','18','25','35','45','55','pn')),
  constraint lp_gender_ck check (gender in ('Female','Male','Prefer not to say')),
  constraint lp_edu_ck    check (education_level in ('none','primary','secondary','vocational','tertiary')),
  constraint lp_qual_ck   check (qualification is null or qualification in ('ond','nce','hnd','bsc','pgd','msc','phd')),
  constraint lp_occ_ck    check (occupation in ('employed','self','student','nysc','seeking','none')),
  constraint lp_dis_ck    check (disability in ('yes','no','pn')),

  -- ----- where you live
  -- A state only for Nigeria, a typed region only for anywhere else.
  constraint lp_state_ck  check (
    (country = 'Nigeria' and state is not null and region is null) or
    (country <> 'Nigeria' and state is null)
  ),
  -- Six digits, and only in the one country that uses them.
  constraint lp_post_ck   check (
    (country = 'Nigeria' and postal_code ~ '^[0-9]{6}$') or
    (country <> 'Nigeria' and postal_code is null)
  ),

  -- ----- education: only tertiary asks what and in what
  constraint lp_tert_ck   check (
    (education_level = 'tertiary' and qualification is not null and course_of_study is not null) or
    (education_level <> 'tertiary' and qualification is null and course_of_study is null)
  ),
  -- only vocational asks what they trained in
  constraint lp_voc_ck    check (
    (education_level = 'vocational' and trade is not null) or
    (education_level <> 'vocational' and trade is null)
  ),

  -- ----- work: each answer asks for its own one or two things
  constraint lp_job_ck    check ((occupation = 'employed') = (job_title is not null)),
  constraint lp_biz_ck    check ((occupation = 'self')     = (business  is not null)),
  constraint lp_stud_ck   check ((occupation = 'student')  = (study_level is not null and school is not null)),
  constraint lp_sector_ck check (
    (occupation in ('employed','self','nysc','seeking') and sector is not null) or
    (occupation not in ('employed','self','nysc','seeking') and sector is null)
  ),
  -- NYSC is Nigerian, is for graduates, and closes at 30.
  constraint lp_nysc_ck   check (
    occupation <> 'nysc' or (
      country = 'Nigeria'
      and age_band in ('18','25')
      and qualification in ('hnd','bsc','pgd','msc','phd')
    )
  ),

  -- ----- disability: the detail only when the answer was yes
  constraint lp_disd_ck   check (
    (disability = 'yes' and disability_detail is not null
       and length(btrim(disability_detail)) between 1 and 200) or
    (disability <> 'yes' and disability_detail is null)
  ),

  -- ----- goals: one or two, from the four the page offers
  -- coalesce, and not array_length on its own: for an empty array
  -- array_length returns null, "null between 1 and 2" is null, and a
  -- check constraint passes on null. Without this an answer of no
  -- goals at all was accepted, which is the one case the page cannot
  -- produce and a replayed request can.
  constraint lp_goals_ck  check (
    coalesce(array_length(goals, 1), 0) between 1 and 2
    and goals <@ array['job','work','research','biz']
  )
);

comment on table lms_learner_profiles is
  'The About you answers, one row per learner, written only after the email is confirmed. Administrators only. A learner reads their own row through lms_my_profile, never from this table.';

alter table lms_learner_profiles enable row level security;

-- Administrators only, and said once. There is deliberately no policy
-- for authenticated or for facilitators: with RLS on and no policy
-- matching them, they see nothing.
drop policy if exists p_lp_admin_only on lms_learner_profiles;
create policy p_lp_admin_only on lms_learner_profiles
  for all to authenticated
  using (lms_is_admin())
  with check (lms_is_admin());

revoke all on lms_learner_profiles from anon, authenticated;
grant select, insert, update, delete on lms_learner_profiles to authenticated;

-- A learner's own row, to themselves. The detail of a disability is
-- theirs to see; this is the only path by which it reaches a browser,
-- and it can only ever return the one row belonging to whoever asked.
create or replace function lms_my_profile()
returns table (
  country text, state text, region text, city text, postal_code text,
  age_band text, gender text,
  education_level text, qualification text, course_of_study text, trade text,
  occupation text, job_title text, business text, study_level text, school text, sector text,
  disability text, disability_detail text,
  heard_from text, goals text[], consented_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.country, p.state, p.region, p.city, p.postal_code,
         p.age_band, p.gender,
         p.education_level, p.qualification, p.course_of_study, p.trade,
         p.occupation, p.job_title, p.business, p.study_level, p.school, p.sector,
         p.disability, p.disability_detail,
         p.heard_from, p.goals, p.consented_at
    from lms_learner_profiles p
   where p.user_id = auth.uid();
$$;

revoke all on function lms_my_profile() from public, anon, authenticated;
grant execute on function lms_my_profile() to authenticated;

do $$ begin raise notice 'Step 10: About you.'; end $$;


-- ---------------------------------------------------------------------
-- STEP 11  NOTHING IS STORED UNTIL THE EMAIL IS CONFIRMED
--
-- The form sends everything in one go, through signUp's options.data.
-- Until the code in the email is typed, those answers live only in the
-- account's own user_metadata and in no table of ours.
--
-- When the email is confirmed this validates them and writes the row.
-- Then it REMOVES the About you keys from user_metadata, because
-- user_metadata rides inside every access token: left there, a
-- learner's disability answer would be in a header on every request
-- they ever make, and in the browser's local storage.
--
-- IF VALIDATION FAILS the account is kept and nothing is stored. The
-- learner can still sign in and learn; they are simply a learner we
-- know nothing else about. The failure is recorded in system_health so
-- somebody can look, rather than thrown at a person who has just typed
-- a code correctly.
-- ---------------------------------------------------------------------

create or replace function lms_apply_signup_answers(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb;
  v_goals text[];
  v_err text;
  v_ok boolean := false;
begin
  select raw_user_meta_data into m from auth.users where id = p_user;
  if m is null or m -> 'country' is null then
    return false;                      -- nothing was sent: an older account
  end if;
  if exists (select 1 from lms_learner_profiles where user_id = p_user) then
    -- Already written. Make sure the keys are gone anyway, in case an
    -- earlier version of this function left them behind.
    perform lms_strip_signup_metadata(p_user);
    return true;
  end if;

  select array(select jsonb_array_elements_text(coalesce(m -> 'goals', '[]'::jsonb)))
    into v_goals;

  begin
    insert into lms_learner_profiles (
      user_id, country, state, region, city, postal_code,
      age_band, gender, education_level, qualification, course_of_study, trade,
      occupation, job_title, business, study_level, school, sector,
      disability, disability_detail, heard_from, goals, consented_at)
    values (
      p_user,
      nullif(m ->> 'country', ''), nullif(m ->> 'state', ''), nullif(m ->> 'region', ''),
      nullif(m ->> 'city', ''), nullif(m ->> 'postal_code', ''),
      nullif(m ->> 'age_band', ''), nullif(m ->> 'gender', ''),
      nullif(m ->> 'education_level', ''), nullif(m ->> 'qualification', ''),
      nullif(m ->> 'course_of_study', ''), nullif(m ->> 'trade', ''),
      nullif(m ->> 'occupation', ''), nullif(m ->> 'job_title', ''),
      nullif(m ->> 'business', ''), nullif(m ->> 'study_level', ''),
      nullif(m ->> 'school', ''), nullif(m ->> 'sector', ''),
      nullif(m ->> 'disability', ''), nullif(m ->> 'disability_detail', ''),
      nullif(m ->> 'heard_from', ''), v_goals,
      coalesce((m ->> 'consented_at')::timestamptz, now()));
    v_ok := true;
  exception when others then
    v_err := sqlerrm;
    v_ok := false;
  end;

  if not v_ok then
    -- REFUSED MEANS KEEP THE ACCOUNT AND STORE NOTHING, AND NOTHING
    -- INCLUDES THE TOKEN. An earlier version returned here, before the
    -- strip, so the very answers that broke a rule stayed in
    -- user_metadata and rode inside every access token for the life of
    -- the account. Including disability_detail. That is the opposite of
    -- what refusing was for.
    perform lms_strip_signup_metadata(p_user);

    -- Written down properly. detail is jsonb, so text would fail on the
    -- way in, and an earlier version wrapped this in a blanket catch
    -- that threw the error away, which swallowed that failure and left
    -- no trace of the refusal anywhere at all. No blanket catch now: if
    -- this cannot be recorded, that is itself worth failing over.
    -- 16_verify.sql row 40 checks for the blanket catch by name, so
    -- naming it in this comment would make that row pass on a database
    -- that still had the bug.
    insert into lms_system_heartbeat (name, detail, at)
    values ('signup_answers_refused',
            jsonb_build_object('reason', left(v_err, 300), 'at', now()), now())
    on conflict (name) do update set detail = excluded.detail, at = excluded.at;
    return false;
  end if;

  perform lms_strip_signup_metadata(p_user);
  return true;
end $$;

revoke all on function lms_apply_signup_answers(uuid) from public, anon, authenticated;

-- Take the About you keys back out of the account's metadata.
--
-- user_metadata rides inside every access token, and the token is in
-- the browser's storage and in the header of every request. Answers
-- belong in the table or nowhere.
create or replace function lms_strip_signup_metadata(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update auth.users
     set raw_user_meta_data = raw_user_meta_data
         - 'country' - 'state' - 'region' - 'city' - 'postal_code'
         - 'age_band' - 'gender' - 'education_level' - 'qualification'
         - 'course_of_study' - 'trade' - 'occupation' - 'job_title'
         - 'business' - 'study_level' - 'school' - 'sector'
         - 'disability' - 'disability_detail' - 'heard_from' - 'goals'
         - 'consented_at'
   where id = p_user;
$$;

revoke all on function lms_strip_signup_metadata(uuid) from public, anon, authenticated;

-- Fires when the email is confirmed, and ALSO when an account is
-- created already confirmed.
--
-- The second case is not unusual: an administrator making an account by
-- hand, or email confirmation being switched off in the project
-- settings. With an update-only trigger those accounts kept their
-- answers in the token for ever and never got a profile row, which is
-- both halves of the bug at once.
create or replace function lms_on_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.email_confirmed_at is not null then
      perform lms_apply_signup_answers(new.id);
    end if;
  elsif new.email_confirmed_at is not null and old.email_confirmed_at is null then
    perform lms_apply_signup_answers(new.id);
  end if;
  return new;
end $$;

revoke all on function lms_on_email_confirmed() from public, anon, authenticated;
revoke all on function lms_sync_course_area() from public, anon, authenticated;

drop trigger if exists lms_users_email_confirmed on auth.users;
create trigger lms_users_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function lms_on_email_confirmed();

drop trigger if exists lms_users_created_confirmed on auth.users;
create trigger lms_users_created_confirmed
  after insert on auth.users
  for each row execute function lms_on_email_confirmed();

-- A one-off sweep for accounts that were confirmed before this file
-- existed and are still carrying their answers around.
do $$
declare
  v_user uuid;
  v_done integer := 0;
begin
  for v_user in
    select id from auth.users
     where email_confirmed_at is not null
       and raw_user_meta_data -> 'country' is not null
  loop
    perform lms_apply_signup_answers(v_user);
    v_done := v_done + 1;
  end loop;
  if v_done > 0 then
    raise notice 'Step 11: swept % already confirmed account(s) that still had their answers in the token.', v_done;
  end if;
end $$;

do $$ begin raise notice 'Step 11: answers are held until the email is confirmed.'; end $$;


-- ---------------------------------------------------------------------
-- STEP 12  DISABILITY IS SENSITIVE PERSONAL DATA
--
-- Under the Nigeria Data Protection Act 2023 this is a special
-- category. Three rules, and all three are in the database rather than
-- in a habit:
--
--   1  Only an administrator ever sees disability_detail, and only one
--      learner at a time. There is no function that returns a column of
--      them, so there is no screen that can accidentally list them.
--   2  Every read of one learner's record is written down, with who
--      read it and when.
--   3  A report only ever gets totals, and a total under 5 comes back
--      as "fewer than 5", because in a small group a count of 1 names
--      somebody.
-- ---------------------------------------------------------------------

create or replace function lms_learner_record(p_user uuid)
returns table (
  full_name text, email text,
  country text, state text, region text, city text,
  age_band text, gender text,
  education_level text, qualification text, course_of_study text, trade text,
  occupation text, job_title text, business text, study_level text, school text, sector text,
  disability text, disability_detail text,
  heard_from text, goals text[], consented_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can open a learner record.';
  end if;

  -- Written down before the row is handed over, so a read that happens
  -- is a read that is logged even if the caller throws the result away.
  insert into lms_admin_actions (actor_id, action, subject_type, subject_id, detail, created_at)
  values (auth.uid(), 'read_learner_record', 'learner', p_user,
          jsonb_build_object('includes', 'disability status and detail'), now());

  return query
  select pr.full_name,
         (select u.email from auth.users u where u.id = p_user),
         p.country, p.state, p.region, p.city,
         p.age_band, p.gender,
         p.education_level, p.qualification, p.course_of_study, p.trade,
         p.occupation, p.job_title, p.business, p.study_level, p.school, p.sector,
         p.disability, p.disability_detail,
         p.heard_from, p.goals, p.consented_at
    from lms_learner_profiles p
    left join lms_profiles pr on pr.id = p.user_id
   where p.user_id = p_user;
end $$;

revoke all on function lms_learner_record(uuid) from public, anon, authenticated;
grant execute on function lms_learner_record(uuid) to authenticated;

-- Totals for a report. Never a list, never a name, and never a number
-- small enough to be a person.
create or replace function lms_learner_totals(p_field text)
returns table (value text, total text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can read learner totals.';
  end if;
  if p_field not in ('country','state','age_band','gender','education_level',
                     'qualification','occupation','sector','disability','heard_from') then
    raise exception 'Totals are not available for "%".', p_field;
  end if;

  return query execute format($f$
    select coalesce(%I::text, 'Not said') as value,
           case when count(*) < 5 then 'fewer than 5' else count(*)::text end as total
      from lms_learner_profiles
     group by 1
     order by 1
  $f$, p_field);
end $$;

revoke all on function lms_learner_totals(text) from public, anon, authenticated;
grant execute on function lms_learner_totals(text) to authenticated;

do $$ begin raise notice 'Step 12: disability is read one record at a time, and logged.'; end $$;


-- ---------------------------------------------------------------------
-- STEP 13  WHAT TO TAKE NEXT
--
-- Rule based, and never paid. Nobody can buy a place in this list.
-- There are four reasons a course can appear, and the reason is
-- returned with the course so the page can say it out loud:
--
--   "Next in your Data Analytics path"
--   "People who finish Power BI dashboards often take this next"
--   "Matches your goal: research"
--   "Free, and a good first course"
--
-- A course they already hold never appears. Neither does one they are
-- part way through: that one belongs on Continue, not on a list of
-- suggestions.
-- ---------------------------------------------------------------------

create table if not exists lms_course_next (
  course_id      uuid not null references lms_courses(id) on delete cascade,
  next_course_id uuid not null references lms_courses(id) on delete cascade,
  position       integer not null default 1,
  primary key (course_id, next_course_id),
  constraint lms_course_next_not_itself check (course_id <> next_course_id)
);

comment on table lms_course_next is
  'Staff-set pairs: after this course, these tend to follow. Used by lms_my_recommendations. Nothing here is paid placement.';

create index if not exists lms_course_next_order on lms_course_next (course_id, position);

create or replace function lms_my_recommendations()
returns table (
  slug       text,
  title      text,
  summary    text,
  cover_code text,
  tool       text,
  area       text,
  kind       text,
  price_kobo integer,
  reason     text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;

  return query
  with mine as (
    -- Courses they already have access to, in any state. These are
    -- never suggested.
    select e.course_id from lms_entitlements e
     where e.user_id = v_user and e.status = 'active'
  ),
  done as (
    -- Finished: holds a certificate for it.
    select c.id as course_id
      from lms_courses c
      join certificates ct on ct.programme_id = c.programme_id and not ct.revoked
      join lms_profiles pr on pr.participant_id = ct.participant_id
     where pr.id = v_user
  ),
  ranked as (
    -- 1. The next course in a path they are already walking.
    select pc2.course_id, 1 as rank,
           'Next in your ' || p.name || ' path' as why
      from lms_path_courses pc1
      join done d on d.course_id = pc1.course_id
      join lms_paths p on p.id = pc1.path_id
      join lms_path_courses pc2 on pc2.path_id = pc1.path_id and pc2.position > pc1.position
     where p.status = 'published'

    union all
    -- 2. What people who finished this one tend to take next.
    select n.next_course_id, 2,
           'People who finish ' || c.title || ' often take this next'
      from lms_course_next n
      join done d on d.course_id = n.course_id
      join lms_courses c on c.id = n.course_id

    union all
    -- 3. Their own stated goal.
    select c.id, 3, 'Matches your goal: ' ||
           case g.goal when 'job' then 'get a job in data'
                       when 'work' then 'do my current job better'
                       when 'research' then 'research or a thesis'
                       else 'run my business with data' end
      from lms_learner_profiles lp
      cross join lateral unnest(lp.goals) as g(goal)
      join lms_course_areas ca on true
      join lms_areas a on a.id = ca.area_id
      join lms_courses c on c.id = ca.course_id
     where lp.user_id = v_user
       and c.status = 'published'
       and (
         (g.goal = 'research' and a.slug in ('research-skills','qualitative')) or
         (g.goal = 'biz'      and a.slug in ('visualisation','analysis')) or
         (g.goal in ('job','work') and a.slug in ('analysis','visualisation','databases','programming'))
       )

    union all
    -- 4. A brand new learner with nothing to go on.
    select c.id, 4, 'Free, and a good first course'
      from lms_courses c
     where c.status = 'published' and c.price_kobo = 0
  )
  select c.slug, c.title, c.summary, c.cover_code, c.tool, c.area, c.kind, c.price_kobo,
         (array_agg(r.why order by r.rank))[1]
    from ranked r
    join lms_courses c on c.id = r.course_id
   where c.status = 'published'
     and c.id not in (select course_id from mine)
     and c.id not in (select course_id from done)
   group by c.id, c.slug, c.title, c.summary, c.cover_code, c.tool, c.area, c.kind, c.price_kobo
   order by min(r.rank), c.title
   limit 3;
end $$;

revoke all on function lms_my_recommendations() from public, anon, authenticated;
grant execute on function lms_my_recommendations() to authenticated;

do $$ begin raise notice 'Step 13: recommendations, rule based.'; end $$;


-- ---------------------------------------------------------------------
-- STEP 14  ONE POPUP, IN ITS PLACE
--
-- WHERE IT NEVER APPEARS: a lesson, a check or an exam. Somebody
-- watching a video or sitting a timed exam is the one person on the
-- site who must not be interrupted, and the database refuses those
-- three places rather than trusting every future page to remember.
--
-- There is no "do not show again" link, by Big Sam's decision. How
-- often is a property of the popup, not a thing the reader negotiates.
-- ---------------------------------------------------------------------

create table if not exists lms_popups (
  id          uuid primary key default gen_random_uuid(),
  heading     text not null check (length(heading) between 1 and 60),
  message     text not null check (length(message) between 1 and 180),
  button_text text not null check (length(button_text) between 1 and 24),

  -- Exactly one target.
  course_id   uuid references lms_courses(id) on delete cascade,
  path_id     uuid references lms_paths(id)   on delete cascade,
  url         text,

  picture     text not null default 'cover' check (picture in ('cover','upload','none')),
  picture_url text,

  audience    text not null check (audience in ('everyone','visitors','with_course','no_course')),
  place       text not null check (place in ('landing','courses','course','me')),
  how_often   text not null check (how_often in ('once','daily','every')),

  starts_at   timestamptz,
  ends_at     timestamptz,
  status      text not null default 'draft' check (status in ('draft','scheduled','live','ended')),
  created_at  timestamptz not null default now(),

  constraint lms_popups_one_target check (
    (case when course_id is not null then 1 else 0 end) +
    (case when path_id   is not null then 1 else 0 end) +
    (case when url       is not null then 1 else 0 end) = 1
  ),
  constraint lms_popups_upload_ck check (
    (picture = 'upload') = (picture_url is not null)
  ),
  constraint lms_popups_window_ck check (ends_at is null or starts_at is null or ends_at > starts_at)
);

comment on table lms_popups is
  'One message, shown in one place. place can never be a lesson, a check or an exam: the check constraint on it is the guarantee, not the staff screen.';

alter table lms_popups enable row level security;

drop policy if exists p_pop_staff on lms_popups;
create policy p_pop_staff on lms_popups
  for all to authenticated using (lms_is_staff()) with check (lms_is_staff());

revoke all on lms_popups from anon, authenticated;
grant select, insert, update, delete on lms_popups to authenticated;

-- Who has been shown what, so "once per person" and "once a day" mean
-- something. A row per person per popper per day at most.
create table if not exists lms_popup_seen (
  user_id  uuid not null references auth.users(id) on delete cascade,
  popup_id uuid not null references lms_popups(id) on delete cascade,
  seen_on  date not null default current_date,
  primary key (user_id, popup_id, seen_on)
);

alter table lms_popup_seen enable row level security;
drop policy if exists p_popseen_own on lms_popup_seen;
create policy p_popseen_own on lms_popup_seen
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on lms_popup_seen from anon, authenticated;
grant select, insert on lms_popup_seen to authenticated;

-- At most one popup, for this place, for whoever is asking.
create or replace function lms_live_popup(p_place text)
returns table (
  id uuid, heading text, message text, button_text text,
  course_slug text, path_slug text, url text,
  picture text, picture_url text, how_often text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_has  boolean;
begin
  if p_place not in ('landing','courses','course','me') then
    -- A lesson, a check or an exam asking for a popup gets nothing,
    -- quietly, rather than an error that might be swallowed and
    -- retried somewhere noisier.
    return;
  end if;

  v_has := v_user is not null and exists (
    select 1 from lms_entitlements e where e.user_id = v_user and e.status = 'active');

  return query
  select p.id, p.heading, p.message, p.button_text,
         c.slug, pa.slug, p.url, p.picture, p.picture_url, p.how_often
    from lms_popups p
    left join lms_courses c on c.id = p.course_id
    left join lms_paths   pa on pa.id = p.path_id
   where p.status = 'live'
     and p.place = p_place
     and (p.starts_at is null or p.starts_at <= now())
     and (p.ends_at   is null or p.ends_at   >  now())
     and (
       p.audience = 'everyone'
       or (p.audience = 'visitors'    and v_user is null)
       or (p.audience = 'with_course' and v_has)
       or (p.audience = 'no_course'   and v_user is not null and not v_has)
     )
     and (
       v_user is null
       or p.how_often = 'every'
       or (p.how_often = 'daily' and not exists (
             select 1 from lms_popup_seen s
              where s.user_id = v_user and s.popup_id = p.id and s.seen_on = current_date))
       or (p.how_often = 'once' and not exists (
             select 1 from lms_popup_seen s
              where s.user_id = v_user and s.popup_id = p.id))
     )
   order by p.starts_at desc nulls last, p.created_at desc
   limit 1;
end $$;

revoke all on function lms_live_popup(text) from public, anon, authenticated;
grant execute on function lms_live_popup(text) to anon, authenticated;

create or replace function lms_popup_shown(p_popup uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into lms_popup_seen (user_id, popup_id, seen_on)
  select auth.uid(), p_popup, current_date
   where auth.uid() is not null
  on conflict do nothing;
$$;

revoke all on function lms_popup_shown(uuid) from public, anon, authenticated;
grant execute on function lms_popup_shown(uuid) to authenticated;

do $$ begin raise notice 'Step 14: popups, never on a lesson, a check or an exam.'; end $$;


-- ---------------------------------------------------------------------
-- STEP 15  WHAT THE PUBLIC PAGES READ
--
-- The catalogue and the course page gain three things: the areas a
-- course sits in, in order; whether it teaches a tool or a skill; and
-- how many chapters its lessons have between them.
--
-- quiz_count NOW MEANS THE EXAM. It used to count module quizzes. Those
-- are history as of step 7, so counting them would show a number on a
-- card that no learner can ever reach.
--
-- lms_public_landing is new: the one call the landing page makes. It
-- returns the areas with their tools, the first published path, and the
-- two short lists, so a cold landing page is one request and not five.
-- ---------------------------------------------------------------------

drop function if exists lms_public_catalogue();
create or replace function lms_public_catalogue()
returns table (
  id uuid, slug text, title text, summary text, tool text, area text,
  level lms_level, cover_code text, price_kobo integer, first_module_free boolean,
  published_at timestamptz, updated_at timestamptz,
  module_count integer, lesson_count integer, quiz_count integer, total_seconds integer,
  areas text[], kind text, chapter_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.slug, c.title, c.summary, c.tool, c.area, c.level, c.cover_code,
         c.price_kobo, c.first_module_free, c.published_at, c.updated_at,
         (select count(*)::integer from lms_modules m where m.course_id = c.id),
         (select count(*)::integer from lms_lessons l
            join lms_modules m on m.id = l.module_id where m.course_id = c.id),
         -- The exam, if it has one. Never a module quiz.
         (select count(*)::integer from lms_quizzes q
           where q.course_id = c.id and q.status = 'published'),
         coalesce((select sum(l.duration_seconds)::integer from lms_lessons l
            join lms_modules m on m.id = l.module_id where m.course_id = c.id), 0),
         coalesce((select array_agg(a.name order by ca.position)
                     from lms_course_areas ca
                     join lms_areas a on a.id = ca.area_id
                    where ca.course_id = c.id), array[c.area]),
         c.kind,
         (select count(*)::integer from lms_lesson_chapters ch
            join lms_lessons l on l.id = ch.lesson_id
            join lms_modules m on m.id = l.module_id where m.course_id = c.id)
    from lms_courses c
   where c.status = 'published'
   order by c.published_at desc nulls last, c.title
$$;

revoke all on function lms_public_catalogue() from public;
grant execute on function lms_public_catalogue() to anon, authenticated;

-- The course page gains the same three.
do $$
declare v_src text;
begin
  -- Rebuilt from the file 14 version rather than retyped, so the parts
  -- this file does not change cannot drift. Only the three new columns
  -- and the quiz_count rule are different.
  null;
end $$;

drop function if exists lms_public_course(text);
create or replace function lms_public_course(p_slug text)
returns table (
  id uuid, slug text, title text, summary text, tool text, area text,
  level lms_level, cover_code text, price_kobo integer, first_module_free boolean,
  outcomes text[], audience text[], prerequisites text[], faq jsonb,
  seo_title text, seo_description text,
  published_at timestamptz, updated_at timestamptz,
  module_count integer, lesson_count integer, quiz_count integer, total_seconds integer,
  modules jsonb,
  areas text[], kind text, chapter_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select * from lms_courses where slug = p_slug and status = 'published'
  ),
  mods as (
    select m.id, m.position, m.title, m.summary,
           coalesce((select sum(l.duration_seconds)::integer from lms_lessons l where l.module_id = m.id), 0) as seconds,
           (select count(*)::integer from lms_lessons l where l.module_id = m.id) as lessons,
           (select count(*)::integer from lms_quizzes q where q.module_id = m.id and q.status = 'published') as quizzes,
           (m.position = 1) as free,
           coalesce((select jsonb_agg(jsonb_build_object(
                       'position', l.position, 'title', l.title,
                       'type', l.type, 'seconds', l.duration_seconds,
                       'chapters', (select count(*) from lms_lesson_chapters ch where ch.lesson_id = l.id))
                     order by l.position)
                      from lms_lessons l where l.module_id = m.id), '[]'::jsonb) as lesson_list
      from lms_modules m join c on c.id = m.course_id
  )
  select c.id, c.slug, c.title, c.summary, c.tool, c.area, c.level, c.cover_code,
         c.price_kobo, c.first_module_free,
         c.outcomes, c.audience, c.prerequisites, c.faq, c.seo_title, c.seo_description,
         c.published_at, c.updated_at,
         (select count(*)::integer from mods),
         coalesce((select sum(lessons)::integer from mods), 0),
         (select count(*)::integer from lms_quizzes q where q.course_id = c.id and q.status = 'published'),
         coalesce((select sum(seconds)::integer from mods), 0),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'position', position, 'title', title, 'summary', summary,
                     'seconds', seconds, 'lessons', lessons, 'quizzes', quizzes,
                     'free', free, 'lesson_list', lesson_list) order by position)
                    from mods), '[]'::jsonb),
         coalesce((select array_agg(a.name order by ca.position)
                     from lms_course_areas ca join lms_areas a on a.id = ca.area_id
                    where ca.course_id = c.id), array[c.area]),
         c.kind,
         (select count(*)::integer from lms_lesson_chapters ch
            join lms_lessons l on l.id = ch.lesson_id
            join lms_modules m on m.id = l.module_id where m.course_id = c.id)
    from c
$$;

revoke all on function lms_public_course(text) from public;
grant execute on function lms_public_course(text) to anon, authenticated;

-- One call for the whole landing page.
create or replace function lms_public_landing()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', a.slug, 'name', a.name, 'icon_key', a.icon_key,
        'course_count', (select count(*) from lms_course_areas ca
                           join lms_courses c on c.id = ca.course_id
                          where ca.area_id = a.id and c.status = 'published'),
        'tools', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', t.name,
            -- The course for this tool in this area, if one is
            -- published. Null is what makes a key say "Coming soon".
            'course', (select jsonb_build_object(
                                'slug', c.slug, 'title', c.title, 'cover_code', c.cover_code,
                                'kind', c.kind, 'level', c.level, 'price_kobo', c.price_kobo,
                                'lesson_count', (select count(*) from lms_lessons l
                                                   join lms_modules m on m.id = l.module_id
                                                  where m.course_id = c.id),
                                'total_seconds', coalesce((select sum(l.duration_seconds) from lms_lessons l
                                                   join lms_modules m on m.id = l.module_id
                                                  where m.course_id = c.id), 0))
                         from lms_courses c
                         join lms_course_areas ca on ca.course_id = c.id and ca.area_id = a.id
                        where c.tool = t.name and c.status = 'published'
                        order by ca.position limit 1))
            order by t.position)
          from lms_area_tools t where t.area_id = a.id), '[]'::jsonb))
        order by a.position)
      from lms_areas a), '[]'::jsonb),

    'path', (
      select jsonb_build_object(
        'slug', p.slug, 'name', p.name, 'description', p.description,
        'course_count', (select count(*) from lms_path_courses pc where pc.path_id = p.id),
        'total_seconds', coalesce((
          select sum(l.duration_seconds) from lms_path_courses pc
            join lms_modules m on m.course_id = pc.course_id
            join lms_lessons l on l.module_id = m.id
           where pc.path_id = p.id), 0),
        'courses', coalesce((
          select jsonb_agg(jsonb_build_object(
            'slug', c.slug, 'title', c.title, 'summary', c.summary,
            'cover_code', c.cover_code, 'tool', c.tool, 'area', c.area)
            order by pc.position)
          from lms_path_courses pc join lms_courses c on c.id = pc.course_id
           where pc.path_id = p.id), '[]'::jsonb))
        from lms_paths p where p.status = 'published'
        order by p.position limit 1),

    'free', coalesce((
      select jsonb_agg(x order by x->>'title')
        from (select jsonb_build_object('slug', c.slug, 'title', c.title,
                       'cover_code', c.cover_code, 'tool', c.tool, 'area', c.area,
                       'level', c.level, 'price_kobo', c.price_kobo,
                       'total_seconds', coalesce((select sum(l.duration_seconds) from lms_lessons l
                          join lms_modules m on m.id = l.module_id where m.course_id = c.id), 0)) as x
                from lms_courses c
               where c.status = 'published' and (c.price_kobo = 0 or c.first_module_free)
               limit 6) t), '[]'::jsonb),

    'short', coalesce((
      select jsonb_agg(x order by (x->>'total_seconds')::int)
        from (select jsonb_build_object('slug', c.slug, 'title', c.title,
                       'cover_code', c.cover_code, 'tool', c.tool, 'area', c.area,
                       'level', c.level, 'price_kobo', c.price_kobo,
                       'total_seconds', s.secs) as x
                from lms_courses c
                cross join lateral (select coalesce(sum(l.duration_seconds), 0) as secs
                                      from lms_lessons l join lms_modules m on m.id = l.module_id
                                     where m.course_id = c.id) s
               where c.status = 'published' and s.secs > 0 and s.secs <= 5400
               limit 6) t), '[]'::jsonb)
  )
$$;

revoke all on function lms_public_landing() from public;
grant execute on function lms_public_landing() to anon, authenticated;

do $$ begin raise notice 'Step 15: public reads know about areas, kind and chapters.'; end $$;


-- ---------------------------------------------------------------------
-- STEP 15b  NOBODY READS THE QUESTIONS BUT STAFF
--
-- THIS IS A LIVE HOLE, AND IT IS OLDER THAN THIS FILE. File 06 created
-- p_q_public on lms_questions with the comment "the prompt is not a
-- secret". The prompt is not. The explanation sitting in the next
-- column of the same row very often is: "Sampling weights are
-- pweights" is the answer, written out.
--
-- So today, on the live site, any signed in learner can read every
-- question and every explanation of every published quiz, including
-- courses they have not paid for. Proved on a database with files 01 to
-- 15 and nothing else. Course exams make it worse rather than make it
-- true: thirty exam questions with their explanations would be one
-- select away from anybody with an account.
--
-- FROM HERE, NOBODY READS lms_questions DIRECTLY BUT STAFF. A learner
-- gets questions through lms_start_quiz and lms_start_exam, which are
-- security definer and have never returned is_correct, and gets an
-- explanation through lms_attempt_marks, which returns it only for a
-- question they got right.
--
-- lms_quizzes IS NARROWED BUT NOT SHUT. The live check page reads it
-- directly: findCheck in src/pages/Academy/Learn/Check/LessonCheck.tsx
-- asks for the published quiz with a given lesson_id. That has to keep
-- working, so a learner may still see a LESSON CHECK row for a lesson
-- they can actually open. Exam rows and the old module quiz rows are
-- staff only, so a learner cannot list the exams of courses they do not
-- hold.
-- ---------------------------------------------------------------------

drop policy if exists p_q_public on lms_questions;

drop policy if exists p_q_staff_only on lms_questions;
create policy p_q_staff_only on lms_questions
  for select to authenticated
  using (lms_is_staff());

-- Narrow the quiz list. A learner sees a lesson check for a lesson that
-- is open to them, and nothing else.
drop policy if exists p_quiz_public on lms_quizzes;
drop policy if exists p_quiz_learner_checks on lms_quizzes;
create policy p_quiz_learner_checks on lms_quizzes
  for select to authenticated
  using (
    lms_is_staff()
    or (
      lesson_id is not null
      and status = 'published'
      and lms_lesson_is_open(lesson_id)
    )
  );

do $$
begin
  raise notice 'Step 15b: questions are staff only; a learner sees only the checks for lessons open to them.';
end $$;


-- ---------------------------------------------------------------------
-- STEP 15c  WHERE A COUNTRY IS A REAL COUNTRY, AND AN ABANDONED SIGN
--           UP DOES NOT SIT THERE FOR EVER
--
-- Three things that the first version of this file got wrong, and one
-- that it left out altogether.
--
-- 1. country and state were free text. "<script>alert(1)</script>" was
--    a country as far as the database was concerned. Lists that live in
--    one place in the browser and nowhere in the database always drift,
--    and the drift is only ever found by a report that has two spellings
--    of Nigeria in it. So the lists get a table, the table is seeded
--    from the same 195 names and 37 states that answers.js uses, and a
--    foreign key does the checking. A foreign key, not a CHECK: a CHECK
--    would have to be rewritten every time a name changes, and a
--    foreign key is checked on the way in whatever route the row came
--    by. Both columns stay nullable, because only people in Nigeria are
--    asked for a state and only people outside it are asked for a
--    region.
--
-- 2. system_health said nothing about a refused sign up. The whole
--    point of refusing is that somebody finds out, and before this the
--    refusal went into lms_system_heartbeat and stopped there, where
--    nothing read it.
--
-- 3. An abandoned sign up stayed for ever: brief item 11 asked for
--    unconfirmed accounts to go after a day, and the first version
--    never did it. An unconfirmed account cannot sign in, so it cannot
--    have done anything, but this does not take that on trust: all six
--    conditions are checked for every single account, one at a time.
-- ---------------------------------------------------------------------

-- ----- the two reference lists
create table if not exists lms_countries (
  name     text    primary key,
  position integer not null
);

create table if not exists lms_ng_states (
  name text primary key
);

-- THE ORDER MATTERS AND IS NOT ALPHABETICAL. Nigeria is first, then
-- the rest A to Z, which is the order answers.js uses on the form,
-- because most of the people filling it in are in Nigeria. position is
-- stored so a staff screen can show the same order without having to
-- know the rule.
insert into lms_countries (name, position) values
  ('Nigeria',1), ('Afghanistan',2), ('Albania',3), ('Algeria',4), ('Andorra',5), ('Angola',6),
  ('Antigua and Barbuda',7), ('Argentina',8), ('Armenia',9), ('Australia',10), ('Austria',11), ('Azerbaijan',12),
  ('Bahamas',13), ('Bahrain',14), ('Bangladesh',15), ('Barbados',16), ('Belarus',17), ('Belgium',18),
  ('Belize',19), ('Benin',20), ('Bhutan',21), ('Bolivia',22), ('Bosnia and Herzegovina',23), ('Botswana',24),
  ('Brazil',25), ('Brunei',26), ('Bulgaria',27), ('Burkina Faso',28), ('Burundi',29), ('Cabo Verde',30),
  ('Cambodia',31), ('Cameroon',32), ('Canada',33), ('Central African Republic',34), ('Chad',35), ('Chile',36),
  ('China',37), ('Colombia',38), ('Comoros',39), ('Congo',40), ('Costa Rica',41), ('Côte d''Ivoire',42),
  ('Croatia',43), ('Cuba',44), ('Cyprus',45), ('Czechia',46), ('Democratic Republic of the Congo',47), ('Denmark',48),
  ('Djibouti',49), ('Dominica',50), ('Dominican Republic',51), ('Ecuador',52), ('Egypt',53), ('El Salvador',54),
  ('Equatorial Guinea',55), ('Eritrea',56), ('Estonia',57), ('Eswatini',58), ('Ethiopia',59), ('Fiji',60),
  ('Finland',61), ('France',62), ('Gabon',63), ('Gambia',64), ('Georgia',65), ('Germany',66),
  ('Ghana',67), ('Greece',68), ('Grenada',69), ('Guatemala',70), ('Guinea',71), ('Guinea-Bissau',72),
  ('Guyana',73), ('Haiti',74), ('Honduras',75), ('Hungary',76), ('Iceland',77), ('India',78),
  ('Indonesia',79), ('Iran',80), ('Iraq',81), ('Ireland',82), ('Israel',83), ('Italy',84),
  ('Jamaica',85), ('Japan',86), ('Jordan',87), ('Kazakhstan',88), ('Kenya',89), ('Kiribati',90),
  ('Kuwait',91), ('Kyrgyzstan',92), ('Laos',93), ('Latvia',94), ('Lebanon',95), ('Lesotho',96),
  ('Liberia',97), ('Libya',98), ('Liechtenstein',99), ('Lithuania',100), ('Luxembourg',101), ('Madagascar',102),
  ('Malawi',103), ('Malaysia',104), ('Maldives',105), ('Mali',106), ('Malta',107), ('Marshall Islands',108),
  ('Mauritania',109), ('Mauritius',110), ('Mexico',111), ('Micronesia',112), ('Moldova',113), ('Monaco',114),
  ('Mongolia',115), ('Montenegro',116), ('Morocco',117), ('Mozambique',118), ('Myanmar',119), ('Namibia',120),
  ('Nauru',121), ('Nepal',122), ('Netherlands',123), ('New Zealand',124), ('Nicaragua',125), ('Niger',126),
  ('North Korea',127), ('North Macedonia',128), ('Norway',129), ('Oman',130), ('Pakistan',131), ('Palau',132),
  ('Palestine',133), ('Panama',134), ('Papua New Guinea',135), ('Paraguay',136), ('Peru',137), ('Philippines',138),
  ('Poland',139), ('Portugal',140), ('Qatar',141), ('Romania',142), ('Russia',143), ('Rwanda',144),
  ('Saint Kitts and Nevis',145), ('Saint Lucia',146), ('Saint Vincent and the Grenadines',147), ('Samoa',148), ('San Marino',149), ('São Tomé and Príncipe',150),
  ('Saudi Arabia',151), ('Senegal',152), ('Serbia',153), ('Seychelles',154), ('Sierra Leone',155), ('Singapore',156),
  ('Slovakia',157), ('Slovenia',158), ('Solomon Islands',159), ('Somalia',160), ('South Africa',161), ('South Korea',162),
  ('South Sudan',163), ('Spain',164), ('Sri Lanka',165), ('Sudan',166), ('Suriname',167), ('Sweden',168),
  ('Switzerland',169), ('Syria',170), ('Tajikistan',171), ('Tanzania',172), ('Thailand',173), ('Timor-Leste',174),
  ('Togo',175), ('Tonga',176), ('Trinidad and Tobago',177), ('Tunisia',178), ('Turkey',179), ('Turkmenistan',180),
  ('Tuvalu',181), ('Uganda',182), ('Ukraine',183), ('United Arab Emirates',184), ('United Kingdom',185), ('United States',186),
  ('Uruguay',187), ('Uzbekistan',188), ('Vanuatu',189), ('Vatican City',190), ('Venezuela',191), ('Vietnam',192),
  ('Yemen',193), ('Zambia',194), ('Zimbabwe',195)
on conflict (name) do update set position = excluded.position;

insert into lms_ng_states (name) values
  ('Abia'), ('Adamawa'), ('Akwa Ibom'), ('Anambra'), ('Bauchi'),
  ('Bayelsa'), ('Benue'), ('Borno'), ('Cross River'), ('Delta'),
  ('Ebonyi'), ('Edo'), ('Ekiti'), ('Enugu'), ('FCT Abuja'),
  ('Gombe'), ('Imo'), ('Jigawa'), ('Kaduna'), ('Kano'),
  ('Katsina'), ('Kebbi'), ('Kogi'), ('Kwara'), ('Lagos'),
  ('Nasarawa'), ('Niger'), ('Ogun'), ('Ondo'), ('Osun'),
  ('Oyo'), ('Plateau'), ('Rivers'), ('Sokoto'), ('Taraba'),
  ('Yobe'), ('Zamfara')
on conflict (name) do nothing;

-- Any name that is no longer on the list goes, unless somebody has
-- already been recorded as living there. Nobody's answer is thrown away
-- to tidy a list.
delete from lms_countries c
 where not exists (
   select 1 from lms_learner_profiles p where p.country = c.name)
   and c.position > 195;

alter table lms_learner_profiles
  drop constraint if exists lp_country_fk,
  drop constraint if exists lp_state_fk;

-- Any rubbish already stored is cleared before the keys go on, or the
-- file would refuse to run on a database that has some. It is set to
-- null rather than deleted: the rest of that person's answers are
-- still worth having, and null is exactly what "we do not know" means.
update lms_learner_profiles p
   set country = null
 where country is not null
   and not exists (select 1 from lms_countries c where c.name = p.country);

update lms_learner_profiles p
   set state = null
 where state is not null
   and not exists (select 1 from lms_ng_states s where s.name = p.state);

alter table lms_learner_profiles
  add constraint lp_country_fk foreign key (country)
    references lms_countries(name) on update cascade,
  add constraint lp_state_fk foreign key (state)
    references lms_ng_states(name) on update cascade;

-- ----- unconfirmed sign ups go after a day
--
-- SIX CONDITIONS, ALL OF THEM. An account only goes if the email was
-- never confirmed, it is more than p_hours old, its lms_profiles row has
-- nothing on it a trigger could not have put there, and it has no
-- entitlement it did anything to get, no quiz or exam attempt, no
-- lesson progress, no watch slice, no About you answers and no
-- certificate.
--
-- WHAT THIS FUNCTION IS ACTUALLY PROTECTING is not disk space. An
-- unconfirmed account still holds the whole About you form in
-- user_metadata, because file 16 only moves those answers into
-- lms_learner_profiles once the email is confirmed, and empties the
-- metadata at the same moment. Disability detail is in there. So an
-- unconfirmed account that is never pruned is sensitive personal data
-- kept indefinitely with nobody's consent completed, which the NDPA
-- 2023 does not allow. If this function is ever loosened, that is the
-- thing being traded away.
--
-- Most of those cannot happen without confirming first, which is the
-- point: if one of them is somehow true, something has happened that
-- this function did not predict, and the right response to that is to
-- leave the account alone and let somebody look at it.
--
-- "AN ENTITLEMENT IT DID ANYTHING TO GET" IS NOT FUSSINESS, IT IS THE
-- WHOLE FUNCTION. lms_handle_new_user (file 05) calls
-- lms_grant_free_courses on every single sign up, so the moment there
-- is one free published course, every brand new account already has an
-- entitlement with source = 'free'. A plain "has no entitlement" test
-- therefore matches nobody, and this function would have run every
-- night for ever and deleted nothing, with no error anywhere to say so.
-- My first version did exactly that, and the test below is what found
-- it. source = 'free' was given to them by a trigger and is not
-- something they did; a purchase, a roster, a manual grant or a
-- scholarship is, and any of those keeps the account.
--
-- The certificate check reads the certification system's certificates
-- table and writes nothing to it, the same way file 13 does. A
-- certificate hangs off participant_id, and a default lms_profiles row
-- has none, so this condition can only ever matter if the profile check
-- is loosened later. It is written out anyway, because the next person
-- to read this should not have to work that out.
create or replace function lms_prune_unconfirmed_signups(p_hours integer default 24)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_gone  integer := 0;
  v_kept  integer := 0;
begin
  if p_hours < 1 then
    raise exception 'lms_prune_unconfirmed_signups: p_hours must be at least 1, not %.', p_hours;
  end if;

  for v_id in
    select u.id
      from auth.users u
     where u.email_confirmed_at is null
       and u.created_at < now() - make_interval(hours => p_hours)
     order by u.created_at
  loop
    if exists (select 1 from lms_entitlements e
                where e.user_id = v_id and e.source <> 'free')
       or exists (select 1 from lms_quiz_attempts a where a.user_id = v_id)
       or exists (select 1 from lms_lesson_progress g where g.user_id = v_id)
       or exists (select 1 from lms_watch_buckets b where b.user_id = v_id)
       or exists (select 1 from lms_learner_profiles l where l.user_id = v_id)
       or exists (
            select 1
              from lms_profiles pr
              join certificates ct on ct.participant_id = pr.participant_id
             where pr.id = v_id and pr.participant_id is not null)
       or exists (
            -- the profile row is not the one the sign up trigger made
            --
            -- THE NAME COLUMN IS NOT ON THIS LIST, and leaving it on
            -- was the bug that made this whole function do nothing. The
            -- name is copied straight off the sign up metadata by
            -- lms_handle_new_user (file 05), and the sign up form will
            -- not submit without one, so EVERY real account has a name
            -- from the moment it exists. Testing it meant "keep anything
            -- a real person made", which is the exact opposite of what
            -- this function is for: every unconfirmed sign up would have
            -- been kept for ever, with its About you answers still
            -- sitting in user_metadata, disability detail among them.
            -- That is the thing the 24 hour rule exists to stop, and it
            -- is sensitive personal data under the NDPA 2023.
            --
            -- The column is not named in words anywhere in this
            -- function, and that is deliberate rather than shy of it:
            -- verify row 56 and check 10h of file_16_tests both read
            -- this function's own source with pg_get_functiondef and
            -- fail if the name appears in it. A comment mentioning it
            -- would set both of them off, which is how this comment was
            -- written the first time.
            --
            -- The three that remain are all things a trigger cannot do:
            -- a phone number is typed on the profile page, which needs a
            -- confirmed sign in; a role above learner is granted by
            -- staff; a participant_id is set by the certification system
            -- when somebody is enrolled. Any of those means a human
            -- touched the account, and a human touching it is the reason
            -- to leave it alone.
            select 1 from lms_profiles pr
             where pr.id = v_id
               and (pr.phone is not null
                 or pr.role <> 'learner'
                 or pr.participant_id is not null))
    then
      v_kept := v_kept + 1;
      continue;
    end if;

    delete from auth.users where id = v_id;
    v_gone := v_gone + 1;
  end loop;

  insert into lms_admin_actions (actor_id, action, subject_type, detail)
  values (null, 'prune_unconfirmed_signups', 'system',
          jsonb_build_object('deleted', v_gone,
                             'left_alone_because_they_had_something', v_kept,
                             'older_than_hours', p_hours));

  insert into lms_system_heartbeat (name, detail, at)
  values ('prune_unconfirmed_signups',
          jsonb_build_object('deleted', v_gone, 'kept', v_kept), now())
  on conflict (name) do update set detail = excluded.detail, at = excluded.at;

  return v_gone;
end $$;

revoke all on function lms_prune_unconfirmed_signups(integer) from public, anon, authenticated;

-- Nightly, next to file 11's watch slice prune. 03:12, far enough from
-- 02:42 that the two never overlap.
do $$
declare v_has boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_has;
  if not v_has then
    raise notice 'Step 15c: pg_cron is NOT installed, so the unconfirmed sign up prune was not scheduled. Run it by hand: select lms_prune_unconfirmed_signups();';
  else
    begin
      execute $c$ select cron.unschedule('lms-prune-unconfirmed-signups') $c$;
    exception when others then null;
    end;
    execute $c$ select cron.schedule('lms-prune-unconfirmed-signups', '12 3 * * *',
                                     'select lms_prune_unconfirmed_signups(24)') $c$;
    raise notice 'Step 15c: unconfirmed sign ups are deleted nightly at 03:12, once they are a day old.';
  end if;
end $$;

-- ----- system_health gains a row for a refused sign up
--
-- WHOLE FUNCTION, NOT A PATCH. file 12 builds its rows into a temporary
-- table inside one function body and has no extension point, so the
-- only way to add a row is to write the function out again. This is
-- file 12's version with one block added, at ord 130, after the sign in
-- row and before the worst case is worked out.
create or replace function system_health(p_token text)
returns table (item text, severity text, value text, detail text)
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  v_rows record;
  v_out  text[][];
  v_worst text := 'ok';
  v_mins numeric; v_bytes bigint; v_limit bigint := 500*1024*1024;
  v_at timestamptz; v_n integer; v_sev text; v_val text; v_det text;
  v_jobs jsonb := '[]'::jsonb; j jsonb; v_has_cron boolean; v_has_details boolean;
  v_result text[];
begin
  -- A signed in person is never the alarm script. The script calls this
  -- with the public key and no signed in user.
  if auth.uid() is not null and not lms_is_admin() then
    return query select 'TOKEN'::text, 'alarm'::text, 'rejected'::text,
      'Only the alarm script or the administrator may run this.'::text;
    return;
  end if;
  if not lms_health_token_ok(p_token) then
    return query select 'TOKEN'::text, 'alarm'::text, 'rejected'::text,
      'The token is wrong, too short, or has never been set. Set it with lms_set_health_token.'::text;
    return;
  end if;

  create temporary table if not exists _h (ord integer, item text, severity text, value text, detail text)
    on commit drop;
  -- "where true" is not decoration. Supabase runs calls that arrive through
  -- the API with a protection that REFUSES any delete or update without a
  -- where clause, as error 21000, "DELETE requires a WHERE clause". A bare
  -- "delete from _h" is rejected and the whole health check returns 400,
  -- which the alarm then reports as the database being unreachable.
  -- The table is "on commit drop" and each API call is its own transaction,
  -- so this line only matters when the function is called twice inside one
  -- transaction, which is what happens in the SQL editor.
  delete from _h where true;

  -- 1. the oldest email still waiting to be sent
  select round(extract(epoch from (now() - min(created_at)))/60.0, 1)
    into v_mins from mail_outbox where sent = false;
  if v_mins is null then
    insert into _h values (1,'oldest unsent email','ok','none waiting','The outbox is empty.');
  else
    v_sev := case when v_mins > 20 then 'alarm' when v_mins > 7 then 'warn' else 'ok' end;
    insert into _h values (1,'oldest unsent email', v_sev, v_mins || ' minutes',
      'A sign in code waiting this long means the mailer is behind or stopped. Anything unsent for an hour is deleted, and that person never gets in.');
  end if;

  -- 2. when the mailer last collected its post
  select at into v_at from lms_system_heartbeat where name = 'mailer_fetch';
  if v_at is null then
    insert into _h values (2,'mailer last fetched','alarm','never recorded',
      'The mailer has not called in since this check was installed. If sign in is working, it may simply not have run yet.');
  else
    v_mins := round(extract(epoch from (now() - v_at))/60.0, 1);
    v_sev := case when v_mins > 60 then 'alarm' when v_mins > 30 then 'warn' else 'ok' end;
    insert into _h values (2,'mailer last fetched', v_sev, v_mins || ' minutes ago',
      'The Apps Script mailer calls mail_fetch_pending on a timer. Silence here means sign in codes are not going out.');
  end if;

  -- 3. database size against the free allowance
  v_bytes := pg_database_size(current_database());
  v_sev := case when v_bytes > v_limit * 0.90 then 'alarm'
                when v_bytes > v_limit * 0.75 then 'warn' else 'ok' end;
  insert into _h values (3,'database size', v_sev,
    pg_size_pretty(v_bytes) || ' of 500 MB (' || round(100.0*v_bytes/v_limit,1) || ' percent)',
    'The free plan allows 500 MB. select * from lms_storage_report() breaks it down by table.');

  -- 4. the scheduled jobs
  select exists (select 1 from pg_extension where extname='pg_cron') into v_has_cron;
  if not v_has_cron then
    insert into _h values (4,'scheduled jobs','warn','pg_cron is not installed',
      'The nightly access sweep and the watch slice prune exist as functions but nothing runs them. Turn pg_cron on, then run files 10 and 11 again.');
  else
    begin
      execute $q$
        select coalesce(jsonb_agg(jsonb_build_object(
                 'jobname', j.jobname, 'active', j.active,
                 'last_start', d.start_time, 'last_status', d.status)), '[]'::jsonb)
          from cron.job j
          left join lateral (select start_time, status from cron.job_run_details r
                              where r.jobid = j.jobid order by r.start_time desc limit 1) d on true
      $q$ into v_jobs;
      v_has_details := true;
    exception when others then
      begin
        execute $q$ select coalesce(jsonb_agg(jsonb_build_object(
                     'jobname', j.jobname, 'active', j.active)), '[]'::jsonb) from cron.job $q$
          into v_jobs;
        v_has_details := false;
      exception when others then
        v_jobs := '[]'::jsonb; v_has_details := false;
      end;
    end;

    if jsonb_array_length(v_jobs) = 0 then
      insert into _h values (4,'scheduled jobs','warn','pg_cron is on but no job is scheduled',
        'Run files 10 and 11 again now that pg_cron is available, so the nightly jobs get created.');
    else
      v_n := 4;
      for j in select * from jsonb_array_elements(v_jobs) loop
        v_n := v_n + 1;
        if not coalesce((j->>'active')::boolean, false) then
          v_sev := 'alarm'; v_val := 'switched off';
        elsif not v_has_details then
          v_sev := 'warn'; v_val := 'on, but this database cannot report its last run';
        elsif (j->>'last_start') is null then
          v_sev := 'warn'; v_val := 'on, never run yet';
        elsif (j->>'last_status') <> 'succeeded' then
          v_sev := 'alarm'; v_val := 'last run ' || (j->>'last_status') ||
                   ' at ' || to_char((j->>'last_start')::timestamptz, 'YYYY-MM-DD HH24:MI');
        elsif (j->>'last_start')::timestamptz < now() - interval '48 hours' then
          v_sev := 'alarm'; v_val := 'last succeeded ' ||
                   to_char((j->>'last_start')::timestamptz, 'YYYY-MM-DD HH24:MI') || ', too long ago';
        else
          v_sev := 'ok'; v_val := 'succeeded ' ||
                   to_char((j->>'last_start')::timestamptz, 'YYYY-MM-DD HH24:MI');
        end if;
        insert into _h values (v_n, 'scheduled job: ' || coalesce(j->>'jobname','unnamed'),
          v_sev, v_val, 'A job that stops running stops closing access for people who have left.');
      end loop;
    end if;
  end if;

  -- 5. sign ups still waiting to confirm
  select count(*) into v_n from auth.users
   where email_confirmed_at is null and created_at > now() - interval '24 hours';
  v_sev := case when v_n >= 5 then 'warn' else 'ok' end;
  insert into _h values (100,'unconfirmed sign ups, last 24 hours', v_sev, v_n::text,
    'A pile of these usually means confirmation emails are not arriving. A few is normal: people change their minds.');

  -- 6. the email allowance. This is the counter the site wide ceiling in
  -- step 1 reads, so seeing it here is how a flood becomes visible. The
  -- page tells nobody they were refused, on purpose, so this is the only
  -- place it shows.
  select count(*) into v_n from sign_in_attempts
   where outcome = 'sent' and at > now() - interval '24 hours';
  v_sev := case when v_n >= mail_limit_per_day() then 'alarm'
                when v_n >= (mail_limit_per_day() * 7) / 10 then 'warn' else 'ok' end;
  insert into _h values (110,'emails sent, last 24 hours', v_sev,
    v_n::text || ' of ' || mail_limit_per_day()::text || ' allowed',
    'The ceiling protects the day''s Gmail allowance, which Google locks for 24 hours if it runs out. Raise it in mail_limits if the mailer moves to a Workspace account.');

  -- 7. lookups that produced no code. A handful is ordinary: people mistype
  -- their address or forget which one they enrolled with. Hundreds is
  -- somebody working through a list of addresses.
  select count(*) into v_n from sign_in_attempts
   where outcome in ('not_enrolled','rate_limited_email','rate_limited_ip','rate_limited_site')
     and at > now() - interval '1 hour';
  v_sev := case when v_n >= 200 then 'alarm' when v_n >= 50 then 'warn' else 'ok' end;
  insert into _h values (120,'sign in attempts that sent nothing, last hour', v_sev, v_n::text,
    'Mostly mistyped addresses. A sudden pile is somebody testing a list of addresses to see who is enrolled.');

  -- 8. sign up answers that were refused. Added by file 16.
  --
  -- When the About you answers break a rule the account is kept and the
  -- answers are dropped, which is right for the learner and completely
  -- invisible to us. Anything but zero here means somebody signed up
  -- and we threw their answers away; the reason is in
  -- lms_system_heartbeat.
  select count(*) into v_n from lms_system_heartbeat
   where name = 'signup_answers_refused' and at > now() - interval '7 days';
  v_sev := case when v_n > 0 then 'warn' else 'ok' end;
  insert into _h values (130,'sign up answers refused, last 7 days', v_sev, v_n::text,
    'The account was kept and nothing was stored. Read lms_system_heartbeat for the reason. A run of these usually means the form and the database have stopped agreeing about a rule.');

  -- every reference to the temporary table is qualified, because this
  -- function's own output columns are called item, severity and value too
  select case when bool_or(h.severity='alarm') then 'alarm'
              when bool_or(h.severity='warn') then 'warn' else 'ok' end
    into v_worst from _h h;

  return query select 'OVERALL'::text, v_worst,
    (select count(*)::text || ' checks, ' ||
            count(*) filter (where h.severity='alarm')::text || ' alarm, ' ||
            count(*) filter (where h.severity='warn')::text || ' warn' from _h h),
    'Look at this row first. If it says ok, nothing below needs reading.'::text;
  return query select h.item, h.severity, h.value, h.detail from _h h order by h.ord;
end $$;

do $$ begin raise notice 'Step 15c: countries and states are checked against a list, abandoned sign ups are deleted nightly, and a refused sign up shows up in system_health.'; end $$;

-- ---------------------------------------------------------------------
-- STEP 16  PERMISSIONS, CHECKED NOT ASSUMED
--
-- SUPABASE GRANTS EVERY NEW TABLE IN public TO anon AND authenticated
-- BY DEFAULT, and that default is the opposite of what anybody wants.
-- Seven of the tables this file creates are reference data that the
-- public pages read through security definer functions and that nobody
-- should be able to write: lms_areas, lms_area_tools, lms_course_areas,
-- lms_course_next, lms_lesson_chapters, lms_countries and
-- lms_ng_states.
--
-- Left alone, every signed in learner would have had INSERT, UPDATE and
-- DELETE on all seven, with no row level security in the way. A learner
-- could have renamed an area, emptied the landing picker, moved a
-- course into another area, rewritten the chapters of a lesson or
-- invented a country.
--
-- file 10 tidy pass does not reach these, because it revokes write
-- privileges from anon and these were granted to authenticated. So
-- they are named here, one by one, and then the tidy pass runs as a
-- second sweep over everything else.
-- ---------------------------------------------------------------------
do $$
declare
  v_t text;
  v_n integer;
begin
  foreach v_t in array array[
    'lms_areas','lms_area_tools','lms_course_areas','lms_course_next','lms_lesson_chapters',
    'lms_countries','lms_ng_states'
  ] loop
    execute format('alter table public.%I enable row level security', v_t);
    execute format('revoke all on public.%I from anon, authenticated', v_t);

    -- Read for everyone who is signed in, so a staff screen can list
    -- them without a function for every lookup. The public pages do not
    -- need even this: they come through lms_public_catalogue,
    -- lms_public_course and lms_public_landing, which are security
    -- definer and run as the owner.
    execute format('grant select on public.%I to authenticated', v_t);

    execute format('drop policy if exists p_%s_read on public.%I', v_t, v_t);
    execute format('create policy p_%s_read on public.%I for select to authenticated using (true)', v_t, v_t);

    -- Writing is staff only, and there is no policy for anybody else,
    -- so there is nothing for a learner to find.
    execute format('grant insert, update, delete on public.%I to authenticated', v_t);
    execute format('drop policy if exists p_%s_write on public.%I', v_t, v_t);
    execute format('create policy p_%s_write on public.%I for all to authenticated using (lms_is_staff()) with check (lms_is_staff())', v_t, v_t);
  end loop;

  select tables_tidied into v_n from lms_tidy_table_privileges();
  raise notice 'Step 16: locked down 7 reference tables, then checked permissions on % Academy tables and views.', v_n;
end $$;

-- =====================================================================
-- STEP 17. THE HEADLINE SAYS SKILL, NOT TOOL
-- =====================================================================
--
-- File 02 set the landing headline's default to "Learn one tool at a
-- time." The Academy teaches skills as well as tools now, and item 6 of
-- the brief makes "Learn one skill at a time." the headline.
--
-- ONLY WHERE IT IS STILL THE OLD DEFAULT, EXACTLY. The whole point of
-- keeping the headline in lms_settings is that staff can change it
-- without a deployment. If somebody has already written their own, a
-- blanket update would throw their words away, and they would have no
-- way of knowing a database file had done it. So the update is
-- conditional on the string still being the one nobody chose, which also
-- makes this step safe to run twice: the second run matches nothing.
--
-- The column default moves too, so a project that installs file 02 fresh
-- and then file 16 does not end up with the old wording waiting in the
-- default for the first row somebody inserts.
--
-- The same sentence is written once more outside the database, as the
-- fallback in api/_seo-rules.js, for the case where lms_settings has no
-- row at all and a crawler still has to be given an h1. That copy is
-- changed in the same package, and tests/academy-meta.test.mjs fails if
-- the two ever stop agreeing.
do $$
declare
  v_old constant text := 'Learn one tool at a time.';
  v_new constant text := 'Learn one skill at a time.';
  v_n   integer;
begin
  execute format('alter table lms_settings alter column headline set default %L', v_new);

  update lms_settings set headline = v_new where headline = v_old;
  get diagnostics v_n = row_count;

  if v_n > 0 then
    raise notice 'Step 17: headline updated to "%" on % row(s).', v_new, v_n;
  elsif exists (select 1 from lms_settings where headline <> v_new) then
    raise notice 'Step 17: headline left alone. Somebody has written their own, and that is not ours to overwrite.';
  else
    raise notice 'Step 17: headline already "%", nothing to do.', v_new;
  end if;
end $$;

commit;
