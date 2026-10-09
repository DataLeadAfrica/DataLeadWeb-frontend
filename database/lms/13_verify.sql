-- =====================================================================
-- Run this AFTER 13_course_certificates.sql. Every row should say yes,
-- except where a row explains why "no" is the correct answer today.
-- =====================================================================
select '01 the claim function exists (part A)' as check,
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.proname='lms_claim_course_certificate'
                            and pg_get_function_identity_arguments(p.oid)='p_course uuid')
            then 'yes' else 'NO' end as answer,
       'a learner calls this when they reach the end of a course' as detail
union all
select '02 it reuses the existing numbering rather than inventing one',
       case when (select p.prosrc like '%make_certificate_number%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='lms_claim_course_certificate')
            then 'yes' else 'NO' end,
       'one place decides what a certificate number looks like'
union all
select '03 it is safe to call twice',
       case when (select p.prosrc like '%is not distinct from%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='lms_claim_course_certificate')
            then 'yes' else 'NO' end,
       'it looks for an existing certificate before making one'
union all
select '04 a withdrawn certificate is not quietly reissued',
       case when (select p.prosrc like '%withdrawn%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='lms_claim_course_certificate')
            then 'yes' else 'NO' end,
       'withdrawing one is a deliberate act and this does not undo it'
union all
select '05 only a signed in learner can reach it',
       case when not exists (select 1 from information_schema.role_routine_grants
                              where routine_schema='public'
                                and routine_name='lms_claim_course_certificate'
                                and grantee in ('anon','PUBLIC'))
            then 'yes' else 'NO' end, ''
union all
select '06 the length function exists (part B)',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.proname='lms_set_lesson_duration')
            then 'yes' else 'NO' end,
       'the only way a page may correct how long a video is'
union all
select '07 it refuses anybody who is not staff',
       case when (select p.prosrc like '%lms_is_staff()%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='lms_set_lesson_duration')
            then 'yes' else 'NO' end,
       'this check is the whole of what protects the non skippable rule'
union all
select '08 a visitor who is not signed in cannot reach it',
       case when not exists (select 1 from information_schema.role_routine_grants
                              where routine_schema='public'
                                and routine_name='lms_set_lesson_duration'
                                and grantee in ('anon','PUBLIC'))
            then 'yes' else 'NO' end, ''
union all
select '09 the publish checklist asks for a programme',
       case when (select p.prosrc like '%Has a programme%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='lms_course_blockers')
            then 'yes' else 'NO' end,
       'without one a learner finishes and there is no certificate'
union all
select '10 the checklist names the lessons that are not filled in',
       case when (select p.prosrc like '%Still missing%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='lms_course_blockers')
            then 'yes' else 'NO' end,
       'so a facilitator does not have to hunt for them'
union all
select '11 courses that cannot be published yet (the data)',
       case when (select count(*) from lms_courses where programme_id is null) = 0
            then 'yes, none' else 'NO, see the detail' end,
       coalesce((select count(*)::text || ' course(s) have no programme_id. '
                      || 'Set one on each before publishing: '
                      || string_agg(slug, ', ' order by slug)
                   from lms_courses where programme_id is null), '')
union all
select '12 no table grants TRUNCATE, REFERENCES or TRIGGER',
       case when not exists (select 1 from information_schema.role_table_grants
                              where table_schema='public' and table_name like 'lms\_%'
                                and grantee in ('anon','authenticated')
                                and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER'))
            then 'yes' else 'NO' end, 'the standing rule from file 10';
