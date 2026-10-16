-- Checks file 18. Changes nothing. Safe to run before it as well as
-- after: it prints a column of NOs rather than an error, which is the
-- answer.
--
-- PASTE 18_verify_EDITOR.sql, NOT THIS ONE. The two hold the same
-- checks and a test keeps them in step. The reason is in
-- scripts/lms/make-editor-sql.mjs: 16_verify.sql failed in the Supabase
-- SQL Editor with `relation "the" does not exist` while running cleanly
-- in psql, and what ran in the end was a version with no prose in it.
-- The cause is still a guess. The explanations for each numbered row
-- live in docs/lms/PHASE-6B-PLAIN.md.
--
-- Rows 2 to 6 are the ones that matter. They are all one fault, which
-- was live: a learner could write any column of their own profile,
-- including the one that joins them to a certification record.

with checks as (

  select 1 as n,
    'A person can set their own name' as checking,
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_my_name'
    ) then 'yes' else 'NO' end as answer,
    'Without this there is no way to save a name, and the greeting falls back to the first part of the email address, which is a made up name shown as a real one.' as what_it_means

  union all select 2,
    'A signed in person cannot write every column of their own profile',
    case when not exists (
      select 1 from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'lms_profiles'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
    ) then 'yes' else 'NO' end,
    'This is the serious one. A policy cannot restrict which columns are written, so a table-wide grant means a learner can write any of them.'

  union all select 3,
    'A learner cannot point themselves at somebody else certification record',
    case when not exists (
      select 1 from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'lms_profiles'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
         and column_name = 'participant_id'
    ) then 'yes' else 'NO' end,
    'A NO here means a learner can claim the certificates of anybody certified who has not yet made an Academy account. File 05 says linking is only ever done on a proven address.'

  union all select 4,
    'A learner cannot write their own role',
    case when not exists (
      select 1 from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'lms_profiles'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
         and column_name = 'role'
    ) then 'yes' else 'NO' end,
    'The policy also refuses this, and it should be refused twice: by privilege and by policy, so neither has to hold on its own.'

  union all select 5,
    'The only columns a person may write are their name and their phone',
    case when (
      select coalesce(string_agg(column_name, ',' order by column_name), 'none')
        from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'lms_profiles'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
    ) = 'full_name,phone' then 'yes' else 'NO' end,
    'Says exactly which columns are writable rather than only which are not, so a column added later is refused by default instead of being allowed by nobody noticing.'

  union all select 6,
    'A visitor who is not signed in can write nothing',
    case when not exists (
      select 1 from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'lms_profiles'
         and grantee = 'anon' and privilege_type = 'UPDATE'
    ) and not exists (
      select 1 from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'lms_profiles'
         and grantee = 'anon' and privilege_type = 'UPDATE'
    ) then 'yes' else 'NO' end,
    'Nobody signed out should be able to change a profile at all.'

  union all select 7,
    'Only a signed in caller may run the name function',
    case when to_regprocedure('public.lms_set_my_name(text)') is not null
           and has_function_privilege('authenticated', 'lms_set_my_name(text)', 'EXECUTE')
           and not has_function_privilege('anon', 'lms_set_my_name(text)', 'EXECUTE')
         then 'yes' else 'NO' end,
    'The function writes a profile row, so a signed out caller must not reach it.'

  union all select 8,
    'The name function refuses an empty name',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_my_name'
    ) like '%Please type your name%' then 'yes' else 'NO' end,
    'A blank name saved over a real one would leave somebody worse off than before they tried.'

  union all select 9,
    'The name function is still the only way a name is set for somebody else',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_my_name'
    ) like '%auth.uid()%' then 'yes' else 'NO' end,
    'The function must write the caller own row and no other. A NO here would mean the id is an argument somebody else could supply.'
)
select n as "#", checking as "what was checked", answer as "answer",
       what_it_means as "what it means if the answer is not yes"
  from checks order by n;
