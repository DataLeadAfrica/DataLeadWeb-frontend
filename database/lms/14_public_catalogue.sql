-- =====================================================================
-- FILE 14. Two leaks closed, and the public catalogue the Academy's
--          open pages are built from.
--
-- Run this in the Supabase SQL editor, after files 01 to 07, 10, 11, 12
-- and 13. It is safe to run twice. Read every notice it prints.
--
-- =====================================================================
-- PART A. TWO WAYS A STRANGER CAN READ WHAT THEY SHOULD NOT
-- =====================================================================
--
-- Both were found by loading files 01 to 12 into a plain PostgreSQL and
-- reading as the anon role. Both are real today, on the live database,
-- and anybody with the publishable key can do them from a phone.
--
-- LEAK 1. Every lesson's video id is readable by anybody.
--
--   grant select on ... lms_lessons ... to anon, authenticated;
--
-- is a grant on the WHOLE table, every column. The row policy
-- p_lessons_public then lets anon see every lesson of every published
-- course. So video_ref and content_md come back with the rest.
--
-- File 10 says the reference is "useless without lms_lesson_is_open".
-- That is true of a player and false of YouTube. An unlisted video is
-- not a private one: paste the id after youtube.com/watch?v= and it
-- plays, for anybody, for ever. One request with the public key returns
-- the id of every paid video in the Academy.
--
-- The fix is to stop granting the whole table and grant the columns a
-- shop window needs. Titles, lengths and positions stay readable, so the
-- syllabus on the course page still works. The video and the lesson body
-- stop being readable at all, by anybody, through the table.
--
-- Granting columns rather than the table also fails safe: a column added
-- later is NOT granted until somebody says so, where a table wide grant
-- would have handed it over the moment it existed.
--
-- LEAK 2. Draft courses are readable by anybody.
--
-- lms_course_cards is a view, and a view in PostgreSQL runs with its
-- OWNER's rights unless it is told otherwise. The owner is the superuser
-- who created it, and row security does not apply to the owner. So the
-- policy that hides draft courses on lms_courses is simply not consulted
-- when somebody reads them through the view. As anon, the view returned
-- unfinished courses with their titles and their prices.
--
-- One setting fixes it: security_invoker = true makes the view run with
-- the rights of whoever is reading, so the policy applies again.
--
-- WHY THE LEAKS ARE WORTH SPELLING OUT AT THIS LENGTH: both are the kind
-- that a reader of the code would not notice, because in both cases the
-- line that grants too much looks exactly like the line that grants the
-- right amount. The tests in tests/file_14_tests.sql read as the real
-- anon role and fail before this file is applied.
--
-- =====================================================================
-- PART B. THE REPLACEMENT WAY TO REACH A VIDEO
-- =====================================================================
-- With the column grants in place, nothing can read video_ref at all, so
-- Phase 4's player needs a door. lms_open_lesson is that door: it asks
-- lms_lesson_is_open first and returns nothing when the answer is no.
-- lms_staff_lesson is the same for the Phase 6 control room, gated on
-- lms_is_staff.
--
-- =====================================================================
-- PART C. WHAT A COURSE PAGE NEEDS AND THE DATABASE DOES NOT HOLD
-- =====================================================================
-- outcomes, audience, prerequisites, faq, seo_title, seo_description.
-- The publish checklist refuses a course with an empty summary or fewer
-- than three outcomes, because a course page with nothing on it is worse
-- for us in search than no page at all.
--
-- =====================================================================
-- PART D. ONE CALL FOR THE CATALOGUE, ONE FOR A COURSE
-- =====================================================================
-- lms_public_catalogue() and lms_public_course(slug). The pages and the
-- edge function that writes the search engine's copy BOTH use these, so
-- what a crawler reads and what a person reads cannot drift apart.
-- =====================================================================


-- =====================================================================
-- STEP 0  Check this database is the one this file was written for.
--         Nothing is changed until every check has passed.
-- =====================================================================
do $$
declare
  v_missing text[] := '{}';
  v_nm text;
begin
  foreach v_nm in array array['lms_is_admin','lms_is_staff','lms_lesson_is_open',
                              'lms_has_course_access','lms_course_blockers',
                              'lms_publish_course','lms_tidy_table_privileges',
                              'lms_claim_course_certificate'] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = v_nm) then
      v_missing := v_missing || ('function ' || v_nm || ', from file 05, 10 or 13')::text;
    end if;
  end loop;

  foreach v_nm in array array['lms_courses','lms_modules','lms_lessons','lms_quizzes',
                              'lms_paths','lms_path_courses','lms_settings'] loop
    if not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = v_nm) then
      v_missing := v_missing || ('table ' || v_nm)::text;
    end if;
  end loop;

  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relkind = 'v'
                    and c.relname = 'lms_course_cards') then
    v_missing := v_missing || 'view lms_course_cards, from file 05'::text;
  end if;

  -- The columns this file grants by name. If one of them has been
  -- renamed, the grant below would silently miss it and the course page
  -- would lose part of its syllabus.
  foreach v_nm in array array['id','module_id','title','summary','type','position',
                              'duration_seconds','bucket_seconds','coverage_percent',
                              'video_provider','video_ref','content_md',
                              'created_at','updated_at'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'lms_lessons'
                      and column_name = v_nm) then
      v_missing := v_missing || ('lms_lessons.' || v_nm)::text;
    end if;
  end loop;

  if array_length(v_missing, 1) > 0 then
    raise exception E'This database is not ready for file 14. Missing or different:\n  %\n\nNothing has been changed.',
      array_to_string(v_missing, E'\n  ');
  end if;
  raise notice 'Step 0: this database is ready for file 14.';
end $$;


-- =====================================================================
-- STEP 1  LEAK 1. Stop granting the whole lessons table.
-- =====================================================================
--
-- The order matters. Revoke first, then grant the columns, so there is
-- no moment where the table is open and no moment where the syllabus is
-- unreadable longer than one statement.
--
-- WHAT IS DELIBERATELY NOT IN THE LIST: video_provider, video_ref and
-- content_md. video_provider is left out as well as video_ref, because
-- knowing a lesson is on YouTube is a small clue and it costs the pages
-- nothing to withhold it: the only thing that needs it is the player,
-- which goes through lms_open_lesson.
-- =====================================================================
revoke select on lms_lessons from anon, authenticated;

grant select (
  id, module_id, title, summary, type, position,
  duration_seconds, bucket_seconds, coverage_percent,
  created_at, updated_at
) on lms_lessons to anon, authenticated;

do $$
declare v_left text;
begin
  select string_agg(column_name, ', ' order by column_name) into v_left
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'lms_lessons'
     and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
     and column_name in ('video_ref', 'video_provider', 'content_md');
  if v_left is not null then
    raise exception 'Step 1 did not take: % is still readable.', v_left;
  end if;
  raise notice 'Step 1: lms_lessons is now granted by column. The video reference and the lesson body are readable by nobody through the table.';
end $$;


-- =====================================================================
-- STEP 2  LEAK 2. Make the view run with the reader's own rights.
-- =====================================================================
alter view lms_course_cards set (security_invoker = true);

do $$
declare v_on boolean;
begin
  select coalesce((select split_part(o, '=', 2)::boolean
                     from unnest(c.reloptions) o
                    where split_part(o, '=', 1) = 'security_invoker'), false)
    into v_on
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'lms_course_cards';
  if not v_on then
    raise exception 'Step 2 did not take: lms_course_cards still runs as its owner.';
  end if;
  raise notice 'Step 2: lms_course_cards now runs with the rights of whoever reads it, so draft courses are hidden again.';
end $$;


-- =====================================================================
-- STEP 3  The sweep. Nothing else may be reading these with the
--         caller's rights.
-- =====================================================================
do $$
declare v_views text; v_funcs text;
begin
  select string_agg(c.relname, ', ') into v_views
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v' and c.relname like 'lms\_%'
     and not coalesce((select split_part(o, '=', 2)::boolean
                         from unnest(c.reloptions) o
                        where split_part(o, '=', 1) = 'security_invoker'), false);
  if v_views is not null then
    raise exception 'Step 3: these views still run as their owner, so row security does not apply to them: %', v_views;
  end if;

  select string_agg(p.proname, ', ') into v_funcs
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'lms\_%'
     and (p.prosrc ilike '%video_ref%' or p.prosrc ilike '%content_md%')
     and p.prosecdef = false;
  if v_funcs is not null then
    raise exception 'Step 3: these functions read the video or the lesson body with the caller''s own rights: %', v_funcs;
  end if;

  raise notice 'Step 3: swept every lms_ view and function. Nothing else reaches the video with the caller''s rights.';
end $$;


-- =====================================================================
-- STEP 4  The door to a video, for the Phase 4 player.
-- =====================================================================
-- SECURITY DEFINER, because the caller can no longer read the column at
-- all. The check is lms_lesson_is_open, which is the same rule the rest
-- of the Academy uses: a published course, and either free, or a free
-- first module, or an entitlement.
--
-- It returns no row rather than an empty one when the answer is no, so a
-- page cannot accidentally render an empty player and look broken.
--
-- Granted to authenticated only. A free first module is readable by
-- anybody who signs up, which takes a minute, and keeping the door shut
-- to anon means one fewer way to harvest ids in bulk.
-- =====================================================================
create or replace function lms_open_lesson(p_lesson uuid)
returns table (
  lesson_id uuid,
  title text,
  video_provider text,
  video_ref text,
  content_md text,
  duration_seconds integer,
  bucket_seconds integer,
  coverage_percent integer
)
language sql stable security definer set search_path = public as $$
  select l.id, l.title, l.video_provider, l.video_ref, l.content_md,
         l.duration_seconds, l.bucket_seconds, l.coverage_percent
    from lms_lessons l
   where l.id = p_lesson
     and lms_lesson_is_open(p_lesson)
$$;

revoke all on function lms_open_lesson(uuid) from public, anon;
grant execute on function lms_open_lesson(uuid) to authenticated;


-- =====================================================================
-- STEP 5  The same, for staff, for the Phase 6 control room.
-- =====================================================================
-- Staff need to see a draft lesson exactly as it is, including the video
-- that has not been published yet, which is the one thing lms_open_lesson
-- will never return.
-- =====================================================================
create or replace function lms_staff_lesson(p_lesson uuid)
returns table (
  lesson_id uuid,
  module_id uuid,
  title text,
  summary text,
  type lms_lesson_type,
  -- "position" cannot name a column in RETURNS TABLE: PostgreSQL reads it
  -- as the start of the POSITION(x IN y) function.
  lesson_position integer,
  video_provider text,
  video_ref text,
  content_md text,
  duration_seconds integer,
  bucket_seconds integer,
  coverage_percent integer
)
language sql stable security definer set search_path = public as $$
  select l.id, l.module_id, l.title, l.summary, l.type, l.position,
         l.video_provider, l.video_ref, l.content_md,
         l.duration_seconds, l.bucket_seconds, l.coverage_percent
    from lms_lessons l
   where l.id = p_lesson
     and lms_is_staff()
$$;

revoke all on function lms_staff_lesson(uuid) from public, anon;
grant execute on function lms_staff_lesson(uuid) to authenticated;


-- =====================================================================
-- STEP 6  What a course page needs and the database does not hold.
-- =====================================================================
alter table lms_courses
  add column if not exists outcomes text[] not null default '{}',
  add column if not exists audience text[] not null default '{}',
  add column if not exists prerequisites text[] not null default '{}',
  add column if not exists faq jsonb not null default '[]'::jsonb,
  add column if not exists seo_title text,
  add column if not exists seo_description text;

create or replace function lms_faq_is_valid(p_faq jsonb)
returns boolean
language sql immutable set search_path = public as $$
  select jsonb_typeof(p_faq) = 'array'
     and not exists (
       select 1 from jsonb_array_elements(p_faq) e
        where jsonb_typeof(e) <> 'object'
           or coalesce(btrim(e ->> 'question'), '') = ''
           or coalesce(btrim(e ->> 'answer'), '') = ''
     )
$$;

-- The two length rules. A title Google cuts in half is worse than a
-- shorter one that reads whole, and the only reliable place to enforce
-- that is here: a rule kept only in the editor is a rule until somebody
-- uses the API.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lms_courses_seo_title_len') then
    alter table lms_courses add constraint lms_courses_seo_title_len
      check (seo_title is null or char_length(seo_title) <= 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lms_courses_seo_desc_len') then
    alter table lms_courses add constraint lms_courses_seo_desc_len
      check (seo_description is null or char_length(seo_description) <= 155);
  end if;
  -- The FAQ has to be a list of question and answer pairs, or the course
  -- page and the edge function both have to guess what to do with it.
  -- A CHECK cannot contain a subquery, so the rule lives in a small
  -- immutable function and the constraint calls it.
  if not exists (select 1 from pg_constraint where conname = 'lms_courses_faq_shape') then
    alter table lms_courses add constraint lms_courses_faq_shape
      check (lms_faq_is_valid(faq));
  end if;
end $$;

-- The new columns are readable by the public, because they are the
-- course page. lms_courses is still granted table wide, which is correct
-- for this table: every column on it is a shop window.
grant select on lms_courses to anon, authenticated;

do $$
declare v_n integer;
begin
  select count(*) into v_n from information_schema.columns
   where table_schema = 'public' and table_name = 'lms_courses'
     and column_name in ('outcomes','audience','prerequisites','faq',
                         'seo_title','seo_description');
  if v_n <> 6 then
    raise exception 'Step 6 did not take: only % of the 6 new columns exist.', v_n;
  end if;
  raise notice 'Step 6: lms_courses now holds outcomes, audience, prerequisites, faq, seo_title and seo_description.';
end $$;


-- =====================================================================
-- STEP 7  The publish checklist learns about outcomes.
-- =====================================================================
-- Everything from file 13 is kept, word for word, and one rule is added.
-- Three outcomes is not an arbitrary number: it is the smallest list that
-- reads as a list rather than as an afterthought, and the course page
-- lays them out in a grid that looks wrong with one.
--
-- The empty summary rule the brief asks for is already here, as "Has a
-- short description", and has been since file 05.
-- =====================================================================
create or replace function lms_course_blockers(p_course uuid)
returns table(ok boolean, label text)
language sql stable security definer set search_path = public as $function$
  with c as (select * from lms_courses where id = p_course),
  m as (select count(*) n from lms_modules where course_id = p_course),
  l as (select count(*) n from lms_lessons le
          join lms_modules mo on mo.id = le.module_id where mo.course_id = p_course),
  novid as (select count(*) n,
                   string_agg(coalesce(nullif(btrim(le.title),''),'untitled'), ', ' order by le.title) as names
              from lms_lessons le
              join lms_modules mo on mo.id = le.module_id
             where mo.course_id = p_course and le.type = 'video'
               and (le.video_ref is null or le.duration_seconds is null)),
  emptyq as (
    select count(*) n,
           string_agg(coalesce(nullif(btrim(q.title),''),'untitled'), ', '
                      order by q.title) as names
      from lms_quizzes q
     where (q.lesson_id in (select le.id from lms_lessons le
                             join lms_modules mo on mo.id = le.module_id
                            where mo.course_id = p_course)
            or q.module_id in (select id from lms_modules where course_id = p_course))
       and not exists (select 1 from lms_questions qq
                        where qq.quiz_id = q.id and qq.active))
  select btrim(coalesce((select title from c),'')) <> '', 'Has a title'
  union all select btrim(coalesce((select summary from c),'')) <> '',
    case when btrim(coalesce((select summary from c),'')) <> ''
         then 'Has a short description'
         else 'Has a short description. It is the sentence under the heading '
              || 'on the course page, and the one search engines show.'
    end
  union all select btrim(coalesce((select tool from c),'')) <> '', 'Has a tool'
  union all select (select n from m) > 0, 'Has at least one module'
  union all select (select n from l) > 0, 'Has at least one lesson'
  union all select coalesce(array_length((select outcomes from c), 1), 0) >= 3,
    case when coalesce(array_length((select outcomes from c), 1), 0) >= 3
         then 'Has at least three things a learner will be able to do'
         else 'Has at least three things a learner will be able to do. '
              || 'There are currently '
              || coalesce(array_length((select outcomes from c), 1), 0)
              || '. They are the first thing people read on the course page, '
              || 'and the words they searched for.'
    end
  union all select (select n from novid) = 0,
    case when (select n from novid) = 0
         then 'Every video lesson has its video and its length'
         else 'Every video lesson has its video and its length. Still missing: '
              || (select names from novid)
              || '. Without the length the non skippable rule cannot work.'
    end
  union all select (select programme_id from c) is not null,
    case when (select programme_id from c) is not null
         then 'Has a programme, so a certificate can be issued'
         else 'Has a programme, so a certificate can be issued. '
              || 'Set lms_courses.programme_id, or a learner will finish this course '
              || 'and find there is no certificate at the end.'
    end
  union all select (select n from emptyq) = 0,
    case when (select n from emptyq) = 0
         then 'Every set of questions has at least one question'
         else 'Every set of questions has at least one question. Still empty: '
              || (select names from emptyq)
              || '. Add a question, or delete the empty set.'
    end
$function$;

grant execute on function lms_course_blockers(uuid) to anon, authenticated;


-- =====================================================================
-- STEP 8  One call for the catalogue.
-- =====================================================================
-- SECURITY DEFINER with an explicit published filter, rather than relying
-- on row security. Two reasons. It can count lessons and quizzes without
-- the caller needing to read those tables at all, which is the whole
-- point of step 1. And the filter is then one line a reader can check,
-- instead of a policy three files away.
--
-- The counts and the totals are worked out here, once, so the catalogue
-- page, the course page and the edge function that writes the search
-- engine's copy cannot disagree about how many lessons a course has.
-- =====================================================================
create or replace function lms_public_catalogue()
returns table (
  id uuid,
  slug text,
  title text,
  summary text,
  tool text,
  area text,
  level lms_level,
  cover_code text,
  price_kobo integer,
  first_module_free boolean,
  published_at timestamptz,
  updated_at timestamptz,
  module_count integer,
  lesson_count integer,
  quiz_count integer,
  total_seconds integer
)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.title, c.summary, c.tool, c.area, c.level, c.cover_code,
         c.price_kobo, c.first_module_free, c.published_at, c.updated_at,
         (select count(*)::integer from lms_modules m where m.course_id = c.id),
         (select count(*)::integer from lms_lessons l
            join lms_modules m on m.id = l.module_id where m.course_id = c.id),
         (select count(*)::integer from lms_quizzes q
            join lms_modules m on m.id = q.module_id
           where m.course_id = c.id and q.status = 'published'),
         coalesce((select sum(l.duration_seconds)::integer from lms_lessons l
            join lms_modules m on m.id = l.module_id where m.course_id = c.id), 0)
    from lms_courses c
   where c.status = 'published'
   order by c.published_at desc nulls last, c.title
$$;

revoke all on function lms_public_catalogue() from public;
grant execute on function lms_public_catalogue() to anon, authenticated;


-- =====================================================================
-- STEP 9  One call for a course page.
-- =====================================================================
-- The modules come back as JSON rather than as extra rows, because the
-- page draws them as a nested list and a flat result set would have to be
-- stitched back together in the browser and again in the edge function,
-- in two languages, from the same data. One shape, built once, here.
--
-- WHAT IS NOT IN IT: video_provider, video_ref, content_md. There is a
-- test that reads the argument names of this function and fails if any of
-- them ever looks like a video or a body.
-- =====================================================================
create or replace function lms_public_course(p_slug text)
returns table (
  id uuid,
  slug text,
  title text,
  summary text,
  tool text,
  area text,
  level lms_level,
  cover_code text,
  price_kobo integer,
  first_module_free boolean,
  outcomes text[],
  audience text[],
  prerequisites text[],
  faq jsonb,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  updated_at timestamptz,
  module_count integer,
  lesson_count integer,
  quiz_count integer,
  total_seconds integer,
  modules jsonb
)
language sql stable security definer set search_path = public as $$
  with c as (
    select * from lms_courses where slug = p_slug and status = 'published'
  ),
  mods as (
    select m.id, m.position, m.title, m.summary,
           coalesce((select sum(l.duration_seconds)::integer from lms_lessons l
                      where l.module_id = m.id), 0) as seconds,
           (select count(*)::integer from lms_lessons l where l.module_id = m.id) as lessons,
           (select count(*)::integer from lms_quizzes q
             where q.module_id = m.id and q.status = 'published') as quizzes,
           -- A free module is the first one of a course that says so.
           (select first_module_free from c) and m.position = 1 as free,
           coalesce((
             select jsonb_agg(jsonb_build_object(
                      'position', l.position,
                      'title', l.title,
                      'type', l.type,
                      'seconds', l.duration_seconds)
                    order by l.position)
               from lms_lessons l where l.module_id = m.id), '[]'::jsonb) as lesson_list
      from lms_modules m
     where m.course_id = (select id from c)
  )
  select c.id, c.slug, c.title, c.summary, c.tool, c.area, c.level, c.cover_code,
         c.price_kobo, c.first_module_free,
         c.outcomes, c.audience, c.prerequisites, c.faq,
         c.seo_title, c.seo_description,
         c.published_at, c.updated_at,
         (select count(*)::integer from mods),
         coalesce((select sum(lessons)::integer from mods), 0),
         coalesce((select sum(quizzes)::integer from mods), 0),
         coalesce((select sum(seconds)::integer from mods), 0),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'position', mods.position,
                    'title', mods.title,
                    'summary', mods.summary,
                    'seconds', mods.seconds,
                    'lessons', mods.lessons,
                    'quizzes', mods.quizzes,
                    'free', mods.free,
                    'lesson_list', mods.lesson_list)
                  order by mods.position)
             from mods), '[]'::jsonb)
    from c
$$;

revoke all on function lms_public_course(text) from public;
grant execute on function lms_public_course(text) to anon, authenticated;


-- =====================================================================
-- STEP 10  Tidy, the same way every other file ends.
-- =====================================================================
do $$
declare v_n integer;
begin
  select tables_tidied into v_n from lms_tidy_table_privileges();
  raise notice 'Step 10: tightened permissions on % Academy tables and views.', v_n;
end $$;

do $$ begin
  raise notice '';
  raise notice 'File 14 is applied. Now run 14_verify.sql and read every row.';
  raise notice 'Both leaks are closed: the video reference and the lesson body are no longer readable through the table, and draft courses are hidden from the catalogue view again.';
end $$;
