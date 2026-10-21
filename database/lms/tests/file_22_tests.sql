-- Tests file 22. NOT for the Supabase editor: it makes accounts and
-- courses, acts as an administrator and as a facilitator through row
-- level security, and rolls everything back.
--
-- WHAT THIS FILE IS ABOUT. Seven gaps Big Sam found by building his
-- first course in a browser. Three of them needed SQL and they are what
-- this tests: a course with no exam, a path that could never issue a
-- certificate, and a certificate tile counting the wrong column over the
-- wrong window. Plus archiving, which existed and had no button and
-- turned out to need two fixes of its own before one was worth adding.
--
-- SECTION 4 IS THE ONE WORTH READING. It proves the tile counts a
-- certificate ISSUED this month and ignores one COMPLETED two days ago
-- but issued last month, which is the fault exactly.
--
-- EVERY PERMISSION TEST RUNS AS authenticated. Row level security does
-- not apply to a table's owner unless FORCE is set, and psql connects as
-- the owner, so a test that forgets "set local role" passes whatever the
-- rules say.

\set ON_ERROR_STOP on
begin;

create temporary table t22_out (n integer, label text, got text, want text) on commit drop;

create or replace function t22_say(p_label text, p_got text, p_want text)
returns void language plpgsql as $$
begin
  insert into t22_out values ((select coalesce(max(n), 0) + 1 from t22_out), p_label, p_got, p_want);
end $$;

create or replace function t22_be(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end $$;

-- --------------------------------------------------------------- setup
insert into auth.users (id, email, email_confirmed_at, created_at) values
  ('22aa0000-0000-0000-0000-000000000009', 'admin22t@example.com', now(), now()),
  ('22aa0000-0000-0000-0000-000000000002', 'facil22t@example.com', now(), now())
on conflict (id) do nothing;

update lms_profiles set role = 'admin', email_verified_at = now()
 where id = '22aa0000-0000-0000-0000-000000000009';
update lms_profiles set role = 'facilitator', email_verified_at = now()
 where id = '22aa0000-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------------
-- 1. Every course that can still be taken has an exam
-- ---------------------------------------------------------------------
do $$
declare v_without integer;
begin
  select count(*) into v_without
    from lms_courses c
   where c.status <> 'archived'
     and not exists (select 1 from lms_quizzes q where q.course_id = c.id);
  perform t22_say('1a no course that can be taken is without an exam', v_without::text, '0');
end $$;

-- A COURSE MADE THE OLD WAY, with no exam at all, which is the state
-- every course built before file 17 is in. The backfill has already run
-- by the time this test does, so the row is made here and the backfill's
-- own insert is repeated to show it picks the course up.
do $$
declare v_c uuid; v_exam uuid; v_made integer;
begin
  insert into lms_courses (slug, title, tool, area, level, status)
       values ('t22-no-exam', 'A course with no exam', 'STATA', 'Stats', 'Beginner', 'draft')
    returning id into v_c;
  perform t22_say('1b a course can still be made with no exam, which is the old state',
    case when exists (select 1 from lms_quizzes q where q.course_id = v_c)
         then 'it has one' else 'none' end, 'none');

  with wanted as (
    select c.id from lms_courses c
     where c.status <> 'archived'
       and not exists (select 1 from lms_quizzes q where q.course_id = c.id)
  )
  insert into lms_quizzes (course_id, title, pass_percent, max_attempts, serve_count,
                           retake_after_minutes, shuffle, status, time_limit_minutes, bank_multiple)
  select w.id, 'Course exam', 70, 2, 20, 1440, true, 'draft', 40, 1.5 from wanted w;
  get diagnostics v_made = row_count;
  perform t22_say('1c and the backfill gives it one', v_made::text, '1');

  select id into v_exam from lms_quizzes where course_id = v_c;
  perform t22_say('1d as a DRAFT, because an empty bank cannot be sat',
    (select status::text from lms_quizzes where id = v_exam), 'draft');
  perform t22_say('1e with the agreed settings',
    (select pass_percent || '/' || max_attempts || '/' || serve_count || '/' ||
            time_limit_minutes || '/' || bank_multiple
       from lms_quizzes where id = v_exam),
    '70/2/20/40/1.5');
end $$;

-- AN ARCHIVED COURSE IS LEFT ALONE. Nobody is going to sit its exam, and
-- giving it one would put it back in the way of every report that counts
-- drafts.
do $$
declare v_c uuid; v_made integer;
begin
  insert into lms_courses (slug, title, tool, area, level, status)
       values ('t22-archived', 'An archived course', 'STATA', 'Stats', 'Beginner', 'archived')
    returning id into v_c;
  with wanted as (
    select c.id from lms_courses c
     where c.status <> 'archived'
       and not exists (select 1 from lms_quizzes q where q.course_id = c.id)
  )
  insert into lms_quizzes (course_id, title, pass_percent, max_attempts, serve_count,
                           retake_after_minutes, shuffle, status, time_limit_minutes, bank_multiple)
  select w.id, 'Course exam', 70, 2, 20, 1440, true, 'draft', 40, 1.5 from wanted w;
  get diagnostics v_made = row_count;
  perform t22_say('1f an archived course is not given one', v_made::text, '0');
end $$;

-- ---------------------------------------------------------------------
-- 2. The backfill numbers agree with the function nobody can call
-- ---------------------------------------------------------------------
-- lms_ensure_course_exam holds the settings and the backfill copies them,
-- because that function guards itself with lms_is_staff() and there is no
-- signed in caller in the SQL editor. If somebody changes the numbers in
-- one place this is what notices.
do $$
declare v_src text;
begin
  select regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
    into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'lms_ensure_course_exam';
  perform t22_say('2a the function still holds the settings the backfill copied',
    case when v_src like '%70, 2, 20, 1440, true, ''draft'', 40, 1.5%'
         then 'the same' else 'DIFFERENT' end, 'the same');
end $$;

-- ---------------------------------------------------------------------
-- 3. A path gets a programme, so a certificate can be issued
-- ---------------------------------------------------------------------
do $$
declare v_null integer;
begin
  select count(*) into v_null from lms_paths where programme_id is null;
  perform t22_say('3a no path is without a programme', v_null::text, '0');
end $$;

do $$
declare v_p uuid; v_prog uuid; v_title text; v_exam uuid;
begin
  perform t22_be('22aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  v_p := lms_create_path('Test Path Twentytwo');
  reset role;

  select programme_id into v_prog from lms_paths where id = v_p;
  perform t22_say('3b a new path is given a programme',
    case when v_prog is null then 'none' else 'yes' end, 'yes');

  select title into v_title from programmes where id = v_prog;
  perform t22_say('3c titled with the certificate name, not the path name',
    v_title, 'Professional Certificate in Test Path Twentytwo');

  select id into v_exam from lms_quizzes where path_id = v_p;
  perform t22_say('3d and it still gets its exam quiz',
    case when v_exam is null then 'none' else 'yes' end, 'yes');
exception when others then
  reset role;
  perform t22_say('3b a new path is given a programme', 'error: ' || sqlerrm, 'yes');
end $$;

-- A PATH MADE THE OLD WAY, with no programme, and the backfill repeated
-- to show it is picked up. A given certificate name is kept and a blank
-- one is filled in.
do $$
declare r record; v_prog uuid; v_done integer := 0;
begin
  insert into lms_paths (slug, name, status, certificate_name) values
    ('t22-old-named', 'Old Named Path', 'draft', 'Advanced Certificate in Something'),
    ('t22-old-blank', 'Old Blank Path', 'draft', '');

  for r in select p.id, p.slug, p.name, p.certificate_name from lms_paths p
            where p.programme_id is null order by p.slug
  loop
    insert into programmes (slug, title, code, active)
    values (r.slug,
            coalesce(nullif(btrim(r.certificate_name), ''),
                     'Professional Certificate in ' || r.name),
            upper(left(regexp_replace(r.slug, '[^a-z0-9]', '', 'g'), 12)), true)
    returning id into v_prog;
    update lms_paths set programme_id = v_prog where id = r.id;
    v_done := v_done + 1;
  end loop;
  perform t22_say('3e the backfill picks up both old paths', v_done::text, '2');

  perform t22_say('3f a certificate name already set is kept',
    (select pr.title from lms_paths p join programmes pr on pr.id = p.programme_id
      where p.slug = 't22-old-named'), 'Advanced Certificate in Something');
  perform t22_say('3g and a blank one is filled in',
    (select pr.title from lms_paths p join programmes pr on pr.id = p.programme_id
      where p.slug = 't22-old-blank'), 'Professional Certificate in Old Blank Path');

  -- safe twice: nothing left to do
  v_done := 0;
  for r in select p.id from lms_paths p where p.programme_id is null loop
    v_done := v_done + 1;
  end loop;
  perform t22_say('3h and a second run has nothing to do', v_done::text, '0');
end $$;

-- ---------------------------------------------------------------------
-- 4. The certificate tile. THE ONE WORTH READING.
-- ---------------------------------------------------------------------
-- It counted completed_on, the day the TRAINING ended, over a rolling
-- seven days. Two certificates below, one of each shape, and the tile
-- must count exactly the first.
do $$
declare v_month integer; v_all integer; v_j jsonb;
begin
  insert into participants (id, full_name, email)
       values ('22bb0000-0000-0000-0000-00000000000b', 'Tile Person', 'tile22t@example.com')
  on conflict (id) do nothing;
  insert into programmes (id, slug, title, code, template_key, active)
       values ('22dd0000-0000-0000-0000-00000000000b', 't22tile', 'Tile Programme', 'T22T', 'default', true)
  on conflict (id) do nothing;

  -- ISSUED this month, COMPLETED last year. The old tile missed it.
  insert into certificates (certificate_number, participant_id, programme_id, completed_on, issued_at)
  values ('T22T-2026-GEN-AAAAAA', '22bb0000-0000-0000-0000-00000000000b',
          '22dd0000-0000-0000-0000-00000000000b', '2025-03-01', now());

  -- COMPLETED two days ago, ISSUED before this month began. The old tile
  -- counted it and the new one must not.
  insert into certificates (certificate_number, participant_id, programme_id, completed_on, issued_at)
  values ('T22T-2026-GEN-BBBBBB', '22bb0000-0000-0000-0000-00000000000b',
          '22dd0000-0000-0000-0000-00000000000b', current_date - 2,
          (date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos')
            - interval '2 days');

  perform t22_be('22aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  -- THROUGH EXECUTE, AND AS jsonb, on purpose. Naming r.this_month
  -- directly is resolved when the block is compiled, so on a database
  -- that has not had file 22 this whole file died with "record r has no
  -- field this_month" instead of reporting a failed check. The same trap
  -- as the verify files, in a test.
  execute 'select to_jsonb(t) from lms_studio_certificate_counts() t' into v_j;
  reset role;

  perform t22_say('4a the tile counts the one issued this month, not the one completed recently',
    coalesce(v_j ->> 'this_month', 'no such column'), '1');
  perform t22_say('4b and all time counts both',
    case when coalesce((v_j ->> 'all_time')::integer, 0) >= 2
         then 'at least 2' else coalesce(v_j ->> 'all_time', 'none') end, 'at least 2');
end $$;

-- A certificate issued one second before the Lagos month began is OUT,
-- and one issued one second after is IN. That second is the whole point
-- of the time zone: the server runs on UTC, an hour behind Abuja.
do $$
declare v_start timestamptz; v_j jsonb;
begin
  v_start := (date_trunc('month', now() at time zone 'Africa/Lagos')) at time zone 'Africa/Lagos';
  insert into certificates (certificate_number, participant_id, programme_id, completed_on, issued_at)
  values ('T22T-2026-GEN-CCCCCC', '22bb0000-0000-0000-0000-00000000000b',
          '22dd0000-0000-0000-0000-00000000000b', current_date, v_start - interval '1 second');
  insert into certificates (certificate_number, participant_id, programme_id, completed_on, issued_at)
  values ('T22T-2026-GEN-DDDDDD', '22bb0000-0000-0000-0000-00000000000b',
          '22dd0000-0000-0000-0000-00000000000b', current_date, v_start + interval '1 second');

  perform t22_be('22aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  execute 'select to_jsonb(t) from lms_studio_certificate_counts() t' into v_j;
  reset role;
  -- the first one from the block above, plus the one a second inside
  perform t22_say('4c the month boundary is to the second, in Lagos time',
    coalesce(v_j ->> 'this_month', 'no such column'), '2');
end $$;

-- AND THE OVERVIEW AGREES WITH IT. There are two of these tiles and
-- different functions build them, so they can disagree.
do $$
declare v_ov jsonb;
begin
  perform t22_be('22aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  v_ov := lms_studio_overview();
  reset role;
  perform t22_say('4d the Overview tile says the same as the Certificates one',
    (v_ov -> 'week' ->> 'certificates'), '2');
end $$;

-- ---------------------------------------------------------------------
-- 5. Archiving a course, and the way back
-- ---------------------------------------------------------------------
do $$
declare v_c uuid;
begin
  perform t22_be('22aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  v_c := lms_create_course('Archive test course', 'STATA');
  reset role;
  perform set_config('lms.t22_course', v_c::text, true);
  perform t22_say('5a a course to work with', 'made', 'made');
end $$;

do $$ begin
  perform t22_be('22aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  perform lms_archive_course(current_setting('lms.t22_course')::uuid, '   ');
  reset role;
  perform t22_say('5b archiving with no reason is refused', 'allowed', 'refused');
exception when others then
  reset role;
  perform t22_say('5b archiving with no reason is refused', 'refused', 'refused');
end $$;

do $$ begin
  perform t22_be('22aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  perform lms_archive_course(current_setting('lms.t22_course')::uuid, 'A duplicate of the real one');
  reset role;
  perform t22_say('5c with a reason it archives',
    (select status::text from lms_courses where id = current_setting('lms.t22_course')::uuid),
    'archived');
  perform t22_say('5d and the reason is in the log',
    (select detail ->> 'reason' from lms_admin_actions
      where action = 'course_archived'
        and subject_id = current_setting('lms.t22_course')::uuid
      order by created_at desc limit 1),
    'A duplicate of the real one');
exception when others then
  reset role;
  perform t22_say('5c with a reason it archives', 'error: ' || sqlerrm, 'archived');
end $$;

do $$ begin
  perform t22_be('22aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  perform lms_archive_course(current_setting('lms.t22_course')::uuid, 'again');
  reset role;
  perform t22_say('5e archiving one that is already archived is not an error',
    'no error', 'no error');
exception when others then
  reset role;
  perform t22_say('5e archiving one that is already archived is not an error',
    'error: ' || sqlerrm, 'no error');
end $$;

do $$ begin
  perform t22_be('22aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  perform lms_restore_course(current_setting('lms.t22_course')::uuid, 'Needed after all');
  reset role;
  perform t22_say('5f it comes back as a DRAFT, not as live',
    (select status::text from lms_courses where id = current_setting('lms.t22_course')::uuid),
    'draft');
  perform t22_say('5g and that is logged too',
    (select detail ->> 'reason' from lms_admin_actions
      where action = 'course_restored'
        and subject_id = current_setting('lms.t22_course')::uuid
      order by created_at desc limit 1),
    'Needed after all');
exception when others then
  reset role;
  perform t22_say('5f it comes back as a DRAFT, not as live', 'error: ' || sqlerrm, 'draft');
end $$;

do $$ begin
  perform t22_be('22aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  perform lms_restore_course(current_setting('lms.t22_course')::uuid, 'nothing to bring back');
  reset role;
  perform t22_say('5h restoring one that is not archived is refused', 'allowed', 'refused');
exception when others then
  reset role;
  perform t22_say('5h restoring one that is not archived is refused', 'refused', 'refused');
end $$;

-- A LIVE COURSE IS NOT ARCHIVED. A learner part way through should not
-- have it disappear underneath them.
do $$
declare v_c uuid;
begin
  v_c := current_setting('lms.t22_course')::uuid;
  update lms_courses set status = 'published', published_at = now() where id = v_c;
  perform t22_be('22aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  begin
    perform lms_archive_course(v_c, 'Trying to archive a live course');
    reset role;
    perform t22_say('5i a live course is not archived', 'allowed', 'refused');
  exception when others then
    reset role;
    perform t22_say('5i a live course is not archived', 'refused', 'refused');
  end;
  update lms_courses set status = 'draft', published_at = null where id = v_c;
end $$;

-- AND BOTH ARE ADMINISTRATOR ONLY. A facilitator owns courses and may
-- edit them, which is exactly why this is worth asking.
do $$
declare v_c uuid;
begin
  perform t22_be('22aa0000-0000-0000-0000-000000000002');
  set local role authenticated;
  v_c := lms_create_course('Facilitator archive test', 'STATA');
  begin
    perform lms_archive_course(v_c, 'it is mine');
    reset role;
    perform t22_say('5j a facilitator cannot archive, even their own', 'allowed', 'refused');
  exception when others then
    reset role;
    perform t22_say('5j a facilitator cannot archive, even their own', 'refused', 'refused');
  end;
end $$;

do $$ begin
  perform t22_be('22aa0000-0000-0000-0000-000000000002');
  set local role authenticated;
  perform lms_restore_course(current_setting('lms.t22_course')::uuid, 'mine now');
  reset role;
  perform t22_say('5k nor restore', 'allowed', 'refused');
exception when others then
  reset role;
  perform t22_say('5k nor restore', 'refused', 'refused');
end $$;

-- ---------------------------------------------------------------------
-- 6. Nothing here is reachable by a visitor
-- ---------------------------------------------------------------------
-- Both archive functions are NEW, and a new function is executable by
-- PUBLIC the moment it exists. lms_studio_certificate_counts was DROPPED
-- to rename its column, which throws its grants away. That is the file
-- 21 lesson arriving one file later.
do $$
declare v_sig text; v_open text[] := '{}';
begin
  foreach v_sig in array array[
    'lms_archive_course(uuid, text)', 'lms_restore_course(uuid, text)',
    'lms_studio_certificate_counts()', 'lms_studio_overview()'
  ]
  loop
    if to_regprocedure('public.' || v_sig) is null then
      v_open := v_open || (v_sig || ' MISSING')::text;
    else
      if has_function_privilege('anon', v_sig, 'EXECUTE') then
        v_open := v_open || (v_sig || ' anon')::text;
      end if;
      if not has_function_privilege('authenticated', v_sig, 'EXECUTE') then
        v_open := v_open || (v_sig || ' lost authenticated')::text;
      end if;
    end if;
  end loop;
  perform t22_say('6a shut to a visitor, open to a signed in administrator',
    coalesce(array_to_string(v_open, ', '), ''), '');

  perform t22_say('6b and the old one argument archive is gone',
    case when to_regprocedure('public.lms_archive_course(uuid)') is null
         then 'gone' else 'STILL THERE' end, 'gone');
end $$;


-- ---------------------------------------------------------------------
-- 7. An Academy programme never takes a certification one's name
-- ---------------------------------------------------------------------
-- THE REVIEW PROVED THIS ONE BY DOING IT. A certification programme with
-- slug 'digital-marketing-web-design' and code DMWD was put in
-- programmes, then lms_create_path('Digital Marketing Web Design')
-- succeeded and programmes held two rows with that slug.
--
-- It is not cosmetic. certificateConfig.ts keys partner logos and
-- certificate templates BY PROGRAMME SLUG, so on live it is either a
-- duplicate key error that stops file 22 dead, or a path certificate
-- quietly borrowing a bootcamp's logos. The code matters the same way:
-- make_certificate_number is handed the code and the number goes on the
-- certificate.
--
-- A certification row holding BOTH the slug and the code is planted
-- first, so each of the three places that make a programme has to move
-- aside on both counts at once.
do $$ begin
  insert into programmes (slug, title, code, template_key, active)
  values ('t22-clash', 'A Planted Bootcamp', 'T22CLASH', 'default', true);
  perform t22_say('7a a certification programme holds the slug and the code',
    (select slug || '/' || code from programmes where title = 'A Planted Bootcamp'),
    't22-clash/T22CLASH');
end $$;

-- (a) making a path
do $$
declare v_p uuid; v_slug text; v_code text;
begin
  perform t22_be('22aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  v_p := lms_create_path('T22 Clash', '');
  reset role;
  select pr.slug, pr.code into v_slug, v_code
    from lms_paths p join programmes pr on pr.id = p.programme_id where p.id = v_p;
  perform t22_say('7b a new path gets a programme slug of its own',
    case when v_slug = 't22-clash' then 'TOOK THE BOOTCAMP SLUG' else 'moved aside' end,
    'moved aside');
  perform t22_say('7c and a code of its own',
    case when v_code = 'T22CLASH' then 'TOOK THE BOOTCAMP CODE' else 'moved aside' end,
    'moved aside');
exception when others then
  reset role;
  perform t22_say('7b a new path gets a programme slug of its own',
    'error: ' || left(sqlerrm, 40), 'moved aside');
end $$;

-- (b) making a course
do $$
declare v_c uuid; v_slug text; v_code text;
begin
  perform t22_be('22aa0000-0000-0000-0000-000000000009');
  set local role authenticated;
  v_c := lms_create_course('T22 Clash', 'Stats', 'STATA');
  reset role;
  select pr.slug, pr.code into v_slug, v_code
    from lms_courses c join programmes pr on pr.id = c.programme_id where c.id = v_c;
  perform t22_say('7d a new course does the same, and has since file 17 not done it',
    case when v_slug = 't22-clash' or v_code = 'T22CLASH'
         then 'TOOK THE BOOTCAMP NAME' else 'moved aside' end,
    'moved aside');
exception when others then
  reset role;
  perform t22_say('7d a new course does the same, and has since file 17 not done it',
    'error: ' || left(sqlerrm, 40), 'moved aside');
end $$;

-- (c) the backfill
do $$
declare r record; v_prog uuid; v_pslug text; v_pcode text; v_path uuid;
begin
  insert into lms_paths (slug, name, status, certificate_name)
       values ('t22-clash-bf', 'T22 Clash', 'draft', '')
    returning id into v_path;

  for r in select p.id, p.slug, p.name, p.certificate_name from lms_paths p
            where p.programme_id is null order by p.slug
  loop
    select h.out_slug, h.out_code into v_pslug, v_pcode
      from lms_free_programme_identity(r.name, 'path') h;
    insert into programmes (slug, title, code, active)
    values (v_pslug,
            coalesce(nullif(btrim(r.certificate_name), ''),
                     'Professional Certificate in ' || r.name),
            v_pcode, true)
    returning id into v_prog;
    update lms_paths set programme_id = v_prog where id = r.id;
  end loop;

  select pr.slug, pr.code into v_pslug, v_pcode
    from lms_paths p join programmes pr on pr.id = p.programme_id where p.id = v_path;
  perform t22_say('7e the backfill moves aside too',
    case when v_pslug = 't22-clash' or v_pcode = 'T22CLASH'
         then 'TOOK THE BOOTCAMP NAME' else 'moved aside' end,
    'moved aside');
  perform t22_say('7f and the path keeps its OWN address, which a learner may hold',
    (select slug from lms_paths where id = v_path), 't22-clash-bf');
end $$;

-- AND THE CERTIFICATION ROW IS EXACTLY AS IT WAS. This is the check that
-- matters most: the Academy moves out of the way rather than renaming,
-- reusing or deleting a row the certification system owns.
do $$ begin
  perform t22_say('7g the planted bootcamp is untouched',
    (select slug || '/' || code || '/' || title from programmes where title = 'A Planted Bootcamp'),
    't22-clash/T22CLASH/A Planted Bootcamp');
  perform t22_say('7h and nothing else took its slug',
    (select count(*)::text from programmes where slug = 't22-clash'), '1');
  perform t22_say('7i nor its code',
    (select count(*)::text from programmes where code = 'T22CLASH'), '1');
end $$;

-- The helper itself: one rule, reachable by nobody.
do $$ begin
  perform t22_say('7j the helper exists',
    case when to_regprocedure('public.lms_free_programme_identity(text, text)') is null
         then 'missing' else 'yes' end, 'yes');
  perform t22_say('7k and no browser can reach it',
    case when to_regprocedure('public.lms_free_programme_identity(text, text)') is null then 'missing'
         when has_function_privilege('anon', 'lms_free_programme_identity(text, text)', 'EXECUTE')
           or has_function_privilege('authenticated', 'lms_free_programme_identity(text, text)', 'EXECUTE')
         then 'REACHABLE' else 'shut' end, 'shut');
  perform t22_say('7l both makers ask it, not just the path one',
    (select case when c.src like '%lms_free_programme_identity%'
                  and p.src like '%lms_free_programme_identity%'
                 then 'both' else 'NOT BOTH' end
       from (select regexp_replace(pg_get_functiondef(pr.oid), '--[^' || chr(10) || ']*', '', 'g') as src
               from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
              where n.nspname = 'public' and pr.proname = 'lms_create_course') c,
            (select regexp_replace(pg_get_functiondef(pr.oid), '--[^' || chr(10) || ']*', '', 'g') as src
               from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
              where n.nspname = 'public' and pr.proname = 'lms_create_path') p),
    'both');
end $$;

-- ------------------------------------------------------------- results
\pset tuples_only off
\pset format aligned
select n as "#", label as "what was checked",
       case when got is not distinct from want then 'pass' else 'FAIL' end as "result",
       got as "got", want as "wanted"
  from t22_out order by n;

select case when count(*) = 0 then 'ALL PASS'
            else count(*) || ' FAILED' end as "summary"
  from t22_out where got is distinct from want;

rollback;
