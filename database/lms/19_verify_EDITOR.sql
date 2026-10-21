with checks (n, checking, answer, note) as (

  select 1,
    'check 1',
    case when exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'lms_profiles'
         and column_name = 'email_verified_at'
    ) then 'yes' else 'NO' end,
    ''

  union all select 2,
    'check 2',
    case when to_regclass('public.lms_email_verify_state') is not null
          and (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_email_verify_state where id = 1',
                false, true, '')))[1]::text::integer > 0
    then 'yes' else 'NO' end,
    ''

  union all select 3,
    'check 3',
    case when to_regclass('public.lms_email_verify_state') is null then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_profiles p join auth.users u on u.id = p.id join lms_email_verify_state s on s.id = 1 where p.email_verified_at is not null and u.created_at > s.first_run_at and p.email_verified_at < s.first_run_at + interval ''1 second''',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end,
    ''

  union all select 4,
    'check 4',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_sync_my_access'
    ) not like '%email_confirmed_at%' then 'yes' else 'NO' end,
    ''

  union all select 5,
    'check 5',
    case when (
      select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public'
         and p.proname in ('lms_claim_bootcamp_access', 'lms_handle_new_user', 'lms_add_facilitator')
         and regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
             like '%email_confirmed_at%'
    ) = 0 then 'yes' else 'NO' end,
    ''

  union all select 6,
    'check 6',
    case when to_regprocedure('public.lms_request_email_check()') is not null
         then 'yes' else 'NO' end,
    ''

  union all select 7,
    'check 7',
    case when to_regprocedure('public.lms_confirm_email_check(text)') is not null
         then 'yes' else 'NO' end,
    ''

  union all select 8,
    'check 8',
    case when to_regprocedure('public.lms_request_email_check()') is not null
          and to_regprocedure('public.lms_confirm_email_check(text)') is not null
          and has_function_privilege('authenticated', 'lms_request_email_check()', 'EXECUTE')
          and has_function_privilege('authenticated', 'lms_confirm_email_check(text)', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_request_email_check()', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_confirm_email_check(text)', 'EXECUTE')
         then 'yes' else 'NO' end,
    ''

  union all select 9,
    'check 9',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_request_email_check'
    ) like '%crypt(v_code, gen_salt%' then 'yes' else 'NO' end,
    ''

  union all select 10,
    'check 10',
    case when (
      select relrowsecurity from pg_class where relname = 'lms_email_checks'
    ) and not exists (
      select 1 from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'lms_email_checks'
         and grantee in ('anon', 'authenticated')
    ) then 'yes' else 'NO' end,
    ''

  union all select 11,
    'check 11',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_confirm_email_check'
    ) like '%tries >= 5%' then 'yes' else 'NO' end,
    ''

  union all select 12,
    'check 12',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_confirm_email_check'
    ) like '%lms_sync_my_access()%' then 'yes' else 'NO' end,
    ''

  union all select 13,
    'check 13',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_request_email_check'
    ) like '%lms_log_action(''email_check_requested''%'
     and (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_request_email_check'
    ) not like '%v_code%jsonb_build_object%' then 'yes' else 'NO' end,
    ''

  union all select 14,
    'check 14',
    case when exists (
      select 1 from pg_trigger t
       where t.tgrelid = 'auth.users'::regclass
         and t.tgname = 'lms_users_created_confirmed' and not t.tgisinternal
    ) then 'yes' else 'NO' end,
    ''

  union all select 15,
    'check 15',
    case when to_regprocedure('public.lms_find_participants(text)') is null then 'NO'
         when has_function_privilege('authenticated', 'lms_find_participants(text)', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_find_participants(text)', 'EXECUTE')
          and (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_find_participants')
              like '%lms_is_admin()%'
         then 'yes' else 'NO' end,
    ''

  union all select 16,
    'check 16',
    case when to_regprocedure('public.lms_link_certification_record(uuid, uuid, text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_link_certification_record')
              like '%lms_is_admin()%'
          and (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_link_certification_record')
              like '%certification_linked%'
         then 'yes' else 'NO' end,
    ''

  union all select 17,
    'check 17',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_link_certification_record'
    ) like '%already joined to another account%' then 'yes' else 'NO' end,
    ''

  union all select 18,
    'check 18',
    case when to_regprocedure('public.lms_set_lesson_chapters(uuid, text)') is null then 'NO'
         when not has_function_privilege('authenticated', 'lms_set_lesson_chapters(uuid, text)', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_set_lesson_chapters(uuid, text)', 'EXECUTE')
          and not has_function_privilege('public', 'lms_set_lesson_chapters(uuid, text)', 'EXECUTE')
         then 'yes' else 'NO' end,
    ''

  union all select 19,
    'check 19',

    case when to_regclass('public.lms_email_verify_state') is null then 'NO'
         when (select relrowsecurity from pg_class
                where oid = to_regclass('public.lms_email_verify_state'))
          and not exists (
            select 1 from information_schema.role_table_grants
             where table_schema = 'public' and table_name = 'lms_email_verify_state'
               and grantee in ('PUBLIC', 'anon', 'authenticated')
          )
         then 'yes' else 'NO' end,
    ''
)
select n as "#", checking as "what", answer as "answer", note as "note"
  from checks order by n;
