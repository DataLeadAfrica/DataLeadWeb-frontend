-- ====================================================================
-- FILE 19. Proof of address becomes our own, and sign up stops
-- sending codes.
-- ====================================================================
--
-- RUN THIS WHILE "CONFIRM EMAIL" IS STILL ON IN SUPABASE.
--
-- That is not a preference, it is what makes the backfill correct. This
-- file copies `auth.users.email_confirmed_at` into our own column for
-- every account that exists when it runs, and those timestamps only
-- mean anything while Supabase is still making people prove the
-- address. Turn the setting off first and every account created in the
-- gap is backfilled as proven when nobody proved anything.
--
-- The order, which PHASE-6D-RUN-ORDER.md states as well:
--
--   a. Run this file, and 19_verify, with Confirm email still ON.
--   b. Merge the branch.
--   c. Only then turn Confirm email off in Supabase.
--
-- Between a and c the old flow keeps working, because this file changes
-- only WHO COUNTS AS PROVEN, and everybody already confirmed is
-- backfilled.
--
-- --------------------------------------------------------------------
-- WHY ANY OF THIS
--
-- Sign up is dropping its emailed code, so a typed address proves
-- nothing. Eleven places in files 01 to 18 read
-- `auth.users.email_confirmed_at`, and with Confirm email off Supabase
-- sets that at the moment the row is inserted. Every one of those
-- places would therefore treat a typed address as a proven one.
--
-- The worst of them is not the certificate link. It is
-- `lms_sync_my_access`, which gates three things behind that one
-- timestamp: facilitator access by email address, the participant link,
-- and bootcamp access through that link. Unchanged, somebody who signed
-- up with an appointed facilitator's address would be handed the
-- control room on their first sign in.
--
-- So the proof moves off Supabase's column entirely and onto ours,
-- `lms_profiles.email_verified_at`, which nothing sets but the check in
-- this file.
--
-- --------------------------------------------------------------------
-- EVERY USE OF email_confirmed_at, AND WHAT HAPPENS TO IT
--
-- Changed to read email_verified_at:
--   05 lms_handle_new_user          linked the participant at insert
--   05 lms_claim_bootcamp_access    refused an unconfirmed address
--   10 lms_sync_my_access           the gate over all three grants
--   10 lms_add_facilitator          applied the role to a confirmed account
--   17 lms_studio_overview          new learners counted confirmed only
--
-- Left alone, deliberately:
--   16 lms_on_email_confirmed       It moves the About you answers out
--                                   of the token into the profile. With
--                                   Confirm email off, email_confirmed_at
--                                   is set at INSERT and the trigger's
--                                   insert branch fires, so the answers
--                                   still land. It grants nothing, so
--                                   nothing rides on the address being
--                                   proven. Moving it to our column
--                                   would mean the answers sat in the
--                                   token until somebody ran the check,
--                                   which is the opposite of what the
--                                   Nigeria Data Protection Act asks.
--   16 the one-off sweep            History. It ran once, in file 16.
--   12, 16, 17 unconfirmed counts   The 24 hour prune and the two health
--                                   warnings for unconfirmed sign ups.
--                                   With Confirm email off these find
--                                   nothing, for ever. They are LEFT IN
--                                   PLACE on purpose: they cost nothing,
--                                   and if the setting is ever turned
--                                   back on they start working again. An
--                                   always-zero warning is written down
--                                   in the run order so nobody reads it
--                                   as good news.
--
-- Safe to run twice. The backfill in particular is safe to run twice,
-- and step 2 explains at length why that needed care.

begin;

-- -------------------------------------------------------------- step 0
do $$
declare v_missing text[] := '{}';
begin
  if to_regclass('public.lms_profiles') is null then
    v_missing := v_missing || 'lms_profiles (file 01)'::text;
  end if;
  if to_regprocedure('public.lms_sync_my_access()') is null then
    v_missing := v_missing || 'lms_sync_my_access (file 10)'::text;
  end if;
  if to_regprocedure('public.lms_link_participant(uuid, text)') is null then
    v_missing := v_missing || 'lms_link_participant (file 05)'::text;
  end if;
  if to_regclass('public.mail_outbox') is null then
    v_missing := v_missing || 'mail_outbox (the mailer, file 12)'::text;
  end if;
  if to_regprocedure('public.mail_limit_per_hour()') is null then
    v_missing := v_missing || 'mail_limit_per_hour (file 12)'::text;
  end if;
  if to_regprocedure('public.lms_log_action(text, text, uuid, jsonb)') is null then
    v_missing := v_missing || 'lms_log_action (file 17)'::text;
  end if;
  if to_regprocedure('public.lms_set_my_name(text)') is null then
    v_missing := v_missing || 'lms_set_my_name (file 18)'::text;
  end if;
  if array_length(v_missing, 1) is not null then
    raise exception 'File 19 cannot run yet. Missing: %', array_to_string(v_missing, ', ');
  end if;
  raise notice 'Step 0: files 01 to 18 are in place.';
end $$;

-- -------------------------------------------------------------- step 1
-- The column that is now the only proof of an address.
alter table lms_profiles add column if not exists email_verified_at timestamptz;

comment on column lms_profiles.email_verified_at is
  'When this person proved their email address by typing a code we sent. '
  'The ONLY proof: nothing reads auth.users.email_confirmed_at for a grant '
  'any more, because with Supabase Confirm email off that is set the moment '
  'the row is inserted and so proves nothing. Set by lms_confirm_email_check '
  'and by file 19 backfilling accounts that confirmed while the setting was '
  'still on.';

-- -------------------------------------------------------------- step 2
-- The backfill, and the mark that makes it safe to run twice.
--
-- THE TRAP THIS AVOIDS. The obvious backfill is "every account whose
-- email_confirmed_at is not null". Run once, while Confirm email is on,
-- that is exactly right. Run again a week after the setting is turned
-- off, it is a disaster: every account created in that week has
-- email_confirmed_at set by Supabase at insert, so a second run would
-- mark every one of them proven, and hand out facilitator access,
-- bootcamp passes and certificate links to addresses nobody proved.
--
-- The guard is a timestamp written on the FIRST run and never moved. A
-- later run backfills only accounts that already existed then.
create table if not exists lms_email_verify_state (
  id           integer primary key default 1 check (id = 1),
  first_run_at timestamptz not null default now()
);

-- AND THE MARK IS LOCKED, BECAUSE IT IS THE WHOLE GUARD.
--
-- The review found this and proved it: as anon it truncated this table.
-- Supabase sets default privileges that grant everything on a new public
-- table to anon and authenticated, TRUNCATE and DELETE included, so a
-- table created here and left alone is wide open. Creating it was not
-- enough.
--
-- On its own, emptying this table does nothing a visitor can see. What
-- it does is remove the only thing standing between a re-run of this
-- file and a backfill of every account created since. With Confirm
-- email off, Supabase sets email_confirmed_at at insert, so that re-run
-- would mark every typed address proven, impostors included, and hand
-- out facilitator access and certificate links with them. The trap this
-- step exists to avoid would be reopened by anybody who can reach the
-- API.
--
-- RLS with no policy, and the grants taken back. Nothing reads this
-- table from a browser: the step below runs as the file's owner and the
-- verify file reads it through query_to_xml, which also runs as owner.
-- 12_verify rows 11 and 12 both said NO until this went in.
alter table lms_email_verify_state enable row level security;
revoke all on lms_email_verify_state from public, anon, authenticated;

do $$
declare
  v_mark timestamptz;
  v_new  boolean := false;
  v_done integer;
begin
  select first_run_at into v_mark from lms_email_verify_state where id = 1;
  if v_mark is null then
    insert into lms_email_verify_state (id, first_run_at) values (1, now())
      on conflict (id) do nothing;
    select first_run_at into v_mark from lms_email_verify_state where id = 1;
    v_new := true;
  end if;

  update lms_profiles p
     set email_verified_at = u.email_confirmed_at
    from auth.users u
   where u.id = p.id
     and p.email_verified_at is null
     and u.email_confirmed_at is not null
     and u.created_at < v_mark;
  get diagnostics v_done = row_count;

  if v_new then
    raise notice 'Step 2: first run. % account(s) that had confirmed their address are now '
                 'marked proven. Accounts created after % will never be backfilled.',
                 v_done, v_mark;
  else
    raise notice 'Step 2: already run once, at %. % further account(s) backfilled, and any '
                 'account created since that moment stays unproven, which is the point.',
                 v_mark, v_done;
  end if;
end $$;

-- -------------------------------------------------------------- step 3
-- The codes. Our own table, not auth_codes.
--
-- auth_codes belongs to the certification system, and the standing rule
-- is that we do not write to its tables. The shape is copied from
-- request_sign_in_code because that one works and is understood: a
-- bcrypt hash of a six digit code, never the code itself.
create table if not exists lms_email_checks (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  code_hash  text        not null,
  expires_at timestamptz not null,
  tries      integer     not null default 0,
  created_at timestamptz not null default now()
);

alter table lms_email_checks enable row level security;

-- NO POLICY, ON PURPOSE. Nobody reads this table from a browser, ever.
-- The hash is useless to a learner and the try count is something they
-- could otherwise watch. Both functions below are security definer, so
-- they reach it without a policy and nothing else does.
--
-- "public" is named first, as it is everywhere else now. A TABLE is not
-- granted to PUBLIC by default, unlike a function, so naming it changes
-- nothing here today. It is named anyway because the reader of this line
-- should not have to know which of the two rules applies to work out
-- whether the table is shut, and because the next person to add default
-- privileges is not going to check.
revoke all on lms_email_checks from public, anon, authenticated;

create index if not exists lms_email_checks_expiry on lms_email_checks (expires_at);

-- -------------------------------------------------------------- step 4
-- Asking for a code.
create or replace function lms_request_email_check()
returns table (ok boolean, message text)
language plpgsql security definer
set search_path to 'public', 'extensions' as $function$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_code  text;
  v_n     integer;
begin
  if v_uid is null then
    return query select false, 'Please sign in first.'; return;
  end if;

  if (select p.email_verified_at from lms_profiles p where p.id = v_uid) is not null then
    return query select true, 'Your email address is already confirmed.'; return;
  end if;

  select lower(btrim(u.email)) into v_email from auth.users u where u.id = v_uid;
  if coalesce(v_email, '') = '' then
    return query select false, 'There is no email address on this account.'; return;
  end if;

  -- Three an hour, per ACCOUNT rather than per address, because the
  -- caller is signed in and the account is the thing being proven.
  -- created_at, not at. lms_admin_actions uses created_at; it is
  -- sign_in_attempts that uses at, and the two sit side by side in this
  -- function.
  select count(*) into v_n from lms_admin_actions
   where actor_id = v_uid and action = 'email_check_requested'
     and created_at > now() - interval '1 hour';
  if v_n >= 3 then
    return query select false,
      'You have asked for three codes in the last hour. Please wait a little and try again.';
    return;
  end if;

  -- The site wide ceiling, counted the same way send_email_hook counts
  -- it, because this email comes out of the same daily allowance. A
  -- cohort signing in can use most of a day's worth on its own.
  if (select count(*) from sign_in_attempts
       where outcome = 'sent' and at > now() - interval '1 hour') >= mail_limit_per_hour()
     or (select count(*) from sign_in_attempts
          where outcome = 'sent' and at > now() - interval '24 hours') >= mail_limit_per_day()
  then
    return query select false,
      'Too many emails have gone out in the last hour. Please try again shortly.';
    return;
  end if;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  -- One live code per account. Asking again replaces the last one
  -- rather than leaving two that both work.
  insert into lms_email_checks (user_id, code_hash, expires_at, tries, created_at)
       values (v_uid, crypt(v_code, gen_salt('bf')), now() + interval '10 minutes', 0, now())
  on conflict (user_id) do update
     set code_hash = excluded.code_hash,
         expires_at = excluded.expires_at,
         tries = 0,
         created_at = now();

  insert into mail_outbox (to_email, code_plain, purpose)
       values (v_email, v_code, 'academy_verify');

  -- Counted against the site's allowance alongside every other email.
  insert into sign_in_attempts (email_hash, ip, outcome)
       values (encode(digest(v_email, 'sha256'), 'hex'), null, 'sent');

  -- THE CODE IS NOT LOGGED. The row says a code was asked for and
  -- nothing else, so the log can be read by an administrator without
  -- handing them a way into somebody's account.
  perform lms_log_action('email_check_requested', 'learner', v_uid, '{}'::jsonb);

  return query select true,
    'We have sent a six digit code to your email address. It lasts ten minutes.';
end $function$;

-- -------------------------------------------------------------- step 5
-- Typing the code in.
create or replace function lms_confirm_email_check(p_code text)
returns table (ok boolean, message text, role text, bootcamp boolean)
language plpgsql security definer
set search_path to 'public', 'extensions' as $function$
declare
  v_uid  uuid := auth.uid();
  v_code text := btrim(coalesce(p_code, ''));
  v_row  lms_email_checks%rowtype;
  v_sync record;
begin
  if v_uid is null then
    return query select false, 'Please sign in first.', null::text, false; return;
  end if;

  if (select p.email_verified_at from lms_profiles p where p.id = v_uid) is not null then
    return query select true, 'Your email address is already confirmed.', null::text, false;
    return;
  end if;

  select * into v_row from lms_email_checks where user_id = v_uid;
  if not found then
    return query select false,
      'Ask for a code first, then type it here.', null::text, false;
    return;
  end if;

  if v_row.expires_at < now() then
    delete from lms_email_checks where user_id = v_uid;
    return query select false,
      'That code has run out. Ask for a new one and try again.', null::text, false;
    return;
  end if;

  -- FIVE TRIES PER CODE. Counted before the comparison, so a wrong
  -- answer costs a try whatever else happens, and the fifth failure
  -- throws the code away rather than leaving it to be guessed at
  -- leisure.
  if v_row.tries >= 5 then
    delete from lms_email_checks where user_id = v_uid;
    return query select false,
      'That code has been tried too many times. Ask for a new one.', null::text, false;
    return;
  end if;

  update lms_email_checks set tries = tries + 1 where user_id = v_uid;

  if v_row.code_hash <> crypt(v_code, v_row.code_hash) then
    -- THE FIFTH FAILURE ENDS THE CODE HERE, not on the next call. The
    -- check at the top of this function catches a sixth attempt, but
    -- waiting for one leaves a dead code sitting in the table until
    -- somebody happens to try again. There is no reason for that window
    -- to exist.
    if v_row.tries + 1 >= 5 then
      delete from lms_email_checks where user_id = v_uid;
      return query select false,
        'That code has been tried too many times. Ask for a new one.', null::text, false;
      return;
    end if;
    -- The same sentence whether it was wrong or nearly right.
    return query select false,
      'That code was not right. Please check it and try again.', null::text, false;
    return;
  end if;

  -- Proven.
  update lms_profiles set email_verified_at = now(), updated_at = now()
   where id = v_uid;
  delete from lms_email_checks where user_id = v_uid;

  perform lms_log_action('email_check_passed', 'learner', v_uid, '{}'::jsonb);

  -- AND THE SYNC RUNS AT ONCE. Facilitator access, a bootcamp pass and
  -- the certificate link all hang off being proven, so without this the
  -- person would type a correct code and see nothing change until they
  -- signed out and back in.
  select * into v_sync from lms_sync_my_access();

  -- THE SYNC'S MESSAGE ONLY WHEN THE SYNC ACTUALLY CHANGED SOMETHING.
  -- Its no-change sentence is "Nothing has changed since you were last
  -- here", which is true and is a strange thing to say to somebody who
  -- has just confirmed their email address: it reads as though the code
  -- did not work. So the plain confirmation is the answer unless there
  -- is real news, and real news is what `changed` means.
  return query select true,
    case when coalesce(v_sync.changed, false) and btrim(coalesce(v_sync.message, '')) <> ''
         then btrim(v_sync.message)
         else 'Your email address is confirmed.' end,
    v_sync.role,
    coalesce(v_sync.bootcamp, false);
end $function$;

revoke all on function lms_request_email_check() from public, anon;
revoke all on function lms_confirm_email_check(text) from public, anon;
grant execute on function lms_request_email_check() to authenticated;
grant execute on function lms_confirm_email_check(text) to authenticated;

-- -------------------------------------------------------------- step 6
-- Every gate moves onto the new column.

-- A new account proves nothing yet, so it links to nothing. The call is
-- kept rather than deleted so the shape of this function still says
-- that linking is a thing that happens here, under a condition that is
-- now never true at insert.
create or replace function lms_handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into lms_profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  -- WAS: if new.email_confirmed_at is not null then link.
  --
  -- With Confirm email off that is true for every account at insert, so
  -- it would link anybody to a certification record matching the
  -- address they typed. Proof now comes from our own column, which is
  -- null here by definition: the row has only just been made and nobody
  -- has typed a code. Linking happens in lms_sync_my_access, after the
  -- check passes.
  if (select p.email_verified_at from lms_profiles p where p.id = new.id) is not null then
    perform lms_link_participant(new.id, new.email);
  end if;

  perform lms_grant_free_courses(new.id);
  return new;
end $$;

create or replace function lms_claim_bootcamp_access()
returns table (granted boolean, message text)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text; v_part uuid; v_ends date;
begin
  if v_uid is null then
    return query select false, 'Please sign in first.'; return;
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  -- WAS: auth.users.email_confirmed_at. See the header.
  if (select p.email_verified_at from lms_profiles p where p.id = v_uid) is null then
    return query select false, 'Please confirm your email address first.'; return;
  end if;

  perform lms_link_participant(v_uid, v_email);
  select participant_id into v_part from lms_profiles where id = v_uid;
  if v_part is null then
    return query select false, 'We could not find a bootcamp enrolment for this email address.'; return;
  end if;

  select max(e.ends_on) into v_ends
    from participant_enrolments e
   where e.participant_id = v_part and e.status = 'active';

  if not exists (select 1 from participant_enrolments e
                  where e.participant_id = v_part and e.status = 'active') then
    return query select false, 'We could not find an active bootcamp enrolment for this address.';
    return;
  end if;

  insert into lms_entitlements (user_id, course_id, source, expires_at)
  values (v_uid, null, 'roster', case when v_ends is null then null else (v_ends + 1)::timestamptz end)
  on conflict do nothing;

  return query select true, 'Your bootcamp access is open, so every course is free to you.';
end $$;

-- DROPPED FIRST, because the shape changes. "create or replace" cannot
-- change a function's return type, so adding the column below without
-- this fails on any database that already has files 01 to 18, which is
-- every database that matters.
--
-- The new column is `verified`. My learning needs to know whether the
-- address has been proven, in order to offer the check, and this
-- function is already called on every Academy page. Asking a second
-- time would be a second round trip for something the sync already
-- knows, which is the mistake academy.ts records having made once with
-- the role.
drop function if exists lms_sync_my_access();

create or replace function lms_sync_my_access()
returns table (role text, bootcamp boolean, changed boolean, message text, verified boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text; v_confirmed timestamptz;
  v_role lms_role; v_new lms_role;
  v_part uuid; v_enrolled boolean := false; v_ends date; v_open boolean := false;
  v_exp timestamptz; v_had boolean; v_was timestamptz;
  v_changed boolean := false; v_msg text := '';
begin
  if v_uid is null then return; end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  select p.email_verified_at into v_confirmed
    from lms_profiles p where p.id = v_uid;

  select p.role into v_role from lms_profiles p where p.id = v_uid;
  v_role := coalesce(v_role, 'learner'::lms_role);

  -- AN UNPROVEN ADDRESS GRANTS NOTHING, and this one gate covers all
  -- three grants below: facilitator access by email address, the
  -- participant link, and bootcamp access through that link.
  --
  -- It used to read auth.users.email_confirmed_at. With Supabase
  -- Confirm email off, that is set the instant the row is inserted, so
  -- every typed address would have passed here and somebody signing up
  -- with an appointed facilitator's address would have been handed the
  -- control room on their first sign in. The proof is now our own
  -- column, which only lms_confirm_email_check sets.
  if v_confirmed is null then
    return query select v_role::text, false, false,
      'Confirm your email address to unlock your access.', false;
    return;
  end if;

  v_email := lower(btrim(coalesce(v_email, '')));

  -- ---------- facilitator, both directions ----------
  -- An administrator is never demoted by this.
  if v_role <> 'admin' then
    if exists (select 1 from lms_facilitators f where f.email_norm = v_email) then
      v_new := 'facilitator';
    else
      v_new := 'learner';
    end if;
    if v_new <> v_role then
      update lms_profiles set role = v_new where id = v_uid;
      v_changed := true;
      v_msg := case when v_new = 'facilitator'
                    then 'You now have facilitator access.'
                    else 'Your facilitator access has been removed.' end;
      v_role := v_new;
    end if;
  end if;

  -- ---------- bootcamp: grant, renew or revoke ----------
  perform lms_link_participant(v_uid, v_email);
  select p.participant_id into v_part from lms_profiles p where p.id = v_uid;

  if v_part is not null then
    -- count(*) > 0, never a bare true: an aggregate query returns a row
    -- even when nothing matched, so a literal here would hand the whole
    -- catalogue to anybody who merely appears on the participant table.
    select count(*) > 0,
           bool_or(e.ends_on is null),
           max(e.ends_on)
      into v_enrolled, v_open, v_ends
      from participant_enrolments e
     where e.participant_id = v_part and e.status = 'active';
  end if;
  v_enrolled := coalesce(v_enrolled, false);

  -- an enrolment with no end date means access does not expire, even if
  -- another enrolment alongside it does
  if coalesce(v_open, false) then v_ends := null; end if;
  v_exp := case when v_ends is null then null else (v_ends + 1)::timestamptz end;

  select true, e.expires_at into v_had, v_was
    from lms_entitlements e
   where e.user_id = v_uid and e.course_id is null
     and e.source = 'roster' and e.status = 'active'
   limit 1;
  v_had := coalesce(v_had, false);

  if v_enrolled and not v_had then
    insert into lms_entitlements (user_id, course_id, source, expires_at)
    values (v_uid, null, 'roster', v_exp)
    on conflict do nothing;
    v_changed := true;
    v_msg := btrim(v_msg || ' Your bootcamp access is open, so every course is free to you.');

  elsif v_enrolled and v_had then
    -- RENEW. This is the branch version 1 was missing. It covers a new
    -- cohort, an extended cohort, and an enrolment that has become open
    -- ended, and it writes nothing when the date already agrees.
    if v_was is distinct from v_exp then
      update lms_entitlements
         set expires_at = v_exp
       where user_id = v_uid and course_id is null
         and source = 'roster' and status = 'active';
      v_changed := true;
      v_msg := btrim(v_msg || ' Your bootcamp access has been renewed.');
    end if;

  elsif not v_enrolled and v_had then
    update lms_entitlements
       set status = 'revoked', revoked_at = now(),
           revoke_reason = 'no active bootcamp enrolment'
     where user_id = v_uid and course_id is null
       and source = 'roster' and status = 'active';
    v_changed := true;
    v_msg := btrim(v_msg || ' Your bootcamp access has ended.');
  end if;

  -- catch any free course published since this person last signed in
  perform lms_grant_free_courses(v_uid);

  return query select v_role::text, v_enrolled, v_changed,
    coalesce(nullif(v_msg, ''), 'Nothing has changed since you were last here.'),
    true;
end $$;

create or replace function lms_add_facilitator(p_email text, p_name text default '', p_note text default '')
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare v_norm text := lower(btrim(coalesce(p_email,''))); v_uid uuid;
begin
  if not lms_is_admin() then
    return query select false, 'Only the administrator can add a facilitator.'; return;
  end if;
  if v_norm !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return query select false, 'That does not look like an email address.'; return;
  end if;

  insert into lms_facilitators (email_norm, full_name, note, added_by)
  values (v_norm, coalesce(p_name,''), coalesce(p_note,''), auth.uid())
  on conflict (email_norm) do update
    set full_name = excluded.full_name, note = excluded.note;

  -- If they already have an account AND have proved the address, apply
  -- it now rather than leaving them to sign out and back in.
  --
  -- WAS auth.users.email_confirmed_at, which with Confirm email off is
  -- true of every account. That would have meant appointing a
  -- facilitator by email address handed the role to whoever had typed
  -- that address, proven or not. Somebody who signs up later, or who
  -- has not confirmed yet, picks the role up from lms_sync_my_access
  -- once they pass the check, exactly as before.
  select u.id into v_uid
    from auth.users u
    join lms_profiles p on p.id = u.id
   where lower(btrim(u.email)) = v_norm
     and p.email_verified_at is not null;
  if v_uid is not null then
    update lms_profiles set role = 'facilitator' where id = v_uid and role <> 'admin';
  end if;

  insert into lms_admin_actions (actor_id, action, subject_type, detail)
  values (auth.uid(), 'add_facilitator', 'email', jsonb_build_object('email', v_norm));

  return query select true,
    case when v_uid is null
      then 'Added. They will have facilitator access the first time they sign in.'
      else 'Added. Their access is active now.' end;
end $$;

create or replace function lms_studio_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb; v_admin boolean := lms_is_admin();
begin
  if not lms_is_staff() then
    raise exception 'Staff only.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'is_admin', v_admin,
    'name', (select p.full_name from lms_profiles p where p.id = auth.uid()),
    'week', jsonb_build_object(
      -- LEARNERS, not every row in auth.users. As written in file 17 it
      -- counted staff and unconfirmed sign ups too, so on a database
      -- with two administrators and nobody else it said 2 new learners.
      --
      -- THE CONFIRMED TEST IS GONE as of file 19, and that is not a
      -- loosening. With Supabase Confirm email off, email_confirmed_at
      -- is set at insert for everybody, so the test excluded nobody and
      -- only looked like a filter. Counting proven addresses instead
      -- would be a different number from the one this tile means, which
      -- is how many people signed up this week.
      'new_learners', (select count(*)
                         from auth.users u
                         join lms_profiles p on p.id = u.id
                        where u.created_at >= current_date - 7
                          and p.role = 'learner'),
      'active', (select count(distinct w.user_id) from lms_watch_days w where w.day >= current_date - 7),
      'minutes', (select coalesce(round(sum(w.seconds) / 60.0), 0) from lms_watch_days w
                   where w.day >= current_date - 7),
      'certificates', (select count(*) from certificates ct where ct.completed_on >= current_date - 7)
    ),
    'courses', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'slug', c.slug, 'title', c.title,
               'state', lms_course_state(c.id),
               'cover_code', c.cover_code, 'area', c.area, 'tool', c.tool,
               'learners', (select count(*) from lms_entitlements e
                             where e.course_id = c.id and e.status = 'active'),
               'updated_at', c.updated_at) order by c.updated_at desc), '[]'::jsonb)
        from lms_courses c
       where v_admin or c.created_by = auth.uid()
    ),
    -- The needs-you queue, most urgent first. Each item carries the one
    -- button that deals with it, which is why it is a list of objects
    -- and not a count.
    'queue', (
      select coalesce(jsonb_agg(q order by q.ord), '[]'::jsonb) from (
        select 1 as ord, 'review' as kind,
               c.title || ' is ready for review' as heading,
               'Sent by ' || coalesce(pr.full_name, 'a facilitator') || '.' as detail,
               'Review and publish' as button, c.id as subject
          from lms_courses c
          left join lms_profiles pr on pr.id = c.sent_for_review_by
         where c.sent_for_review_at is not null and v_admin
        union all
        select 2, 'blocked',
               c.title || ' cannot be published yet',
               (select count(*)::text from lms_publish_checks(c.id) b where not b.passes)
                 || ' of 9 checks fail.',
               'Open the builder', c.id
          from lms_courses c
         where c.status = 'draft' and c.sent_for_review_at is null
           and (v_admin or c.created_by = auth.uid())
           and exists (select 1 from lms_publish_checks(c.id) b where not b.passes)
      ) q
    )
  ) into v_out;
  return v_out;
end $$;

-- -------------------------------------------------------------- step 7
-- An administrator linking a certification record by hand.
--
-- The automatic link matches on email address and happens only once the
-- address is proven. This is for the case that rule cannot cover: the
-- address on somebody's certificate is not the one they signed up with.
-- It is rare, and when it happens a person should look at it rather
-- than the system guessing, which is what the review asked for.
--
-- Administrators only, never facilitators. A facilitator sees no
-- learner names or email addresses at all, and this is a function for
-- joining a person to their certificates.
create or replace function lms_find_participants(p_query text)
returns table (id uuid, full_name text, email text, linked boolean)
language plpgsql stable security definer set search_path to 'public' as $function$
declare v_q text := btrim(coalesce(p_query, ''));
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can look up a certification record.'
      using errcode = '42501';
  end if;

  -- THREE CHARACTERS AT LEAST. A one letter search returns most of the
  -- certification register, which is a list of real people and their
  -- email addresses, and nobody needs that to find one person.
  if length(v_q) < 3 then
    return;
  end if;

  return query
  select pa.id, pa.full_name, pa.email,
         exists (select 1 from lms_profiles p where p.participant_id = pa.id)
    from participants pa
   where pa.email_norm like '%' || lower(v_q) || '%'
      or lower(pa.full_name) like '%' || lower(v_q) || '%'
   order by pa.full_name
   limit 20;
end $function$;

create or replace function lms_link_certification_record(
  p_user        uuid,
  p_participant uuid,
  p_reason      text
)
returns table (ok boolean, message text)
language plpgsql security definer set search_path to 'public' as $function$
declare v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not lms_is_admin() then
    raise exception 'Only an administrator can link a certification record.'
      using errcode = '42501';
  end if;

  if v_reason = '' then
    return query select false, 'Say why. This is somebody certificates, so the reason is the record.';
    return;
  end if;

  if not exists (select 1 from lms_profiles where id = p_user) then
    return query select false, 'There is no Academy account with that id.'; return;
  end if;
  if not exists (select 1 from participants where id = p_participant) then
    return query select false, 'There is no certification record with that id.'; return;
  end if;

  -- NEVER TAKE ONE THAT IS ALREADY SOMEBODY ELSE'S. The automatic link
  -- refuses this too, and it is the whole reason the unique index on
  -- participant_id exists, but refusing here means an administrator
  -- gets a sentence rather than a constraint violation.
  if exists (select 1 from lms_profiles p
              where p.participant_id = p_participant and p.id <> p_user) then
    return query select false,
      'That certification record is already joined to another account. Unjoin it there first.';
    return;
  end if;

  -- And not over the top of one this account already has, for the same
  -- reason: two decisions, taken one at a time, by somebody who can see
  -- what they are undoing.
  if exists (select 1 from lms_profiles p
              where p.id = p_user and p.participant_id is not null
                and p.participant_id <> p_participant) then
    return query select false,
      'This account is already joined to a different certification record.';
    return;
  end if;

  update lms_profiles
     set participant_id = p_participant, linked_at = now(), updated_at = now()
   where id = p_user;

  -- The reason goes in the log, because "why does this person have
  -- those certificates" is a question that gets asked later.
  perform lms_log_action('certification_linked', 'learner', p_user,
    jsonb_build_object('participant', p_participant, 'reason', v_reason));

  return query select true, 'Joined, and recorded in the activity log.';
end $function$;

revoke all on function lms_find_participants(text) from public, anon;
revoke all on function lms_link_certification_record(uuid, uuid, text) from public, anon;
grant execute on function lms_find_participants(text) to authenticated;
grant execute on function lms_link_certification_record(uuid, uuid, text) to authenticated;

commit;
