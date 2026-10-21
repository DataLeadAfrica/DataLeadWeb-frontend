-- Checks file 23. Changes nothing. Safe to run before it as well as
-- after: it prints a column of NOs rather than an error, which is the
-- answer.
--
-- PASTE 23_verify_EDITOR.sql, NOT THIS ONE. The two hold the same checks
-- and a test keeps them in step. The explanations for each numbered row
-- live in docs/lms/PHASE-6E-PLAIN.md.
--
-- ROWS 1 AND 2 ARE THE LIVE HOLE. Together they let a learner watch one
-- second of each lesson, run one update, and be issued a real
-- certificate number having never opened the exam.
--
-- ROW 7 IS THE ONE THAT WILL STILL BE WORKING IN A YEAR. The others
-- check known mistakes. That one asks whether any Academy course or path
-- without a certificate has drifted from its own certificate title, so
-- it catches a new way of drifting without anybody adding a check.
--
-- Everything that names a column or a function is asked through
-- to_regprocedure, information_schema or query_to_xml, never a literal
-- cast, because Postgres resolves relations and columns when it PLANS a
-- statement. Files 18 to 22 each had a version of that fault and it is
-- cheaper to write it this way than to find it again.

with checks as (

  select 1 as n,
    'A learner cannot mark their own lessons complete' as checking,
    case when to_regclass('public.lms_lesson_progress') is null then 'NO'
         when not exists (
           select 1 from pg_policy
            where polrelid = to_regclass('public.lms_lesson_progress')
              and polcmd <> 'r'
         ) and not exists (
           select 1 from information_schema.role_table_grants
            where table_schema = 'public' and table_name = 'lms_lesson_progress'
              and grantee in ('anon', 'authenticated')
              and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
         ) then 'yes' else 'NO' end as answer,
    'THE LIVE HOLE. File 06 made a policy covering updates on the progress record with no restriction on which columns, and a policy cannot restrict columns, so a learner could set completed and check_passed by hand and step around every rule lms_complete_lesson enforces. One second of a lesson is enough to create the row, and lms_record_watch creates it. A NO means a learner can award themselves a finished course. Both halves matter: dropping the policy while leaving the privileges in place fixes nothing, because the policy was all that stood in front of them.' as what_it_means

  union all select 2,
    'And a certificate is not issued until the exam is passed',
    case when to_regprocedure('public.lms_claim_course_certificate(uuid)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_claim_course_certificate')
              like '%q.course_id = p_course%'
         then 'yes' else 'NO' end,
    'THE OTHER HALF, and it bit an honest learner too. The claim counted quizzes reached through lms_modules, which is MODULE quizzes, and file 16 abolished those. So the count was zero for every modern course, the test read zero is less than zero, and the exam was never required at all. A NO means somebody who watched every lesson and never opened the exam is handed a certificate.'

  union all select 3,
    'The watch record and the attempt log are read only as well',
    case when (
      select count(*) from (values ('lms_watch_buckets'), ('lms_quiz_attempts')) as t(tbl)
       where to_regclass('public.' || tbl) is not null
         and exists (
           select 1 from information_schema.role_table_grants g
            where g.table_schema = 'public' and g.table_name = tbl
              and g.grantee in ('anon', 'authenticated')
              and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
         )
    ) = 0 then 'yes' else 'NO' end,
    'These two were already right, and the statements in file 23 change nothing today. They are asked about because a fault like row 1 is rarely alone, and because a later hand re-granting the lot would reopen all three at once. The attempt log is the record of what somebody actually scored.'

  union all select 4,
    'A certificate title can follow the course, but only before one is issued',
    case when to_regprocedure('public.lms_programme_title_follows(uuid, text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_programme_title_follows')
              like '%v_issued > 0%'
         then 'yes' else 'NO' end,
    'lms_create_course copied the course title to the programme row once, at creation, and nothing ever updated it again. The certificate prints the programme title, so a course created as "power-bi" would print "power-bi" for ever. It now follows, and stops the moment a certificate exists, because rewording a certificate somebody already holds is a decision for a person.'

  union all select 5,
    'And it refuses a programme no Academy course or path points at',
    case when to_regprocedure('public.lms_programme_title_follows(uuid, text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_programme_title_follows')
              like '%not exists (select 1 from lms_courses%'
         then 'yes' else 'NO' end,
    'The certification system owned programmes before the Academy existed. Nothing here may rename, reuse or delete one of its rows, so the only programme this can touch is one an Academy course or path points at. A NO means a bootcamp title could be rewritten by somebody renaming a course.'

  union all select 6,
    'Both save functions ask it, and nothing signed in can',
    case when to_regprocedure('public.lms_programme_title_follows(uuid, text)') is null then 'NO'
         when has_function_privilege('anon', 'lms_programme_title_follows(uuid, text)', 'EXECUTE')
           or has_function_privilege('authenticated', 'lms_programme_title_follows(uuid, text)', 'EXECUTE')
         then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_set_course_details')
              like '%lms_programme_title_follows%'
          and (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_set_path_details')
              like '%lms_programme_title_follows%'
         then 'yes' else 'NO' end,
    'A course has a title and a path has a certificate name, and both are printed on a certificate, so fixing one and not the other would leave half the fault. The helper itself is reached only by those two, which run as their owner, and a new function is executable by PUBLIC the moment it exists.'

  union all select 7,
    'EVERY COURSE AND PATH WITHOUT A CERTIFICATE STILL MATCHES ITS OWN',
    case when not exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'lms_paths'
              and column_name = 'programme_id'
         ) then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from ('
                || 'select 1 from lms_courses c join programmes pr on pr.id = c.programme_id where c.status <> ''archived'' and pr.title <> c.title and not exists (select 1 from certificates ct where ct.programme_id = pr.id)'
                || ' union all '
                || 'select 1 from lms_paths p join programmes pr on pr.id = p.programme_id where pr.title <> p.certificate_name and not exists (select 1 from certificates ct where ct.programme_id = pr.id)'
                || ') d',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end,
    'THE ROW THAT KEEPS WORKING. The others check a list of known mistakes. This one asks whether anything has drifted, by any route, and so catches a new way of drifting without anybody remembering to add a check. A NO is not an emergency and nothing is broken by it: it means somebody renamed a course through a path this file does not cover, and the list printed underneath names them. Archived courses are left out, and so is anything with a certificate against it, because those are supposed to stay where they are.'
)
select n as "#", checking as "what was checked", answer as "answer",
       what_it_means as "what it means if the answer is not yes"
  from checks order by n;

-- WHICH ONES, when row 7 says NO.
--
-- Asked through query_to_xml, and the SQL it runs is CHOSEN by whether
-- the column exists, because query_to_xml protects the outer statement
-- from plan time resolution but still EXECUTES what it is given.
-- lms_paths.programme_id arrives with file 16, so on an older database
-- the harmless query is run instead. coalesce covers the empty case,
-- where query_to_xml hands back nothing at all and xpath on an empty
-- document raises "could not parse XML document".
--
-- THE FOREST IS WRAPPED IN A ROOT OF ITS OWN. With tableforest set,
-- query_to_xml returns bare <row> elements and no <table> around them,
-- so an xpath of /table/row matched nothing and the list came back
-- empty while row 7 above correctly said NO. Wrapping in <rows> gives
-- xpath something to stand on, and covers the no rows case for free:
-- an empty <rows></rows> parses, where an empty document does not.
select (xpath('/row/kind/text()',  x))[1]::text as "what",
       (xpath('/row/slug/text()',  x))[1]::text as "its address",
       (xpath('/row/mine/text()',  x))[1]::text as "it is called",
       (xpath('/row/cert/text()',  x))[1]::text as "its certificate says"
  from unnest(xpath('/rows/row', ('<rows>' || coalesce(query_to_xml(
       'select ''course'' as kind, c.slug, c.title as mine, pr.title as cert from lms_courses c join programmes pr on pr.id = c.programme_id where c.status <> ''archived'' and pr.title <> c.title and not exists (select 1 from certificates ct where ct.programme_id = pr.id)'
       || ' union all '
       || (case when exists (
                  select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'lms_paths'
                     and column_name = 'programme_id')
                then 'select ''path'' as kind, p.slug, p.certificate_name as mine, pr.title as cert from lms_paths p join programmes pr on pr.id = p.programme_id where pr.title <> p.certificate_name and not exists (select 1 from certificates ct where ct.programme_id = pr.id)'
                else 'select null::text, null::text, null::text, null::text where false'
           end),
       false, true, '')::text, '') || '</rows>')::xml)) as x
 order by 1, 2;
