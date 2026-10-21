-- Checks file 22. Changes nothing. Safe to run before it as well as
-- after: it prints a column of NOs rather than an error, which is the
-- answer.
--
-- PASTE 22_verify_EDITOR.sql, NOT THIS ONE. The two hold the same checks
-- and a test keeps them in step. The explanations for each numbered row
-- live in docs/lms/PHASE-6E-PLAIN.md.
--
-- Rows 1 and 3 are the two Big Sam ran into: a course with no exam, and
-- a path that could never issue a certificate.
--
-- Everything that names a column or a function is asked through
-- to_regprocedure, information_schema or query_to_xml, never a literal
-- cast, because Postgres resolves relations and columns when it PLANS a
-- statement. Naming lms_paths.programme_id directly would raise on a
-- database that has not had file 16 yet, instead of printing a NO, and
-- files 18, 19, 20 and 21 all had a version of that fault.

with checks as (

  select 1 as n,
    'Every course that can still be taken has an exam' as checking,
    -- Through query_to_xml, because lms_quizzes.course_id arrives with
    -- file 16 and a column named in a statement is resolved when the
    -- statement is PLANNED. I wrote the warning about this at the top of
    -- this file and then put a bare reference in the very first row.
    case when not exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'lms_quizzes'
              and column_name = 'course_id'
         ) then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_courses c where c.status <> ''archived'' and not exists (select 1 from lms_quizzes q where q.course_id = c.id)',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end as answer,
    'A course with no exam has nothing for the Course exam page to open, so writing a question answered "invalid input syntax for type uuid" and the course could never be published. Courses made before file 17 are the ones affected, and Big Sam Phase 4 test course was one.' as what_it_means

  union all select 2,
    'And a new course still gets one, with the agreed numbers',
    case when to_regprocedure('public.lms_ensure_course_exam(uuid)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_ensure_course_exam')
              like '%70, 2, 20, 1440, true, ''draft'', 40, 1.5%'
         then 'yes' else 'NO' end,
    'The backfill in step 1 copies these numbers because it cannot call the function, which guards itself with lms_is_staff() and so refuses in the SQL editor where nobody is signed in. A NO means the two have drifted apart and a backfilled exam no longer matches a freshly made one.'

  union all select 3,
    'Every path has a programme, so a certificate can be issued',
    case when not exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'lms_paths'
              and column_name = 'programme_id'
         ) then 'NO'
         when (xpath('/row/c/text()', query_to_xml(
                'select count(*) as c from lms_paths where programme_id is null',
                false, true, '')))[1]::text::integer = 0
         then 'yes' else 'NO' end,
    'Without one, lms_claim_path_certificate answers "This path has no programme attached" and refuses, so no path certificate could ever be issued however much work a learner did. A NO means at least one path is still in that state.'

  union all select 4,
    'And a path made after this one gets its programme too',
    case when to_regprocedure('public.lms_create_path(text, text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_create_path')
              like '%programmes%'
         then 'yes' else 'NO' end,
    'The backfill in step 2 fixes the paths that exist. This is what stops the next one being made without a programme, which is how all of them got that way.'

  union all select 5,
    'The programme is titled with the certificate name',
    case when to_regprocedure('public.lms_create_path(text, text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_create_path')
              like '%values (v_slug, v_cert,%'
         then 'yes' else 'NO' end,
    'The programme title is what somebody reads on the certificate, so it has to be "Professional Certificate in Data Analytics" and not "Data Analytics". A NO means a path certificate would carry the path name instead.'

  union all select 6,
    'The certificate tile counts when a certificate was ISSUED',
    case when to_regprocedure('public.lms_studio_certificate_counts()') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_studio_certificate_counts')
              like '%ct.issued_at >=%'
         then 'yes' else 'NO' end,
    'It counted completed_on, which is the day the TRAINING ended and often weeks before anybody issued the certificate. The old number was not answering "how many went out recently" and was not answering anything else either.'

  union all select 7,
    'Over a calendar month that starts at midnight in Lagos',
    case when to_regprocedure('public.lms_studio_certificate_counts()') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_studio_certificate_counts')
              like '%Africa/Lagos%'
         then 'yes' else 'NO' end,
    'The server runs on UTC, an hour behind Abuja. Without the time zone, the month would turn over at one in the morning Lagos time, and on the first of the month that hour is the difference between a tile that reads zero and one that reads correctly.'

  union all select 8,
    'And the column says so, so nobody reads it as a week',
    case when to_regprocedure('public.lms_studio_certificate_counts()') is null then 'NO'
         when exists (
           select 1 from pg_proc p
             join pg_namespace ns on ns.oid = p.pronamespace
             join unnest(p.proargnames) as nm on true
            where ns.nspname = 'public' and p.proname = 'lms_studio_certificate_counts'
              and nm = 'this_month'
         ) then 'yes' else 'NO' end,
    'The returned column was called this_week. Changing a return type needs the function dropped and remade, so a NO here means the drop did not happen and the pages are reading a month out of something still called a week.'

  union all select 9,
    'The same tile on the Overview changed with it',
    case when to_regprocedure('public.lms_studio_overview()') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_studio_overview')
              like '%ct.issued_at >=%'
         then 'yes' else 'NO' end,
    'There are two of these tiles, one on the Overview and one on Certificates, and they are built by different functions. A NO means the two now disagree with each other, which is worse than both being wrong in the same way.'

  union all select 10,
    'Neither one is reachable by a visitor',
    case when to_regprocedure('public.lms_studio_certificate_counts()') is null
           or to_regprocedure('public.lms_studio_overview()') is null then 'NO'
         when not has_function_privilege('anon', 'lms_studio_certificate_counts()', 'EXECUTE')
          and not has_function_privilege('public', 'lms_studio_certificate_counts()', 'EXECUTE')
          and has_function_privilege('authenticated', 'lms_studio_certificate_counts()', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_studio_overview()', 'EXECUTE')
          and has_function_privilege('authenticated', 'lms_studio_overview()', 'EXECUTE')
         then 'yes' else 'NO' end,
    'A dropped function takes its grants with it and a new one is executable by PUBLIC, so dropping lms_studio_certificate_counts to rename its column handed it to everybody until the grants were restated. That is the file 21 lesson arriving again one file later. Both of these read the whole certificate register, so a NO means a signed out visitor can count it.'

  union all select 11,
    'Archiving a course needs a reason and leaves a note of it',
    case when to_regprocedure('public.lms_archive_course(uuid, text)') is null then 'NO'
         when to_regprocedure('public.lms_archive_course(uuid)') is not null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_archive_course')
              like '%jsonb_build_object(''reason''%'
         then 'yes' else 'NO' end,
    'It logged that a course was archived and never why. The second condition matters as much as the first: the old one argument version must be GONE, because leaving it would make two functions of the same name and the pages would keep calling the one that asks for nothing.'

  union all select 12,
    'And it refuses a course that is still live',
    case when to_regprocedure('public.lms_archive_course(uuid, text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_archive_course')
              like '%This course is live%'
         then 'yes' else 'NO' end,
    'A learner part way through a live course should not have it disappear underneath them. Unpublishing is a separate decision with its own blockers, so this one sends you there instead of doing both at once.'

  union all select 13,
    'An archived course can be brought back, to draft and not to live',
    case when to_regprocedure('public.lms_restore_course(uuid, text)') is null then 'NO'
         when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_restore_course')
              like '%set status = ''draft''%'
         then 'yes' else 'NO' end,
    'Nothing used to turn an archived course back to draft, so archiving was final in practice even though the row was still there. It comes back as a DRAFT on purpose: appearing again is one decision and going live is another, with the publish checklist in between.'

  union all select 14,
    'Neither archiving nor restoring is reachable by a visitor',
    case when to_regprocedure('public.lms_archive_course(uuid, text)') is null
           or to_regprocedure('public.lms_restore_course(uuid, text)') is null then 'NO'
         when not has_function_privilege('anon', 'lms_archive_course(uuid, text)', 'EXECUTE')
          and not has_function_privilege('public', 'lms_archive_course(uuid, text)', 'EXECUTE')
          and has_function_privilege('authenticated', 'lms_archive_course(uuid, text)', 'EXECUTE')
          and not has_function_privilege('anon', 'lms_restore_course(uuid, text)', 'EXECUTE')
          and not has_function_privilege('public', 'lms_restore_course(uuid, text)', 'EXECUTE')
          and has_function_privilege('authenticated', 'lms_restore_course(uuid, text)', 'EXECUTE')
         then 'yes' else 'NO' end,
    'Both are new functions, and a new function is executable by PUBLIC the moment it exists. Both ask lms_is_admin() inside, so a visitor would be refused anyway, but a function that takes a course id and changes its status has no business being callable by somebody with no account.'
  union all select 15,
    'No two programmes share a slug, and no two share a code',
    -- Counted, never raised. A database where two already clash must get
    -- a NO it can act on, not an error that hides every other row, so
    -- this groups and counts rather than asserting anything. The list
    -- underneath names them.
    case when (select count(*) from (
                 select pr.slug from programmes pr group by pr.slug having count(*) > 1
               ) d) = 0
          and (select count(*) from (
                 select pr.code from programmes pr group by pr.code having count(*) > 1
               ) d) = 0
         then 'yes' else 'NO' end,
    'THE ROW THE REVIEW ASKED FOR. The certification system owned programmes before the Academy existed, and certificateConfig.ts keys partner logos and certificate templates by programme slug. An Academy programme landing on a bootcamp slug means one of two things: a duplicate key error that stops this file dead, or a path certificate quietly borrowing a bootcamp partner logos. The code matters the same way, because make_certificate_number is handed the code and the number goes on the certificate. A NO does NOT mean this file failed: a clash that was already there is left exactly as it is, because nothing here changes a row the certification system owns. It means somebody has two to look at, and the list printed underneath names them.'

  union all select 16,
    'And the thing that keeps it that way is in place, and private',
    case when to_regprocedure('public.lms_free_programme_identity(text, text)') is null then 'NO'
         when has_function_privilege('anon', 'lms_free_programme_identity(text, text)', 'EXECUTE')
           or has_function_privilege('authenticated', 'lms_free_programme_identity(text, text)', 'EXECUTE')
         then 'NO' else 'yes' end,
    'One helper, used by lms_create_course, lms_create_path and the backfill, so there is one rule and not three copies of it. It is reached only by those three, which are security definer and run as their owner, so nothing signed in needs it. A new function is executable by PUBLIC the moment it exists, which is why this row asks about the grants as well as the existence.'

  union all select 17,
    'Making a course asks the helper too, not just making a path',
    case when (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_create_course')
              like '%lms_free_programme_identity%'
          and (select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
                 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname = 'public' and p.proname = 'lms_create_path')
              like '%lms_free_programme_identity%'
         then 'yes' else 'NO' end,
    'lms_create_course has carried this fault since file 17 and it is the one used far more often, so fixing only the path would have left the larger half open. A NO means one of the two is still making its own slug and can still land on a bootcamp.'
)
select n as "#", checking as "what was checked", answer as "answer",
       what_it_means as "what it means if the answer is not yes"
  from checks order by n;

-- WHICH ONES, when row 15 says NO. Separate, because a verify file's job
-- is a column of yes and a list belongs underneath it rather than
-- squeezed into a cell.
select 'slug' as "what", pr.slug as "the value shared",
       count(*) as "how many programmes", string_agg(pr.title, ' | ' order by pr.title) as "which"
  from programmes pr group by pr.slug having count(*) > 1
union all
select 'code', pr.code, count(*), string_agg(pr.title, ' | ' order by pr.title)
  from programmes pr group by pr.code having count(*) > 1
 order by 1, 2;
