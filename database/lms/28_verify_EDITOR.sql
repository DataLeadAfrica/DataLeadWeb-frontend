with

scope(t) as (values
  ('lms_participant_cards'), ('lms_learner_setup'),
  ('lms_attendance_days'), ('lms_attendance_checkins'),
  ('lms_attendance_responses')),

secret(t) as (values ('lms_participant_cards'), ('lms_attendance_days')),

fns(f) as (values
  ('lms_wat_today()'),
  ('lms_unambiguous_code(integer)'),
  ('lms_issue_participant_card(uuid)'),
  ('lms_card_mark_lost(uuid)'),
  ('lms_participant_cards_for_print(text)'),
  ('lms_my_setup()'),
  ('lms_save_my_setup(text, text, text, text, text)'),
  ('lms_attendance_open_day(text, text, text, integer)'),
  ('lms_attendance_reveal_code(uuid, integer)'),
  ('lms_attendance_close_day(uuid)'),
  ('lms_attendance_day(uuid)'),
  ('lms_attendance_scan(uuid, text, text)'),
  ('lms_attendance_use_code(text)'),
  ('lms_attendance_my_day()'),
  ('lms_attendance_submit(text, integer, text, text)'),
  ('lms_attendance_live(uuid)'),
  ('lms_attendance_register(text, date, date)'),
  ('lms_attendance_cohorts()'),
  ('lms_attendance_correct(uuid, uuid, text)')),

checks (n, checking, answer, note) as (

  select 1,
    'check 1',
    case when (select count(*) from scope s
                where to_regclass('public.' || s.t) is not null) = 5
         then 'yes' else 'NO' end,
    ''

  union all select 2,
    'check 2',
    case when (select count(*) from fns z
                where to_regprocedure('public.' || z.f) is not null) = 19
         then 'yes' else 'NO' end,
    ''

  union all select 3,
    'check 3',
    case when (select count(*) from scope s
                join information_schema.role_table_grants g
                  on g.table_schema = 'public' and g.table_name = s.t
               where g.grantee in ('anon', 'authenticated', 'PUBLIC')
                 and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')) = 0
         then 'yes' else 'NO' end,
    ''

  union all select 4,
    'check 4',
    case when (select count(*) from scope s
                where to_regclass('public.' || s.t) is not null
                  and exists (select 1 from pg_policy p
                               where p.polrelid = to_regclass('public.' || s.t)
                                 and p.polcmd <> 'r')) = 0
         then 'yes' else 'NO' end,
    ''

  union all select 5,
    'check 5',
    case when (select count(*) from secret s
                join information_schema.role_table_grants g
                  on g.table_schema = 'public' and g.table_name = s.t
               where g.grantee in ('anon', 'authenticated', 'PUBLIC')
                 and g.privilege_type = 'SELECT') = 0
         then 'yes' else 'NO' end,
    ''

  union all select 6,
    'check 6',
    case when (select count(*) from information_schema.columns c
                where c.table_schema = 'public'
                  and c.table_name = 'lms_attendance_days'
                  and c.column_name in ('code_hash', 'code_salt')) = 2
         then 'yes' else 'NO' end,
    ''

  union all select 7,
    'check 7',
    case when to_regclass('public.lms_attendance_checkins') is not null
           and exists (select 1 from pg_constraint k
                        where k.conrelid = to_regclass('public.lms_attendance_checkins')
                          and k.conname = 'ac_one_per_day'
                          and k.contype = 'u')
         then 'yes' else 'NO' end,
    ''

  union all select 8,
    'check 8',
    case when to_regclass('public.lms_attendance_checkins') is not null
           and exists (select 1 from pg_indexes i
                        where i.schemaname = 'public'
                          and i.tablename = 'lms_attendance_checkins'
                          and i.indexname = 'ac_client_ref_once')
         then 'yes' else 'NO' end,
    ''

  union all select 9,
    'check 9',
    case when to_regclass('public.lms_attendance_responses') is not null
           and exists (select 1 from pg_constraint k
                        where k.conrelid = to_regclass('public.lms_attendance_responses')
                          and k.conname = 'ar_one_per_day'
                          and k.contype = 'u')
         then 'yes' else 'NO' end,
    ''

  union all select 10,
    'check 10',
    case when to_regprocedure('public.lms_wat_today()') is not null
           and (select count(*) from pg_proc p
                 join pg_namespace s on s.oid = p.pronamespace
                where s.nspname = 'public'
                  and p.proname = 'lms_wat_today'
                  and pg_get_functiondef(p.oid) ~ 'Africa/Lagos') = 1
         then 'yes' else 'NO' end,
    ''

  union all select 11,
    'check 11',
    case when to_regclass('public.lms_learner_setup') is not null
           and (select count(*) from information_schema.columns c
                 where c.table_schema = 'public'
                   and c.table_name = 'lms_learner_setup'
                   and c.column_name in ('full_name', 'name', 'email', 'phone')) = 0
         then 'yes' else 'NO' end,
    ''

  union all select 12,
    'check 12',
    case when (select count(*) from information_schema.role_table_grants g
                where g.table_schema = 'public'
                  and g.table_name like 'lms\_%'
                  and g.grantee in ('anon', 'authenticated', 'PUBLIC')
                  and g.privilege_type = 'TRUNCATE') = 0
         then 'yes' else 'NO' end,
    ''

  union all select 13,
    'check 13',
    case when coalesce((xpath('/rows/row/n/text()',
           ('<rows>' || coalesce(query_to_xml(
             case when to_regclass('public.lms_participant_cards') is null
                  then 'select 1 as n'
                  else 'select count(*) as n from participant_enrolments e where e.status = ''active'' and not exists (select 1 from lms_participant_cards c where c.participant_id = e.participant_id)'
             end, false, true, '')::text, '') || '</rows>')::xml))[1]::text::integer, 1) = 0
         then 'yes' else 'NO' end,
    ''

  union all select 14,
    'check 14',
    case when (select count(*) from pg_proc p
                join pg_namespace s on s.oid = p.pronamespace
               where s.nspname = 'public'
                 and p.proname like 'lms\_attendance%'
                 and pg_get_functiondef(p.oid) ~* 'delete[[:space:]]+from[[:space:]]+lms_attendance') = 0
         then 'yes' else 'NO' end,
    ''

)
select n as "#", checking as "what", answer as "answer", note as "note"
  from checks order by n;

select g.table_name as "can still be emptied", g.grantee as "by"
  from information_schema.role_table_grants g
 where g.table_schema = 'public'
   and g.table_name like 'lms\_%'
   and g.grantee in ('anon', 'authenticated', 'PUBLIC')
   and g.privilege_type = 'TRUNCATE'
 group by g.table_name, g.grantee
 order by 1, 2;

select (xpath('/row/cohort/text()', t.x))[1]::text as "cohort",
       (xpath('/row/n/text()', t.x))[1]::text as "people with no ID card yet"
  from unnest(xpath('/rows/row',
         ('<rows>' || coalesce(query_to_xml(
           case when to_regclass('public.lms_participant_cards') is null
                then 'select null::text as cohort, 0 as n where false'
                else 'select e.cohort as cohort, count(*) as n from participant_enrolments e where e.status = ''active'' and not exists (select 1 from lms_participant_cards c where c.participant_id = e.participant_id) group by e.cohort order by 1'
           end, false, true, '')::text, '') || '</rows>')::xml)) as t(x);
