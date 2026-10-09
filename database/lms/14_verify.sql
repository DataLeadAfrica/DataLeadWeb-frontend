-- =====================================================================
-- 14_verify.sql
--
-- Run this in the Supabase SQL editor straight after 14_public_catalogue.sql.
-- It changes nothing. Read every row: the answer column should say yes
-- on every single line. Anything else means the file did not fully take,
-- and the "what it means" column says what to do.
--
-- ONE STATEMENT, on purpose. The Supabase editor shows only the result of
-- the last statement it runs, so a verify file written as twenty separate
-- queries would show you twenty rows of nothing and one row of something.
-- =====================================================================

with checks as (

  -- ---------------------------------------------------------- LEAK 1
  select 1 as n,
    'The video reference is not readable through the table' as checking,
    case when not exists (
      select 1 from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'lms_lessons'
         and grantee in ('anon', 'authenticated')
         and privilege_type = 'SELECT'
         and column_name in ('video_ref', 'video_provider', 'content_md')
    ) then 'yes' else 'NO' end as answer,
    'This is the first of the two leaks. If this says NO, anybody with the publishable key can still list every paid video. Re-run step 1 of file 14.' as what_it_means

  union all select 2,
    'There is no table wide select on lms_lessons',
    case when not exists (
      select 1 from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'lms_lessons'
         and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
    ) then 'yes' else 'NO' end,
    'A table wide grant covers every column there will ever be, so a column added next year would be handed over without anybody deciding to. The grant has to be by column.'

  union all select 3,
    'The syllabus is still readable, so the course page still works',
    case when (
      select count(*) from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'lms_lessons'
         and grantee = 'anon' and privilege_type = 'SELECT'
         and column_name in ('title', 'position', 'duration_seconds', 'type')
    ) = 4 then 'yes' else 'NO' end,
    'The fix must not go too far. Lesson titles and lengths are the shop window and have to stay public.'

  -- ---------------------------------------------------------- LEAK 2
  union all select 4,
    'lms_course_cards runs with the rights of whoever reads it',
    case when coalesce((
      select split_part(o, '=', 2)::boolean from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      cross join lateral unnest(c.reloptions) o
       where ns.nspname = 'public' and c.relname = 'lms_course_cards'
         and split_part(o, '=', 1) = 'security_invoker'
    ), false) then 'yes' else 'NO' end,
    'This is the second leak. A view without this runs as its owner, and row security does not apply to the owner, so draft courses are visible to anybody.'

  union all select 5,
    'Every other lms_ view does too',
    case when not exists (
      select 1 from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
       where ns.nspname = 'public' and c.relkind = 'v' and c.relname like 'lms\_%'
         and not coalesce((select split_part(o, '=', 2)::boolean
                             from unnest(c.reloptions) o
                            where split_part(o, '=', 1) = 'security_invoker'), false)
    ) then 'yes' else 'NO' end,
    'The same trap applies to any view added later. If this says NO, a view somewhere is reading tables as the owner.'

  union all select 6,
    'No function reads the video with the caller''s own rights',
    case when not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname like 'lms\_%'
         and (p.prosrc ilike '%video_ref%' or p.prosrc ilike '%content_md%')
         and p.prosecdef = false
    ) then 'yes' else 'NO' end,
    'A plain function running as the caller would hand the column straight back and undo step 1.'

  -- ------------------------------------------------------- the new doors
  union all select 7,
    'lms_open_lesson exists',
    case when exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                       where ns.nspname = 'public' and p.proname = 'lms_open_lesson')
         then 'yes' else 'NO' end,
    'Without it the Phase 4 player has no way to reach a video at all.'

  union all select 8,
    'Only signed in people can call lms_open_lesson',
    case when not exists (
      select 1 from information_schema.role_routine_grants
       where routine_schema = 'public' and routine_name = 'lms_open_lesson'
         and grantee IN ('anon', 'PUBLIC')
    ) then 'yes' else 'NO' end,
    'anon must not be able to call it. A free first module is open to anybody who makes an account, which takes a minute.'

  union all select 9,
    'lms_staff_lesson exists and is shut to anon',
    case when exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                       where ns.nspname = 'public' and p.proname = 'lms_staff_lesson')
          and not exists (select 1 from information_schema.role_routine_grants
                           where routine_schema = 'public' and routine_name = 'lms_staff_lesson'
                             and grantee IN ('anon', 'PUBLIC'))
         then 'yes' else 'NO' end,
    'The Phase 6 control room needs to see a draft lesson whole. Nobody else does.'

  -- ------------------------------------------------------- new columns
  union all select 10,
    'lms_courses has the six course page columns',
    case when (
      select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'lms_courses'
         and column_name in ('outcomes','audience','prerequisites','faq',
                             'seo_title','seo_description')
    ) = 6 then 'yes' else 'NO' end,
    'outcomes, audience, prerequisites, faq, seo_title and seo_description. The course page and the search engine copy are both built from these.'

  union all select 11,
    'A title longer than 60 characters is refused',
    case when exists (select 1 from pg_constraint
                       where conname = 'lms_courses_seo_title_len')
         then 'yes' else 'NO' end,
    'Google cuts a longer title mid word. A rule kept only in the editor stops being a rule the moment somebody uses the API.'

  union all select 12,
    'A description longer than 155 characters is refused',
    case when exists (select 1 from pg_constraint
                       where conname = 'lms_courses_seo_desc_len')
         then 'yes' else 'NO' end,
    'Same reason.'

  union all select 13,
    'The FAQ has to be question and answer pairs',
    case when exists (select 1 from pg_constraint
                       where conname = 'lms_courses_faq_shape')
         then 'yes' else 'NO' end,
    'Otherwise the course page and the edge function each have to guess what to do with whatever shape arrives.'

  -- --------------------------------------------------- publish checklist
  union all select 14,
    'The checklist asks for three things a learner will be able to do',
    case when exists (
      select 1 from lms_course_blockers(
        (select id from lms_courses order by created_at limit 1)) b
       where b.label ilike '%able to do%'
    ) then 'yes' else 'NO' end,
    'A course page with no outcomes on it is worse for us in search than no page at all.'

  union all select 15,
    'The checklist still asks for everything it asked for before',
    case when (
      select count(*) from lms_course_blockers(
        (select id from lms_courses order by created_at limit 1))
    ) >= 9 then 'yes' else 'NO' end,
    'File 14 rewrites this function, so it has to keep all eight earlier rules. Nine or more means nothing was dropped.'

  -- --------------------------------------------------- public catalogue
  union all select 16,
    'lms_public_catalogue exists and anybody may call it',
    case when exists (select 1 from information_schema.role_routine_grants
                       where routine_schema = 'public'
                         and routine_name = 'lms_public_catalogue'
                         and grantee = 'anon')
         then 'yes' else 'NO' end,
    'The catalogue page and the edge function both call this. If anon cannot, a visitor who is not signed in sees nothing.'

  union all select 17,
    'lms_public_course exists and anybody may call it',
    case when exists (select 1 from information_schema.role_routine_grants
                       where routine_schema = 'public'
                         and routine_name = 'lms_public_course'
                         and grantee = 'anon')
         then 'yes' else 'NO' end,
    'Same, for one course page.'

  union all select 18,
    'Neither public function returns a video or a lesson body',
    case when not exists (
      select 1 from pg_proc p
      cross join lateral unnest(coalesce(p.proargnames, '{}')) a(name)
       where p.proname in ('lms_public_catalogue', 'lms_public_course')
         and (a.name ilike '%video%' or a.name ilike '%content%')
    ) then 'yes' else 'NO' end,
    'These two are the public face of the Academy. If a video reference ever appears in one of them, step 1 has been undone through the front door.'

  -- This one has to actually CALL lms_public_catalogue, and a call to a
  -- function that does not exist is a parse time error: PostgreSQL reads
  -- the whole statement before it runs any of it, so a half applied file
  -- 14 would make this entire verify return nothing at all instead of
  -- nineteen useful rows and one NO. A verify file that goes silent when
  -- something is missing is the opposite of what it is for.
  --
  -- query_to_xml takes its query as TEXT, so nothing inside it is looked
  -- up until the row is evaluated, and the guard in front of it decides
  -- whether that ever happens.
  union all select 19,
    'The catalogue shows published courses only',
    case
      when to_regprocedure('public.lms_public_catalogue()') is null then 'NO'
      when (xpath('/row/c/text()', query_to_xml(
             'select count(*) as c from lms_courses c'
             || ' where c.status <> ''published'''
             || '   and c.id in (select id from lms_public_catalogue())',
             false, true, '')))[1]::text::integer = 0
      then 'yes' else 'NO' end,
    'Read against whatever is in the database right now. If this says NO, unfinished work is on the public catalogue, or lms_public_catalogue is missing.'

  -- ------------------------------------------------------------ tidy up
  union all select 20,
    'anon still holds no write privilege on any Academy table',
    case when not exists (
      select 1 from information_schema.role_table_grants
       where table_schema = 'public' and table_name like 'lms\_%'
         and grantee = 'anon'
         and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
    ) then 'yes' else 'NO' end,
    'File 14 changes grants, so this is worth reading again afterwards.'
)
select n as "#", checking, answer, what_it_means as "what it means"
  from checks order by n;
