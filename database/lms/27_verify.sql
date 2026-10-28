-- Checks file 27. Changes nothing. Safe to run before it as well as
-- after: it prints a column of NOs rather than an error, which is the
-- answer.
--
-- PASTE 27_verify_EDITOR.sql, NOT THIS ONE. The two hold the same checks
-- and a test keeps them in step. The explanations for each numbered row
-- live in docs/lms/PHASE-6G-PLAIN.md.
--
-- ROW 6 IS THE ONE THAT WILL STILL BE WORKING IN A YEAR, and it is the
-- row that would have caught this whole thing years earlier. It asks
-- whether any LIVE course has an exam still sitting in draft, which is
-- the state every course ever built was in, silently, while the
-- publish screen showed nine green ticks over it.
--
-- Everything that names a relation or a function is asked through
-- to_regclass, to_regprocedure or information_schema, never a literal
-- cast, because Postgres resolves relations when it PLANS a statement.
-- Files 18 to 26 each had a version of that fault.
--
-- No sentence here puts an ordinary English word after "from", "into",
-- "join", "update" or "table", because the Supabase editor appears to
-- read those as relation names.

with checks as (

  select 1 as n,
    'Publishing an exam is an administrator''s decision' as checking,
    case when to_regprocedure('public.lms_publish_exam(uuid)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_publish_exam')
              like '%lms_is_admin()%'
         then 'yes' else 'NO' end as answer,
    'NOT A SECURITY ROW, and the first draft of this file wrongly said it was. It asked lms_is_staff() where every sibling asks for an administrator, but a facilitator calling it was refused anyway by the lms_guard_quiz trigger underneath, which was checked by trying it. This row asks that the function states the rule itself rather than leaning on a trigger to state it, so that the refusal names the real reason and the next reader does not need to know the trigger exists.' as what_it_means

  union all select 2,
    'And so is publishing a path',
    case when to_regprocedure('public.lms_publish_path(uuid)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_publish_path')
              like '%lms_is_admin()%'
         then 'yes' else 'NO' end,
    'Building a path is an administrator''s job everywhere else: creating one, setting its courses, setting its details. Publishing it asked only whether you were staff. As with row 1 this was not exploitable, because lms_guard_path refuses a non administrator outright, and as with row 1 the point is that the function should say the rule rather than depend on a trigger to say it.'

  union all select 3,
    'And making the exam a path will be judged by',
    case when to_regprocedure('public.lms_ensure_path_exam(uuid)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_ensure_path_exam')
              like '%lms_is_admin()%'
         then 'yes' else 'NO' end,
    'The third straggler, found by looking at the two beside it. Same shape, same reason, and it is the exam a path certificate rests on.'

  union all select 4,
    'THE PUBLISH SCREEN ASKS WHETHER THE EXAM IS PUBLISHED',
    case when to_regprocedure('public.lms_publish_checks(uuid)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_publish_checks')
              like '%The course exam is published%'
         then 'yes' else 'NO' end,
    'THE ROW THAT WOULD HAVE CAUGHT ALL OF THIS. The old checklist asked whether the exam had enough questions and ticked when it did. It never asked whether the exam was published, so the one screen whose job is to say what is left showed nine green ticks over a course no learner could finish. Not a screen that failed: a screen that reported success.'

  union all select 5,
    'A signed in administrator can reach both, and a visitor cannot',
    case when to_regprocedure('public.lms_publish_exam(uuid)') is null then 'NO'
         when to_regprocedure('public.lms_publish_path(uuid)') is null then 'NO'
         when not has_function_privilege('authenticated', 'lms_publish_exam(uuid)', 'EXECUTE') then 'NO'
         when not has_function_privilege('authenticated', 'lms_publish_path(uuid)', 'EXECUTE') then 'NO'
         when has_function_privilege('anon', 'lms_publish_exam(uuid)', 'EXECUTE') then 'NO'
         when has_function_privilege('anon', 'lms_publish_path(uuid)', 'EXECUTE') then 'NO'
         else 'yes' end,
    'The guard inside a function decides what it does. The grant decides whether the browser may call it at all. Both halves are asked, because a button onto a function the signed in role cannot execute answers "permission denied", which is the file 21 lesson, and a visitor who can call it is the opposite mistake.'

  union all select 6,
    'NO LIVE COURSE HAS AN EXAM STILL IN DRAFT',
    case when not exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'lms_quizzes'
              and column_name = 'course_id'
         ) then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_quizzes q join lms_courses c on c.id = q.course_id where q.lesson_id is null and q.module_id is null and c.status = ''published'' and q.status <> ''published''',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end,
    'THE ROW THAT KEEPS WORKING, and the one this whole file exists for. A live course whose exam is still a draft is a course nobody can ever finish: the learner watches everything, reaches a hundred per cent, and is told there is no exam. A NO is not an emergency and nothing is broken by it. It means the courses named underneath are waiting for somebody to press publish on their exam, and until that happens no learner on them can be certified.'
)
select n as "#", checking as "what was checked", answer as "answer",
       what_it_means as "what it means if the answer is not yes"
  from checks order by n;

-- WHICH ONES, when row 6 says NO.
--
-- Asked through query_to_xml because lms_quizzes.course_id arrives with
-- file 16, and a column named in a statement is resolved when the
-- statement is PLANNED rather than when a CASE reaches it. The SQL it
-- runs starts with a verb for the Editor's sake, and the forest is
-- wrapped in a root of its own because with tableforest set there is
-- nothing around the rows to stand on.
select (xpath('/row/slug/text()',  x))[1]::text as "this live course",
       (xpath('/row/title/text()', x))[1]::text as "is called",
       (xpath('/row/bank/text()',  x))[1]::text as "questions written",
       (xpath('/row/need/text()',  x))[1]::text as "questions needed"
  from unnest(xpath('/rows/row', ('<rows>' || coalesce(query_to_xml(
       (case when exists (select 1 from information_schema.columns
                           where table_schema = 'public' and table_name = 'lms_quizzes'
                             and column_name = 'course_id')
             then 'select c.slug, c.title, (select count(*) from lms_questions qq where qq.quiz_id = q.id and qq.active) as bank, ceil(q.serve_count * coalesce(q.bank_multiple, 1.5)) as need from lms_quizzes q join lms_courses c on c.id = q.course_id where q.lesson_id is null and q.module_id is null and c.status = ''published'' and q.status <> ''published'' order by c.slug'
             else 'select null::text as slug, null::text as title, null::int as bank, null::int as need where false'
        end),
       false, true, '')::text, '') || '</rows>')::xml)) as x;
