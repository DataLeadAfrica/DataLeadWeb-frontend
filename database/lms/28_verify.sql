-- Checks file 28. Changes nothing. Safe to run before it as well as
-- after: it prints a column of NOs rather than an error, which is the
-- answer.
--
-- PASTE 28_verify_EDITOR.sql, NOT THIS ONE. The two hold the same checks
-- and a test keeps them in step. The explanations for each numbered row
-- live in docs/lms/PHASE-6H-PLAIN.md.
--
-- ROW 12 IS THE ONE THAT WILL STILL BE WORKING IN A YEAR. The others
-- check a list of known mistakes. That one asks whether ANY table in
-- this family can be emptied in one statement by a signed in person, so
-- a table added later with the default grants is caught without anybody
-- remembering to come back here and add a row.
--
-- ROW 13 MAY WELL SAY NO, AND THAT IS THE POINT OF IT. It counts active
-- participants with no ID card. On the day file 28 goes in that is every
-- one of them, because no card has been issued yet. It is a worklist,
-- not a fault.
--
-- Everything that names a relation or a function is asked through
-- to_regclass, to_regprocedure or information_schema, never a literal
-- cast, because Postgres resolves relations when it PLANS a statement.
-- Files 18 to 24 each had a version of that fault.
--
-- No sentence here puts an ordinary English word after "from", "into",
-- "join", "update" or "table", because the Supabase editor appears to
-- read those as relation names and 16_verify.sql failed in it on
-- exactly that.

with
-- The five this file makes, written once.
scope(t) as (values
  ('lms_participant_cards'), ('lms_learner_setup'),
  ('lms_attendance_days'), ('lms_attendance_checkins'),
  ('lms_attendance_responses')),

-- The two that hold a secret, so neither may be read by a browser role
-- at all: one carries the fingerprint of the access code, the other the
-- card token that the QR holds.
secret(t) as (values ('lms_participant_cards'), ('lms_attendance_days')),

-- The twenty-three functions, so a missing one is named rather than
-- guessed.
fns(f) as (values
  ('lms_wat_today()'),
  ('lms_unambiguous_code(integer)'),
  ('lms_issue_participant_card(uuid)'),
  ('lms_card_mark_lost(uuid)'),
  ('lms_issue_cards_for_cohort(text)'),
  ('lms_participant_cards_for_print(text)'),
  ('lms_my_setup()'),
  ('lms_save_my_setup(text, text, text, text, text)'),
  ('lms_attendance_open_day(text, text, text, integer)'),
  ('lms_attendance_reveal_code(uuid, integer)'),
  ('lms_attendance_close_day(uuid)'),
  ('lms_attendance_day(uuid)'),
  ('lms_attendance_today(text)'),
  ('lms_attendance_scan(uuid, text, text)'),
  ('lms_attendance_use_code(text)'),
  ('lms_attendance_my_day()'),
  ('lms_attendance_submit(text, integer, text, text)'),
  ('lms_attendance_live(uuid)'),
  ('lms_attendance_roster(text)'),
  ('lms_attendance_days_list(text, date, date)'),
  ('lms_attendance_register(text, date, date)'),
  ('lms_attendance_cohorts()'),
  ('lms_attendance_correct(uuid, uuid, text)')),

checks as (

  select 1 as n,
    'All five new tables are in place' as checking,
    case when (select count(*) from scope s
                where to_regclass('public.' || s.t) is not null) = 5
         then 'yes' else 'NO' end as answer,
    'A NO means file 28 did not finish. Nothing below it will read correctly, so fix this one first.' as what_it_means

  union all select 2,
    'All twenty-three new functions are in place',
    case when (select count(*) from fns z
                where to_regprocedure('public.' || z.f) is not null) = 23
         then 'yes' else 'NO' end,
    'A NO means part of file 28 is missing. The screens will show an error rather than a blank page, which is the better of the two, but attendance cannot be taken.'

  union all select 3,
    'No signed in person can write any of the five tables',
    case when (select count(*) from scope s
                join information_schema.role_table_grants g
                  on g.table_schema = 'public' and g.table_name = s.t
               where g.grantee in ('anon', 'authenticated', 'PUBLIC')
                 and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')) = 0
         then 'yes' else 'NO' end,
    'THE RULE THIS FILE IS BUILT ON. A NO means a learner could write a check-in directly, and so could set the method to a scan and name a member of staff who never scanned them. Every change is supposed to go through a function that checks who is asking.'

  union all select 4,
    'And none of the five has a write policy either',
    case when (select count(*) from scope s
                where to_regclass('public.' || s.t) is not null
                  and exists (select 1 from pg_policy p
                               where p.polrelid = to_regclass('public.' || s.t)
                                 and p.polcmd <> 'r')) = 0
         then 'yes' else 'NO' end,
    'The lesson of file 23, learned again in file 26: a policy allowing a person to write their own row allows them to write every column of it. A NO means such a policy exists here.'

  union all select 5,
    'The two tables holding a secret cannot be read by a browser role',
    case when (select count(*) from secret s
                join information_schema.role_table_grants g
                  on g.table_schema = 'public' and g.table_name = s.t
               where g.grantee in ('anon', 'authenticated', 'PUBLIC')
                 and g.privilege_type = 'SELECT') = 0
         then 'yes' else 'NO' end,
    'One holds the fingerprint of the access code and the other the card token that the QR carries. A NO hands out the thing each is protecting, in the same way a select on quiz options would hand out which answer is right.'

  union all select 6,
    'The access code is kept as a fingerprint, not as itself',
    case when (select count(*) from information_schema.columns c
                where c.table_schema = 'public'
                  and c.table_name = 'lms_attendance_days'
                  and c.column_name in ('code_hash', 'code_salt')) = 2
         then 'yes' else 'NO' end,
    'A NO means the code is being stored in a way somebody could read back. What should be kept is a salted sha-256 of it, which can be checked against but not reversed, so a copy of the database shows a hash and never PURPLE42.'

  union all select 7,
    'One check-in per person per day is enforced by the database',
    case when to_regclass('public.lms_attendance_checkins') is not null
           and exists (select 1 from pg_constraint k
                        where k.conrelid = to_regclass('public.lms_attendance_checkins')
                          and k.conname = 'ac_one_per_day'
                          and k.contype = 'u')
         then 'yes' else 'NO' end,
    'THE WHOLE ANTI-DUPLICATE MECHANISM. A NO means a phone that came back online and resent its queue could mark the same person present twice, and the register would show more people than were in the room.'

  union all select 8,
    'A resent scan is recognised by its receipt number',
    case when to_regclass('public.lms_attendance_checkins') is not null
           and exists (select 1 from pg_indexes i
                        where i.schemaname = 'public'
                          and i.tablename = 'lms_attendance_checkins'
                          and i.indexname = 'ac_client_ref_once')
         then 'yes' else 'NO' end,
    'The second half of the offline answer. A NO is survivable because row 7 still refuses the duplicate, but the refusal arrives as an error rather than as a quiet "already in", which is what the scanner shows the person holding it.'

  union all select 9,
    'One set of answers per person per day likewise',
    case when to_regclass('public.lms_attendance_responses') is not null
           and exists (select 1 from pg_constraint k
                        where k.conrelid = to_regclass('public.lms_attendance_responses')
                          and k.conname = 'ar_one_per_day'
                          and k.contype = 'u')
         then 'yes' else 'NO' end,
    'A NO means somebody could send the form twice and appear in the figures twice, which would quietly skew every average the facilitator reads.'

  union all select 10,
    'Every day boundary is Nigerian time, not the server clock',
    case when to_regprocedure('public.lms_wat_today()') is not null
           and (select count(*) from pg_proc p
                 join pg_namespace s on s.oid = p.pronamespace
                where s.nspname = 'public'
                  and p.proname = 'lms_wat_today'
                  and pg_get_functiondef(p.oid) ~ 'Africa/Lagos') = 1
         then 'yes' else 'NO' end,
    'The server clock is UTC, one hour behind Lagos. A NO means a scan at half past midnight here would be filed under the day before, which is wrong for an hour every single night.'

  union all select 11,
    'The first-sign-in screen has nowhere to write a name',
    case when to_regclass('public.lms_learner_setup') is not null
           and (select count(*) from information_schema.columns c
                 where c.table_schema = 'public'
                   and c.table_name = 'lms_learner_setup'
                   and c.column_name in ('full_name', 'name', 'email', 'phone')) = 0
         then 'yes' else 'NO' end,
    'Only staff may change a name, because it has to match the ID card. A NO means a column exists that a learner could write, which is a weaker rule than having nowhere to write it at all.'

  union all select 12,
    'Nothing in this family can be emptied in one statement',
    case when (select count(*) from information_schema.role_table_grants g
                where g.table_schema = 'public'
                  and g.table_name like 'lms\_%'
                  and g.grantee in ('anon', 'authenticated', 'PUBLIC')
                  and g.privilege_type = 'TRUNCATE') = 0
         then 'yes' else 'NO' end,
    'THE ROW THAT WILL STILL BE WORKING IN A YEAR. The default privileges on this database grant everything on anything newly created to all three browser roles, so every file that adds one leaves TRUNCATE behind unless it says otherwise. Row level security does not apply to TRUNCATE: no policy can refuse it. A NO names each one in the list underneath.'

  -- ASKED THROUGH query_to_xml, and the guard is INSIDE the string it is
  -- given, not around it. Postgres resolves relations when it plans a
  -- statement, so naming lms_participant_cards in ordinary SQL here
  -- would raise on a database without file 28 rather than print the NO
  -- that is the answer. A string is not planned until query_to_xml runs
  -- it, and the case below decides WHICH string that is, so on a
  -- database without the table the query that runs never mentions it.
  -- Each literal is one line and starts with a SQL verb, which is what
  -- the Supabase editor needs.
  union all select 13,
    'Every active participant has an ID card',
    case when coalesce((xpath('/rows/row/n/text()',
           ('<rows>' || coalesce(query_to_xml(
             case when to_regclass('public.lms_participant_cards') is null
                  then 'select 1 as n'
                  else 'select count(*) as n from participant_enrolments e where e.status = ''active'' and not exists (select 1 from lms_participant_cards c where c.participant_id = e.participant_id)'
             end, false, true, '')::text, '') || '</rows>')::xml))[1]::text::integer, 1) = 0
         then 'yes' else 'NO' end,
    'EXPECTED TO SAY NO ON THE DAY THIS GOES IN, because no card has been issued yet. It is a worklist rather than a fault: the count of people still waiting is in the list underneath. Nobody without a card can be scanned in.'

  union all select 14,
    'No function in this file deletes an attendance record',
    case when (select count(*) from pg_proc p
                join pg_namespace s on s.oid = p.pronamespace
               where s.nspname = 'public'
                 and p.proname like 'lms\_attendance%'
                 and pg_get_functiondef(p.oid) ~* 'delete[[:space:]]+from[[:space:]]+lms_attendance') = 0
         then 'yes' else 'NO' end,
    'The standing rule is that nothing a learner has touched is removed outright. A day is closed and a record is corrected, with a note of who changed it and why. A NO means something in here deletes instead.'

)
select n as "#", checking as "what was checked",
       answer as "answer", what_it_means as "what it means"
  from checks order by n;

-- ROW 12, NAMED. Which tables, if any, a signed in person could still
-- empty in one statement.
select g.table_name as "can still be emptied", g.grantee as "by"
  from information_schema.role_table_grants g
 where g.table_schema = 'public'
   and g.table_name like 'lms\_%'
   and g.grantee in ('anon', 'authenticated', 'PUBLIC')
   and g.privilege_type = 'TRUNCATE'
 group by g.table_name, g.grantee
 order by 1, 2;

-- ROW 13, NAMED. Who is still waiting for an ID card, by cohort, so the
-- worklist is a number somebody can work through rather than a NO.
--
-- Through query_to_xml for the same reason as row 13 itself, and with
-- tableforest set, so there is no table element wrapping the rows and
-- they have to be wrapped by hand before xpath can walk them.
select (xpath('/row/cohort/text()', t.x))[1]::text as "cohort",
       (xpath('/row/n/text()', t.x))[1]::text as "people with no ID card yet"
  from unnest(xpath('/rows/row',
         ('<rows>' || coalesce(query_to_xml(
           case when to_regclass('public.lms_participant_cards') is null
                then 'select null::text as cohort, 0 as n where false'
                else 'select e.cohort as cohort, count(*) as n from participant_enrolments e where e.status = ''active'' and not exists (select 1 from lms_participant_cards c where c.participant_id = e.participant_id) group by e.cohort order by 1'
           end, false, true, '')::text, '') || '</rows>')::xml)) as t(x);
