-- Checks file 24. Changes nothing. Safe to run before it as well as
-- after: it prints a column of NOs rather than an error, which is the
-- answer.
--
-- PASTE 24_verify_EDITOR.sql, NOT THIS ONE. The two hold the same checks
-- and a test keeps them in step. The explanations for each numbered row
-- live in docs/lms/PHASE-6E-PLAIN.md.
--
-- ROW 8 IS THE ONE THAT WILL STILL BE WORKING IN A YEAR. The others
-- check a list of known mistakes. That one asks whether anybody who has
-- finished a module is missing its badge, by any route, so it catches a
-- new way of going wrong without anybody adding a check.
--
-- Everything that names a column, a function or a relation is asked
-- through to_regclass, to_regprocedure, information_schema or
-- query_to_xml, never a literal cast, because Postgres resolves
-- relations and columns when it PLANS a statement. Files 18 to 23 each
-- had a version of that fault and it is cheaper to write it this way
-- than to find it again.
--
-- No sentence here puts an ordinary English word after "from", "into",
-- "join", "update" or "table", because the Supabase editor appears to
-- read those as relation names, and 16_verify.sql failed in it on
-- exactly that. Every query handed to query_to_xml starts with a SQL
-- verb for the same reason.

with checks as (

  select 1 as n,
    'A learner cannot award themselves a badge' as checking,
    case when to_regclass('public.lms_module_badges') is null then 'NO'
         when not exists (
           select 1 from information_schema.role_table_grants g
            where g.table_schema = 'public' and g.table_name = 'lms_module_badges'
              and g.grantee in ('anon', 'authenticated')
              and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
         ) and not exists (
           select 1 from pg_policy
            where polrelid = to_regclass('public.lms_module_badges')
              and polcmd <> 'r'
         ) and coalesce((select c.relrowsecurity from pg_class c
                          where c.oid = to_regclass('public.lms_module_badges')), false)
         then 'yes' else 'NO' end as answer,
    'THE FILE 23 LESSON, APPLIED BEFORE THE FAULT RATHER THAN AFTER IT. A badge is a claim about work done, so the person it is about must not be able to write one. Row level security is on, a learner may read their own and nothing more, and there is no write policy of any kind: file 23 was the proof that a write policy on somebody''s own row is a write policy on every column of it. A NO means a learner can mark a module finished without doing it.' as what_it_means

  union all select 2,
    'And a badge is awarded in the same breath as the last lesson',
    case when to_regclass('public.lms_lesson_progress') is null then 'NO'
         when exists (
           select 1 from pg_trigger t
            where t.tgrelid = to_regclass('public.lms_lesson_progress')
              and t.tgname = 't_award_module_badge'
              and not t.tgisinternal
         ) then 'yes' else 'NO' end,
    'The award sits on the progress record rather than inside lms_complete_lesson, so it happens in the same transaction as the last requirement and happens whichever function wrote the row. A NO means somebody can finish every lesson of a module and be given nothing, which is the complaint that is hard to answer later because the work is already done and there is no record of when.'

  union all select 3,
    'A badge is not a certificate, and cannot quietly become one',
    case when to_regclass('public.lms_module_badges') is null then 'NO'
         when to_regprocedure('public.lms_award_module_badge()') is null then 'NO'
         when exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'lms_module_badges'
              and column_name in ('certificate_number', 'programme_id', 'revoked')
         ) then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_award_module_badge')
              like '%certificates%'
         then 'NO' else 'yes' end,
    'A badge has no number, nothing on /verify and nothing a programme points at. This row asks it twice over: the record carries no certificate shaped column, and the thing that awards one never mentions the certificate register at all. A NO is worth stopping for, because a mark of having finished a module quietly becoming a credential somebody can show an employer is a bigger decision than any file should make on its own.'

  union all select 4,
    'The learner sees it on the module, and keeps it',
    case when to_regprocedure('public.lms_my_course(text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_my_course')
              like '%badge_awarded_at%'
         then 'yes' else 'NO' end,
    'The page reads the awarded date rather than comparing lessons done against lessons, and the difference matters: a badge once earned stays earned, so a module that gains a lesson afterwards still shows its badge beside "2 of 3 lessons". Worked out by comparing the counts, the badge would silently come back off somebody who had done nothing wrong.'

  union all select 5,
    'The Overview counts learners, not everybody holding a course',
    case when to_regprocedure('public.lms_studio_overview()') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_studio_overview')
              like '%pl.id = e.user_id%'
         then 'yes' else 'NO' end,
    'It counted every active entitlement, which includes a facilitator who gave themselves access to look at their own course. On a database whose only two accounts are administrators that reported two learners on a course with an empty learner list beside it. The same fault was fixed once before in this very function, for the new learners figure, and the note above that one records it.'

  union all select 6,
    'The learner list can be narrowed to one course, and stays private',
    case when to_regprocedure('public.lms_staff_learners(text, text, text, integer, integer, uuid)') is null then 'NO'
         when has_function_privilege('anon',
                'lms_staff_learners(text, text, text, integer, integer, uuid)', 'EXECUTE') then 'NO'
         when not has_function_privilege('authenticated',
                'lms_staff_learners(text, text, text, integer, integer, uuid)', 'EXECUTE') then 'NO'
         else 'yes' end,
    'So the number beside a course and the list of who is on it can be checked against each other, which is what nobody could do before. Both halves are asked: adding the parameter meant dropping and remaking the function, a drop takes the grants away with it, and a new function is executable by PUBLIC the moment it exists. That is the file 21 lesson and file 22 had to learn it again.'

  union all select 7,
    'The control room can reach a path exam to write it',
    case when to_regprocedure('public.lms_studio_path(uuid)') is null then 'NO'
         when has_function_privilege('anon', 'lms_studio_path(uuid)', 'EXECUTE') then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_studio_path')
              like '%lms_is_admin%'
         then 'yes' else 'NO' end,
    'Everything else about a path exam has worked since file 16: writing a question, reading the bank, retiring one, sitting it and claiming the certificate all accept a path owned exam already. What was missing was a way for the browser to learn WHICH exam a path has, so there was no id to hand any of them, and the sentence on the Paths screen about holding 60 questions named a condition nobody could meet. A NO means paths still cannot be published.'

  union all select 8,
    'EVERYBODY WHO HAS FINISHED A MODULE HOLDS ITS BADGE',
    case when to_regclass('public.lms_module_badges') is null then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from (select p.user_id, m.id as mid from lms_lesson_progress p join lms_lessons l on l.id = p.lesson_id join lms_modules m on m.id = l.module_id where p.completed group by p.user_id, m.id having count(*) = (select count(*) from lms_lessons l2 where l2.module_id = m.id) and not exists (select 1 from lms_module_badges b where b.user_id = p.user_id and b.module_id = m.id)) d',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end,
    'THE ROW THAT KEEPS WORKING. The others check a list of known mistakes. This one asks whether anybody has finished every lesson of a module and been given nothing, by any route, so it catches a new way of failing to award one without anybody remembering to add a check. A NO is not an emergency: it means the people named underneath are owed a badge, and running file 24 again awards every one of them, because its backfill asks this same question.'
)
select n as "#", checking as "what was checked", answer as "answer",
       what_it_means as "what it means if the answer is not yes"
  from checks order by n;

-- WHO, when row 8 says NO.
--
-- Asked through query_to_xml, and the SQL it runs is CHOSEN by whether
-- the badge record exists, because query_to_xml protects the outer
-- statement from plan time resolution but still EXECUTES what it is
-- given. On a database without file 24 the harmless query runs instead.
--
-- THE FOREST IS WRAPPED IN A ROOT OF ITS OWN. With tableforest set,
-- query_to_xml returns bare row elements and nothing around them, so an
-- xpath looking for a root matched nothing and the list came back empty
-- while row 8 above correctly said NO. Wrapping gives xpath something to
-- stand on, and covers the no rows case for free: an empty pair of tags
-- parses, where an empty document does not.
select (xpath('/row/who/text()',  x))[1]::text as "who",
       (xpath('/row/what/text()', x))[1]::text as "finished this module",
       (xpath('/row/crs/text()',  x))[1]::text as "in this course"
  from unnest(xpath('/rows/row', ('<rows>' || coalesce(query_to_xml(
       (case when to_regclass('public.lms_module_badges') is null
             then 'select null::text as who, null::text as what, null::text as crs where false'
             else 'select coalesce(pr.full_name, ''a learner'') as who, m.title as what, c.title as crs from lms_lesson_progress p join lms_lessons l on l.id = p.lesson_id join lms_modules m on m.id = l.module_id join lms_courses c on c.id = m.course_id left join lms_profiles pr on pr.id = p.user_id where p.completed group by p.user_id, m.id, m.title, c.title, pr.full_name having count(*) = (select count(*) from lms_lessons l2 where l2.module_id = m.id) and not exists (select 1 from lms_module_badges b where b.user_id = p.user_id and b.module_id = m.id)'
        end),
       false, true, '')::text, '') || '</rows>')::xml)) as x
 order by 1, 2;
