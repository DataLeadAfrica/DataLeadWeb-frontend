-- =====================================================================
-- FILE 28. Attendance for bootcamp participants, and the short screen a
-- learner fills in the first time they sign in.
--
-- PASTE 28_attendance_EDITOR.sql, NOT THIS ONE. The two hold the same
-- statements and a test keeps them in step. The plain English is in
-- docs/lms/PHASE-6H-PLAIN.md and 28_verify.sql checks the result.
--
-- WHAT THIS IS FOR. A bootcamp meets, in a room or online, and somebody
-- has to record who was there. In the room a member of staff scans the
-- QR on the participant's ID card. Online the facilitator reveals a code
-- during the class and participants type it. Either way there is one
-- attendance record per participant per day, and only somebody who
-- checked in can open that day's short form.
--
-- THE CERTIFICATION TABLES ARE NOT TOUCHED. The ID card needs a number
-- and a secret token per participant, and the obvious place for them is
-- two new columns on participants. participants is a certification
-- table: certificates.participant_id points at it. So the card data
-- lives in lms_participant_cards, a new table of its own that points at
-- participants rather than altering it. Nothing in here adds, changes or
-- removes a column anywhere outside this file.
--
-- WHY THERE IS NO PHOTOGRAPH. The scanner shows a name and a cohort and
-- nothing else. A photograph would let staff check a face against the
-- card, which is the strongest answer to a shared card, and that was
-- offered and declined for now. There is no photo column here and no
-- storage bucket behind it, so this file does not half build one: a
-- later file can add it without disturbing anything written here.
--
-- WHY NO TABLE IN HERE IS WRITABLE FROM A BROWSER. The lesson of file
-- 23, learned again in file 26: a write policy on a learner's own row is
-- a write policy on every column of that row. A learner who could write
-- their own check-in could write method = 'scan' and invent a staff
-- member who scanned them. So none of these five tables has a write
-- policy at all, insert, update and delete are revoked from the browser
-- roles, and every change goes through a function that checks who is
-- asking.
--
-- TWO TABLES ARE NOT READABLE FROM A BROWSER EITHER, for the same
-- reason quiz_options.is_correct never leaves the server.
-- lms_attendance_days holds the fingerprint of the access code and
-- lms_participant_cards holds the secret card token. A select grant on
-- either would hand out the thing it is protecting, so neither has one,
-- and learners read what they are allowed to through functions that do
-- not select those columns.
--
-- EVERY DAY BOUNDARY IS NIGERIAN. The database server's clock is UTC,
-- one hour behind Lagos, so current_date here is the wrong day for an
-- hour every night. A scan at half past midnight in Lagos is 23:30 UTC
-- the day before, and filed by current_date it would land on yesterday.
-- Every "what day is it" in this file asks for
-- (now() at time zone 'Africa/Lagos')::date instead, and a check-in
-- belongs to the day a facilitator opened rather than to whatever the
-- server thinks today is.
--
-- NOTHING HERE IS EVER DELETED. A day is closed, not removed. A
-- check-in can be corrected by staff, which rewrites the method and
-- records who changed it, but no function in this file deletes an
-- attendance row or a form answer.
-- =====================================================================

-- -------------------------------------------------------------- step 0
-- Files 01 to 27 first.
do $$
declare v_missing text[] := '{}';
begin
  if to_regclass('public.participants') is null then
    v_missing := v_missing || 'participants (certification tables)'::text;
  end if;
  if to_regclass('public.participant_enrolments') is null then
    v_missing := v_missing || 'participant_enrolments (certification tables)'::text;
  end if;
  if to_regclass('public.lms_profiles') is null then
    v_missing := v_missing || 'lms_profiles (file 01)'::text;
  end if;
  if to_regclass('public.lms_admin_actions') is null then
    v_missing := v_missing || 'lms_admin_actions (file 11)'::text;
  end if;
  if to_regprocedure('public.lms_is_staff()') is null then
    v_missing := v_missing || 'lms_is_staff (file 10)'::text;
  end if;
  if to_regprocedure('public.lms_is_admin()') is null then
    v_missing := v_missing || 'lms_is_admin (file 10)'::text;
  end if;
  if to_regprocedure('public.lms_touch()') is null then
    v_missing := v_missing || 'lms_touch (file 01)'::text;
  end if;
  if to_regprocedure('public.lms_log_action(text, text, uuid, jsonb)') is null then
    v_missing := v_missing || 'lms_log_action (file 17)'::text;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'lms_profiles'
                    and column_name = 'participant_id') then
    v_missing := v_missing || 'lms_profiles.participant_id (file 01)'::text;
  end if;
  if array_length(v_missing, 1) is not null then
    raise exception 'File 28 cannot run yet. Missing: %', array_to_string(v_missing, ', ');
  end if;
  raise notice 'Step 0: files 01 to 27 are in place.';
end $$;

-- -------------------------------------------------------------- step 1
-- The ID card: a number people can read, and a token nobody can guess.
--
-- WHY TWO VALUES AND NOT ONE. participant_no is printed on the front of
-- the card and is what somebody quotes on the phone. If that were also
-- the thing inside the QR, anybody who saw one card would know the shape
-- of every other and could print a working fake. card_token is 32 random
-- hex characters, so it cannot be guessed, and it is the only thing the
-- QR holds.
--
-- THE QR HOLDS THE TOKEN AND NOTHING ELSE. Not a web address. A QR
-- carrying a link would make a lost card into a working door into the
-- system, and would let somebody print a card pointing at a copycat
-- site. A bare token does nothing at all in an ordinary camera app.
--
-- A LOST CARD IS REVOKED, NOT DELETED. lms_card_mark_lost replaces the
-- token and leaves the number alone, so the old card stops working the
-- instant it is pressed and the participant's paperwork does not change.
-- replaced_count records how many times that has happened.
--
-- NO SELECT GRANT, DELIBERATELY. card_token is the secret. Reading this
-- table from a browser would hand it out, so nothing outside a function
-- can read any of it.
create table if not exists lms_participant_cards (
  participant_id  uuid primary key references participants(id) on delete cascade,
  participant_no  text not null,
  card_token      text not null,
  issued_at       timestamptz not null default now(),
  lost_at         timestamptz,
  replaced_count  integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint pc_no_uniq    unique (participant_no),
  constraint pc_token_uniq unique (card_token),
  -- The printed number: DLA, two digit year, five characters, and no
  -- letter that can be misread as a digit. I, O, 0 and 1 are all absent
  -- from the alphabet on purpose.
  constraint pc_no_ck      check (participant_no ~ '^DLA-[0-9]{2}-[2-9A-HJ-NP-Z]{5}$'),
  constraint pc_token_ck   check (card_token ~ '^[0-9a-f]{32}$'),
  constraint pc_repl_ck    check (replaced_count >= 0)
);

alter table lms_participant_cards enable row level security;

drop trigger if exists lms_participant_cards_touch on lms_participant_cards;
create trigger lms_participant_cards_touch before update on lms_participant_cards
for each row execute function lms_touch();

-- REVOKE ALL, NOT JUST THE FOUR. The default privileges on this
-- database grant everything on a new table to anon and authenticated,
-- which is how Supabase is set up, so revoking select, insert, update
-- and delete leaves TRUNCATE behind. ROW LEVEL SECURITY DOES NOT APPLY
-- TO TRUNCATE: a policy cannot stop it and there is no per row test to
-- fail, so a role holding it can empty the table in one statement. It is
-- not reachable through the REST layer, which only ever issues the four,
-- but the rule since file 26 is to take the permission away rather than
-- to trust the layer above it.
revoke all on lms_participant_cards from public, anon, authenticated;

-- -------------------------------------------------------------- step 2
-- The short screen a learner fills in the first time they sign in.
--
-- WHY A NEW TABLE RATHER THAN COLUMNS ON lms_learner_profiles. That
-- table holds the disability answer, so file 26 stripped it right back:
-- a learner cannot read their own row at all and the only way in is one
-- administrator function that writes an audit line every time it is
-- used. That is correct for sensitive personal data and wrong for "do
-- you have a laptop". A facilitator who wants to know who is working on
-- a phone should not be setting off a sensitive data audit entry, and a
-- learner should be able to see and change their own answer without an
-- administrator. So the practical answers live here and that table is
-- not touched.
--
-- THERE IS NO NAME, EMAIL OR PHONE COLUMN, AND THAT IS THE NAME RULE.
-- Only staff may change a participant's name, because it has to match
-- the ID card. The screen shows the name read only, and it is read only
-- because there is nowhere to write it to: no column, no permission and
-- no function. That is stronger than a disabled text box, which a
-- determined person can re-enable in their browser.
--
-- SIX THINGS WERE ALREADY BEING ASKED and are not asked again. Age band,
-- gender, state, education level, occupation and heard_from are all
-- collected by the About you section of the sign-up page, which nobody
-- can get past. Re-asking them is how a form teaches people that it does
-- not know what it already knows.
create table if not exists lms_learner_setup (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  preferred_name   text not null,
  device           text not null,
  internet         text not null,
  topic_experience text not null,
  goal_note        text,
  completed_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint ls_pref_ck     check (length(btrim(preferred_name)) between 1 and 60),
  constraint ls_device_ck   check (device in ('laptop', 'phone')),
  constraint ls_internet_ck check (internet in ('reliable', 'sometimes', 'poor')),
  constraint ls_topic_ck    check (topic_experience in ('none', 'some', 'confident')),
  constraint ls_goal_ck     check (goal_note is null
                                   or length(btrim(goal_note)) between 1 and 300)
);

alter table lms_learner_setup enable row level security;

drop trigger if exists lms_learner_setup_touch on lms_learner_setup;
create trigger lms_learner_setup_touch before update on lms_learner_setup
for each row execute function lms_touch();

-- A learner reads their own row. Staff read every row, because a
-- facilitator setting an exercise needs to know who is on a phone. There
-- is no write policy: step 8 is the only way in.
drop policy if exists p_ls_self_read  on lms_learner_setup;
create policy p_ls_self_read on lms_learner_setup
  for select to authenticated using (user_id = auth.uid());

drop policy if exists p_ls_staff_read on lms_learner_setup;
create policy p_ls_staff_read on lms_learner_setup
  for select to authenticated using (lms_is_staff());

revoke all on lms_learner_setup from public, anon, authenticated;
grant select on lms_learner_setup to authenticated;

-- -------------------------------------------------------------- step 3
-- One row per cohort per class day.
--
-- THE ACCESS CODE IS NEVER STORED AS ITSELF. code_hash is a salted
-- SHA-256 of the code and code_salt is random per day. Fingerprints work
-- one way: a code can be checked against one but cannot be read back out
-- of it. So a database dump shows a hash, not PURPLE42, and the real code
-- exists only on the facilitator's screen for as long as the window
-- lasts.
--
-- WHAT THE HASH DOES NOT PROTECT AGAINST, stated plainly rather than
-- left to be discovered: a participant in the room who photographs the
-- revealed code and sends it to somebody else within the window. That
-- friend's own account can use it once. The window, the single use per
-- account and the live reveal make that narrow, not impossible, and
-- lms_attendance_reveal_code can be called again to kill the old code.
--
-- NO SELECT GRANT, DELIBERATELY, because of code_hash. Learners read
-- what they need through lms_attendance_my_day, which does not select
-- it.
create table if not exists lms_attendance_days (
  id              uuid primary key default gen_random_uuid(),
  cohort          text not null,
  meets_on        date not null,
  mode            text not null,
  title           text,
  code_hash       text,
  code_salt       text,
  code_opens_at   timestamptz,
  code_closes_at  timestamptz,
  form_closes_at  timestamptz not null,
  opened_by       uuid references auth.users(id),
  closed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ad_one_per_day unique (cohort, meets_on),
  constraint ad_cohort_ck check (length(btrim(cohort)) between 1 and 80),
  constraint ad_mode_ck   check (mode in ('in_person', 'virtual', 'both')),
  constraint ad_title_ck  check (title is null or length(btrim(title)) between 1 and 120),
  -- A code exists completely or not at all. Half a code, with a hash and
  -- no window, would be a code that never expires.
  constraint ad_code_ck check (
    (code_hash is null and code_salt is null
       and code_opens_at is null and code_closes_at is null)
    or (code_hash is not null and code_salt is not null
       and code_opens_at is not null and code_closes_at is not null
       and code_closes_at > code_opens_at)
  )
);

alter table lms_attendance_days enable row level security;

drop trigger if exists lms_attendance_days_touch on lms_attendance_days;
create trigger lms_attendance_days_touch before update on lms_attendance_days
for each row execute function lms_touch();

create index if not exists ad_cohort_date_idx
  on lms_attendance_days (cohort, meets_on desc);

revoke all on lms_attendance_days from public, anon, authenticated;

-- -------------------------------------------------------------- step 4
-- One check-in per participant per day, whichever way they arrived.
--
-- ad_one_per_day ON THE TABLE IS THE WHOLE ANTI-DOUBLE MECHANISM. Not
-- the page, not the function: the database refuses a second row for the
-- same person on the same day. Everything else about duplicates, the
-- offline queue included, leans on this one constraint.
--
-- client_ref IS THE PHONE'S OWN RECEIPT NUMBER, and it is what makes the
-- offline queue safe. A scanner with no signal keeps its scans and sends
-- them when the signal returns. If it is not sure whether a scan got
-- through it sends it again, and the partial unique index below
-- recognises the receipt and writes nothing rather than a duplicate. The
-- index is partial because a code check-in has no receipt number, and
-- null is not equal to null, so without the WHERE clause every code
-- check-in would collide with every other.
create table if not exists lms_attendance_checkins (
  id             uuid primary key default gen_random_uuid(),
  day_id         uuid not null references lms_attendance_days(id) on delete restrict,
  user_id        uuid not null references auth.users(id) on delete cascade,
  method         text not null,
  scanned_by     uuid references auth.users(id),
  client_ref     text,
  checked_in_at  timestamptz not null default now(),
  corrected_by   uuid references auth.users(id),
  corrected_at   timestamptz,
  correction_note text,
  created_at     timestamptz not null default now(),
  constraint ac_one_per_day unique (day_id, user_id),
  constraint ac_method_ck check (method in ('scan', 'code', 'staff')),
  -- A scan names the member of staff who did it. A code check-in cannot,
  -- because there was no member of staff involved.
  constraint ac_scanner_ck check (
    (method = 'code' and scanned_by is null)
    or (method in ('scan', 'staff') and scanned_by is not null)
  ),
  constraint ac_ref_ck check (client_ref is null
                              or client_ref ~ '^[0-9a-zA-Z_-]{8,64}$'),
  constraint ac_corr_ck check (
    (corrected_by is null and corrected_at is null and correction_note is null)
    or (corrected_by is not null and corrected_at is not null)
  )
);

alter table lms_attendance_checkins enable row level security;

create unique index if not exists ac_client_ref_once
  on lms_attendance_checkins (day_id, scanned_by, client_ref)
  where client_ref is not null;

create index if not exists ac_day_idx  on lms_attendance_checkins (day_id);
create index if not exists ac_user_idx on lms_attendance_checkins (user_id);

-- A learner sees their own check-ins. Staff read through the reporting
-- functions in step 12, so there is no staff read policy to keep wide
-- open here. No write policy at all.
drop policy if exists p_ac_self_read on lms_attendance_checkins;
create policy p_ac_self_read on lms_attendance_checkins
  for select to authenticated using (user_id = auth.uid());

revoke all on lms_attendance_checkins from public, anon, authenticated;
grant select on lms_attendance_checkins to authenticated;

-- -------------------------------------------------------------- step 5
-- The day's short form.
--
-- SEPARATE COLUMNS RATHER THAN ONE jsonb BLOB, so the lists are enforced
-- by the database the way lms_learner_profiles enforces its own. A blob
-- would accept any answer at all and leave the checking to the page,
-- which is the thing this file is trying not to do.
create table if not exists lms_attendance_responses (
  id              uuid primary key default gen_random_uuid(),
  day_id          uuid not null references lms_attendance_days(id) on delete restrict,
  user_id         uuid not null references auth.users(id) on delete cascade,
  followed        text not null,
  confidence      integer not null,
  unclear         text,
  repeat_request  text,
  submitted_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ar_one_per_day unique (day_id, user_id),
  constraint ar_followed_ck check (followed in ('little', 'some', 'most', 'all')),
  constraint ar_conf_ck     check (confidence between 1 and 5),
  constraint ar_unclear_ck  check (unclear is null
                                   or length(btrim(unclear)) between 1 and 500),
  constraint ar_repeat_ck   check (repeat_request is null
                                   or length(btrim(repeat_request)) between 1 and 500)
);

alter table lms_attendance_responses enable row level security;

drop trigger if exists lms_attendance_responses_touch on lms_attendance_responses;
create trigger lms_attendance_responses_touch before update on lms_attendance_responses
for each row execute function lms_touch();

create index if not exists ar_day_idx on lms_attendance_responses (day_id);

drop policy if exists p_ar_self_read on lms_attendance_responses;
create policy p_ar_self_read on lms_attendance_responses
  for select to authenticated using (user_id = auth.uid());

revoke all on lms_attendance_responses from public, anon, authenticated;
grant select on lms_attendance_responses to authenticated;

-- -------------------------------------------------------------- step 6
-- Two small helpers, used by everything below.

-- The date in Lagos, which is the only date this file ever means.
create or replace function lms_wat_today()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Africa/Lagos')::date;
$$;

revoke execute on function lms_wat_today() from public, anon;
grant execute on function lms_wat_today() to authenticated;

-- A random string from an alphabet with no character that can be
-- misread. Built from gen_random_uuid rather than random(): random() is
-- a predictable sequence and an access code made from it could be worked
-- out by somebody who had seen a few. Two hex characters give eight
-- bits, and 256 divides by 32 exactly, so taking the remainder leaves
-- every character of the alphabet equally likely rather than favouring
-- the first eight.
create or replace function lms_unambiguous_code(p_len integer default 8)
returns text language plpgsql volatile set search_path = public as $$
declare
  v_alpha text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_hex   text := replace(gen_random_uuid()::text, '-', '')
                  || replace(gen_random_uuid()::text, '-', '');
  v_len   integer := greatest(4, least(coalesce(p_len, 8), 16));
  v_out   text := '';
  i       integer;
begin
  for i in 1 .. v_len loop
    v_out := v_out || substr(v_alpha,
               1 + (('x' || substr(v_hex, i * 2 - 1, 2))::bit(8)::int % 32), 1);
  end loop;
  return v_out;
end $$;

revoke execute on function lms_unambiguous_code(integer) from public, anon, authenticated;

-- -------------------------------------------------------------- step 7
-- Issuing and replacing ID cards. Administrators only.

-- Gives a participant a number and a token if they have none, and
-- returns the number. Safe to call twice: a participant who already has
-- a card keeps it.
create or replace function lms_issue_participant_card(p_participant uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_no text; v_try integer := 0; v_year text;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can issue an ID card.' using errcode = '42501';
  end if;
  if not exists (select 1 from participants p where p.id = p_participant) then
    raise exception 'No such participant.' using errcode = 'P0002';
  end if;

  select c.participant_no into v_no
    from lms_participant_cards c where c.participant_id = p_participant;
  if v_no is not null then
    return v_no;
  end if;

  v_year := to_char(lms_wat_today(), 'YY');

  -- Retried rather than trusted first time: the number is random and
  -- short enough that a clash is possible, and the unique constraint is
  -- what decides, not a prior check.
  loop
    v_try := v_try + 1;
    begin
      insert into lms_participant_cards (participant_id, participant_no, card_token)
      values (p_participant,
              'DLA-' || v_year || '-' || lms_unambiguous_code(5),
              replace(gen_random_uuid()::text, '-', ''))
      returning participant_no into v_no;
      exit;
    exception when unique_violation then
      if v_try >= 20 then
        raise exception 'Could not find a free card number after 20 tries.';
      end if;
    end;
  end loop;

  perform lms_log_action('card_issued', 'participant', p_participant,
                         jsonb_build_object('participant_no', v_no));
  return v_no;
end $$;

revoke execute on function lms_issue_participant_card(uuid) from public, anon;
grant execute on function lms_issue_participant_card(uuid) to authenticated;

-- Marks a card lost: the token is replaced, the number is kept.
create or replace function lms_card_mark_lost(p_participant uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_no text;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can replace an ID card.' using errcode = '42501';
  end if;

  update lms_participant_cards
     set card_token     = replace(gen_random_uuid()::text, '-', ''),
         lost_at        = now(),
         replaced_count = replaced_count + 1
   where participant_id = p_participant
  returning participant_no into v_no;

  if v_no is null then
    raise exception 'That participant has no card to replace.' using errcode = 'P0002';
  end if;

  perform lms_log_action('card_replaced', 'participant', p_participant,
                         jsonb_build_object('participant_no', v_no));
  return v_no;
end $$;

revoke execute on function lms_card_mark_lost(uuid) from public, anon;
grant execute on function lms_card_mark_lost(uuid) to authenticated;

-- The printable sheet for a cohort. This is the ONE place a token
-- leaves the database, because the QR has to be drawn from it, and it is
-- administrators only.
create or replace function lms_participant_cards_for_print(p_cohort text)
returns table (participant_id uuid, full_name text, participant_no text,
               card_token text, cohort text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can print ID cards.' using errcode = '42501';
  end if;

  return query
  select p.id, p.full_name, c.participant_no, c.card_token, e.cohort
    from participants p
    join participant_enrolments e on e.participant_id = p.id
    join lms_participant_cards c  on c.participant_id = p.id
   where e.cohort = p_cohort
     and e.status = 'active'
   order by p.full_name;
end $$;

revoke execute on function lms_participant_cards_for_print(text) from public, anon;
grant execute on function lms_participant_cards_for_print(text) to authenticated;

-- -------------------------------------------------------------- step 8
-- The first-sign-in screen.

-- What the screen needs: this learner's own answers if they have them,
-- and the six things they already told us, read only, so the screen can
-- show them back rather than ask again.
create or replace function lms_my_setup()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_out jsonb;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'done', (select true from lms_learner_setup s where s.user_id = v_uid),
    'full_name', (select pr.full_name from lms_profiles pr where pr.id = v_uid),
    'mine', (select to_jsonb(x) from (
               select s.preferred_name, s.device, s.internet,
                      s.topic_experience, s.goal_note, s.completed_at
                 from lms_learner_setup s where s.user_id = v_uid) x),
    -- Shown back, never asked again. Read here rather than from the
    -- browser because lms_learner_profiles is not readable from one.
    'already_told_us', (select to_jsonb(y) from (
               select lp.age_band, lp.gender, lp.state, lp.country,
                      lp.education_level, lp.occupation, lp.heard_from
                 from lms_learner_profiles lp where lp.user_id = v_uid) y)
  ) into v_out;

  return coalesce(v_out, '{}'::jsonb);
end $$;

revoke execute on function lms_my_setup() from public, anon;
grant execute on function lms_my_setup() to authenticated;

-- Saving it. The only way into lms_learner_setup.
--
-- THERE IS NO NAME PARAMETER, and that is deliberate rather than an
-- omission. Only staff change a name.
create or replace function lms_save_my_setup(
  p_preferred_name   text,
  p_device           text,
  p_internet         text,
  p_topic_experience text,
  p_goal_note        text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_goal text;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  v_goal := nullif(btrim(coalesce(p_goal_note, '')), '');

  insert into lms_learner_setup (user_id, preferred_name, device, internet,
                                 topic_experience, goal_note)
  values (v_uid, btrim(p_preferred_name), p_device, p_internet,
          p_topic_experience, v_goal)
  on conflict (user_id) do update
     set preferred_name   = excluded.preferred_name,
         device           = excluded.device,
         internet         = excluded.internet,
         topic_experience = excluded.topic_experience,
         goal_note        = excluded.goal_note;

  return lms_my_setup();
end $$;

revoke execute on function lms_save_my_setup(text, text, text, text, text)
  from public, anon;
grant execute on function lms_save_my_setup(text, text, text, text, text)
  to authenticated;

-- -------------------------------------------------------------- step 9
-- Opening a day, and revealing its code. Staff only.

-- Opens today for a cohort, or returns the day already open. The form
-- closing time is given in hours from now, so a facilitator never types
-- a timestamp.
create or replace function lms_attendance_open_day(
  p_cohort      text,
  p_mode        text,
  p_title       text default null,
  p_form_hours  integer default 12
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_today date := lms_wat_today(); v_hours integer;
begin
  if not lms_is_staff() then
    raise exception 'Only staff can open an attendance day.' using errcode = '42501';
  end if;
  if p_mode not in ('in_person', 'virtual', 'both') then
    raise exception 'Mode must be in_person, virtual or both.' using errcode = '22023';
  end if;
  -- A cohort nobody is enrolled in is almost always a typing mistake,
  -- and an attendance day against one would silently record nobody.
  if not exists (select 1 from participant_enrolments e
                  where e.cohort = p_cohort and e.status = 'active') then
    raise exception 'No active enrolment carries the cohort %.', p_cohort
      using errcode = 'P0002';
  end if;

  v_hours := greatest(1, least(coalesce(p_form_hours, 12), 72));

  insert into lms_attendance_days (cohort, meets_on, mode, title,
                                   form_closes_at, opened_by)
  values (btrim(p_cohort), v_today, p_mode,
          nullif(btrim(coalesce(p_title, '')), ''),
          now() + make_interval(hours => v_hours), auth.uid())
  on conflict (cohort, meets_on) do update
     set mode     = excluded.mode,
         title    = coalesce(excluded.title, lms_attendance_days.title),
         closed_at = null
  returning id into v_id;

  perform lms_log_action('attendance_day_opened', 'cohort', null,
                         jsonb_build_object('cohort', p_cohort,
                                            'meets_on', v_today, 'mode', p_mode));
  return lms_attendance_day(v_id);
end $$;

-- Reveals a fresh code and returns it ONCE. Calling it again makes a new
-- code and kills the old one, which is how a leaked code is dealt with
-- mid class.
create or replace function lms_attendance_reveal_code(
  p_day uuid,
  p_window_minutes integer default 20
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_code text; v_salt text; v_mins integer; v_ok boolean;
begin
  if not lms_is_staff() then
    raise exception 'Only staff can reveal the access code.' using errcode = '42501';
  end if;

  select true into v_ok from lms_attendance_days d
   where d.id = p_day and d.closed_at is null;
  if v_ok is null then
    raise exception 'That day is not open.' using errcode = 'P0002';
  end if;

  v_mins := greatest(1, least(coalesce(p_window_minutes, 20), 180));
  v_code := lms_unambiguous_code(8);
  v_salt := replace(gen_random_uuid()::text, '-', '');

  update lms_attendance_days
     set code_hash      = encode(sha256((v_salt || v_code)::bytea), 'hex'),
         code_salt      = v_salt,
         code_opens_at  = now(),
         code_closes_at = now() + make_interval(mins => v_mins)
   where id = p_day;

  perform lms_log_action('attendance_code_revealed', 'attendance_day', p_day,
                         jsonb_build_object('window_minutes', v_mins));

  -- The plain code is returned here and stored nowhere.
  return jsonb_build_object('code', v_code,
                            'closes_at', (select d.code_closes_at
                                            from lms_attendance_days d where d.id = p_day),
                            'window_minutes', v_mins);
end $$;

-- Closes a day. The rows stay.
create or replace function lms_attendance_close_day(p_day uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_staff() then
    raise exception 'Only staff can close an attendance day.' using errcode = '42501';
  end if;

  update lms_attendance_days
     set closed_at      = now(),
         code_hash      = null,
         code_salt      = null,
         code_opens_at  = null,
         code_closes_at = null
   where id = p_day;

  perform lms_log_action('attendance_day_closed', 'attendance_day', p_day, '{}'::jsonb);
  return lms_attendance_day(p_day);
end $$;

-- One day, as staff see it. Never returns the hash or the salt.
create or replace function lms_attendance_day(p_day uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not lms_is_staff() then
    raise exception 'Only staff can open an attendance day.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', d.id, 'cohort', d.cohort, 'meets_on', d.meets_on,
    'mode', d.mode, 'title', d.title,
    'form_closes_at', d.form_closes_at,
    'closed_at', d.closed_at,
    -- Whether a code is live, not what it is.
    'code_live', (d.code_hash is not null and now() < d.code_closes_at),
    'code_closes_at', d.code_closes_at,
    'checked_in', (select count(*) from lms_attendance_checkins c where c.day_id = d.id),
    'expected', (select count(*) from participant_enrolments e
                  where e.cohort = d.cohort and e.status = 'active')
  ) into v_out
    from lms_attendance_days d where d.id = p_day;

  if v_out is null then
    raise exception 'No such attendance day.' using errcode = 'P0002';
  end if;
  return v_out;
end $$;

revoke execute on function lms_attendance_open_day(text, text, text, integer)
  from public, anon;
grant execute on function lms_attendance_open_day(text, text, text, integer)
  to authenticated;
revoke execute on function lms_attendance_reveal_code(uuid, integer) from public, anon;
grant execute on function lms_attendance_reveal_code(uuid, integer) to authenticated;
revoke execute on function lms_attendance_close_day(uuid) from public, anon;
grant execute on function lms_attendance_close_day(uuid) to authenticated;
revoke execute on function lms_attendance_day(uuid) from public, anon;
grant execute on function lms_attendance_day(uuid) to authenticated;

-- ------------------------------------------------------------- step 10
-- The two ways in.

-- THE SCAN DOOR. Staff only, which is what stops a participant scanning
-- a borrowed card: a learner account is refused here outright, so there
-- is no account on the site that can scan anything at all except a
-- facilitator or an administrator.
--
-- IT TAKES THE DAY, rather than working it out from the token. A
-- participant can sit in more than one cohort, and guessing which class
-- they are standing in would be a guess. The facilitator opened a day
-- and the scanner is scanning for that day.
--
-- THE NAME IT RETURNS IS THE RECEIPT FOR A WRITE, not a lookup. There is
-- no function in this file that answers "who is this card" on its own,
-- so the scanner cannot be used to find people: the only way to learn a
-- name from a card is to mark that person present in a class that is
-- running now, as staff, on the record.
create or replace function lms_attendance_scan(
  p_day        uuid,
  p_token      text,
  p_client_ref text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_part uuid; v_name text; v_cohort text; v_uid uuid;
  v_d lms_attendance_days%rowtype; v_already boolean := false;
begin
  if not lms_is_staff() then
    raise exception 'Only staff can scan an ID card.' using errcode = '42501';
  end if;

  select * into v_d from lms_attendance_days d where d.id = p_day;
  if v_d.id is null then
    raise exception 'No such attendance day.' using errcode = 'P0002';
  end if;
  if v_d.closed_at is not null then
    raise exception 'That day is closed.' using errcode = 'P0002';
  end if;

  select c.participant_id into v_part
    from lms_participant_cards c where c.card_token = btrim(p_token);
  if v_part is null then
    raise exception 'That card is not recognised.' using errcode = 'P0002';
  end if;

  select p.full_name into v_name from participants p where p.id = v_part;

  -- Enrolled in THIS day's cohort, so a card from another cohort is
  -- refused rather than quietly recorded against the wrong class.
  select e.cohort into v_cohort
    from participant_enrolments e
   where e.participant_id = v_part
     and e.status = 'active'
     and e.cohort = v_d.cohort
   limit 1;
  if v_cohort is null then
    raise exception '% is not enrolled in this cohort.', coalesce(v_name, 'That participant')
      using errcode = 'P0002';
  end if;

  -- The card belongs to a participant. Attendance belongs to an account.
  select pr.id into v_uid from lms_profiles pr where pr.participant_id = v_part;
  if v_uid is null then
    raise exception '% has not linked an Academy account yet.', coalesce(v_name, 'That participant')
      using errcode = 'P0002';
  end if;

  -- CAUGHT RATHER THAN "on conflict", BECAUSE THERE ARE TWO INDEXES THAT
  -- CAN REFUSE THIS ROW and an on conflict clause can only name one of
  -- them. ac_one_per_day catches the same person twice. ac_client_ref_once
  -- catches the same scan sent twice by a phone that came back online and
  -- was not sure the first attempt landed. Naming only the first would
  -- turn the second into an unhandled error, which is exactly the case
  -- the offline queue is built to survive. Either way the answer is the
  -- same: that person is already marked present, and nothing is written.
  begin
    insert into lms_attendance_checkins (day_id, user_id, method, scanned_by, client_ref)
    values (p_day, v_uid, 'scan', auth.uid(),
            nullif(btrim(coalesce(p_client_ref, '')), ''));
  exception when unique_violation then
    v_already := true;
  end;

  return jsonb_build_object(
    'ok', true,
    'already_in', v_already,
    'full_name', v_name,
    'cohort', v_cohort,
    -- limit 1 on both, though ac_one_per_day already guarantees it. A
    -- scalar subquery that would raise if the constraint were ever
    -- dropped is a function whose correctness lives in another object,
    -- and the error it gives ("more than one row returned by a
    -- subquery") names nothing a reader could act on.
    'checked_in_at', (select c.checked_in_at from lms_attendance_checkins c
                       where c.day_id = p_day and c.user_id = v_uid limit 1),
    'method', (select c.method from lms_attendance_checkins c
                where c.day_id = p_day and c.user_id = v_uid limit 1));
end $$;

revoke execute on function lms_attendance_scan(uuid, text, text) from public, anon;
grant execute on function lms_attendance_scan(uuid, text, text) to authenticated;

-- THE CODE DOOR. The learner knocks on this one.
--
-- The search is limited to days whose cohort this learner is actually
-- enrolled in, so a code overheard from another cohort does not work
-- here even while it is live over there.
create or replace function lms_attendance_use_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_part uuid; v_day uuid; v_code text;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  select pr.participant_id into v_part from lms_profiles pr where pr.id = v_uid;
  if v_part is null then
    raise exception 'This account is not linked to a bootcamp enrolment.'
      using errcode = 'P0002';
  end if;

  v_code := upper(btrim(coalesce(p_code, '')));
  if v_code = '' then
    raise exception 'Type the code the facilitator showed you.' using errcode = '22023';
  end if;

  select d.id into v_day
    from lms_attendance_days d
    join participant_enrolments e
      on e.cohort = d.cohort and e.status = 'active' and e.participant_id = v_part
   where d.closed_at is null
     and d.code_hash is not null
     and now() >= d.code_opens_at
     and now() <  d.code_closes_at
     and d.code_hash = encode(sha256((d.code_salt || v_code)::bytea), 'hex')
   limit 1;

  if v_day is null then
    -- One message for a wrong code, an expired code and a code from
    -- somebody else's cohort, so nothing can be learned by trying.
    raise exception 'That code is not working. Check it with the facilitator.'
      using errcode = 'P0002';
  end if;

  insert into lms_attendance_checkins (day_id, user_id, method)
  values (v_day, v_uid, 'code')
  on conflict (day_id, user_id) do nothing;

  return lms_attendance_my_day();
end $$;

revoke execute on function lms_attendance_use_code(text) from public, anon;
grant execute on function lms_attendance_use_code(text) to authenticated;

-- ------------------------------------------------------------- step 11
-- The learner's own view, and the form.

-- Today, for this learner. Never selects the hash or the salt, so there
-- is nothing here that could leak the code.
create or replace function lms_attendance_my_day()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_part uuid; v_out jsonb;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  select pr.participant_id into v_part from lms_profiles pr where pr.id = v_uid;
  if v_part is null then
    return jsonb_build_object('bootcamp', false);
  end if;

  select jsonb_build_object(
    'bootcamp', true,
    'day_id', d.id,
    'cohort', d.cohort,
    'meets_on', d.meets_on,
    'mode', d.mode,
    'title', d.title,
    'code_live', (d.code_hash is not null and now() < d.code_closes_at),
    'checked_in', (c.id is not null),
    'checked_in_at', c.checked_in_at,
    'method', c.method,
    'form_open', (c.id is not null and now() < d.form_closes_at),
    'form_closes_at', d.form_closes_at,
    'answered', (r.id is not null),
    'mine', case when r.id is null then null else jsonb_build_object(
              'followed', r.followed, 'confidence', r.confidence,
              'unclear', r.unclear, 'repeat_request', r.repeat_request,
              'submitted_at', r.submitted_at) end
  ) into v_out
    from lms_attendance_days d
    join participant_enrolments e
      on e.cohort = d.cohort and e.status = 'active' and e.participant_id = v_part
    left join lms_attendance_checkins c  on c.day_id = d.id and c.user_id = v_uid
    left join lms_attendance_responses r on r.day_id = d.id and r.user_id = v_uid
   where d.meets_on = lms_wat_today()
     and d.closed_at is null
   limit 1;

  return coalesce(v_out, jsonb_build_object('bootcamp', true, 'day_id', null));
end $$;

revoke execute on function lms_attendance_my_day() from public, anon;
grant execute on function lms_attendance_my_day() to authenticated;

-- THE FORM DOOR. Refuses anybody who never checked in, which is what
-- makes the locked form real rather than a greyed out button.
create or replace function lms_attendance_submit(
  p_followed       text,
  p_confidence     integer,
  p_unclear        text default null,
  p_repeat_request text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_part uuid; v_day uuid; v_closes timestamptz;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  select pr.participant_id into v_part from lms_profiles pr where pr.id = v_uid;
  if v_part is null then
    raise exception 'This account is not linked to a bootcamp enrolment.'
      using errcode = 'P0002';
  end if;

  -- The day AND the check-in, in one go: no check-in, no day, no form.
  select d.id, d.form_closes_at into v_day, v_closes
    from lms_attendance_days d
    join participant_enrolments e
      on e.cohort = d.cohort and e.status = 'active' and e.participant_id = v_part
    join lms_attendance_checkins c on c.day_id = d.id and c.user_id = v_uid
   where d.meets_on = lms_wat_today()
     and d.closed_at is null
   limit 1;

  if v_day is null then
    raise exception 'You have not been marked present today, so the form is locked.'
      using errcode = '42501';
  end if;
  if now() >= v_closes then
    raise exception 'The form for today has closed.' using errcode = '42501';
  end if;

  insert into lms_attendance_responses (day_id, user_id, followed, confidence,
                                        unclear, repeat_request)
  values (v_day, v_uid, p_followed, p_confidence,
          nullif(btrim(coalesce(p_unclear, '')), ''),
          nullif(btrim(coalesce(p_repeat_request, '')), ''))
  on conflict (day_id, user_id) do update
     set followed       = excluded.followed,
         confidence     = excluded.confidence,
         unclear        = excluded.unclear,
         repeat_request = excluded.repeat_request;

  return lms_attendance_my_day();
end $$;

revoke execute on function lms_attendance_submit(text, integer, text, text)
  from public, anon;
grant execute on function lms_attendance_submit(text, integer, text, text)
  to authenticated;

-- ------------------------------------------------------------- step 12
-- What staff see.

-- Who has arrived, for the panel that updates during class.
create or replace function lms_attendance_live(p_day uuid)
returns table (user_id uuid, full_name text, method text,
               checked_in_at timestamptz, answered boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_staff() then
    raise exception 'Only staff can see who has checked in.' using errcode = '42501';
  end if;

  return query
  select c.user_id,
         coalesce(pa.full_name, pr.full_name),
         c.method,
         c.checked_in_at,
         exists (select 1 from lms_attendance_responses r
                  where r.day_id = c.day_id and r.user_id = c.user_id)
    from lms_attendance_checkins c
    left join lms_profiles pr on pr.id = c.user_id
    left join participants pa on pa.id = pr.participant_id
   where c.day_id = p_day
   order by c.checked_in_at desc;
end $$;

revoke execute on function lms_attendance_live(uuid) from public, anon;
grant execute on function lms_attendance_live(uuid) to authenticated;

-- The cohort's register, which is what the grid and the export read.
-- One row per person per day they were present.
create or replace function lms_attendance_register(
  p_cohort text,
  p_from   date default null,
  p_to     date default null
)
returns table (meets_on date, full_name text, participant_no text,
               method text, checked_in_at timestamptz,
               followed text, confidence integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_staff() then
    raise exception 'Only staff can see the attendance register.' using errcode = '42501';
  end if;

  return query
  select d.meets_on,
         coalesce(pa.full_name, pr.full_name),
         pc.participant_no,
         c.method,
         c.checked_in_at,
         r.followed,
         r.confidence
    from lms_attendance_days d
    join lms_attendance_checkins c on c.day_id = d.id
    left join lms_profiles pr on pr.id = c.user_id
    left join participants pa  on pa.id = pr.participant_id
    left join lms_participant_cards pc on pc.participant_id = pr.participant_id
    left join lms_attendance_responses r
      on r.day_id = d.id and r.user_id = c.user_id
   where d.cohort = p_cohort
     and (p_from is null or d.meets_on >= p_from)
     and (p_to   is null or d.meets_on <= p_to)
   order by d.meets_on desc, 2;
end $$;

revoke execute on function lms_attendance_register(text, date, date) from public, anon;
grant execute on function lms_attendance_register(text, date, date) to authenticated;

-- The cohorts there are, so no screen has to ask somebody to type one.
create or replace function lms_attendance_cohorts()
returns table (cohort text, people integer, last_day date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not lms_is_staff() then
    raise exception 'Only staff can list the cohorts.' using errcode = '42501';
  end if;

  return query
  select e.cohort,
         count(distinct e.participant_id)::integer,
         (select max(d.meets_on) from lms_attendance_days d where d.cohort = e.cohort)
    from participant_enrolments e
   where e.status = 'active'
   group by e.cohort
   order by e.cohort;
end $$;

revoke execute on function lms_attendance_cohorts() from public, anon;
grant execute on function lms_attendance_cohorts() to authenticated;

-- A staff correction. Not a delete: the row keeps its history and gains
-- a note of who changed it and why.
create or replace function lms_attendance_correct(
  p_day  uuid,
  p_user uuid,
  p_note text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can correct an attendance record.'
      using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'Say why the record is being corrected.' using errcode = '22023';
  end if;

  insert into lms_attendance_checkins (day_id, user_id, method, scanned_by,
                                       corrected_by, corrected_at, correction_note)
  values (p_day, p_user, 'staff', auth.uid(), auth.uid(), now(), btrim(p_note))
  on conflict (day_id, user_id) do update
     set corrected_by    = auth.uid(),
         corrected_at    = now(),
         correction_note = btrim(p_note)
  returning id into v_id;

  perform lms_log_action('attendance_corrected', 'attendance_day', p_day,
                         jsonb_build_object('user_id', p_user, 'note', btrim(p_note)));
  return jsonb_build_object('ok', true, 'checkin_id', v_id);
end $$;

revoke execute on function lms_attendance_correct(uuid, uuid, text) from public, anon;
grant execute on function lms_attendance_correct(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------- step 13
-- The same hole, in the badge table from file 24.
--
-- NOT SCOPE CREEP, AND NOT SILENT. Writing the tables above turned up
-- the fact that the default privileges on this database grant everything
-- on a new table to the browser roles, so every file that has ever made
-- one has left TRUNCATE behind. lms_module_badges, made in file 24, is
-- the one table outside this file that still does, and a badge is
-- exactly the kind of record that is meant to be impossible to take
-- away. One line, removing a permission that nothing has ever used.
--
-- Every other lms_ table was already covered, most of them by file 26.
revoke all on lms_module_badges from public, anon, authenticated;
grant select on lms_module_badges to authenticated;

-- ------------------------------------------------------------- step 14
-- What changed.
do $$
declare v_t integer; v_f integer;
begin
  select count(*) into v_t from information_schema.tables
   where table_schema = 'public'
     and table_name in ('lms_participant_cards', 'lms_learner_setup',
                        'lms_attendance_days', 'lms_attendance_checkins',
                        'lms_attendance_responses');
  select count(*) into v_f from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('lms_wat_today', 'lms_unambiguous_code',
       'lms_issue_participant_card', 'lms_card_mark_lost',
       'lms_participant_cards_for_print', 'lms_my_setup', 'lms_save_my_setup',
       'lms_attendance_open_day', 'lms_attendance_reveal_code',
       'lms_attendance_close_day', 'lms_attendance_day', 'lms_attendance_scan',
       'lms_attendance_use_code', 'lms_attendance_my_day',
       'lms_attendance_submit', 'lms_attendance_live',
       'lms_attendance_register', 'lms_attendance_cohorts',
       'lms_attendance_correct');
  raise notice '--------------------------------------------------------';
  raise notice 'File 28 is in.';
  raise notice '  New tables: % of 5.', v_t;
  raise notice '  New functions: % of 19.', v_f;
  raise notice '  No table in this file is writable from a browser, and';
  raise notice '  the two holding a secret are not readable either.';
  raise notice '  Every day boundary is Nigerian time, not the server clock.';
  raise notice '  The certification tables were not altered.';
  raise notice '  Nobody has an ID card yet. Issue them from the control';
  raise notice '  room, or call lms_issue_participant_card per participant.';
  raise notice '  Run 28_verify_EDITOR.sql next.';
  raise notice '--------------------------------------------------------';
end $$;
