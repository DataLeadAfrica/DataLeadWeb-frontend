with checks (n, checking, answer, note) as (

  select 1,
    'check 1',
    case when to_regprocedure('public.lms_publish_exam(uuid)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_publish_exam')
              like '%lms_is_admin()%'
         then 'yes' else 'NO' end,
    ''

  union all select 2,
    'check 2',
    case when to_regprocedure('public.lms_publish_path(uuid)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_publish_path')
              like '%lms_is_admin()%'
         then 'yes' else 'NO' end,
    ''

  union all select 3,
    'check 3',
    case when to_regprocedure('public.lms_ensure_path_exam(uuid)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_ensure_path_exam')
              like '%lms_is_admin()%'
         then 'yes' else 'NO' end,
    ''

  union all select 4,
    'check 4',
    case when to_regprocedure('public.lms_publish_checks(uuid)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_publish_checks')
              like '%The course exam is published%'
         then 'yes' else 'NO' end,
    ''

  union all select 5,
    'check 5',
    case when to_regprocedure('public.lms_publish_exam(uuid)') is null then 'NO'
         when to_regprocedure('public.lms_publish_path(uuid)') is null then 'NO'
         when not has_function_privilege('authenticated', 'lms_publish_exam(uuid)', 'EXECUTE') then 'NO'
         when not has_function_privilege('authenticated', 'lms_publish_path(uuid)', 'EXECUTE') then 'NO'
         when has_function_privilege('anon', 'lms_publish_exam(uuid)', 'EXECUTE') then 'NO'
         when has_function_privilege('anon', 'lms_publish_path(uuid)', 'EXECUTE') then 'NO'
         else 'yes' end,
    ''

  union all select 6,
    'check 6',
    case when not exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'lms_quizzes'
              and column_name = 'course_id'
         ) then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_quizzes q join lms_courses c on c.id = q.course_id where q.lesson_id is null and q.module_id is null and c.status = ''published'' and q.status <> ''published''',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end,
    ''
)
select n as "#", checking as "what", answer as "answer", note as "note"
  from checks order by n;

select (xpath('/row/slug/text()',  x))[1]::text as "this live course",
       (xpath('/row/title/text()', x))[1]::text as "is called",
       (xpath('/row/bank/text()',  x))[1]::text as "questions written",
       (xpath('/row/need/text()',  x))[1]::text as "questions needed"
  from unnest(xpath('/rows/row', ('<rows>' || coalesce(query_to_xml(
       (case when exists (select 1 from information_schema.columns
                           where table_schema = 'public' and table_name = 'lms_quizzes'
                             and column_name = 'course_id')
             then 'select c.slug, c.title, (select count(*) from lms_questions qq where qq.quiz_id = q.id and qq.active) as bank, ceil(q.serve_count * coalesce(q.bank_multiple, 1.5)) as need from lms_quizzes q join lms_courses c on c.id = q.course_id where q.lesson_id is null and q.module_id is null and c.status = ''published'' and q.status <> ''published'' order by c.slug'
             else 'select null::text as slug, null::text as title, null::int as bank, null::int as need where false'
        end),
       false, true, '')::text, '') || '</rows>')::xml)) as x;
