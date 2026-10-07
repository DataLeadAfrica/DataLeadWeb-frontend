-- =====================================================================
-- Run this AFTER 11_housekeeping.sql.
-- Every row should say "yes", except row 14 which reports honestly if
-- pg_cron is not installed. Anything else, send me the table.
--
-- Rows 01 to 05 check part A, quiz safety.
-- Rows 06 to 13 check part B, housekeeping, including four checks on the
-- data itself rather than on the code.
-- Rows 14 to 17 check the report and part C, permissions.
-- =====================================================================
select '01 the three new progress columns exist (A, B)' as check,
       case when (select count(*) from information_schema.columns
                   where table_schema='public' and table_name='lms_lesson_progress'
                     and column_name in ('final_coverage','check_passed','check_passed_at')) = 3
            then 'yes' else 'NO' end as answer,
       (select string_agg(column_name, ', ' order by column_name)
          from information_schema.columns
         where table_schema='public' and table_name='lms_lesson_progress'
           and column_name in ('final_coverage','check_passed','check_passed_at')) as detail
union all
select '02 an attempt with nothing to mark is refused, not passed (A1)',
       case when (select p.prosrc like '%nothing has been marked%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='lms_submit_quiz')
            then 'yes' else 'NO' end,
       'checks the guard is present in lms_submit_quiz'
union all
select '03 no marks on offer can never be a pass (A1)',
       case when (select p.prosrc like '%v_max > 0 and v_pct >= v_q.pass_percent%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='lms_submit_quiz')
            then 'yes' else 'NO' end,
       'checks the pass test itself requires marks to exist'
union all
select '04 an empty set of questions blocks its course (A2)',
       case when (select p.prosrc like '%Every set of questions has at least one question%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='lms_course_blockers')
            then 'yes' else 'NO' end,
       'checks the blocker is present in lms_course_blockers'
union all
select '05 an empty set of questions cannot be published (A2)',
       case when exists (select 1 from pg_trigger
                          where tgname='t_guard_quiz_has_questions' and not tgisinternal)
            then 'yes' else 'NO' end, ''
union all
select '06 completing a lesson throws its slices away (B1)',
       case when (select count(*) from pg_trigger
                   where tgname in ('t_progress_keep_coverage','t_progress_tidy_up')
                     and not tgisinternal) = 2
            then 'yes' else 'NO' end,
       (select count(*)::text || ' of 2' from pg_trigger
         where tgname in ('t_progress_keep_coverage','t_progress_tidy_up') and not tgisinternal)
union all
select '07 completion reads the progress row, not the attempts table (B2)',
       case when (select p.prosrc like '%check_passed%' and p.prosrc not like '%lms_quiz_attempts%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='lms_complete_lesson')
            then 'yes' else 'NO' end,
       'this is what makes deleting lesson check attempts safe'
union all
select '08 coverage survives the slices going (B1)',
       case when (select p.prosrc like '%final_coverage%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='lms_watch_coverage')
            then 'yes' else 'NO' end, ''

-- ---------------------------------------------------------------------
-- checks on the data itself
-- ---------------------------------------------------------------------
union all
select '09 no live set of questions is empty (A2, the data)',
       case when (select count(*) from lms_quizzes q
                   where q.status='published'
                     and not exists (select 1 from lms_questions x
                                      where x.quiz_id=q.id and x.active)) = 0
            then 'yes' else 'NO' end,
       (select coalesce(string_agg(coalesce(nullif(btrim(q.title),''),'untitled'), ', '), 'none')
          from lms_quizzes q where q.status='published'
           and not exists (select 1 from lms_questions x where x.quiz_id=q.id and x.active))
union all
select '10 no completed lesson still holds watch slices (B1, the data)',
       case when (select count(*) from lms_watch_buckets b
                   join lms_lesson_progress p
                     on p.user_id=b.user_id and p.lesson_id=b.lesson_id
                  where p.completed) = 0
            then 'yes' else 'NO' end,
       (select count(*)::text || ' slice(s) left behind' from lms_watch_buckets b
          join lms_lesson_progress p on p.user_id=b.user_id and p.lesson_id=b.lesson_id
         where p.completed)
union all
select '11 no completed lesson still holds check attempts (B2, the data)',
       case when (select count(*) from lms_quiz_attempts a
                   join lms_quizzes q on q.id=a.quiz_id
                   join lms_lesson_progress p
                     on p.user_id=a.user_id and p.lesson_id=q.lesson_id
                  where q.lesson_id is not null and p.completed) = 0
            then 'yes' else 'NO' end,
       (select count(*)::text || ' attempt(s) left behind' from lms_quiz_attempts a
          join lms_quizzes q on q.id=a.quiz_id
          join lms_lesson_progress p on p.user_id=a.user_id and p.lesson_id=q.lesson_id
         where q.lesson_id is not null and p.completed)
union all
select '12 nobody is locked out of a lesson they finished (B2, the data)',
       case when (select count(*) from lms_lesson_progress p
                   where p.completed and not p.check_passed
                     and exists (select 1 from lms_quizzes q
                                  where q.lesson_id = p.lesson_id and q.status='published')) = 0
            then 'yes' else 'NO' end,
       (select count(*)::text || ' learner-lesson(s) completed but with no pass recorded'
          from lms_lesson_progress p
         where p.completed and not p.check_passed
           and exists (select 1 from lms_quizzes q
                        where q.lesson_id = p.lesson_id and q.status='published'))
union all
select '13 every completed video lesson kept its coverage figure (B1, the data)',
       case when (select count(*) from lms_lesson_progress p
                   join lms_lessons l on l.id = p.lesson_id
                  where p.completed and l.type='video' and p.final_coverage is null) = 0
            then 'yes' else 'NO' end,
       (select count(*)::text || ' completed video lesson(s) with no figure'
          from lms_lesson_progress p join lms_lessons l on l.id = p.lesson_id
         where p.completed and l.type='video' and p.final_coverage is null)

-- ---------------------------------------------------------------------
-- the prune, the report, and permissions
-- ---------------------------------------------------------------------
union all
select '14 the nightly prune is scheduled (B3)',
       case when lms_prune_job_status() = 'scheduled' then 'yes'
            else 'no: ' || lms_prune_job_status() end,
       'if pg_cron is not installed, run select * from lms_prune_watch_buckets() by hand'
union all
select '15 the storage report exists and is administrator only (B4)',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.proname='lms_storage_report'
                            and p.prosrc like '%Only the administrator%')
            then 'yes' else 'NO' end, ''
union all
select '16 no table grants TRUNCATE, REFERENCES or TRIGGER (C)',
       case when (select count(*) from information_schema.role_table_grants
                   where table_schema='public' and table_name like 'lms\_%'
                     and grantee in ('anon','authenticated')
                     and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')) = 0
            then 'yes' else 'NO' end,
       (select coalesce(string_agg(distinct table_name||'/'||privilege_type, ', '), 'none held')
          from information_schema.role_table_grants
         where table_schema='public' and table_name like 'lms\_%'
           and grantee in ('anon','authenticated')
           and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER'))
union all
select '17 a visitor who is not signed in holds no write privilege (C)',
       case when (select count(*) from information_schema.role_table_grants
                   where table_schema='public' and table_name like 'lms\_%'
                     and grantee='anon' and privilege_type in ('INSERT','UPDATE','DELETE')) = 0
            then 'yes' else 'NO' end,
       (select coalesce(string_agg(distinct table_name||'/'||privilege_type, ', '), 'none held')
          from information_schema.role_table_grants
         where table_schema='public' and table_name like 'lms\_%'
           and grantee='anon' and privilege_type in ('INSERT','UPDATE','DELETE'))
order by 1;
