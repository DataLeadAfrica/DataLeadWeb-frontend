with

scope(t) as (values
  ('lms_courses'), ('lms_lessons'), ('lms_modules'), ('lms_quizzes'),
  ('lms_questions'), ('lms_options'), ('lms_lesson_chapters'), ('lms_areas'),
  ('lms_area_tools'), ('lms_course_areas'), ('lms_course_next'),
  ('lms_countries'), ('lms_ng_states'), ('lms_popups')),

allowed(t, why) as (values
  ('lms_profiles',   'a person''s own row, limited by column grants. A learner cannot set email_verified_at, which was checked.'),
  ('lms_popup_seen', 'a learner noting they have seen a popup. Their own row, and harmless.')),

checks (n, checking, answer, note) as (

  select 1,
    'check 1',
    case when (select count(*) from scope s
                where to_regclass('public.' || s.t) is not null
                  and exists (select 1 from pg_policy p
                               where p.polrelid = to_regclass('public.' || s.t)
                                 and p.polcmd <> 'r')) = 0
         then 'yes' else 'NO' end,
    ''

  union all select 2,
    'check 2',
    case when (select count(*) from scope s
                join information_schema.role_table_grants g
                  on g.table_schema = 'public' and g.table_name = s.t
                where g.grantee in ('anon', 'authenticated', 'PUBLIC')
                  and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')) = 0
         then 'yes' else 'NO' end,
    ''

  union all select 3,
    'check 3',
    case when to_regclass('public.lms_lesson_chapters') is null then 'NO'
         when not exists (
           select 1 from information_schema.role_table_grants g
            where g.table_schema = 'public' and g.table_name = 'lms_lesson_chapters'
              and g.grantee in ('anon', 'authenticated', 'PUBLIC')
              and g.privilege_type = 'DELETE')
         then 'yes' else 'NO' end,
    ''

  union all select 4,
    'check 4',
    case when to_regprocedure('public.lms_may_edit_quiz(uuid)') is null then 'NO'
         when not exists (
           select 1 from pg_policy p
            where p.polrelid = to_regclass('public.lms_questions')
              and p.polcmd = 'r'
              and pg_get_expr(p.polqual, p.polrelid) like '%lms_may_edit_quiz%')
         then 'NO'
         when not exists (
           select 1 from pg_policy p
            where p.polrelid = to_regclass('public.lms_options')
              and p.polcmd = 'r'
              and pg_get_expr(p.polqual, p.polrelid) like '%lms_may_edit_quiz%')
         then 'NO' else 'yes' end,
    ''

  union all select 5,
    'check 5',
    case when to_regprocedure('public.lms_may_edit_quiz(uuid)') is null then 'NO'
         when not has_function_privilege('authenticated', 'lms_may_edit_quiz(uuid)', 'EXECUTE')
         then 'NO'
         when has_function_privilege('anon', 'lms_may_edit_quiz(uuid)', 'EXECUTE')
         then 'NO' else 'yes' end,
    ''

  union all select 6,
    'check 6',
    case when not exists (
           select 1 from pg_policy p
            where p.polrelid = to_regclass('public.lms_options') and p.polcmd = 'r')
         then 'NO'
         when not exists (
           select 1 from pg_policy p
            where p.polrelid = to_regclass('public.lms_popups') and p.polcmd = 'r')
         then 'NO' else 'yes' end,
    ''

  union all select 7,
    'check 7',
    case when exists (
           select 1 from pg_policy p
            where p.polrelid in (to_regclass('public.lms_questions'),
                                 to_regclass('public.lms_options'))
              and 'anon' = any (select r.rolname from pg_roles r
                                 where r.oid = any (p.polroles)))
         then 'NO'
         when exists (
           select 1 from pg_policy p
            where p.polrelid in (to_regclass('public.lms_questions'),
                                 to_regclass('public.lms_options'))
              and p.polroles = '{0}')
         then 'NO' else 'yes' end,
    ''

  union all select 8,
    'check 8',
    case when (
      select count(*) from information_schema.role_table_grants g
       where g.table_schema = 'public' and g.table_name like 'lms\_%'
         and g.grantee in ('anon', 'authenticated', 'PUBLIC')
         and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
         and g.table_name not in (select a.t from allowed a)
         and exists (
           select 1 from pg_policy p
            where p.polrelid = to_regclass('public.' || g.table_name)
              and p.polcmd <> 'r')
    ) = 0 then 'yes' else 'NO' end,
    ''

  union all select 9,
    'check 9',
    case when to_regclass('public.lms_learner_profiles') is null then 'NO'
         when exists (
           select 1 from information_schema.role_table_grants g
            where g.table_schema = 'public' and g.table_name = 'lms_learner_profiles'
              and g.grantee in ('anon', 'authenticated', 'PUBLIC')) then 'NO'
         when exists (
           select 1 from pg_policy p
            where p.polrelid = to_regclass('public.lms_learner_profiles')) then 'NO'
         when to_regprocedure('public.lms_learner_record(uuid)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(pr.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc pr join pg_namespace ns on ns.oid = pr.pronamespace
                where ns.nspname = 'public' and pr.proname = 'lms_learner_record')
              not like '%lms_admin_actions%' then 'NO'
         else 'yes' end,
    ''
)
select n as "#", checking as "what", answer as "answer", note as "note"
  from checks order by n;

with allowed(t, why) as (values
  ('lms_profiles',   'a person''s own row, limited by column grants. A learner cannot set email_verified_at, which was checked.'),
  ('lms_popup_seen', 'a learner noting they have seen a popup. Their own row, and harmless.'))
select g.table_name as "record", g.grantee as "held by",
       string_agg(g.privilege_type, ', ' order by g.privilege_type) as "can"
  from information_schema.role_table_grants g
 where g.table_schema = 'public' and g.table_name like 'lms\_%'
   and g.grantee in ('anon', 'authenticated', 'PUBLIC')
   and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
   and g.table_name not in (select a.t from allowed a)
   and exists (select 1 from pg_policy p
                where p.polrelid = to_regclass('public.' || g.table_name)
                  and p.polcmd <> 'r')
 group by g.table_name, g.grantee
 order by 1, 2;

with allowed(t, why) as (values
  ('lms_profiles',   'a person''s own row, limited by column grants. A learner cannot set email_verified_at, which was checked.'),
  ('lms_popup_seen', 'a learner noting they have seen a popup. Their own row, and harmless.'))
select a.t as "left alone on purpose", a.why as "why"
  from allowed a order by 1;
