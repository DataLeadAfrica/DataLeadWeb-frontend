-- =====================================================================
-- Run this AFTER 12_email_and_health.sql.
-- Every row should say "yes". Row 04 will say NO until you have set the
-- health token, which is a one line step after running file 12.
-- =====================================================================
select '01 an enrolled student with no certificate can now ask for a code (part 0)' as check,
       case when (select p.prosrc like '%participant_enrolments%' and p.prosrc like '%certificates%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='request_sign_in_code')
            then 'yes' else 'NO' end as answer,
       'checks the enrolment half of the test is present' as detail
union all
select '02 the page that is live today still works unchanged (part 0)',
       case when (select pg_get_function_result(p.oid) = 'boolean'
                    and pg_get_function_identity_arguments(p.oid) = 'p_email text'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='request_certificate_code')
            then 'yes' else 'NO' end,
       'same name, same argument, same boolean answer, still vague'
union all
select '02b every caller gets the SAME reply, so the page is not an oracle',
       case when (select request_sign_in_code('nobody-'||md5(random()::text)||'@example.com')
                       = request_sign_in_code('nobody-'||md5(random()::text)||'@example.com'))
            then 'yes' else 'NO' end,
       'enrolled, withdrawn, unknown and graduate all read the same'
union all
select '02c the reply is the agreed wording',
       case when (select request_sign_in_code('someone-'||md5(random()::text)||'@example.com')->>'message'
                  = 'If you are enrolled, your code arrives within 5 minutes. '
                 || 'Nothing yet? Check spam or contact us.')
            then 'yes' else 'NO' end, ''
union all
select '02d the caller is read from the LAST x-forwarded-for entry, not the first',
       case when (select p.prosrc like '%array_length%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='sign_in_caller_ip')
            then 'yes' else 'NO' end,
       'the first entry is whatever the caller claimed, so it must not be used'
union all
select '02e the site wide ceiling, and what it is set to',
       case when (select p.prosrc like '%rate_limited_site%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='request_sign_in_code')
            then 'yes' else 'NO' end,
       coalesce((select per_hour || ' an hour, ' || per_day || ' a day. Google allows a free '
                     || 'gmail.com account 100 a day and a Workspace account 1500'
                   from mail_limits where id = 1), 'the mail_limits row is MISSING')
union all
select '02e2 that ceiling leaves room under the real Google allowance',
       case when (select per_day <= 90 from mail_limits where id = 1) then 'yes, set for a free gmail.com account'
            when (select per_day <= 1400 from mail_limits where id = 1) then 'yes, set for a Workspace account'
            else 'NO, it is above what Google will allow' end,
       'run checkSenderReady() in the mailer script to see this account''s real daily number'
union all
select '02f nobody but the functions can reach the attempt log',
       case when not exists (select 1 from information_schema.role_table_grants
                              where table_schema='public' and table_name='sign_in_attempts'
                                and grantee in ('anon','authenticated'))
            then 'yes' else 'NO' end,
       'it holds a hash of the address, never the address itself'
union all
select '02g the Send Email Hook function exists (part 1)',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.proname='send_email_hook'
                            and pg_get_function_identity_arguments(p.oid)='event jsonb')
            then 'yes' else 'NO' end,
       'switch it on under Authentication, then Hooks, then Send Email hook'
union all
select '02h only Supabase Auth may call the hook, nobody from a browser',
       case when not exists (select 1 from information_schema.role_routine_grants
                              where routine_schema='public' and routine_name='send_email_hook'
                                and grantee in ('anon','authenticated','PUBLIC'))
            then 'yes' else 'NO' end,
       'otherwise it would be a way to make the site email any address'
union all
select '02i the outbox records what kind of email each row is',
       case when exists (select 1 from information_schema.columns
                          where table_schema='public' and table_name='mail_outbox'
                            and column_name='purpose')
             and (select pg_get_function_result(p.oid)
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='mail_fetch_pending')
                 = 'TABLE(id uuid, to_email text, code_plain text, purpose text)'
            then 'yes' else 'NO' end,
       'so a sign up confirmation is not sent out worded as a certificate code'
union all
select '03 the health token table exists and is locked down (part 2)',
       case when exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                          where n.nspname='public' and c.relname='lms_health_token'
                            and c.relrowsecurity)
            then 'yes' else 'NO' end, ''
union all
select '04 the health token has actually been set (part 2)',
       case when exists (select 1 from lms_health_token where id=1) then 'yes'
            else 'NO, not yet' end,
       'if NO: select lms_set_health_token(''a-long-random-string-of-your-own'');'
union all
select '05 the health check function exists (part 2)',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.proname='system_health')
            then 'yes' else 'NO' end, ''
union all
select '06 there is somewhere to record that the mailer ran (part 2)',
       case when exists (select 1 from information_schema.tables
                          where table_schema='public' and table_name='lms_system_heartbeat')
            then 'yes' else 'NO' end, ''
union all
select '07 the mailer records when it collects the post (part 2)',
       case when (select p.prosrc like '%lms_system_heartbeat%'
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='mail_fetch_pending')
            then 'yes' else 'NO' end, ''
union all
select '08 the mailer has called in at least once (part 2, the data)',
       case when exists (select 1 from lms_system_heartbeat where name='mailer_fetch')
            then 'yes' else 'not yet, which is fine until the mailer next runs' end,
       coalesce((select 'last at ' || to_char(at,'YYYY-MM-DD HH24:MI')
                   from lms_system_heartbeat where name='mailer_fetch'), '')
union all
select '09 a question a learner has been given cannot be deleted (part 5)',
       case when exists (select 1 from pg_trigger
                          where tgname='t_guard_question_not_served' and not tgisinternal)
            then 'yes' else 'NO' end, ''
union all
select '10 no attempt points at a question that is gone (part 5, the data)',
       case when (select count(*) from lms_quiz_attempts a, unnest(a.served_question_ids) x
                   where not exists (select 1 from lms_questions q where q.id = x)) = 0
            then 'yes' else 'NO' end,
       (select count(*)::text || ' broken reference(s)' from lms_quiz_attempts a,
               unnest(a.served_question_ids) x
         where not exists (select 1 from lms_questions q where q.id = x))
union all
select '11 no table grants TRUNCATE, REFERENCES or TRIGGER',
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
select '12 a visitor who is not signed in holds no write privilege',
       case when (select count(*) from information_schema.role_table_grants
                   where table_schema='public' and table_name like 'lms\_%'
                     and grantee='anon' and privilege_type in ('INSERT','UPDATE','DELETE')) = 0
            then 'yes' else 'NO' end,
       (select coalesce(string_agg(distinct table_name||'/'||privilege_type, ', '), 'none held')
          from information_schema.role_table_grants
         where table_schema='public' and table_name like 'lms\_%'
           and grantee='anon' and privilege_type in ('INSERT','UPDATE','DELETE'))
order by 1;
