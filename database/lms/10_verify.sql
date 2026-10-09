-- =====================================================================
-- Run this AFTER 10_roles_and_access.sql (version 2).
-- Every row should say "yes". Anything else, send me the table.
--
-- Rows 1 to 10 check version 1's work. Rows 11 to 18 check the six
-- things the outside review asked for.
-- =====================================================================
select '01 the role is now called facilitator' as check,
       case when exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                          where t.typname = 'lms_role' and e.enumlabel = 'facilitator')
            then 'yes' else 'NO' end as answer,
       '' as detail
union all
select '02 the old name is gone',
       case when not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                              where t.typname = 'lms_role' and e.enumlabel = 'uploader')
            then 'yes' else 'NO' end, ''
union all
select '03 no function still refers to the old name',
       case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.prokind = 'f'
                                and p.prosrc like '%''uploader''%')
            then 'yes' else 'NO' end,
       coalesce((select string_agg(p.proname, ', ') from pg_proc p
                   join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.prokind = 'f'
                    and p.prosrc like '%''uploader''%'), '')
union all
select '04 opening a lesson still works',
       case when (select lms_lesson_is_open(id) is not null from lms_lessons limit 1) then 'yes'
            when not exists (select 1 from lms_lessons) then 'yes (no lessons yet)'
            else 'NO' end, ''
union all
select '05 the facilitator list exists',
       case when exists (select 1 from information_schema.tables
                          where table_schema = 'public' and table_name = 'lms_facilitators')
            then 'yes' else 'NO' end, ''
union all
select '06 the facilitator list is locked down',
       case when (select relrowsecurity from pg_class where relname = 'lms_facilitators')
            then 'yes' else 'NO' end, ''
union all
select '07 the sign in and staff functions are all here',
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
select '08 staff can edit the six course tables',
       case when (select count(*) from pg_policies where schemaname = 'public'
                   and policyname in ('p_courses_edit','p_modules_edit','p_lessons_edit',
                                      'p_quiz_edit','p_q_edit','p_opt_staff_only')) = 6
            then 'yes' else 'NO' end,
       (select count(*)::text || ' of 6' from pg_policies where schemaname = 'public'
         and policyname in ('p_courses_edit','p_modules_edit','p_lessons_edit',
                            'p_quiz_edit','p_q_edit','p_opt_staff_only'))
union all
select '09 every table still has its lock on',
       case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relkind = 'r'
                     and c.relname like 'lms\_%' and not c.relrowsecurity) = 0
            then 'yes' else 'NO' end,
       (select coalesce(string_agg(c.relname, ', '), 'none unlocked')
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'
           and c.relname like 'lms\_%' and not c.relrowsecurity)
union all
select '10 the certification tables are untouched',
       case when (select count(*) from information_schema.tables
                   where table_schema = 'public'
                     and table_name in ('participants','participant_enrolments',
                                        'programmes','certificates')) = 4
            then 'yes' else 'NO' end, ''

-- ---------------------------------------------------------------------
-- review item 1: a returning bootcamp student is not locked out
-- ---------------------------------------------------------------------
union all
select '11 the sign in check renews an expiry date (item 1)',
       case when (select p.prosrc like '%has been renewed%'
                    and p.prosrc like '%v_was is distinct from v_exp%'
                    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'lms_sync_my_access')
            then 'yes' else 'NO' end,
       'checks the renew branch is present in lms_sync_my_access'

-- ---------------------------------------------------------------------
-- review item 2: only the administrator publishes
-- ---------------------------------------------------------------------
union all
select '12 all seven guard triggers are in place (item 2)',
       case when (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
                   join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and not t.tgisinternal
                    and t.tgname in ('t_guard_course','t_guard_path','t_guard_quiz',
                                     't_guard_module','t_guard_lesson','t_guard_question',
                                     't_guard_option')) = 7
            then 'yes' else 'NO' end,
       (select count(*)::text || ' of 7' from pg_trigger t join pg_class c on c.oid = t.tgrelid
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and not t.tgisinternal
           and t.tgname in ('t_guard_course','t_guard_path','t_guard_quiz',
                            't_guard_module','t_guard_lesson','t_guard_question','t_guard_option'))
union all
select '13 every guard fires on insert, update and delete (item 2)',
       case when (select count(*) from pg_trigger t
                   where not t.tgisinternal and t.tgname like 't\_guard\_%'
                     and (t.tgtype & 4) > 0 and (t.tgtype & 8) > 0 and (t.tgtype & 16) > 0) = 7
            then 'yes' else 'NO' end, ''

-- ---------------------------------------------------------------------
-- review item 3: importing questions does not delete the bank
-- ---------------------------------------------------------------------
union all
select '14 importing retires old questions instead of deleting (item 3)',
       case when (select p.prosrc like '%set active = false%'
                    and p.prosrc not like '%delete from lms_questions%'
                    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'lms_import_questions')
            then 'yes' else 'NO' end,
       'checks lms_import_questions retires and never deletes'
union all
select '15 no part-finished attempt points at a question that is gone (item 3)',
       case when (select count(*) from lms_quiz_attempts a,
                        unnest(a.served_question_ids) x
                   where not exists (select 1 from lms_questions q where q.id = x)) = 0
            then 'yes' else 'NO' end,
       (select count(*)::text || ' broken reference(s)' from lms_quiz_attempts a,
               unnest(a.served_question_ids) x
         where not exists (select 1 from lms_questions q where q.id = x))

-- ---------------------------------------------------------------------
-- review item 4: access changes without waiting for a sign in
-- ---------------------------------------------------------------------
union all
select '16 the nightly sweep function exists (item 4)',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                          where n.nspname = 'public' and p.proname = 'lms_nightly_access_sweep')
            then 'yes' else 'NO' end, ''
union all
select '17 the nightly job is scheduled (item 4)',
       case when lms_nightly_job_status() = 'scheduled' then 'yes'
            else 'no: ' || lms_nightly_job_status() end,
       'if pg_cron is not installed, run the sweep by hand or turn pg_cron on'

-- ---------------------------------------------------------------------
-- review item 5: table permissions
-- ---------------------------------------------------------------------
union all
select '18 nobody holds TRUNCATE, REFERENCES or TRIGGER (item 5)',
       case when (select count(*) from information_schema.role_table_grants
                   where table_schema = 'public' and table_name like 'lms\_%'
                     and grantee in ('anon','authenticated')
                     and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')) = 0
            then 'yes' else 'NO' end,
       (select coalesce(string_agg(distinct table_name || '/' || privilege_type, ', '), 'none held')
          from information_schema.role_table_grants
         where table_schema = 'public' and table_name like 'lms\_%'
           and grantee in ('anon','authenticated')
           and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER'))
union all
select '19 a visitor who is not signed in cannot write (item 5)',
       case when (select count(*) from information_schema.role_table_grants
                   where table_schema = 'public' and table_name like 'lms\_%'
                     and grantee = 'anon'
                     and privilege_type in ('INSERT','UPDATE','DELETE')) = 0
            then 'yes' else 'NO' end,
       (select coalesce(string_agg(distinct table_name || '/' || privilege_type, ', '), 'none held')
          from information_schema.role_table_grants
         where table_schema = 'public' and table_name like 'lms\_%'
           and grantee = 'anon' and privilege_type in ('INSERT','UPDATE','DELETE'))
union all
select '20 a signed in person can still read the tables (item 5)',
       case when (select count(*) from information_schema.role_table_grants
                   where table_schema = 'public' and table_name like 'lms\_%'
                     and grantee = 'authenticated' and privilege_type = 'SELECT') >= 17
            then 'yes' else 'NO' end,
       (select count(*)::text || ' table(s) readable'
          from information_schema.role_table_grants
         where table_schema = 'public' and table_name like 'lms\_%'
           and grantee = 'authenticated' and privilege_type = 'SELECT')
order by 1;
