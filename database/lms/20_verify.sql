-- Checks file 20. Changes nothing. Safe to run before it as well as
-- after: it prints a column of NOs rather than an error.
--
-- PASTE 20_verify_EDITOR.sql, NOT THIS ONE. The explanations for each
-- numbered row live in docs/lms/PHASE-6D-PLAIN.md.
--
-- ROWS 1 AND 2 ARE THE FAULT. Until file 20, nothing in the control
-- room ever made a lesson check, so no course built there could be
-- published at all.

with checks as (

  select 1 as n,
    'Making a video lesson also makes its check' as checking,
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_save_lesson'
    ) like '%insert into lms_quizzes%' then 'yes' else 'NO' end as answer,
    'A NO means every lesson built in the builder has no check, the Questions page has no id to give the editor, and publish check 7 can never pass. No course can be published.' as what_it_means

  union all select 2,
    'No video lesson is sitting without one',
    case when (
      select count(*) from lms_lessons l
       join lms_modules m on m.id = l.module_id
       join lms_courses c on c.id = m.course_id
       where l.type = 'video' and c.status <> 'archived'
         and not exists (select 1 from lms_quizzes q where q.lesson_id = l.id)
    ) = 0 then 'yes' else 'NO' end,
    'These are lessons made before file 20. Each one is a course that cannot be published until somebody notices.'

  union all select 3,
    'A lesson check belongs to its lesson and to nothing else',
    -- Asked through query_to_xml, and the columns checked before it is
    -- asked at all. lms_quizzes.course_id and path_id arrive with file
    -- 16, and Postgres resolves every column in a statement when it
    -- PLANS the statement, so naming one that does not exist yet is an
    -- error before any CASE gets a chance to guard it. This file would
    -- then blow up on a database that is only part way up to date,
    -- instead of printing the column of NOs that is the honest answer.
    -- Files 18 and 19 both had this same fault and it was found the
    -- same way, by running a verify before the file it verifies.
    case when not exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'lms_quizzes'
              and column_name = 'course_id'
         ) then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_quizzes q where q.lesson_id is not null and (q.module_id is not null or q.course_id is not null or q.path_id is not null)',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end,
    'Exactly one owner is allowed, and a row with two is refused on the way in, so a NO here would mean the rule itself has gone.'

  union all select 4,
    'Adding a set of questions asks whose course it is',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_create_quiz'
    ) like '%lms_may_edit_course%' then 'yes' else 'NO' end,
    'It used to ask only whether the caller was staff, so a facilitator could attach questions to any lesson of anybody course.'

  union all select 5,
    'And nothing signed in is granted it, because nothing calls it',
    case when to_regprocedure('public.lms_create_quiz(uuid, uuid, text)') is null then 'NO'
         when not has_function_privilege('authenticated', 'lms_create_quiz(uuid, uuid, text)', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_create_quiz(uuid, uuid, text)', 'EXECUTE')
         then 'yes' else 'NO' end,
    'Revoking the two roles alone is not enough: a function is executable by PUBLIC the moment it is made, so the grant survives unless PUBLIC is named as well.'

  union all select 6,
    'A lesson that is not a video is left alone',
    case when (
      select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_save_lesson'
    ) like '%= ''video''%' then 'yes' else 'NO' end,
    'A check on a reading lesson is a row nobody ever looks at, since check 7 only asks about video lessons.'
)
select n as "#", checking as "what was checked", answer as "answer",
       what_it_means as "what it means if the answer is not yes"
  from checks order by n;
