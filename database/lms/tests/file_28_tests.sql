-- Tests file 28. NOT for the Supabase editor: it makes accounts,
-- participants and enrolments, acts as an administrator, a facilitator
-- and three learners through row level security, and rolls everything
-- back.
--
-- SECTIONS 2, 3 AND 4 ARE THE WHOLE POINT. They are the four loopholes
-- demonstrated rather than described: a learner cannot scan a card, a
-- scan sent twice writes one row, a code from the wrong cohort and an
-- expired code are both refused, and the form will not open for somebody
-- who was never marked present.
--
-- EVERY PERMISSION TEST RUNS AS authenticated. Row level security does
-- not apply to a table's owner unless FORCE is set, and psql connects as
-- the owner, so a test that forgets "set local role" passes whatever the
-- rules say.
--
-- NOTHING IS RECORDED WHILE A ROLE IS SET. t28_say writes to a temporary
-- table that authenticated cannot touch. Capture into variables, reset
-- role, then record.
--
-- SECTION 0 CHECKS THE ACTORS ARE WHO THE TEST THINKS THEY ARE. That is
-- the file 27 lesson: without it, "a learner cannot scan" would go green
-- on a database where the learner was never given a participant link,
-- because they would be refused for the wrong reason.

\set ON_ERROR_STOP on
begin;

create temporary table t28_out (n integer, label text, got text, want text) on commit drop;

create or replace function t28_say(p_label text, p_got text, p_want text)
returns void language plpgsql as $$
begin
  insert into t28_out values ((select coalesce(max(n), 0) + 1 from t28_out), p_label, p_got, p_want);
end $$;

create or replace function t28_be(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end $$;

-- The card token, read as the owner. A learner must never see one, so
-- the test reads it the way the printing function does rather than by
-- selecting the table as a learner.
create or replace function t28_token(p_part uuid) returns text
language sql security definer set search_path = public as $$
  select c.card_token from lms_participant_cards c where c.participant_id = p_part
$$;

-- ---------------------------------------------------------------------
-- The ground. An administrator, a facilitator, and three learners:
-- two in cohort alpha, one in cohort beta, plus one account with no
-- bootcamp link at all.
-- ---------------------------------------------------------------------
insert into auth.users (id, email, created_at, email_confirmed_at) values
  ('28d10000-0000-0000-0000-0000000000d1','t28-admin@example.com',       now(), now()),
  ('28f10000-0000-0000-0000-0000000000f1','t28-facilitator@example.com', now(), now()),
  ('28a10000-0000-0000-0000-0000000000a1','t28-alpha-one@example.com',   now(), now()),
  ('28a20000-0000-0000-0000-0000000000a2','t28-alpha-two@example.com',   now(), now()),
  ('28a30000-0000-0000-0000-0000000000a3','t28-beta-one@example.com',    now(), now()),
  ('28a40000-0000-0000-0000-0000000000a4','t28-alpha-three@example.com', now(), now()),
  ('28a90000-0000-0000-0000-0000000000a9','t28-no-bootcamp@example.com', now(), now());

update lms_profiles set role='admin', email_verified_at=now(), full_name='T28 Admin'
 where id='28d10000-0000-0000-0000-0000000000d1';
update lms_profiles set role='facilitator', email_verified_at=now(), full_name='T28 Facilitator'
 where id='28f10000-0000-0000-0000-0000000000f1';
update lms_profiles set role='learner', email_verified_at=now(), full_name='T28 Alpha One'
 where id='28a10000-0000-0000-0000-0000000000a1';
update lms_profiles set role='learner', email_verified_at=now(), full_name='T28 Alpha Two'
 where id='28a20000-0000-0000-0000-0000000000a2';
update lms_profiles set role='learner', email_verified_at=now(), full_name='T28 Beta One'
 where id='28a30000-0000-0000-0000-0000000000a3';
-- Alpha Three exists for one reason: the expired-code check needs
-- somebody in the ALPHA cohort who has not checked in yet. The first
-- version of that check used the beta learner, so the code was refused
-- because of the cohort and not because it had expired, and the check
-- went green while testing nothing. Mutation testing caught it: ignoring
-- the window turned no check red.
update lms_profiles set role='learner', email_verified_at=now(), full_name='T28 Alpha Three'
 where id='28a40000-0000-0000-0000-0000000000a4';
update lms_profiles set role='learner', email_verified_at=now(), full_name='T28 No Bootcamp'
 where id='28a90000-0000-0000-0000-0000000000a9';

insert into programmes (id, slug, title, code, active)
values ('28910000-0000-0000-0000-000000000091','t28-prog','T28 Programme','T28', true);

insert into participants (id, full_name, email, created_at) values
  ('28710000-0000-0000-0000-000000000071','T28 Alpha One','t28-alpha-one@example.com', now()),
  ('28720000-0000-0000-0000-000000000072','T28 Alpha Two','t28-alpha-two@example.com', now()),
  ('28730000-0000-0000-0000-000000000073','T28 Beta One', 't28-beta-one@example.com',  now()),
  ('28740000-0000-0000-0000-000000000074','T28 Alpha Three','t28-alpha-three@example.com', now());

insert into participant_enrolments (participant_id, programme_id, cohort, status) values
  ('28710000-0000-0000-0000-000000000071','28910000-0000-0000-0000-000000000091','t28-alpha','active'),
  ('28720000-0000-0000-0000-000000000072','28910000-0000-0000-0000-000000000091','t28-alpha','active'),
  ('28730000-0000-0000-0000-000000000073','28910000-0000-0000-0000-000000000091','t28-beta', 'active'),
  ('28740000-0000-0000-0000-000000000074','28910000-0000-0000-0000-000000000091','t28-alpha','active');

update lms_profiles set participant_id='28710000-0000-0000-0000-000000000071'
 where id='28a10000-0000-0000-0000-0000000000a1';
update lms_profiles set participant_id='28720000-0000-0000-0000-000000000072'
 where id='28a20000-0000-0000-0000-0000000000a2';
update lms_profiles set participant_id='28730000-0000-0000-0000-000000000073'
 where id='28a30000-0000-0000-0000-0000000000a3';
update lms_profiles set participant_id='28740000-0000-0000-0000-000000000074'
 where id='28a40000-0000-0000-0000-0000000000a4';

-- ---------------------------------------------------------------------
-- 0. The actors are who we think they are
-- ---------------------------------------------------------------------
do $$ begin
  perform t28_say('0a the administrator really is an administrator',
    (select role::text from lms_profiles where id='28d10000-0000-0000-0000-0000000000d1'), 'admin');
  perform t28_say('0b the facilitator really is a facilitator',
    (select role::text from lms_profiles where id='28f10000-0000-0000-0000-0000000000f1'), 'facilitator');
  perform t28_say('0c the first learner really is a learner',
    (select role::text from lms_profiles where id='28a10000-0000-0000-0000-0000000000a1'), 'learner');
  perform t28_say('0d and really is linked to a participant',
    (select participant_id::text from lms_profiles where id='28a10000-0000-0000-0000-0000000000a1'),
    '28710000-0000-0000-0000-000000000071');
  perform t28_say('0e the beta learner is in a different cohort',
    (select e.cohort from participant_enrolments e
      where e.participant_id='28730000-0000-0000-0000-000000000073'), 't28-beta');
  perform t28_say('0f the unlinked account has no participant',
    coalesce((select participant_id::text from lms_profiles
               where id='28a90000-0000-0000-0000-0000000000a9'), 'none'), 'none');
end $$;

-- ---------------------------------------------------------------------
-- 1. ID cards are an administrator's business
-- ---------------------------------------------------------------------
do $$
declare v_said text; v_no text; v_no2 text; v_tok text; v_tok2 text;
begin
  -- a learner cannot issue themselves a card
  perform t28_be('28a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  begin
    perform lms_issue_participant_card('28710000-0000-0000-0000-000000000071');
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('1a a learner cannot issue an ID card', v_said, 'refused');

  -- nor can a facilitator
  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  begin
    perform lms_issue_participant_card('28710000-0000-0000-0000-000000000071');
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('1b nor can a facilitator', v_said, 'refused');

  -- the administrator can, and the number looks like a number
  perform t28_be('28d10000-0000-0000-0000-0000000000d1');
  set local role authenticated;
  select lms_issue_participant_card('28710000-0000-0000-0000-000000000071') into v_no;
  select lms_issue_participant_card('28720000-0000-0000-0000-000000000072') into v_no2;
  perform lms_issue_participant_card('28730000-0000-0000-0000-000000000073');
  reset role;
  perform t28_say('1c an administrator can issue one',
    (v_no ~ '^DLA-[0-9]{2}-[2-9A-HJ-NP-Z]{5}$')::text, 'true');
  perform t28_say('1d with no character that can be misread',
    (v_no ~ '[01IO]')::text, 'false');

  -- issuing twice is not two cards
  v_tok := t28_token('28710000-0000-0000-0000-000000000071');
  perform t28_be('28d10000-0000-0000-0000-0000000000d1');
  set local role authenticated;
  select lms_issue_participant_card('28710000-0000-0000-0000-000000000071') into v_no2;
  reset role;
  perform t28_say('1e issuing twice keeps the same card', (v_no2 = v_no)::text, 'true');
  perform t28_say('1f and the same token',
    (t28_token('28710000-0000-0000-0000-000000000071') = v_tok)::text, 'true');

  -- a lost card: new token, same number
  perform t28_be('28d10000-0000-0000-0000-0000000000d1');
  set local role authenticated;
  select lms_card_mark_lost('28710000-0000-0000-0000-000000000071') into v_no2;
  reset role;
  v_tok2 := t28_token('28710000-0000-0000-0000-000000000071');
  perform t28_say('1g marking a card lost keeps the number', (v_no2 = v_no)::text, 'true');
  perform t28_say('1h but replaces the token', (v_tok2 <> v_tok)::text, 'true');
  perform t28_say('1i and the old token is gone for good',
    (select count(*)::text from lms_participant_cards where card_token = v_tok), '0');
end $$;

-- ---------------------------------------------------------------------
-- 2. THE SCAN DOOR. A learner cannot scan, and a scan sent twice
--    writes one row.
-- ---------------------------------------------------------------------
do $$
declare v_said text; v_day uuid; v_tok text; v_beta_tok text; v_n integer; v_res jsonb;
begin
  -- the facilitator opens today for cohort alpha
  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  select (lms_attendance_open_day('t28-alpha','in_person','T28 Day One', 12)->>'id')::uuid into v_day;
  reset role;
  perform t28_say('2a a facilitator can open a day', (v_day is not null)::text, 'true');

  v_tok      := t28_token('28710000-0000-0000-0000-000000000071');
  v_beta_tok := t28_token('28730000-0000-0000-0000-000000000073');

  -- THE LOOPHOLE. A learner holding somebody's card cannot scan it.
  perform t28_be('28a20000-0000-0000-0000-0000000000a2');
  set local role authenticated;
  begin
    perform lms_attendance_scan(v_day, v_tok, null);
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('2b a learner cannot scan a card at all', v_said, 'refused');
  perform t28_say('2c and nobody was marked present by it',
    (select count(*)::text from lms_attendance_checkins where day_id = v_day), '0');

  -- a made up token is refused
  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  begin
    perform lms_attendance_scan(v_day, '00000000000000000000000000000000', null);
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('2d an unknown card is refused', v_said, 'refused');

  -- a card from another cohort is refused
  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  begin
    perform lms_attendance_scan(v_day, v_beta_tok, null);
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('2e a card from another cohort is refused', v_said, 'refused');

  -- the facilitator scans properly, and gets the name back to check
  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  select lms_attendance_scan(v_day, v_tok, 'receipt-aaaa0001') into v_res;
  reset role;
  perform t28_say('2f a facilitator can scan', (v_res->>'ok'), 'true');
  perform t28_say('2g and sees the name, to check the face',
    (v_res->>'full_name'), 'T28 Alpha One');
  perform t28_say('2h the first scan is not a duplicate',
    (v_res->>'already_in'), 'false');

  -- THE OFFLINE CASE. The phone was not sure, so it sends the same
  -- scan again. One row, not two, and no error.
  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  begin
    select lms_attendance_scan(v_day, v_tok, 'receipt-aaaa0001') into v_res;
    v_said := 'no error';
  exception when others then v_said := 'ERROR: ' || left(sqlerrm, 40);
  end;
  reset role;
  perform t28_say('2i a resent scan does not error', v_said, 'no error');
  perform t28_say('2j and says the person was already in', (v_res->>'already_in'), 'true');
  select count(*) into v_n from lms_attendance_checkins
   where day_id = v_day and user_id = '28a10000-0000-0000-0000-0000000000a1';
  perform t28_say('2k one check-in only, after two scans', v_n::text, '1');

  -- a different receipt number for the same person is also one row
  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  select lms_attendance_scan(v_day, v_tok, 'receipt-bbbb0002') into v_res;
  reset role;
  select count(*) into v_n from lms_attendance_checkins
   where day_id = v_day and user_id = '28a10000-0000-0000-0000-0000000000a1';
  perform t28_say('2l and still one after a different receipt', v_n::text, '1');
  perform t28_say('2m the method recorded is a scan',
    (select method from lms_attendance_checkins
      where day_id = v_day and user_id = '28a10000-0000-0000-0000-0000000000a1'
      limit 1), 'scan');
  perform t28_say('2n and it names the staff member who scanned',
    (select (scanned_by = '28f10000-0000-0000-0000-0000000000f1')::text
       from lms_attendance_checkins
      where day_id = v_day and user_id = '28a10000-0000-0000-0000-0000000000a1'
      limit 1), 'true');
end $$;

-- ---------------------------------------------------------------------
-- 3. THE CODE DOOR. Short window, one use per account, right cohort.
-- ---------------------------------------------------------------------
do $$
declare
  v_said text; v_day uuid; v_beta_day uuid; v_code text; v_beta_code text;
  v_n integer; v_res jsonb;
begin
  select id into v_day from lms_attendance_days where cohort = 't28-alpha';

  -- a learner cannot reveal the code
  perform t28_be('28a20000-0000-0000-0000-0000000000a2');
  set local role authenticated;
  begin
    perform lms_attendance_reveal_code(v_day, 20);
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('3a a learner cannot reveal the code', v_said, 'refused');

  -- the facilitator reveals it
  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  select (lms_attendance_reveal_code(v_day, 20))->>'code' into v_code;
  reset role;
  perform t28_say('3b the code is eight characters', length(v_code)::text, '8');
  perform t28_say('3c with nothing that can be misread',
    (v_code ~ '[01IO]')::text, 'false');

  -- THE CODE IS NOT STORED. The column holds a fingerprint, not the code.
  perform t28_say('3d the code itself is not in the table',
    (select count(*)::text from lms_attendance_days
      where code_hash = v_code or code_salt = v_code), '0');
  perform t28_say('3e what is stored is a sha-256 fingerprint',
    (select (code_hash = encode(sha256((code_salt || v_code)::bytea), 'hex'))::text
       from lms_attendance_days where id = v_day), 'true');

  -- a wrong code is refused
  perform t28_be('28a20000-0000-0000-0000-0000000000a2');
  set local role authenticated;
  begin
    perform lms_attendance_use_code('WRONGCOD');
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('3f a wrong code is refused', v_said, 'refused');

  -- the right code works
  perform t28_be('28a20000-0000-0000-0000-0000000000a2');
  set local role authenticated;
  select lms_attendance_use_code(v_code) into v_res;
  reset role;
  perform t28_say('3g the right code marks them present', (v_res->>'checked_in'), 'true');
  perform t28_say('3h and records the method as a code',
    (select method from lms_attendance_checkins
      where day_id = v_day and user_id = '28a20000-0000-0000-0000-0000000000a2'
      limit 1), 'code');
  perform t28_say('3i with no staff member attached',
    coalesce((select scanned_by::text from lms_attendance_checkins
               where day_id = v_day and user_id = '28a20000-0000-0000-0000-0000000000a2'
               limit 1),
             'none'), 'none');

  -- ONE USE PER ACCOUNT: using it again writes nothing more
  perform t28_be('28a20000-0000-0000-0000-0000000000a2');
  set local role authenticated;
  begin
    perform lms_attendance_use_code(v_code);
    v_said := 'no error';
  exception when others then v_said := 'ERROR';
  end;
  reset role;
  select count(*) into v_n from lms_attendance_checkins
   where day_id = v_day and user_id = '28a20000-0000-0000-0000-0000000000a2';
  perform t28_say('3j using the code twice is still one record', v_n::text, '1');

  -- A CODE FROM ANOTHER COHORT DOES NOT WORK HERE, even while it is live
  -- over there.
  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  select (lms_attendance_open_day('t28-beta','virtual','T28 Beta Day', 12)->>'id')::uuid into v_beta_day;
  select (lms_attendance_reveal_code(v_beta_day, 20))->>'code' into v_beta_code;
  reset role;

  perform t28_be('28a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  begin
    perform lms_attendance_use_code(v_beta_code);
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('3k a code from another cohort is refused', v_said, 'refused');

  -- AN EXPIRED CODE IS REFUSED. The window is wound back rather than
  -- waiting twenty minutes.
  --
  -- ALPHA THREE, NOT THE BETA LEARNER. The first version of this check
  -- used the beta learner, who is refused by the cohort test whatever
  -- the clock says, so it went green on a database that ignored the
  -- window completely. 3l and 3n are a pair: the same person and the
  -- same code, refused when the window is shut and accepted when it is
  -- open, so the only thing that changed is the window.
  update lms_attendance_days
     set code_opens_at  = now() - interval '2 hours',
         code_closes_at = now() - interval '100 minutes'
   where id = v_day;

  perform t28_be('28a40000-0000-0000-0000-0000000000a4');
  set local role authenticated;
  begin
    perform lms_attendance_use_code(v_code);
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('3l an expired code is refused', v_said, 'refused');
  perform t28_say('3m and nothing was written by it',
    (select count(*)::text from lms_attendance_checkins
      where day_id = v_day and user_id = '28a40000-0000-0000-0000-0000000000a4'), '0');

  -- the window reopened, same person, same code
  update lms_attendance_days
     set code_opens_at  = now() - interval '1 minute',
         code_closes_at = now() + interval '19 minutes'
   where id = v_day;

  perform t28_be('28a40000-0000-0000-0000-0000000000a4');
  set local role authenticated;
  begin
    perform lms_attendance_use_code(v_code);
    v_said := 'allowed';
  exception when others then v_said := 'REFUSED';
  end;
  reset role;
  perform t28_say('3n the same code inside the window is accepted', v_said, 'allowed');

  -- revealing again kills the old code
  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  perform lms_attendance_reveal_code(v_day, 20);
  reset role;
  perform t28_say('3o revealing again replaces the fingerprint',
    (select (code_hash = encode(sha256((code_salt || v_code)::bytea), 'hex'))::text
       from lms_attendance_days where id = v_day), 'false');
end $$;

-- ---------------------------------------------------------------------
-- 4. THE FORM DOOR. No check-in, no form.
-- ---------------------------------------------------------------------
do $$
declare v_said text; v_day uuid; v_n integer; v_res jsonb;
begin
  select id into v_day from lms_attendance_days where cohort = 't28-alpha';

  -- Beta One is in the alpha cohort's class? No. Use the alpha learner
  -- who has NOT checked in: nobody left, so make one by removing the
  -- check-in of Alpha Two and trying as them.
  delete from lms_attendance_checkins
   where day_id = v_day and user_id = '28a20000-0000-0000-0000-0000000000a2';

  perform t28_be('28a20000-0000-0000-0000-0000000000a2');
  set local role authenticated;
  begin
    perform lms_attendance_submit('most', 4, null, null);
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('4a somebody never marked present cannot fill the form',
    v_said, 'refused');
  perform t28_say('4b and no answer was written',
    (select count(*)::text from lms_attendance_responses
      where day_id = v_day and user_id = '28a20000-0000-0000-0000-0000000000a2'), '0');

  -- the learner who WAS scanned can
  perform t28_be('28a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  select lms_attendance_submit('most', 4, 'The second join was unclear.', null) into v_res;
  reset role;
  perform t28_say('4c somebody who was scanned can fill it', (v_res->>'answered'), 'true');

  -- filling it twice corrects rather than duplicates
  perform t28_be('28a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  perform lms_attendance_submit('all', 5, null, 'Please go over joins again.');
  reset role;
  select count(*) into v_n from lms_attendance_responses
   where day_id = v_day and user_id = '28a10000-0000-0000-0000-0000000000a1';
  perform t28_say('4d filling it twice is one answer, corrected', v_n::text, '1');
  perform t28_say('4e and the correction took',
    (select followed from lms_attendance_responses
      where day_id = v_day and user_id = '28a10000-0000-0000-0000-0000000000a1'), 'all');

  -- a value not on the list is refused by the database, not the page
  perform t28_be('28a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  begin
    perform lms_attendance_submit('brilliant', 4, null, null);
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('4f an answer not on the list is refused', v_said, 'refused');

  -- a confidence outside one to five is refused
  perform t28_be('28a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  begin
    perform lms_attendance_submit('all', 9, null, null);
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('4g a confidence of nine is refused', v_said, 'refused');

  -- THE FORM CLOSES. Wound forward rather than waited for.
  update lms_attendance_days set form_closes_at = now() - interval '1 minute'
   where id = v_day;
  perform t28_be('28a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  begin
    perform lms_attendance_submit('some', 2, null, null);
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('4h a closed form is refused', v_said, 'refused');
  perform t28_say('4i and the earlier answer is untouched',
    (select followed from lms_attendance_responses
      where day_id = v_day and user_id = '28a10000-0000-0000-0000-0000000000a1'), 'all');

  update lms_attendance_days set form_closes_at = now() + interval '6 hours'
   where id = v_day;
end $$;

-- ---------------------------------------------------------------------
-- 5. Nigerian time, not the server clock
-- ---------------------------------------------------------------------
do $$
declare v_n integer;
begin
  perform t28_say('5a the day the file means is the Lagos day',
    (lms_wat_today() = (now() at time zone 'Africa/Lagos')::date)::text, 'true');

  -- THE BUG THIS DEFENDS AGAINST, shown with a fixed moment rather than
  -- by waiting until half past eleven at night. At 23:30 UTC it is
  -- already tomorrow in Lagos, so a scan filed by the server's own date
  -- would land on the day before.
  perform t28_say('5b at 23:30 UTC the Lagos date is already tomorrow',
    (timestamptz '2026-11-03 23:30:00+00' at time zone 'Africa/Lagos')::date::text,
    '2026-11-04');
  perform t28_say('5c while the server date is still yesterday',
    (timestamptz '2026-11-03 23:30:00+00' at time zone 'UTC')::date::text,
    '2026-11-03');

  -- No function in file 28 leans on the server's own date, which is the
  -- structural version of the two checks above.
  select count(*) into v_n
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public'
     and p.proname in ('lms_attendance_open_day','lms_attendance_my_day',
                       'lms_attendance_submit','lms_issue_participant_card')
     and pg_get_functiondef(p.oid) ~* 'current_date';
  perform t28_say('5d no file 28 function uses the server date', v_n::text, '0');

  perform t28_say('5e and lms_wat_today names Lagos explicitly',
    (select (pg_get_functiondef(p.oid) ~ 'Africa/Lagos')::text
       from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname = 'lms_wat_today'), 'true');
end $$;

-- ---------------------------------------------------------------------
-- 6. The first-sign-in screen, and the name rule
-- ---------------------------------------------------------------------
do $$
declare v_said text; v_res jsonb;
begin
  -- a learner cannot write the table directly
  perform t28_be('28a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  begin
    insert into lms_learner_setup (user_id, preferred_name, device, internet, topic_experience)
    values ('28a10000-0000-0000-0000-0000000000a1','Hacked','laptop','reliable','none');
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('6a a learner cannot write the setup table directly',
    v_said, 'refused');

  -- but can through the function
  perform t28_be('28a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  select lms_save_my_setup('Ope', 'phone', 'sometimes', 'some', 'I want a data job.') into v_res;
  reset role;
  perform t28_say('6b and can through the save function', (v_res->>'done'), 'true');
  perform t28_say('6c which stored the preferred name',
    (select preferred_name from lms_learner_setup
      where user_id = '28a10000-0000-0000-0000-0000000000a1'), 'Ope');

  -- THE NAME RULE. There is no parameter for it and no column for it, so
  -- there is nothing to defend: a learner cannot change their own name
  -- because the screen has nowhere to write one.
  perform t28_say('6d the setup table holds no name column',
    (select count(*)::text from information_schema.columns
      where table_schema = 'public' and table_name = 'lms_learner_setup'
        and column_name in ('full_name','name','email','phone')), '0');
  perform t28_say('6e and the save function takes no name',
    (select count(*)::text from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname = 'lms_save_my_setup'
        and pg_get_function_arguments(p.oid) ~* '(full_name|p_name)'), '0');
  perform t28_say('6f the real name is unchanged',
    (select full_name from lms_profiles where id = '28a10000-0000-0000-0000-0000000000a1'),
    'T28 Alpha One');

  -- a device that is not on the list is refused
  perform t28_be('28a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  begin
    perform lms_save_my_setup('Ope', 'tablet', 'sometimes', 'some', null);
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('6g a device not on the list is refused', v_said, 'refused');

  -- one learner cannot read another's row
  perform t28_be('28a20000-0000-0000-0000-0000000000a2');
  set local role authenticated;
  select count(*) into v_said from lms_learner_setup
   where user_id = '28a10000-0000-0000-0000-0000000000a1';
  reset role;
  perform t28_say('6h one learner cannot read another setup row', v_said, '0');

  -- staff can, because a facilitator needs to know who is on a phone
  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  select count(*) into v_said from lms_learner_setup
   where user_id = '28a10000-0000-0000-0000-0000000000a1';
  reset role;
  perform t28_say('6i but a facilitator can', v_said, '1');
end $$;

-- ---------------------------------------------------------------------
-- 7. The two secrets never leave the server
-- ---------------------------------------------------------------------
do $$
declare v_said text;
begin
  perform t28_be('28a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  begin
    perform 1 from lms_attendance_days limit 1;
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('7a a learner cannot read the day table, which holds the code',
    v_said, 'refused');

  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  begin
    perform 1 from lms_attendance_days limit 1;
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('7b nor can a facilitator, who reads it through a function',
    v_said, 'refused');

  perform t28_be('28d10000-0000-0000-0000-0000000000d1');
  set local role authenticated;
  begin
    perform 1 from lms_participant_cards limit 1;
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('7c not even an administrator reads the card table directly',
    v_said, 'refused');

  -- and nothing can be emptied in one statement
  perform t28_be('28a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  begin
    truncate lms_attendance_checkins;
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('7d attendance cannot be emptied in one statement',
    v_said, 'refused');

  perform t28_say('7e anon holds nothing on any of the five tables',
    (select count(*)::text from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon'
        and table_name in ('lms_participant_cards','lms_learner_setup',
          'lms_attendance_days','lms_attendance_checkins','lms_attendance_responses')),
    '0');
end $$;

-- ---------------------------------------------------------------------
-- 8. Nothing is deleted, and a correction says who did it
-- ---------------------------------------------------------------------
do $$
declare v_said text; v_day uuid; v_n integer;
begin
  select id into v_day from lms_attendance_days where cohort = 't28-alpha';

  perform t28_say('8a no function in file 28 deletes an attendance row',
    (select count(*)::text from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname like 'lms_attendance%'
        and pg_get_functiondef(p.oid) ~* 'delete[[:space:]]+from[[:space:]]+lms_attendance'),
    '0');

  -- a learner cannot delete their own check-in
  perform t28_be('28a10000-0000-0000-0000-0000000000a1');
  set local role authenticated;
  begin
    delete from lms_attendance_checkins
     where user_id = '28a10000-0000-0000-0000-0000000000a1';
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('8b a learner cannot delete their own check-in', v_said, 'refused');

  -- a correction needs a reason
  perform t28_be('28d10000-0000-0000-0000-0000000000d1');
  set local role authenticated;
  begin
    perform lms_attendance_correct(v_day, '28a20000-0000-0000-0000-0000000000a2', 'x');
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('8c a correction with no reason is refused', v_said, 'refused');

  -- and with one, it records who and why
  perform t28_be('28d10000-0000-0000-0000-0000000000d1');
  set local role authenticated;
  perform lms_attendance_correct(v_day, '28a20000-0000-0000-0000-0000000000a2',
                                 'Arrived late, scanner battery was flat.');
  reset role;
  perform t28_say('8d a correction names who made it',
    (select (corrected_by = '28d10000-0000-0000-0000-0000000000d1')::text
       from lms_attendance_checkins
      where day_id = v_day and user_id = '28a20000-0000-0000-0000-0000000000a2'
      limit 1), 'true');
  perform t28_say('8e and keeps the reason',
    (select (correction_note is not null)::text from lms_attendance_checkins
      where day_id = v_day and user_id = '28a20000-0000-0000-0000-0000000000a2'
      limit 1), 'true');
  -- Actually tried, not inferred from a grant. The grant says
  -- authenticated may call it, which is true of every learner too: the
  -- refusal is inside the function, so only calling it proves anything.
  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  begin
    perform lms_attendance_correct(v_day, '28a10000-0000-0000-0000-0000000000a1',
                                   'A facilitator should not be able to do this.');
    v_said := 'ALLOWED';
  exception when others then v_said := 'refused';
  end;
  reset role;
  perform t28_say('8f a facilitator cannot correct a record', v_said, 'refused');

  -- the register reads back what happened
  perform t28_be('28f10000-0000-0000-0000-0000000000f1');
  set local role authenticated;
  select count(*) into v_n from lms_attendance_register('t28-alpha', null, null);
  reset role;
  perform t28_say('8g the register shows all three who were present', v_n::text, '3');
end $$;

-- ------------------------------------------------------------- results
\pset tuples_only off
\pset format aligned
select n as "#", label as "what was checked",
       case when got is not distinct from want then 'pass' else 'FAIL' end as "result",
       got as "got", want as "wanted"
  from t28_out order by n;

select case when count(*) = 0 then 'ALL PASS'
            else count(*) || ' FAILED' end as "summary"
  from t28_out where got is distinct from want;

rollback;
