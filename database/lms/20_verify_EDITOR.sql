with checks (n, checking, answer, note) as (

  select 1,
    'check 1',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_save_lesson'
    ) like '%insert into lms_quizzes%' then 'yes' else 'NO' end,
    ''

  union all select 2,
    'check 2',
    case when (
      select count(*) from lms_lessons l
       join lms_modules m on m.id = l.module_id
       join lms_courses c on c.id = m.course_id
       where l.type = 'video' and c.status <> 'archived'
         and not exists (select 1 from lms_quizzes q where q.lesson_id = l.id)
    ) = 0 then 'yes' else 'NO' end,
    ''

  union all select 3,
    'check 3',

    case when not exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'lms_quizzes'
              and column_name = 'course_id'
         ) then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_quizzes q where q.lesson_id is not null and (q.module_id is not null or q.course_id is not null or q.path_id is not null)',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end,
    ''

  union all select 4,
    'check 4',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_create_quiz'
    ) like '%lms_may_edit_course%' then 'yes' else 'NO' end,
    ''

  union all select 5,
    'check 5',
    case when to_regprocedure('public.lms_create_quiz(uuid, uuid, text)') is null then 'NO'
         when not has_function_privilege('authenticated', 'lms_create_quiz(uuid, uuid, text)', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_create_quiz(uuid, uuid, text)', 'EXECUTE')
         then 'yes' else 'NO' end,
    ''

  union all select 6,
    'check 6',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_save_lesson'
    ) like '%= ''video''%' then 'yes' else 'NO' end,
    ''
)
select n as "#", checking as "what", answer as "answer", note as "note"
  from checks order by n;
