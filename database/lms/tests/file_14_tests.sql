-- ===========================================================================
-- FILE 14 TESTS
--
-- Run tests/seed_file_14_tests.sql first, then this file.
--
-- Written to FAIL before file 14 is applied and pass afterwards. The first
-- two are the reason the file exists: two ways a stranger with nothing but
-- the public key can read things they have not paid for and things that are
-- not finished.
--
-- Every test connects as a REAL role, anon or authenticated, and sets
-- request.jwt.claim.sub the way PostgREST does. A test that runs as the
-- owner proves nothing, because the owner is exactly who row security does
-- not apply to.
-- ===========================================================================

\set ON_ERROR_STOP off
\timing off
\pset pager off

-- A real table, not a temporary one, and granted to the roles the tests
-- run as. A test that cannot write down its own result fails silently,
-- which is the worst kind of failure a test suite can have.
drop table if exists t14_results;
create table t14_results (n integer primary key, name text, pass boolean, detail text);
grant all on t14_results to anon, authenticated;

create or replace function t_say(p_n integer, p_name text, p_pass boolean,
                                 p_detail text default '')
returns void language sql as $$
  insert into t14_results values (p_n, p_name, coalesce(p_pass, false), p_detail)
  on conflict (n) do update set name = excluded.name, pass = excluded.pass,
                                detail = excluded.detail;
$$;
grant execute on function t_say(integer, text, boolean, text) to anon, authenticated;

-- auth.users is not readable by anon, so the three ids are looked up once,
-- as the owner, and kept where every test can reach them.
drop table if exists t14_who;
create table t14_who (k text primary key, id uuid);
insert into t14_who
select case when email like 'nobody%' then 'nobody'
            when email like 'buyer%'  then 'buyer'
            else 'admin' end, id
  from auth.users where email like '%14@example.com';
grant select on t14_who to anon, authenticated;

-- ===========================================================================
-- A. THE TWO LEAKS
-- ===========================================================================

-- --------------------------------------------------------------------- A1
-- A visitor who has never signed up must not be able to read video_ref.
-- An unlisted YouTube id is not a secret once you have it: paste it after
-- youtube.com/watch?v= and the video plays. The comment in file 10 said the
-- reference was useless without lms_lesson_is_open. That is true for a
-- player and false for YouTube.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare v_leaked integer := 0;
begin
  begin
    select count(*) into v_leaked from lms_lessons where video_ref is not null;
  exception when insufficient_privilege then
    v_leaked := -1;   -- what we want: the column is not readable at all
  end;
  perform t_say(1, 'anon cannot read lms_lessons.video_ref',
                v_leaked = -1,
                case when v_leaked = -1 then 'permission denied, correct'
                     else v_leaked || ' video references readable by anon' end);
end $$;
reset role;

-- --------------------------------------------------------------------- A2
-- The same for content_md, which holds the lesson notes.
set role anon;
do $$
declare v_leaked integer := 0;
begin
  begin
    select count(*) into v_leaked from lms_lessons where content_md is not null;
  exception when insufficient_privilege then
    v_leaked := -1;
  end;
  perform t_say(2, 'anon cannot read lms_lessons.content_md',
                v_leaked = -1,
                case when v_leaked = -1 then 'permission denied, correct'
                     else v_leaked || ' lesson bodies readable by anon' end);
end $$;
reset role;

-- --------------------------------------------------------------------- A3
-- A signed in learner with no entitlement is in exactly the same position
-- as a stranger. Paying is what opens a video, and signing up is not paying.
set role authenticated;
select set_config('request.jwt.claim.sub',
                  (select id::text from t14_who where k = 'nobody'), false);
do $$
declare v_leaked integer := 0;
begin
  begin
    select count(*) into v_leaked from lms_lessons where video_ref is not null;
  exception when insufficient_privilege then
    v_leaked := -1;
  end;
  perform t_say(3, 'a signed in learner with no access cannot read video_ref',
                v_leaked = -1,
                case when v_leaked = -1 then 'permission denied, correct'
                     else v_leaked || ' video references readable' end);
end $$;
reset role;

-- --------------------------------------------------------------------- A4
-- The syllabus must still work. Titles and lengths are the shop window and
-- have to stay readable, or the course page has nothing to show.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare v_titles integer;
begin
  select count(*) into v_titles
    from lms_lessons l join lms_modules m on m.id = l.module_id
    join lms_courses c on c.id = m.course_id
   where c.slug = 't14-published' and l.title is not null;
  perform t_say(4, 'anon can still read lesson titles and lengths',
                v_titles = 3, v_titles || ' of 3 lesson titles readable');
exception when insufficient_privilege then
  perform t_say(4, 'anon can still read lesson titles and lengths', false,
                'the fix went too far: titles are not readable either');
end $$;
reset role;

-- --------------------------------------------------------------------- A5
-- lms_course_cards is a view. A view without security_invoker runs with its
-- OWNER's rights, so row security on lms_courses never applies to anybody
-- reading through it. That is how a draft course, with its title and its
-- price, was readable by anon.
set role anon;
do $$
declare v_drafts integer;
begin
  select count(*) into v_drafts from lms_course_cards where status <> 'published';
  perform t_say(5, 'anon cannot see draft courses through lms_course_cards',
                v_drafts = 0, v_drafts || ' draft courses visible to anon');
exception when insufficient_privilege then
  perform t_say(5, 'anon cannot see draft courses through lms_course_cards',
                true, 'no access to the view at all, which is also fine');
end $$;
reset role;

-- --------------------------------------------------------------------- A6
-- And the published one is still there, or the fix has broken the catalogue.
set role anon;
do $$
declare v_pub integer;
begin
  select count(*) into v_pub from lms_course_cards where slug = 't14-published';
  perform t_say(6, 'anon can still see published courses through the view',
                v_pub = 1, v_pub || ' published course visible');
exception when others then
  perform t_say(6, 'anon can still see published courses through the view', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;
reset role;

-- ===========================================================================
-- B. THE REPLACEMENT WAY IN
-- ===========================================================================

-- --------------------------------------------------------------------- B1
-- lms_open_lesson hands over the video only when lms_lesson_is_open agrees.
-- For a learner with no access, that is never.
set role authenticated;
select set_config('request.jwt.claim.sub',
                  (select id::text from t14_who where k = 'nobody'), false);
do $$
declare v_ref text;
begin
  select video_ref into v_ref from lms_open_lesson(
    (select l.id from lms_lessons l join lms_modules m on m.id = l.module_id
      join lms_courses c on c.id = m.course_id
     where c.slug = 't14-published' and m.position = 2 limit 1));
  perform t_say(7, 'lms_open_lesson gives no video to somebody without access',
                v_ref is null, coalesce('returned ' || v_ref, 'returned null, correct'));
exception when others then
  perform t_say(7, 'lms_open_lesson gives no video to somebody without access', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;
reset role;

-- --------------------------------------------------------------------- B2
-- The same learner, now entitled, gets it.
set role authenticated;
select set_config('request.jwt.claim.sub',
                  (select id::text from t14_who where k = 'buyer'), false);
do $$
declare v_ref text;
begin
  select video_ref into v_ref from lms_open_lesson(
    (select l.id from lms_lessons l join lms_modules m on m.id = l.module_id
      join lms_courses c on c.id = m.course_id
     where c.slug = 't14-published' and m.position = 2 limit 1));
  perform t_say(8, 'lms_open_lesson gives the video to somebody with access',
                v_ref = 'VIDEOTHREE', coalesce('returned ' || v_ref, 'returned null'));
exception when others then
  perform t_say(8, 'lms_open_lesson gives the video to somebody with access', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;
reset role;

-- --------------------------------------------------------------------- B3
-- A free first module is open to anybody signed in, which is what
-- first_module_free means. Lesson 1 is in module 1 of a course that has it.
set role authenticated;
select set_config('request.jwt.claim.sub',
                  (select id::text from t14_who where k = 'nobody'), false);
do $$
declare v_ref text;
begin
  select video_ref into v_ref from lms_open_lesson(
    (select l.id from lms_lessons l join lms_modules m on m.id = l.module_id
      join lms_courses c on c.id = m.course_id
     where c.slug = 't14-published' and m.position = 1 and l.position = 1));
  perform t_say(9, 'the free first module opens without paying',
                v_ref = 'VIDEOONE', coalesce('returned ' || v_ref, 'returned null'));
exception when others then
  perform t_say(9, 'the free first module opens without paying', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;
reset role;

-- --------------------------------------------------------------------- B4
-- anon cannot call it at all. There is no signed in person to check.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare v_ok boolean := false;
begin
  perform * from lms_open_lesson(
    (select l.id from lms_lessons l join lms_modules m on m.id = l.module_id
      join lms_courses c on c.id = m.course_id
     where c.slug = 't14-published' and l.position = 1 limit 1));
  v_ok := false;
exception when insufficient_privilege then
  v_ok := true;
end $$;
reset role;
do $$ begin
  perform t_say(10, 'anon cannot execute lms_open_lesson',
    not exists (select 1 from information_schema.role_routine_grants
                 where grantee = 'anon' and routine_name = 'lms_open_lesson'),
    'checked the grant directly');
exception when others then
  perform t_say(10, 'anon cannot execute lms_open_lesson', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;

-- --------------------------------------------------------------------- B5
-- Staff can read a lesson whole, for the Phase 6 control room.
set role authenticated;
select set_config('request.jwt.claim.sub',
                  (select id::text from t14_who where k = 'admin'), false);
do $$
declare v_ref text;
begin
  select video_ref into v_ref from lms_staff_lesson(
    (select l.id from lms_lessons l join lms_modules m on m.id = l.module_id
      join lms_courses c on c.id = m.course_id
     where c.slug = 't14-draft' limit 1));
  perform t_say(11, 'staff can read a draft lesson whole',
                v_ref = 'DRAFTVIDEO', coalesce('returned ' || v_ref, 'returned null'));
exception when others then
  perform t_say(11, 'staff can read a draft lesson whole', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;
reset role;

-- --------------------------------------------------------------------- B6
-- And a learner cannot, however they ask.
set role authenticated;
select set_config('request.jwt.claim.sub',
                  (select id::text from t14_who where k = 'buyer'), false);
do $$
declare v_rows integer := -1;
begin
  select count(*) into v_rows from lms_staff_lesson(
    (select l.id from lms_lessons l join lms_modules m on m.id = l.module_id
      join lms_courses c on c.id = m.course_id
     where c.slug = 't14-draft' limit 1));
  perform t_say(12, 'a learner gets nothing from lms_staff_lesson',
                v_rows = 0, v_rows || ' rows returned');
exception
  when insufficient_privilege then
    perform t_say(12, 'a learner gets nothing from lms_staff_lesson', true,
                  'permission denied, also correct');
  when others then
    perform t_say(12, 'a learner gets nothing from lms_staff_lesson', false,
                  'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;
reset role;

-- ===========================================================================
-- C. THE PUBLIC CATALOGUE FUNCTIONS
-- ===========================================================================

-- --------------------------------------------------------------------- C1
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare v_rows integer; v_drafts integer;
begin
  select count(*) into v_rows from lms_public_catalogue();
  select count(*) into v_drafts from lms_public_catalogue() where slug = 't14-draft';
  perform t_say(13, 'lms_public_catalogue returns published courses only',
                v_rows >= 1 and v_drafts = 0,
                v_rows || ' rows, ' || v_drafts || ' of them drafts');
exception when others then
  perform t_say(13, 'lms_public_catalogue returns published courses only', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;
reset role;

-- --------------------------------------------------------------------- C2
-- The counts have to be right, because the page and the edge function both
-- show them and a visitor comparing the two would spot a difference.
set role anon;
do $$
declare r record;
begin
  select * into r from lms_public_catalogue() where slug = 't14-published';
  perform t_say(14, 'the catalogue counts lessons, modules, quizzes and seconds',
                r.lesson_count = 3 and r.module_count = 2 and r.quiz_count = 1
                  and r.total_seconds = 900,
                format('lessons %s, modules %s, quizzes %s, seconds %s',
                       r.lesson_count, r.module_count, r.quiz_count, r.total_seconds));
exception when others then
  perform t_say(14, 'the catalogue counts lessons, modules, quizzes and seconds', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;
reset role;

-- --------------------------------------------------------------------- C3
-- No column in the catalogue may carry a video reference or a lesson body.
do $$
declare v_bad text;
begin
  select string_agg(p.proname || '.' || a.name, ', ') into v_bad
    from pg_proc p
    cross join lateral unnest(coalesce(p.proargnames, '{}')) with ordinality as a(name, ord)
   where p.proname in ('lms_public_catalogue', 'lms_public_course')
     and (a.name ilike '%video%' or a.name ilike '%content%');
  perform t_say(15, 'no public function returns a video reference or a body',
                v_bad is null, coalesce(v_bad, 'none, correct'));
exception when others then
  perform t_say(15, 'no public function returns a video reference or a body', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;

-- --------------------------------------------------------------------- C4
set role anon;
do $$
declare r record;
begin
  select * into r from lms_public_course('t14-published');
  perform t_say(16, 'lms_public_course returns the course by slug',
                r.title = 'T14 published course' and array_length(r.outcomes, 1) = 3,
                format('title %L, %s outcomes', r.title, array_length(r.outcomes, 1)));
exception when others then
  perform t_say(16, 'lms_public_course returns the course by slug', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;
reset role;

-- --------------------------------------------------------------------- C5
-- A draft slug returns nothing. The edge function turns that into a real
-- 404, which is what keeps unfinished work out of search results.
set role anon;
do $$
declare v_rows integer;
begin
  select count(*) into v_rows from lms_public_course('t14-draft');
  perform t_say(17, 'lms_public_course returns nothing for a draft slug',
                v_rows = 0, v_rows || ' rows');
exception when others then
  perform t_say(17, 'lms_public_course returns nothing for a draft slug', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;
reset role;

-- --------------------------------------------------------------------- C6
set role anon;
do $$
declare v_rows integer;
begin
  select count(*) into v_rows from lms_public_course('no-such-course-at-all');
  perform t_say(18, 'lms_public_course returns nothing for an unknown slug',
                v_rows = 0, v_rows || ' rows');
exception when others then
  perform t_say(18, 'lms_public_course returns nothing for an unknown slug', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;
reset role;

-- --------------------------------------------------------------------- C7
-- The per module totals the course map bar is drawn from.
set role anon;
do $$
declare v_mods jsonb;
begin
  select modules into v_mods from lms_public_course('t14-published');
  perform t_say(19, 'the course carries its modules with lessons and lengths',
                jsonb_array_length(v_mods) = 2
                  and (v_mods -> 0 -> 'lessons') is not null
                  and ((v_mods -> 0 ->> 'seconds')::int) > 0,
                'modules: ' || coalesce(jsonb_array_length(v_mods)::text, 'null'));
exception when others then
  perform t_say(19, 'the course carries its modules with lessons and lengths', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;
reset role;

-- ===========================================================================
-- D. THE NEW COLUMNS AND THE PUBLISH RULE
-- ===========================================================================

-- --------------------------------------------------------------------- D1
do $$
declare v_missing text;
begin
  select string_agg(c, ', ') into v_missing from unnest(array[
    'outcomes', 'audience', 'prerequisites', 'faq', 'seo_title', 'seo_description'
  ]) c
  where not exists (select 1 from information_schema.columns
                     where table_name = 'lms_courses' and column_name = c);
  perform t_say(20, 'lms_courses has the six new columns',
                v_missing is null, coalesce('missing: ' || v_missing, 'all present'));
exception when others then
  perform t_say(20, 'lms_courses has the six new columns', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;

-- --------------------------------------------------------------------- D2
do $$
declare v_unmet text[];
begin
  select array_agg(label) into v_unmet
    from lms_course_blockers((select id from lms_courses where slug = 't14-thin'))
   where not ok;
  perform t_say(21, 'a course with no summary cannot be published',
                exists (select 1 from unnest(v_unmet) b where b ilike '%description%'),
                coalesce(array_to_string(v_unmet, ' | '), 'nothing unmet'));
exception when others then
  perform t_say(21, 'a course with no summary cannot be published', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;

-- --------------------------------------------------------------------- D3
do $$
declare v_unmet text[];
begin
  select array_agg(label) into v_unmet
    from lms_course_blockers((select id from lms_courses where slug = 't14-thin'))
   where not ok;
  perform t_say(22, 'a course with fewer than three outcomes cannot be published',
                exists (select 1 from unnest(v_unmet) b where b ilike '%able to do%'),
                coalesce(array_to_string(v_unmet, ' | '), 'nothing unmet'));
exception when others then
  perform t_say(22, 'a course with fewer than three outcomes cannot be published', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;

-- --------------------------------------------------------------------- D4
do $$
declare v_blockers integer;
begin
  select count(*) into v_blockers
    from lms_course_blockers((select id from lms_courses where slug = 't14-published'))
   where not ok;
  perform t_say(23, 'the complete course has no blockers left',
                v_blockers = 0, v_blockers || ' things still unmet');
exception when others then
  perform t_say(23, 'the complete course has no blockers left', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;

-- --------------------------------------------------------------------- D5
-- seo_title and seo_description are only useful if they fit. The database
-- refuses anything longer rather than letting Google cut it mid word.
do $$
declare v_ok boolean := false;
begin
  begin
    update lms_courses set seo_title = repeat('x', 61) where slug = 't14-published';
    v_ok := false;
  exception when check_violation then
    v_ok := true;
  end;
  perform t_say(24, 'seo_title longer than 60 characters is refused', v_ok,
                case when v_ok then 'refused, correct' else 'accepted a 61 character title' end);
exception when others then
  perform t_say(24, 'seo_title longer than 60 characters is refused', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;

do $$
declare v_ok boolean := false;
begin
  begin
    update lms_courses set seo_description = repeat('x', 156) where slug = 't14-published';
    v_ok := false;
  exception when check_violation then
    v_ok := true;
  end;
  perform t_say(25, 'seo_description longer than 155 characters is refused', v_ok,
                case when v_ok then 'refused, correct' else 'accepted a 156 character description' end);
exception when others then
  perform t_say(25, 'seo_description longer than 155 characters is refused', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;

-- ===========================================================================
-- E. THE SWEEP: nothing anywhere reads the video with the caller's rights
-- ===========================================================================

-- --------------------------------------------------------------------- E1
-- Every function that mentions video_ref or content_md must either be
-- SECURITY DEFINER with its own check, or belong to staff. A plain stable
-- function running as the caller would hand the column straight back.
do $$
declare v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname like 'lms_%'
     and (p.prosrc ilike '%video_ref%' or p.prosrc ilike '%content_md%')
     and p.prosecdef = false;
  perform t_say(26, 'no function reads the video with the caller''s own rights',
                v_bad is null, coalesce('caller rights: ' || v_bad, 'none, correct'));
exception when others then
  perform t_say(26, 'no function reads the video with the caller''s own rights', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;

-- --------------------------------------------------------------------- E2
-- Every view that reads lms_lessons must be security_invoker, or it runs as
-- its owner and row security stops applying to anybody who reads it. That
-- is exactly what went wrong with lms_course_cards.
do $$
declare v_bad text;
begin
  select string_agg(c.relname, ', ') into v_bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v' and c.relname like 'lms_%'
     and not coalesce((select option_value::boolean from unnest(c.reloptions) o
                        cross join lateral (select split_part(o, '=', 1) as option_name,
                                                   split_part(o, '=', 2) as option_value) x
                       where option_name = 'security_invoker'), false);
  perform t_say(27, 'every lms_ view runs with the reader''s own rights',
                v_bad is null, coalesce('owner rights: ' || v_bad, 'none, correct'));
exception when others then
  perform t_say(27, 'every lms_ view runs with the reader''s own rights', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;

-- --------------------------------------------------------------------- E3
-- The column grant itself, read from the catalogue rather than inferred.
do $$
declare v_cols text;
begin
  select string_agg(column_name, ', ' order by column_name) into v_cols
    from information_schema.column_privileges
   where table_name = 'lms_lessons' and grantee = 'anon' and privilege_type = 'SELECT'
     and column_name in ('video_ref', 'video_provider', 'content_md');
  perform t_say(28, 'anon holds no column grant on the video or the body',
                v_cols is null, coalesce('still granted: ' || v_cols, 'none, correct'));
exception when others then
  perform t_say(28, 'anon holds no column grant on the video or the body', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;

-- --------------------------------------------------------------------- E4
-- And the table wide grant is gone, or a later ALTER TABLE adding a column
-- would quietly hand it over.
do $$
declare v_table_wide integer;
begin
  select count(*) into v_table_wide
    from information_schema.role_table_grants
   where table_name = 'lms_lessons' and grantee in ('anon', 'authenticated')
     and privilege_type = 'SELECT';
  perform t_say(29, 'there is no table wide select on lms_lessons',
                v_table_wide = 0,
                v_table_wide || ' table wide select grants remain');
exception when others then
  perform t_say(29, 'there is no table wide select on lms_lessons', false,
                'did not run: ' || replace(SQLERRM, chr(10), ' '));
end $$;

-- ===========================================================================
-- RESULTS
-- ===========================================================================
\echo ''
\echo '================ FILE 14 TESTS ================'
select n, case when pass then 'pass' else 'FAIL' end as result, name, detail
  from t14_results order by n;
select count(*) filter (where pass) as passed,
       count(*) filter (where not pass) as failed,
       count(*) as total
  from t14_results;
