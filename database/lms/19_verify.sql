-- Checks file 19. Changes nothing. Safe to run before it as well as
-- after: it prints a column of NOs rather than an error, which is the
-- answer.
--
-- PASTE 19_verify_EDITOR.sql, NOT THIS ONE. The two hold the same
-- checks and a test keeps them in step. The explanations for each
-- numbered row live in docs/lms/PHASE-6D-PLAIN.md.
--
-- ROW 4 IS THE ONE THAT MATTERS. It is the reason this file exists.
--
-- Rows 2 and 3 ask about a table that does not exist until file 19 has
-- run, and they ask through query_to_xml rather than naming it in a
-- FROM clause. That is not cleverness for its own sake: Postgres
-- resolves every relation in a statement when it PLANS it, so a missing
-- table is an error before any CASE has a chance to guard it, and this
-- file would blow up instead of printing a column of NOs. File 18 had
-- the same fault through has_function_privilege and it was found the
-- same way, by running the verify before the file it verifies.

with checks as (

  select 1 as n,
    'There is a column of our own for a proven address' as checking,
    case when exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'lms_profiles'
         and column_name = 'email_verified_at'
    ) then 'yes' else 'NO' end as answer,
    'Everything below depends on this column. Without it there is no way to tell whether an address was proven or merely typed.' as what_it_means

  union all select 2,
    'The backfill has run, and recorded when',
    case when to_regclass('public.lms_email_verify_state') is not null
          and (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_email_verify_state where id = 1',
                false, true, '')))[1]::text::integer > 0
    then 'yes' else 'NO' end,
    'The recorded moment is what stops a later run marking accounts proven that nobody proved. Without it, running this file again after Confirm email is off would hand out access to every address typed since.'

  union all select 3,
    'Nobody who signed up after the backfill is marked proven by it',
    case when to_regclass('public.lms_email_verify_state') is null then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_profiles p join auth.users u on u.id = p.id join lms_email_verify_state s on s.id = 1 where p.email_verified_at is not null and u.created_at > s.first_run_at and p.email_verified_at < s.first_run_at + interval ''1 second''',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end,
    'A NO means the guard failed and somebody is marked proven because a file was run twice rather than because they typed a code.'

  union all select 4,
    'The access sync no longer trusts the address somebody typed',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_sync_my_access'
    ) not like '%email_confirmed_at%' then 'yes' else 'NO' end,
    'THE IMPORTANT ONE. This gate covers facilitator access, the certification link and bootcamp access together. A NO means somebody signing up with an appointed facilitator address is handed the control room on first sign in.'

  union all select 5,
    'Nor does the bootcamp claim, the new account trigger or the facilitator appointment',
    case when (
      select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public'
         and p.proname in ('lms_claim_bootcamp_access', 'lms_handle_new_user', 'lms_add_facilitator')
         and regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
             like '%email_confirmed_at%'
    ) = 0 then 'yes' else 'NO' end,
    'The same fault by three other doors. The comments in those functions still name the old column, which is why this strips them before looking.'

  union all select 6,
    'A person can ask for a code',
    case when to_regprocedure('public.lms_request_email_check()') is not null
         then 'yes' else 'NO' end,
    'Without this there is no way to prove an address at all, so nobody ever gets a bootcamp pass, staff access or their certificates.'

  union all select 7,
    'And type it in',
    case when to_regprocedure('public.lms_confirm_email_check(text)') is not null
         then 'yes' else 'NO' end,
    'The other half of the same thing.'

  union all select 8,
    'Only a signed in caller may use either one',
    case when to_regprocedure('public.lms_request_email_check()') is not null
          and to_regprocedure('public.lms_confirm_email_check(text)') is not null
          and has_function_privilege('authenticated', 'lms_request_email_check()', 'EXECUTE')
          and has_function_privilege('authenticated', 'lms_confirm_email_check(text)', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_request_email_check()', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_confirm_email_check(text)', 'EXECUTE')
         then 'yes' else 'NO' end,
    'A signed out caller must not be able to make the site send email, nor prove an address belonging to somebody else.'

  union all select 9,
    'The codes are hashed, never kept as typed',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_request_email_check'
    ) like '%crypt(v_code, gen_salt%' then 'yes' else 'NO' end,
    'A NO means anybody able to read one stored row can sign in as whoever has a code waiting.'

  union all select 10,
    'Nobody can read the stored codes in a browser',
    case when (
      select relrowsecurity from pg_class where relname = 'lms_email_checks'
    ) and not exists (
      select 1 from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'lms_email_checks'
         and grantee in ('anon', 'authenticated')
    ) then 'yes' else 'NO' end,
    'The hash is useless to a learner and the try count is something they could otherwise watch. Both functions are security definer and reach it that way, so nothing is lost by shutting it.'

  union all select 11,
    'A wrong code is counted, and five of them end it',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_confirm_email_check'
    ) like '%tries >= 5%' then 'yes' else 'NO' end,
    'A six digit code with no try limit is guessed in an afternoon.'

  union all select 12,
    'Passing the check runs the access sync at once',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_confirm_email_check'
    ) like '%lms_sync_my_access()%' then 'yes' else 'NO' end,
    'Without it somebody types a correct code and nothing visibly happens until they sign out and back in.'

  union all select 13,
    'The log keeps a note of the check and not of the code',
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
    'An administrator reading the log must not come away holding a way to open somebody else account.'

  union all select 14,
    'The answers a person gave at sign up still reach their profile',
    case when exists (
      select 1 from pg_trigger t
       where t.tgrelid = 'auth.users'::regclass
         and t.tgname = 'lms_users_created_confirmed' and not t.tgisinternal
    ) then 'yes' else 'NO' end,
    'This trigger is deliberately LEFT reading Supabase own column, because it grants nothing and moving it would leave the disability answer sitting in the account token until somebody typed a code.'

  union all select 15,
    'Only an administrator can look up a certification record',
    case when to_regprocedure('public.lms_find_participants(text)') is null then 'NO'
         when has_function_privilege('authenticated', 'lms_find_participants(text)', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_find_participants(text)', 'EXECUTE')
          and (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_find_participants')
              like '%lms_is_admin()%'
         then 'yes' else 'NO' end,
    'It searches the certification register, which is a list of real people and their addresses. A facilitator sees no learner names at all and must not reach this.'

  union all select 16,
    'Joining a certification record by hand is an administrator decision, with a reason',
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
    'This hands somebody the certificates of a named person, so it belongs to an administrator and the reason belongs in the log.'

  union all select 17,
    'And it cannot take one that is already joined to another account',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_link_certification_record'
    ) like '%already joined to another account%' then 'yes' else 'NO' end,
    'The unique index refuses it anyway, so a NO here means an administrator gets a constraint violation instead of a sentence.'

  union all select 18,
    'A facilitator cannot rewrite the chapters of somebody else lesson',
    case when to_regprocedure('public.lms_set_lesson_chapters(uuid, text)') is null then 'NO'
         when not has_function_privilege('authenticated', 'lms_set_lesson_chapters(uuid, text)', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_set_lesson_chapters(uuid, text)', 'EXECUTE')
          and not has_function_privilege('public', 'lms_set_lesson_chapters(uuid, text)', 'EXECUTE')
         then 'yes' else 'NO' end,
    'This one asks "are you staff" and never "is this lesson yours", so a direct call let any facilitator overwrite the chapters of a published course belonging to somebody else. It is only ever meant to be reached through lms_save_lesson, which does check ownership. PUBLIC is named as well as the other two roles because every function is executable by PUBLIC as soon as it exists, so revoking the two roles on their own leaves that third grant standing.'

  union all select 19,
    'And the backfill mark cannot be emptied by a visitor',
    -- to_regclass, NOT a 'public.x'::regclass cast. A literal cast is
    -- constant folded while the statement is planned, so it raises on a
    -- database without file 19 before the CASE above it can guard
    -- anything. That is the same trap as rows 2 and 3 and as row 18,
    -- and I walked into it again here.
    case when to_regclass('public.lms_email_verify_state') is null then 'NO'
         when (select relrowsecurity from pg_class
                where oid = to_regclass('public.lms_email_verify_state'))
          and not exists (
            select 1 from information_schema.role_table_grants
             where table_schema = 'public' and table_name = 'lms_email_verify_state'
               and grantee in ('PUBLIC', 'anon', 'authenticated')
          )
         then 'yes' else 'NO' end,
    'THE SECOND ONE THAT MATTERS, for the same reason as row 4. Supabase hands anon and authenticated every privilege on anything newly created in public, so this one arrived wide open and a signed out visitor could empty it. The mark is the only thing stopping a later run of file 19 backfilling every account made since, and with Confirm email off that would mark every typed address proven. A NO here means the guard in row 3 can be removed by anybody who can reach the API, and row 3 would then happily report yes afterwards because there would be no mark left to compare against. 12_verify rows 11 and 12 also go NO while this is NO.'
)
select n as "#", checking as "what was checked", answer as "answer",
       what_it_means as "what it means if the answer is not yes"
  from checks order by n;
