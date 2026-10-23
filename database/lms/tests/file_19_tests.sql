-- Tests file 19. NOT for the Supabase editor: it makes accounts, a
-- facilitator appointment and a certification record, acts as a learner
-- through row level security, and rolls everything back.
--
-- WHAT THIS FILE IS ABOUT. Sign up no longer emails a code, so a typed
-- address proves nothing, and `auth.users.email_confirmed_at` is set at
-- insert once Supabase "Confirm email" is off. Every grant that used to
-- hang off that column now hangs off `lms_profiles.email_verified_at`,
-- which only the check in file 19 sets.
--
-- The tests that matter are sections 2 and 3: an unproven address with
-- a facilitator's or a certified person's email gets nothing, and gets
-- everything the moment the code is typed. Those are the two ways the
-- old design would have handed access to whoever typed the address.
--
-- EVERY PERMISSION TEST RUNS AS authenticated. Row level security does
-- not apply to a table's owner unless FORCE is set, and psql connects
-- as the owner, so a test that forgets "set local role authenticated"
-- passes whatever the policies say. Results are captured into variables
-- BEFORE reset role, because authenticated cannot write the temporary
-- results table.

\set ON_ERROR_STOP on
begin;

create temporary table t19_out (n integer, label text, got text, want text) on commit drop;

create or replace function t19_say(p_label text, p_got text, p_want text)
returns void language plpgsql as $$
begin
  insert into t19_out values ((select coalesce(max(n), 0) + 1 from t19_out), p_label, p_got, p_want);
end $$;

create or replace function t19_be(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end $$;

/* The code for an address, read out of the outbox the way the mailer
   would. Nothing else can read it: the table keeps only a hash. */
create or replace function t19_code(p_email text)
returns text language sql as $$
  select code_plain from mail_outbox
   where to_email = p_email and purpose = 'academy_verify'
   order by created_at desc limit 1;
$$;

-- --------------------------------------------------------------- setup

-- THE SITE WIDE MAIL CEILING IS CLEARED FIRST, inside this transaction
-- and so rolled back with the rest. File 12 caps the whole site at 25
-- messages an hour, counted from sign_in_attempts, and the earlier test
-- files in this folder spend that allowance before this one runs. Seven
-- checks here failed the first time for that reason and the product was
-- right every time: the ceiling held, and the test was simply not
-- isolated from the files that ran before it.
delete from sign_in_attempts where at > now() - interval '24 hours';

insert into auth.users (id, email, email_confirmed_at, created_at) values
  ('19aa0000-0000-0000-0000-000000000001', 'plain19@example.com',   now(), now()),
  ('19aa0000-0000-0000-0000-000000000002', 'teacher19@example.com', now(), now()),
  ('19aa0000-0000-0000-0000-000000000003', 'certs19@example.com',   now(), now()),
  ('19aa0000-0000-0000-0000-000000000009', 'admin19@example.com',   now(), now() - interval '30 days')
on conflict (id) do nothing;

update lms_profiles set role = 'admin', email_verified_at = now()
 where id = '19aa0000-0000-0000-0000-000000000009';

-- A certification record nobody has linked, which is the normal state
-- for anybody certified before they made an Academy account, and an
-- active enrolment so bootcamp access is on the table too.
-- email, NOT email_norm. A trigger derives email_norm from email and
-- lowercases it, so a row inserted with email_norm set directly comes
-- back with it NULL and matches nobody. That is why the link test first
-- reported a fault in lms_link_participant that was not there.
insert into participants (id, full_name, email)
     values ('19bb0000-0000-0000-0000-00000000000a', 'Certified Person', 'certs19@example.com')
on conflict (id) do nothing;
-- An enrolment needs a programme and a cohort: both are required
-- columns on the certification system's table. A local, rolled back
-- programme rather than borrowing a real one, so this test never
-- depends on what happens to be in the database.
insert into programmes (id, slug, title, code, template_key, active)
     values ('19dd0000-0000-0000-0000-00000000000a', 'test-19', 'Test Programme 19',
             'T19', 'default', true)
on conflict (id) do nothing;

insert into participant_enrolments (id, participant_id, programme_id, cohort, status, ends_on)
     values ('19cc0000-0000-0000-0000-00000000000a',
             '19bb0000-0000-0000-0000-00000000000a',
             '19dd0000-0000-0000-0000-00000000000a', '2026', 'active', null)
on conflict (id) do nothing;

-- An appointed facilitator, by email address, as the Staff page does it.
do $$
begin
  perform t19_be('19aa0000-0000-0000-0000-000000000009');
  perform lms_add_facilitator('teacher19@example.com', 'A Teacher', '');
  perform t19_be(null);
end $$;

-- ---------------------------------------------------------------------
-- 1. The backfill mark
-- ---------------------------------------------------------------------
do $$
declare v_mark timestamptz; v_after boolean;
begin
  select first_run_at into v_mark from lms_email_verify_state where id = 1;
  perform t19_say('1a the first run recorded when it happened',
    case when v_mark is not null then 'yes' else 'no' end, 'yes');

  -- The four accounts above were made after file 19 ran, so none of
  -- them may be marked proven by a later run of it.
  select exists (
    select 1 from lms_profiles p join auth.users u on u.id = p.id
     where u.created_at > v_mark and p.email_verified_at is not null
       and p.id <> '19aa0000-0000-0000-0000-000000000009'
  ) into v_after;
  perform t19_say('1b and no account made since is proven by the backfill',
    case when v_after then 'one is' else 'none' end, 'none');
end $$;

-- ---------------------------------------------------------------------
-- 2. A facilitator's address, unproven then proven
-- ---------------------------------------------------------------------
-- THE ONE THAT WOULD HAVE HANDED OVER THE CONTROL ROOM. lms_sync_my_access
-- gates facilitator access, the participant link and bootcamp access
-- behind one test. Before file 19 that test was Supabase's column, which
-- with Confirm email off is true of every account at insert.
do $$
declare
  v_u uuid := '19aa0000-0000-0000-0000-000000000002';
  r record; v_role text; v_studio text; v_code text;
begin
  perform t19_be(v_u);
  select * into r from lms_sync_my_access();
  v_role := r.role;

  set local role authenticated;
  begin
    perform lms_studio_overview();
    v_studio := 'allowed';
  exception when others then v_studio := 'refused';
  end;
  reset role;

  perform t19_say('2a an unproven address with a facilitator appointment stays a learner',
    v_role, 'learner');
  perform t19_say('2b and the control room refuses them', v_studio, 'refused');
  perform t19_say('2c and the sync says what to do about it',
    (select message from lms_sync_my_access()),
    'Confirm your email address to unlock your access.');

  -- Now they pass the check.
  perform lms_request_email_check();
  v_code := t19_code('teacher19@example.com');
  select * into r from lms_confirm_email_check(v_code);

  perform t19_say('2d after the check they are a facilitator', r.role, 'facilitator');
  perform t19_say('2e and the message says so', r.message, 'You now have facilitator access.');

  set local role authenticated;
  begin
    perform lms_studio_overview();
    v_studio := 'allowed';
  exception when others then v_studio := 'refused';
  end;
  reset role;
  perform t19_say('2f and the control room lets them in', v_studio, 'allowed');
end $$;

-- ---------------------------------------------------------------------
-- 3. A certified person's address, unproven then proven
-- ---------------------------------------------------------------------
do $$
declare
  v_u uuid := '19aa0000-0000-0000-0000-000000000003';
  r record; v_part uuid; v_boot boolean; v_code text;
begin
  perform t19_be(v_u);
  select * into r from lms_sync_my_access();
  select participant_id into v_part from lms_profiles where id = v_u;

  perform t19_say('3a an unproven address matching a certification record is not linked',
    case when v_part is null then 'not linked' else 'linked' end, 'not linked');
  perform t19_say('3b and gets no bootcamp access',
    coalesce(r.bootcamp, false)::text, 'false');

  -- The old claim route refuses it too, not only the sync.
  select * into r from lms_claim_bootcamp_access();
  perform t19_say('3c and claiming it directly is refused',
    case when r.granted then 'granted' else 'refused' end, 'refused');

  perform lms_request_email_check();
  v_code := t19_code('certs19@example.com');
  select * into r from lms_confirm_email_check(v_code);

  select participant_id into v_part from lms_profiles where id = v_u;
  select bootcamp into v_boot from lms_sync_my_access();

  perform t19_say('3d after the check the record is linked',
    case when v_part is null then 'not linked' else 'linked' end, 'linked');
  perform t19_say('3e and bootcamp access is open', coalesce(v_boot, false)::text, 'true');
end $$;

-- ---------------------------------------------------------------------
-- 4. The code itself
-- ---------------------------------------------------------------------
do $$
declare
  v_u uuid := '19aa0000-0000-0000-0000-000000000001';
  r record; v_code text; v_plain boolean; v_read text;
begin
  perform t19_be(v_u);
  select * into r from lms_request_email_check();
  perform t19_say('4a asking for a code works', r.ok::text, 'true');

  v_code := t19_code('plain19@example.com');
  perform t19_say('4b and it is six digits',
    case when v_code ~ '^[0-9]{6}$' then 'yes' else coalesce(v_code, 'none') end, 'yes');

  -- THE CODE IS NEVER STORED AS TYPED, anywhere but the outbox, which
  -- the mailer empties. A hash that equals the code is the whole
  -- failure this checks for.
  select exists (select 1 from lms_email_checks where user_id = v_u and code_hash = v_code)
    into v_plain;
  perform t19_say('4c and it is not kept in the clear',
    case when v_plain then 'it is' else 'hashed' end, 'hashed');

  -- Five wrong tries end the code.
  for i in 1..5 loop
    select * into r from lms_confirm_email_check('000000');
  end loop;
  perform t19_say('4d five wrong tries end the code',
    case when r.ok then 'still live' else 'refused' end, 'refused');
  -- Thrown away ON the fifth failure, not on the next call after it.
  -- The first version deleted the row when it next saw tries >= 5, so a
  -- dead code sat in the table until somebody tried again, which is a
  -- window with no reason to exist.
  perform t19_say('4e and the code row is thrown away at once',
    (select count(*) from lms_email_checks where user_id = v_u)::text, '0');

  -- The real code is now useless, which is the point of throwing it away.
  select * into r from lms_confirm_email_check(v_code);
  perform t19_say('4f so the real code no longer works either',
    case when r.ok then 'worked' else 'refused' end, 'refused');
end $$;

-- ---------------------------------------------------------------------
-- 5. Expiry, and the three an hour limit
-- ---------------------------------------------------------------------
do $$
declare
  v_u uuid := '19aa0000-0000-0000-0000-000000000001';
  r record; v_code text;
begin
  perform t19_be(v_u);
  perform lms_request_email_check();
  v_code := t19_code('plain19@example.com');

  -- Age the code rather than waiting ten minutes.
  update lms_email_checks set expires_at = now() - interval '1 minute' where user_id = v_u;
  select * into r from lms_confirm_email_check(v_code);
  perform t19_say('5a an expired code is refused',
    case when r.ok then 'worked' else 'refused' end, 'refused');

  -- Requests so far in this section and the last: that is 2. A third is
  -- allowed and a fourth is not.
  perform lms_request_email_check();
  select * into r from lms_request_email_check();
  perform t19_say('5b the fourth request within an hour is refused',
    case when r.ok then 'allowed' else 'refused' end, 'refused');
end $$;

-- ---------------------------------------------------------------------
-- 6. Signed out, and the code table
-- ---------------------------------------------------------------------
do $$
declare r_req text; r_conf text; r_read text;
begin
  perform t19_be(null);
  set local role anon;
  begin
    perform lms_request_email_check();
    r_req := 'allowed';
  exception when others then r_req := 'refused';
  end;
  begin
    perform lms_confirm_email_check('123456');
    r_conf := 'allowed';
  exception when others then r_conf := 'refused';
  end;
  reset role;

  perform t19_be('19aa0000-0000-0000-0000-000000000001');
  set local role authenticated;
  begin
    perform count(*) from lms_email_checks;
    r_read := 'allowed';
  exception when others then r_read := 'refused';
  end;
  reset role;

  perform t19_say('6a a signed out visitor cannot ask for a code', r_req, 'refused');
  perform t19_say('6b nor type one in', r_conf, 'refused');
  perform t19_say('6c and a signed in learner cannot read the code table at all',
    r_read, 'refused');
end $$;

-- ---------------------------------------------------------------------
-- 7. The answers given at sign up still land
-- ---------------------------------------------------------------------
-- The trigger that moves them is deliberately LEFT reading Supabase's
-- own column, because it grants nothing and moving it would leave the
-- disability answer sitting in the account token until somebody typed a
-- code. This checks it still fires at insert, which is the branch that
-- carries it once Confirm email is off.
do $$
declare v_u uuid := '19aa0000-0000-0000-0000-00000000000b'; v_has boolean;
begin
  -- 'country' is the key lms_apply_signup_answers looks for to decide
  -- anything was sent at all. Without it the function returns false and
  -- writes nothing, which is correct for an older account and made this
  -- test report a fault that was not there.
  -- EVERY REQUIRED ANSWER, because lms_learner_profiles makes country,
  -- age_band, gender, education_level, occupation and disability NOT
  -- NULL. Leave one out and the insert is refused, the metadata is
  -- stripped, the reason is written to lms_system_heartbeat and the
  -- function returns false. All of that is correct behaviour, and it is
  -- how this test first reported a fault in file 19 that was not there.
  --
  -- Every value is one the table's own CHECK constraints allow, and
  -- they are strict: age_band is a code rather than a range, goals come
  -- from a list of four, and a Nigerian address drags in a state and a
  -- six digit postal code. Ghana keeps this fixture to the fields it
  -- actually needs.
  --
  -- 'disability' is answered 'no' on purpose. The detail column is the
  -- sensitive one under the Nigeria Data Protection Act and a test
  -- fixture has no business carrying a value for it.
  insert into auth.users (id, email, email_confirmed_at, created_at, raw_user_meta_data)
  values (v_u, 'answers19@example.com', now(), now(),
          jsonb_build_object('full_name', 'Answer Person',
                             'country', 'Ghana',
                             'age_band', '25',
                             'gender', 'Prefer not to say',
                             'education_level', 'secondary',
                             'occupation', 'none',
                             'disability', 'no',
                             'goals', jsonb_build_array('work')));

  select exists (select 1 from lms_learner_profiles where user_id = v_u) into v_has;
  perform t19_say('7a the sign up answers still reach the profile at insert',
    case when v_has then 'yes' else 'no' end, 'yes');

  perform t19_say('7b and that account is still not proven',
    case when (select email_verified_at from lms_profiles where id = v_u) is null
         then 'not proven' else 'proven' end, 'not proven');
end $$;

-- ---------------------------------------------------------------------
-- 8. An administrator joining a certification record by hand
-- ---------------------------------------------------------------------
-- The automatic join matches on email address and only once that
-- address is proven. This is for the case that cannot cover: the
-- address on the certificate is not the one they signed up with.
do $$
declare
  v_admin   uuid := '19aa0000-0000-0000-0000-000000000009';
  v_learner uuid := '19aa0000-0000-0000-0000-000000000001';
  v_other   uuid := '19aa0000-0000-0000-0000-000000000002';
  v_part    uuid := '19dd0000-0000-0000-0000-0000000000cc';
  r record; v_n integer; r_search text;
begin
  insert into participants (id, full_name, email)
       values (v_part, 'Different Address Person', 'old-work-address@example.com')
  on conflict (id) do nothing;

  -- A facilitator must not be able to search the register at all.
  perform t19_be(v_learner);
  begin
    perform lms_find_participants('Different');
    r_search := 'allowed';
  exception when others then r_search := 'refused';
  end;
  perform t19_say('8a a learner cannot search the certification register', r_search, 'refused');

  perform t19_be(v_admin);
  select count(*) into v_n from lms_find_participants('Different');
  perform t19_say('8b an administrator can find a record', v_n::text, '1');

  -- Two characters returns nothing: a one letter search would hand back
  -- most of a list of real people and their addresses.
  select count(*) into v_n from lms_find_participants('Di');
  perform t19_say('8c and a two letter search returns nothing', v_n::text, '0');

  select * into r from lms_link_certification_record(v_learner, v_part, '');
  perform t19_say('8d joining without a reason is refused',
    case when r.ok then 'allowed' else 'refused' end, 'refused');

  select * into r from lms_link_certification_record(v_learner, v_part,
    'Their certificate is under an old work address');
  perform t19_say('8e with a reason it joins',
    case when r.ok then 'joined' else 'refused: ' || r.message end, 'joined');

  perform t19_say('8f and the reason is in the log',
    (select detail ->> 'reason' from lms_admin_actions
      where action = 'certification_linked' order by created_at desc limit 1),
    'Their certificate is under an old work address');

  -- THE CODE IS NOT THE ONLY THING THAT MUST NOT BE TAKEN TWICE.
  select * into r from lms_link_certification_record(v_other, v_part, 'Trying to take it');
  perform t19_say('8g nobody else can be joined to the same record',
    case when r.ok then 'allowed' else 'refused' end, 'refused');
end $$;

-- ---------------------------------------------------------------------
-- 9. The backfill mark is not something a visitor can empty
-- ---------------------------------------------------------------------
-- The review found this by doing it: as anon, it truncated the table.
-- Supabase's default privileges grant everything on a new public table
-- to anon and authenticated, TRUNCATE and DELETE included, so creating
-- the table was not the same as locking it.
--
-- Emptying it shows a visitor nothing. What it does is remove the guard
-- in section 1, so a later run of file 19 would backfill every account
-- created since, and with Confirm email off that means every typed
-- address, impostors included.
--
-- Each attempt is its own block with its own handler, because the first
-- refusal would otherwise end the section and the rest would be
-- reported as passing by never running at all. The marker row is
-- counted after each one as the owner, which is the only thing that
-- proves nothing actually went.
do $$
declare v_before integer; v_after integer; v_mark timestamptz;
begin
  select count(*) into v_before from lms_email_verify_state;
  perform t19_say('9a there is a mark to protect', v_before::text, '1');

  -- KEPT FOR 9h, which asks whether any of section 9 MOVED the mark.
  -- It used to ask whether the mark was less than an hour old, which is
  -- a different question with the same answer only on a database built
  -- in the last hour. It failed on one built two and a half hours
  -- earlier, with and without any change, which is the worst kind of
  -- test: one that goes red for a reason that has nothing to do with
  -- what it is checking.
  select max(first_run_at) into v_mark from lms_email_verify_state;
  perform set_config('t19.mark_before', coalesce(v_mark::text, ''), true);
end $$;

do $$ begin
  perform t19_be(null);
  set local role anon;
  truncate lms_email_verify_state;
  reset role;
  perform t19_say('9b anon cannot truncate the mark', 'allowed', 'refused');
exception when others then
  reset role;
  perform t19_say('9b anon cannot truncate the mark', 'refused', 'refused');
end $$;

do $$ begin
  perform t19_be(null);
  set local role anon;
  delete from lms_email_verify_state where true;
  reset role;
  perform t19_say('9c nor delete from it', 'allowed', 'refused');
exception when others then
  reset role;
  perform t19_say('9c nor delete from it', 'refused', 'refused');
end $$;

do $$ begin
  perform t19_be(null);
  set local role anon;
  perform count(*) from lms_email_verify_state;
  reset role;
  perform t19_say('9d nor read it', 'allowed', 'refused');
exception when others then
  reset role;
  perform t19_say('9d nor read it', 'refused', 'refused');
end $$;

-- AND A SIGNED IN LEARNER IS NO DIFFERENT. anon and authenticated both
-- held the whole set, so testing only the signed out case would have
-- left the larger half of the hole untested.
do $$ begin
  perform t19_be('19aa0000-0000-0000-0000-000000000001');
  set local role authenticated;
  update lms_email_verify_state set first_run_at = now() - interval '10 years' where id = 1;
  reset role;
  perform t19_say('9e a learner cannot move the mark backwards', 'allowed', 'refused');
exception when others then
  reset role;
  perform t19_say('9e a learner cannot move the mark backwards', 'refused', 'refused');
end $$;

do $$ begin
  perform t19_be('19aa0000-0000-0000-0000-000000000001');
  set local role authenticated;
  truncate lms_email_verify_state;
  reset role;
  perform t19_say('9f nor truncate it', 'allowed', 'refused');
exception when others then
  reset role;
  perform t19_say('9f nor truncate it', 'refused', 'refused');
end $$;

do $$
declare v_after integer; v_mark timestamptz;
begin
  perform t19_be(null);
  select count(*), max(first_run_at) into v_after, v_mark from lms_email_verify_state;
  perform t19_say('9g the mark survived all of that', v_after::text, '1');
  -- Compared with what it was before the section, not with the clock.
  perform t19_say('9h and was not moved',
    case when coalesce(v_mark::text, '')
            is not distinct from coalesce(current_setting('t19.mark_before', true), '')
         then 'where it was' else 'MOVED' end,
    'where it was');
end $$;

-- The table is shut the way the codes table is shut: row level security
-- on, no policy at all, and the grants taken back. The two functions
-- reach the codes table because they are security definer, and step 2
-- of file 19 reaches this one because it runs as the file's owner.
do $$
declare v_rls boolean; v_grants integer;
begin
  select relrowsecurity into v_rls from pg_class
   where oid = 'public.lms_email_verify_state'::regclass;
  perform t19_say('9i row level security is on', coalesce(v_rls::text, 'missing'), 'true');

  select count(*) into v_grants from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'lms_email_verify_state'
     and grantee in ('PUBLIC', 'anon', 'authenticated');
  perform t19_say('9j and no grant is left to public, anon or authenticated',
    v_grants::text, '0');

  select count(*) into v_grants from pg_policy
   where polrelid = 'public.lms_email_verify_state'::regclass;
  perform t19_say('9k with no policy, so nothing reaches it but the owner',
    v_grants::text, '0');

  -- the codes table, asked the same question, because it was revoked
  -- from anon and authenticated only and public was never named
  select count(*) into v_grants from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'lms_email_checks'
     and grantee in ('PUBLIC', 'anon', 'authenticated');
  perform t19_say('9l the codes table is shut the same way', v_grants::text, '0');
end $$;

-- ------------------------------------------------------------- results
\pset tuples_only off
\pset format aligned
select n as "#", label as "what was checked",
       case when got is not distinct from want then 'pass' else 'FAIL' end as "result",
       got as "got", want as "wanted"
  from t19_out order by n;

select case when count(*) = 0 then 'ALL PASS'
            else count(*) || ' FAILED' end as "summary"
  from t19_out where got is distinct from want;

rollback;
