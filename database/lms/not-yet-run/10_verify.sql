-- =====================================================================
-- Run this AFTER 10_roles_and_access.sql.
-- Every row should say "yes". Anything else, send me the table.
-- =====================================================================
select 'the role is now called facilitator' as check,
       case when exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                          where t.typname = 'lms_role' and e.enumlabel = 'facilitator')
            then 'yes' else 'NO' end as answer,
       '' as detail
union all
select 'the old name is gone',
       case when not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                              where t.typname = 'lms_role' and e.enumlabel = 'uploader')
            then 'yes' else 'NO' end, ''
union all
select 'no function still refers to the old name',
       case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.prokind = 'f'
                                and p.prosrc like '%''uploader''%')
            then 'yes' else 'NO' end,
       coalesce((select string_agg(p.proname, ', ') from pg_proc p
                   join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.prokind = 'f'
                    and p.prosrc like '%''uploader''%'), '')
union all
select 'opening a lesson still works',
       case when (select lms_lesson_is_open(id) is not null from lms_lessons limit 1) then 'yes'
            when not exists (select 1 from lms_lessons) then 'yes (no lessons yet)'
            else 'NO' end, ''
union all
select 'the facilitator list exists',
       case when exists (select 1 from information_schema.tables
                          where table_schema = 'public' and table_name = 'lms_facilitators')
            then 'yes' else 'NO' end, ''
union all
select 'the facilitator list is locked down',
       case when (select relrowsecurity from pg_class where relname = 'lms_facilitators')
            then 'yes' else 'NO' end, ''
union all
select 'the five new functions are all here',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname in
                   ('lms_sync_my_access','lms_can_edit','lms_is_staff',
                    'lms_add_facilitator','lms_remove_facilitator')) = 5
            then 'yes' else 'NO' end,
       (select count(*)::text || ' of 5' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in
         ('lms_sync_my_access','lms_can_edit','lms_is_staff',
          'lms_add_facilitator','lms_remove_facilitator'))
union all
select 'staff can edit the six course tables',
       case when (select count(*) from pg_policies where schemaname = 'public'
                   and policyname in ('p_courses_edit','p_modules_edit','p_lessons_edit',
                                      'p_quiz_edit','p_q_edit','p_opt_staff_only')) = 6
            then 'yes' else 'NO' end,
       (select count(*)::text || ' of 6' from pg_policies where schemaname = 'public'
         and policyname in ('p_courses_edit','p_modules_edit','p_lessons_edit',
                            'p_quiz_edit','p_q_edit','p_opt_staff_only'))
union all
select 'every table still has its lock on',
       case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relkind = 'r'
                     and c.relname like 'lms\_%' and not c.relrowsecurity) = 0
            then 'yes' else 'NO' end,
       (select coalesce(string_agg(c.relname, ', '), 'none unlocked')
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'
           and c.relname like 'lms\_%' and not c.relrowsecurity)
union all
select 'the certification tables are untouched',
       case when (select count(*) from information_schema.tables
                   where table_schema = 'public'
                     and table_name in ('participants','participant_enrolments',
                                        'programmes','certificates')) = 4
            then 'yes' else 'NO' end, '';
