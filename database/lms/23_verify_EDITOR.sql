with checks (n, checking, answer, note) as (

  select 1,
    'check 1',
    case when to_regclass('public.lms_lesson_progress') is null then 'NO'
         when not exists (
           select 1 from pg_policy
            where polrelid = to_regclass('public.lms_lesson_progress')
              and polcmd <> 'r'
         ) and not exists (
           select 1 from information_schema.role_table_grants
            where table_schema = 'public' and table_name = 'lms_lesson_progress'
              and grantee in ('anon', 'authenticated')
              and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
         ) then 'yes' else 'NO' end,
    ''

  union all select 2,
    'check 2',
    case when to_regprocedure('public.lms_claim_course_certificate(uuid)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_claim_course_certificate')
              like '%q.course_id = p_course%'
         then 'yes' else 'NO' end,
    ''

  union all select 3,
    'check 3',
    case when (
      select count(*) from (values ('lms_watch_buckets'), ('lms_quiz_attempts')) as t(tbl)
       where to_regclass('public.' || tbl) is not null
         and exists (
           select 1 from information_schema.role_table_grants g
            where g.table_schema = 'public' and g.table_name = tbl
              and g.grantee in ('anon', 'authenticated')
              and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
         )
    ) = 0 then 'yes' else 'NO' end,
    ''

  union all select 4,
    'check 4',
    case when to_regprocedure('public.lms_programme_title_follows(uuid, text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_programme_title_follows')
              like '%v_issued > 0%'
         then 'yes' else 'NO' end,
    ''

  union all select 5,
    'check 5',
    case when to_regprocedure('public.lms_programme_title_follows(uuid, text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_programme_title_follows')
              like '%not exists (select 1 from lms_courses%'
         then 'yes' else 'NO' end,
    ''

  union all select 6,
    'check 6',
    case when to_regprocedure('public.lms_programme_title_follows(uuid, text)') is null then 'NO'
         when has_function_privilege('anon', 'lms_programme_title_follows(uuid, text)', 'EXECUTE')
           or has_function_privilege('authenticated', 'lms_programme_title_follows(uuid, text)', 'EXECUTE')
         then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_set_course_details')
              like '%lms_programme_title_follows%'
          and (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_set_path_details')
              like '%lms_programme_title_follows%'
         then 'yes' else 'NO' end,
    ''

  union all select 7,
    'check 7',
    case when not exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'lms_paths'
              and column_name = 'programme_id'
         ) then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from ('
                || 'select 1 from lms_courses c join programmes pr on pr.id = c.programme_id where c.status <> ''archived'' and pr.title <> c.title and not exists (select 1 from certificates ct where ct.programme_id = pr.id)'
                || ' union all '
                || 'select 1 from lms_paths p join programmes pr on pr.id = p.programme_id where pr.title <> p.certificate_name and not exists (select 1 from certificates ct where ct.programme_id = pr.id)'
                || ') d',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end,
    ''
)
select n as "#", checking as "what", answer as "answer", note as "note"
  from checks order by n;

select (xpath('/row/kind/text()',  x))[1]::text as "what",
       (xpath('/row/slug/text()',  x))[1]::text as "its address",
       (xpath('/row/mine/text()',  x))[1]::text as "it is called",
       (xpath('/row/cert/text()',  x))[1]::text as "its certificate says"
  from unnest(xpath('/rows/row', ('<rows>' || coalesce(query_to_xml(
       'select ''course'' as kind, c.slug, c.title as mine, pr.title as cert from lms_courses c join programmes pr on pr.id = c.programme_id where c.status <> ''archived'' and pr.title <> c.title and not exists (select 1 from certificates ct where ct.programme_id = pr.id)'
       || ' union all '
       || (case when exists (
                  select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'lms_paths'
                     and column_name = 'programme_id')
                then 'select ''path'' as kind, p.slug, p.certificate_name as mine, pr.title as cert from lms_paths p join programmes pr on pr.id = p.programme_id where pr.title <> p.certificate_name and not exists (select 1 from certificates ct where ct.programme_id = pr.id)'
                else 'select null::text, null::text, null::text, null::text where false'
           end),
       false, true, '')::text, '') || '</rows>')::xml)) as x
 order by 1, 2;
