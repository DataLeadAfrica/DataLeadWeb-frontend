-- Checks file 26. Changes nothing. Safe to run before it as well as
-- after: it prints a column of NOs rather than an error, which is the
-- answer.
--
-- PASTE 26_verify_EDITOR.sql, NOT THIS ONE. The two hold the same checks
-- and a test keeps them in step. The explanations for each numbered row
-- live in docs/lms/PHASE-6F-PLAIN.md.
--
-- ROW 8 IS THE ONE THAT WILL STILL BE WORKING IN A YEAR. The others
-- check a list of known mistakes. That one asks whether ANY lms table
-- lets a signed in person write it directly, so a table added later
-- with the default grants and a policy is caught without anybody
-- remembering to come back here and add a row.
--
-- Everything that names a relation or a function is asked through
-- to_regclass, to_regprocedure or information_schema, never a literal
-- cast, because Postgres resolves relations when it PLANS a statement.
-- Files 18 to 24 each had a version of that fault.
--
-- No sentence here puts an ordinary English word after "from", "into",
-- "join", "update" or "table", because the Supabase editor appears to
-- read those as relation names and 16_verify.sql failed in it on
-- exactly that.

with
-- The fourteen this file is about, written once.
scope(t) as (values
  ('lms_courses'), ('lms_lessons'), ('lms_modules'), ('lms_quizzes'),
  ('lms_questions'), ('lms_options'), ('lms_lesson_chapters'), ('lms_areas'),
  ('lms_area_tools'), ('lms_course_areas'), ('lms_course_next'),
  ('lms_countries'), ('lms_ng_states'), ('lms_popups')),

-- THE WRITTEN ALLOW LIST for row 8, with a reason beside each, because
-- a list of exceptions nobody wrote a reason for becomes a list nobody
-- dares change.
allowed(t, why) as (values
  ('lms_profiles',   'a person''s own row, limited by column grants. A learner cannot set email_verified_at, which was checked.'),
  ('lms_popup_seen', 'a learner noting they have seen a popup. Their own row, and harmless.')),

checks as (

  select 1 as n,
    'A facilitator cannot write a course that is not theirs' as checking,
    case when (select count(*) from scope s
                where to_regclass('public.' || s.t) is not null
                  and exists (select 1 from pg_policy p
                               where p.polrelid = to_regclass('public.' || s.t)
                                 and p.polcmd <> 'r')) = 0
         then 'yes' else 'NO' end as answer,
    'THE HOLE. The ownership rule lives in the functions and these policies went around it: lms_can_edit() asks only whether you are staff, where lms_may_edit_course() asks whether the course is yours. Measured on a database built from 01 to 24, a facilitator who owned no course changed the title of a lesson in somebody else''s LIVE course. A NO means any facilitator can still write any course''s rows directly, whatever the functions would have said.' as what_it_means

  union all select 2,
    'And the privileges behind those policies are gone too',
    case when (select count(*) from scope s
                join information_schema.role_table_grants g
                  on g.table_schema = 'public' and g.table_name = s.t
                where g.grantee in ('anon', 'authenticated', 'PUBLIC')
                  and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')) = 0
         then 'yes' else 'NO' end,
    'BOTH HALVES MATTER, exactly as they did in file 23. A policy dropped while the privilege stands is one re-granted policy short of being back, and a privilege revoked while the policy stands is the same thing in reverse. PUBLIC is asked about as well as the two role names, because a grant to PUBLIC is held by every role at once and is the one a check written against two names would miss.'

  union all select 3,
    'A bare delete cannot empty a shared record',
    case when to_regclass('public.lms_lesson_chapters') is null then 'NO'
         when not exists (
           select 1 from information_schema.role_table_grants g
            where g.table_schema = 'public' and g.table_name = 'lms_lesson_chapters'
              and g.grantee in ('anon', 'authenticated', 'PUBLIC')
              and g.privilege_type = 'DELETE')
         then 'yes' else 'NO' end,
    'Asked on its own because it is the one that was measured doing the most damage in a single statement: a bare delete across the chapters record removed every chapter of every course, live ones included, run by somebody who owned none of them. The chapters are shared by every course and had no ownership guard of their own.'

  union all select 4,
    'The answer key is readable only for courses a person may edit',
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
    'A facilitator could read is_correct for every exam in the Academy, including courses that were nothing to do with them. Both records are asked about, because the questions and the answers are two different places and narrowing one without the other leaves the half that matters.'

  union all select 5,
    'And the rule it asks is reachable by the people the policy applies to',
    case when to_regprocedure('public.lms_may_edit_quiz(uuid)') is null then 'NO'
         when not has_function_privilege('authenticated', 'lms_may_edit_quiz(uuid)', 'EXECUTE')
         then 'NO'
         when has_function_privilege('anon', 'lms_may_edit_quiz(uuid)', 'EXECUTE')
         then 'NO' else 'yes' end,
    'THE FILE 21 LESSON, ARRIVING IN A NEW SHAPE. A helper used inside a policy is run by whoever is querying, so taking execute off authenticated turns an ordinary read into "permission denied" for every member of staff. File 21 found this with a function sitting inside a CHECK constraint. A NO here means either the control room cannot read its own questions, or a visitor can run the rule.'

  union all select 6,
    'The two reads that rode on a write policy are back',
    case when not exists (
           select 1 from pg_policy p
            where p.polrelid = to_regclass('public.lms_options') and p.polcmd = 'r')
         then 'NO'
         when not exists (
           select 1 from pg_policy p
            where p.polrelid = to_regclass('public.lms_popups') and p.polcmd = 'r')
         then 'NO' else 'yes' end,
    'THE TRAP THIS FILE HAD TO AVOID. Two of the dropped policies were ALL policies, and an ALL policy is also a read. Neither of those two records had a SELECT policy of its own, so dropping the write without putting a read back would have taken the questions screen and the popups screen down for everybody, administrators included. Every other record in the list has a SELECT policy that names lms_is_staff() itself.'

  union all select 7,
    'A learner and a visitor are exactly where they were',
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
    'Learners were never the problem here and this file must not make them one. A learner reads 0 questions and 0 options before it and after it, because no policy on either record names them and a record with row level security on and no policy for your role returns nothing. A NO means a policy here has been widened to everybody, which would hand the answers to the people sitting the exam.'

  union all select 8,
    'NO LMS RECORD LETS A SIGNED IN PERSON WRITE IT DIRECTLY',
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
    'THE ROW THAT KEEPS WORKING. The others check a list of known mistakes. This one asks the general question, so a record added later with the default grants AND a policy that permits a write is caught without anybody remembering to come back here. It asks for BOTH together, because a grant with no policy is refused by row level security anyway and a policy with no grant is refused by the privilege, and reporting either on its own would cry wolf until nobody read the row. The allow list and the reason for each entry are printed underneath.'

  union all select 9,
    'THE SENSITIVE LEARNER RECORD HAS ONLY THE LOGGED WAY IN',
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
    'THE ROW WITH LEGAL WEIGHT. Disability detail is sensitive personal data under the Nigeria Data Protection Act 2023, and the rule is that only an administrator reads it, one learner at a time, and that every read is written to the log. Measured before this file: an administrator read EVERY row at once, directly, with nothing logged. The first clause held and the other two did not. This row asks all of it at once: no grant to anybody signed in, no policy of any kind, and the one function that may read it still writing the log. A NO means the sensitive field can be read in bulk by a route that leaves no trace of who looked.'
)
select n as "#", checking as "what was checked", answer as "answer",
       what_it_means as "what it means if the answer is not yes"
  from checks order by n;

-- WHICH ONES, when row 8 says NO.
--
-- THE ALLOW LIST IS WRITTEN OUT AGAIN HERE, and again below, because a
-- CTE belongs to one statement and these are three. The first version
-- of this file named the list once at the top and the two statements
-- underneath could not see it.
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

-- AND THE ALLOW LIST ITSELF, printed every time rather than kept in a
-- comment, so that the exceptions are read as often as the rule.
with allowed(t, why) as (values
  ('lms_profiles',   'a person''s own row, limited by column grants. A learner cannot set email_verified_at, which was checked.'),
  ('lms_popup_seen', 'a learner noting they have seen a popup. Their own row, and harmless.'))
select a.t as "left alone on purpose", a.why as "why"
  from allowed a order by 1;
