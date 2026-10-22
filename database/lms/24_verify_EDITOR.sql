with checks (n, checking, answer, note) as (

  select 1,
    'check 1',
    case when to_regclass('public.lms_module_badges') is null then 'NO'
         when not exists (
           select 1 from information_schema.role_table_grants g
            where g.table_schema = 'public' and g.table_name = 'lms_module_badges'
              and g.grantee in ('anon', 'authenticated')
              and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
         ) and not exists (
           select 1 from pg_policy
            where polrelid = to_regclass('public.lms_module_badges')
              and polcmd <> 'r'
         ) and coalesce((select c.relrowsecurity from pg_class c
                          where c.oid = to_regclass('public.lms_module_badges')), false)
         then 'yes' else 'NO' end,
    ''

  union all select 2,
    'check 2',
    case when to_regclass('public.lms_lesson_progress') is null then 'NO'
         when exists (
           select 1 from pg_trigger t
            where t.tgrelid = to_regclass('public.lms_lesson_progress')
              and t.tgname = 't_award_module_badge'
              and not t.tgisinternal
         ) then 'yes' else 'NO' end,
    ''

  union all select 3,
    'check 3',
    case when to_regclass('public.lms_module_badges') is null then 'NO'
         when to_regprocedure('public.lms_award_module_badge()') is null then 'NO'
         when exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'lms_module_badges'
              and column_name in ('certificate_number', 'programme_id', 'revoked')
         ) then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_award_module_badge')
              like '%certificates%'
         then 'NO' else 'yes' end,
    ''

  union all select 4,
    'check 4',
    case when to_regprocedure('public.lms_my_course(text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_my_course')
              like '%badge_awarded_at%'
         then 'yes' else 'NO' end,
    ''

  union all select 5,
    'check 5',
    case when to_regprocedure('public.lms_studio_overview()') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_studio_overview')
              like '%pl.id = e.user_id%'
         then 'yes' else 'NO' end,
    ''

  union all select 6,
    'check 6',
    case when to_regprocedure('public.lms_staff_learners(text, text, text, integer, integer, uuid)') is null then 'NO'
         when has_function_privilege('anon',
                'lms_staff_learners(text, text, text, integer, integer, uuid)', 'EXECUTE') then 'NO'
         when not has_function_privilege('authenticated',
                'lms_staff_learners(text, text, text, integer, integer, uuid)', 'EXECUTE') then 'NO'
         else 'yes' end,
    ''

  union all select 7,
    'check 7',
    case when to_regprocedure('public.lms_studio_path(uuid)') is null then 'NO'
         when has_function_privilege('anon', 'lms_studio_path(uuid)', 'EXECUTE') then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_studio_path')
              like '%lms_is_admin%'
         then 'yes' else 'NO' end,
    ''

  union all select 8,
    'check 8',
    case when to_regclass('public.lms_module_badges') is null then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from (select p.user_id, m.id as mid from lms_lesson_progress p join lms_lessons l on l.id = p.lesson_id join lms_modules m on m.id = l.module_id where p.completed group by p.user_id, m.id having count(*) = (select count(*) from lms_lessons l2 where l2.module_id = m.id) and not exists (select 1 from lms_module_badges b where b.user_id = p.user_id and b.module_id = m.id)) d',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end,
    ''
)
select n as "#", checking as "what", answer as "answer", note as "note"
  from checks order by n;

select (xpath('/row/who/text()',  x))[1]::text as "who",
       (xpath('/row/what/text()', x))[1]::text as "finished this module",
       (xpath('/row/crs/text()',  x))[1]::text as "in this course"
  from unnest(xpath('/rows/row', ('<rows>' || coalesce(query_to_xml(
       (case when to_regclass('public.lms_module_badges') is null
             then 'select null::text as who, null::text as what, null::text as crs where false'
             else 'select coalesce(pr.full_name, ''a learner'') as who, m.title as what, c.title as crs from lms_lesson_progress p join lms_lessons l on l.id = p.lesson_id join lms_modules m on m.id = l.module_id join lms_courses c on c.id = m.course_id left join lms_profiles pr on pr.id = p.user_id where p.completed group by p.user_id, m.id, m.title, c.title, pr.full_name having count(*) = (select count(*) from lms_lessons l2 where l2.module_id = m.id) and not exists (select 1 from lms_module_badges b where b.user_id = p.user_id and b.module_id = m.id)'
        end),
       false, true, '')::text, '') || '</rows>')::xml)) as x
 order by 1, 2;
