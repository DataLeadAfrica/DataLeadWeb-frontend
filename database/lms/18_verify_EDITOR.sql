with checks (n, checking, answer, note) as (

  select 1,
    'check 1',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_my_name'
    ) then 'yes' else 'NO' end,
    ''

  union all select 2,
    'check 2',
    case when not exists (
      select 1 from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'lms_profiles'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
    ) then 'yes' else 'NO' end,
    ''

  union all select 3,
    'check 3',
    case when not exists (
      select 1 from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'lms_profiles'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
         and column_name = 'participant_id'
    ) then 'yes' else 'NO' end,
    ''

  union all select 4,
    'check 4',
    case when not exists (
      select 1 from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'lms_profiles'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
         and column_name = 'role'
    ) then 'yes' else 'NO' end,
    ''

  union all select 5,
    'check 5',
    case when (
      select coalesce(string_agg(column_name, ',' order by column_name), 'none')
        from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'lms_profiles'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
    ) = 'full_name,phone' then 'yes' else 'NO' end,
    ''

  union all select 6,
    'check 6',
    case when not exists (
      select 1 from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'lms_profiles'
         and grantee = 'anon' and privilege_type = 'UPDATE'
    ) and not exists (
      select 1 from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'lms_profiles'
         and grantee = 'anon' and privilege_type = 'UPDATE'
    ) then 'yes' else 'NO' end,
    ''

  union all select 7,
    'check 7',
    case when to_regprocedure('public.lms_set_my_name(text)') is not null
           and has_function_privilege('authenticated', 'lms_set_my_name(text)', 'EXECUTE')
           and not has_function_privilege('anon', 'lms_set_my_name(text)', 'EXECUTE')
         then 'yes' else 'NO' end,
    ''

  union all select 8,
    'check 8',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_my_name'
    ) like '%Please type your name%' then 'yes' else 'NO' end,
    ''

  union all select 9,
    'check 9',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_my_name'
    ) like '%auth.uid()%' then 'yes' else 'NO' end,
    ''
)
select n as "#", checking as "what", answer as "answer", note as "note"
  from checks order by n;
