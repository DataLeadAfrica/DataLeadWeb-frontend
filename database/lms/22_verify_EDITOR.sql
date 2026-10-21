with checks (n, checking, answer, note) as (

  select 1,
    'check 1',

    case when not exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'lms_quizzes'
              and column_name = 'course_id'
         ) then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_courses c where c.status <> ''archived'' and not exists (select 1 from lms_quizzes q where q.course_id = c.id)',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end,
    ''

  union all select 2,
    'check 2',
    case when to_regprocedure('public.lms_ensure_course_exam(uuid)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_ensure_course_exam')
              like '%70, 2, 20, 1440, true, ''draft'', 40, 1.5%'
         then 'yes' else 'NO' end,
    ''

  union all select 3,
    'check 3',
    case when not exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'lms_paths'
              and column_name = 'programme_id'
         ) then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_paths where programme_id is null',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end,
    ''

  union all select 4,
    'check 4',
    case when to_regprocedure('public.lms_create_path(text, text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_create_path')
              like '%programmes%'
         then 'yes' else 'NO' end,
    ''

  union all select 5,
    'check 5',
    case when to_regprocedure('public.lms_create_path(text, text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_create_path')
              like '%values (v_slug, v_cert,%'
         then 'yes' else 'NO' end,
    ''

  union all select 6,
    'check 6',
    case when to_regprocedure('public.lms_studio_certificate_counts()') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_studio_certificate_counts')
              like '%ct.issued_at >=%'
         then 'yes' else 'NO' end,
    ''

  union all select 7,
    'check 7',
    case when to_regprocedure('public.lms_studio_certificate_counts()') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_studio_certificate_counts')
              like '%Africa/Lagos%'
         then 'yes' else 'NO' end,
    ''

  union all select 8,
    'check 8',
    case when to_regprocedure('public.lms_studio_certificate_counts()') is null then 'NO'
         when exists (
           select 1 from pg_proc p
             join pg_namespace ns on ns.oid = p.pronamespace
             join unnest(p.proargnames) as nm on true
            where ns.nspname = 'public' and p.proname = 'lms_studio_certificate_counts'
              and nm = 'this_month'
         ) then 'yes' else 'NO' end,
    ''

  union all select 9,
    'check 9',
    case when to_regprocedure('public.lms_studio_overview()') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_studio_overview')
              like '%ct.issued_at >=%'
         then 'yes' else 'NO' end,
    ''

  union all select 10,
    'check 10',
    case when to_regprocedure('public.lms_studio_certificate_counts()') is null
           or to_regprocedure('public.lms_studio_overview()') is null then 'NO'
         when not has_function_privilege('anon', 'lms_studio_certificate_counts()', 'EXECUTE')
          and not has_function_privilege('public', 'lms_studio_certificate_counts()', 'EXECUTE')
          and has_function_privilege('authenticated', 'lms_studio_certificate_counts()', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_studio_overview()', 'EXECUTE')
          and has_function_privilege('authenticated', 'lms_studio_overview()', 'EXECUTE')
         then 'yes' else 'NO' end,
    ''

  union all select 11,
    'check 11',
    case when to_regprocedure('public.lms_archive_course(uuid, text)') is null then 'NO'
         when to_regprocedure('public.lms_archive_course(uuid)') is not null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_archive_course')
              like '%jsonb_build_object(''reason''%'
         then 'yes' else 'NO' end,
    ''

  union all select 12,
    'check 12',
    case when to_regprocedure('public.lms_archive_course(uuid, text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_archive_course')
              like '%This course is live%'
         then 'yes' else 'NO' end,
    ''

  union all select 13,
    'check 13',
    case when to_regprocedure('public.lms_restore_course(uuid, text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_restore_course')
              like '%set status = ''draft''%'
         then 'yes' else 'NO' end,
    ''

  union all select 14,
    'check 14',
    case when to_regprocedure('public.lms_archive_course(uuid, text)') is null
           or to_regprocedure('public.lms_restore_course(uuid, text)') is null then 'NO'
         when not has_function_privilege('anon', 'lms_archive_course(uuid, text)', 'EXECUTE')
          and not has_function_privilege('public', 'lms_archive_course(uuid, text)', 'EXECUTE')
          and has_function_privilege('authenticated', 'lms_archive_course(uuid, text)', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_restore_course(uuid, text)', 'EXECUTE')
          and not has_function_privilege('public', 'lms_restore_course(uuid, text)', 'EXECUTE')
          and has_function_privilege('authenticated', 'lms_restore_course(uuid, text)', 'EXECUTE')
         then 'yes' else 'NO' end,
    ''
  union all select 15,
    'check 15',

    case when (select count(*) from (
                 select pr.slug from programmes pr group by pr.slug having count(*) > 1
               ) d) = 0
          and (select count(*) from (
                 select pr.code from programmes pr group by pr.code having count(*) > 1
               ) d) = 0
         then 'yes' else 'NO' end,
    ''

  union all select 16,
    'check 16',
    case when to_regprocedure('public.lms_free_programme_identity(text, text)') is null then 'NO'
         when has_function_privilege('anon', 'lms_free_programme_identity(text, text)', 'EXECUTE')
           or has_function_privilege('authenticated', 'lms_free_programme_identity(text, text)', 'EXECUTE')
         then 'NO' else 'yes' end,
    ''

  union all select 17,
    'check 17',
    case when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_create_course')
              like '%lms_free_programme_identity%'
          and (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_create_path')
              like '%lms_free_programme_identity%'
         then 'yes' else 'NO' end,
    ''
)
select n as "#", checking as "what", answer as "answer", note as "note"
  from checks order by n;

select 'slug' as "what", pr.slug as "the value shared",
       count(*) as "how many programmes", string_agg(pr.title, ' | ' order by pr.title) as "which"
  from programmes pr group by pr.slug having count(*) > 1
union all
select 'code', pr.code, count(*), string_agg(pr.title, ' | ' order by pr.title)
  from programmes pr group by pr.code having count(*) > 1
 order by 1, 2;
