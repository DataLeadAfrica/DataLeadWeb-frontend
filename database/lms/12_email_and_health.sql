-- =====================================================================
-- 12  SIGN IN, HEALTH AND ONE SMALL GUARD              (7 October 2026)
--
-- Run this after file 11. Three jobs:
--
-- PART 0  The sign in deadlock. Somebody enrolled on a bootcamp who has
--         not yet been given a certificate cannot sign in to the portal
--         at all, and the page tells them to check their email anyway.
--
-- PART 2  system_health(), a read only check an outside alarm can call.
--
-- PART 5  A question a learner has already been given cannot be hard
--         deleted, by anybody, including you.
--
-- Parts 1, 3 and 4 of this piece of work are not SQL. They are the
-- custom SMTP setup, the Apps Script alarm, and rotating the mailer
-- token. Those are in docs/lms/EMAIL-SETUP.md.
--
-- Safe to run twice. If anything is missing it stops at step 0 and
-- tells you what, before changing a single thing.
-- =====================================================================


-- =====================================================================
-- STEP 0  Check this database is the one this file was written for.
-- =====================================================================
do $$
declare
  v_missing text[] := '{}';
  v_t text; v_c text; v_nm text; v_sig text;
begin
  foreach v_t in array array[
    'auth_codes','mail_outbox','mailer_token','certificates','participants',
    'participant_enrolments','lms_questions','lms_quiz_attempts','lms_profiles']
  loop
    if not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = v_t) then
      v_missing := v_missing || ('table ' || v_t);
    end if;
  end loop;

  foreach v_c in array array[
    'auth_codes.email_norm','auth_codes.code_hash','auth_codes.expires_at',
    'mail_outbox.to_email','mail_outbox.code_plain','mail_outbox.sent','mail_outbox.created_at',
    'mailer_token.token_hash','certificates.revoked','certificates.participant_id',
    'participants.email_norm','participant_enrolments.status',
    'lms_quiz_attempts.served_question_ids','lms_questions.active']
  loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = split_part(v_c, '.', 1)
                      and column_name = split_part(v_c, '.', 2)) then
      v_missing := v_missing || ('column ' || v_c);
    end if;
  end loop;

  -- files 10 and 11 must already be in
  foreach v_nm in array array['lms_tidy_table_privileges','lms_is_admin','lms_storage_report'] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = v_nm) then
      v_missing := v_missing || ('function ' || v_nm || '(), from file 10 or 11');
    end if;
  end loop;

  -- the certification functions this file rewrites must be the shape it
  -- expects, because rewriting the wrong thing here breaks sign in
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'request_certificate_code'
       and pg_get_function_identity_arguments(p.oid) = 'p_email text'
       and pg_get_function_result(p.oid) = 'boolean') then
    v_missing := v_missing ||
      ('function request_certificate_code is not the shape this file expects. Found: ' ||
       coalesce((select '(' || pg_get_function_identity_arguments(p.oid) || ') returns ' ||
                        pg_get_function_result(p.oid)
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'request_certificate_code' limit 1), 'nothing'));
  end if;

  -- mail_fetch_pending is accepted in EITHER shape: the three column one
  -- that is live today, or the four column one this file leaves behind.
  -- Without the second, running this file twice would stop at step 0.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'mail_fetch_pending'
       and pg_get_function_identity_arguments(p.oid) = 'p_token text, p_limit integer'
       and pg_get_function_result(p.oid) in (
             'TABLE(id uuid, to_email text, code_plain text)',
             'TABLE(id uuid, to_email text, code_plain text, purpose text)')) then
    v_missing := v_missing ||
      ('function mail_fetch_pending is not the shape this file expects. Found: ' ||
       coalesce((select '(' || pg_get_function_identity_arguments(p.oid) || ') returns ' ||
                        pg_get_function_result(p.oid)
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'mail_fetch_pending' limit 1), 'nothing'));
  end if;

  -- digest() and crypt() have to be reachable, or the code minting breaks
  if not exists (select 1 from pg_proc p where p.proname = 'digest') then
    v_missing := v_missing || 'the pgcrypto extension (digest and crypt)';
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception E'This database is not ready for file 12. Missing or different:\n  %\n\nRun files 01 to 07, then 10, then 11 first. Nothing has been changed.',
      array_to_string(v_missing, E'\n  ');
  end if;
  raise notice 'Step 0: everything file 12 needs is present.';
end $$;


-- =====================================================================
-- STEP 1  PART 0. The sign in deadlock, and one honest reply for all.
--
-- WHAT THE DEADLOCK IS. request_certificate_code is what both the sign in
-- page and the certificate claim page call when somebody types their email
-- address. It only ever minted a code for a person who ALREADY HELD A
-- CERTIFICATE. Everybody else got nothing, and it returns true either way,
-- so the page cheerfully says "check your email" and no email is ever sent.
--
-- WHO IT AFFECTS. Every bootcamp participant who has not yet been issued a
-- certificate, which is every participant on a course still running.
--
-- THE FIX. Mint a code for somebody who holds a certificate that is not
-- revoked, OR who is on a bootcamp enrolment that is active.
--
-- THE REPLY IS THE SAME FOR EVERYBODY, ON PURPOSE. An earlier draft of
-- this file told a person when they were not enrolled. That is friendlier
-- and it is wrong: once the form says one thing to an enrolled address and
-- another to an unenrolled one, anybody can type an address and learn
-- which it is, one guess at a time. The certificate page makes it worse,
-- because there the answer reveals who has GRADUATED.
--
-- So every outcome except a badly typed address now returns one identical
-- sentence. It is honest without being an oracle: it tells the person what
-- to expect and what to do if nothing comes, and it says nothing about
-- them. The real outcome is written to a server side log that the browser
-- never sees, and the health check reports on it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- The server side log. Nobody but the definer functions can read it.
--
-- It holds a HASH of the address rather than the address, because the only
-- thing it is for is counting, and counting works just as well on a hash.
-- It holds the caller's network address, which is needed to slow down a
-- flood, for no longer than 24 hours.
-- ---------------------------------------------------------------------
create table if not exists sign_in_attempts (
  id         bigserial primary key,
  email_hash text,
  ip         text,
  outcome    text,
  at         timestamptz not null default now()
);
create index if not exists sign_in_attempts_at_idx on sign_in_attempts (at);
create index if not exists sign_in_attempts_email_idx on sign_in_attempts (email_hash, at);
create index if not exists sign_in_attempts_ip_idx on sign_in_attempts (ip, at);
create index if not exists sign_in_attempts_outcome_idx on sign_in_attempts (outcome, at);
alter table sign_in_attempts enable row level security;
-- deliberately no policy: nothing reaches it except the functions below

-- An older draft of this file had no outcome or email_hash column. Running
-- this file over that one must not lose the table.
alter table sign_in_attempts add column if not exists email_hash text;
alter table sign_in_attempts add column if not exists outcome text;


-- ---------------------------------------------------------------------
-- HOW "THE CALLER" IS WORKED OUT, and why it is not the real protection.
--
-- PostgREST hands the function the HTTP headers it received, so the
-- function can read x-forwarded-for. That header is a list, and the list
-- grows from the left: each proxy APPENDS the address it saw. A client is
-- free to send a first entry of its own invention, so
--
--     the FIRST entry is whatever the caller claimed
--     the LAST entry is what the proxy nearest to us actually saw
--
-- An earlier draft of this file read the first entry. That is backwards
-- and it made the limit useless: a different invented header on each
-- request and the limit never bites. It now reads the LAST entry.
--
-- Even so, treat this as a speed bump, not a lock. We do not control the
-- proxy chain in front of Supabase and cannot prove how many hops there
-- are, and the header is absent in the SQL editor. So there are two
-- further limits below that depend on NOTHING the caller can choose:
--
--   per email address   5 attempts in 15 minutes, counted on attempts
--                       rather than on codes, so it fires the same way for
--                       an enrolled and an unenrolled address and
--                       therefore reveals nothing
--   the whole site      a number of codes an hour and a number a day,
--                       both held in the mail_limits table below
--
-- The site wide ceiling is the backstop. It cannot be faked because it
-- counts what the server did, not what anybody said. Its honest cost is
-- that a flood could use it up and real learners would then wait, which is
-- the lesser of two harms: the alternative is spending the day's Gmail
-- allowance, and Google locks sending for 24 hours when that runs out.
-- The health check reports both counters so a flood is visible.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- The ceiling lives in a table, not in this code, because the right
-- number depends on which Google account owns the Apps Script mailer and
-- that can change without the database changing:
--
--   a free gmail.com account    100 recipients a day through Apps Script
--   a paid Workspace account    1,500 a day
--
-- The defaults below are set for the free gmail.com case, 100 a day, with
-- headroom left for the daily alarm email, the odd manual test and a
-- retry, because hitting Google's own limit stops ALL sending for up to
-- 24 hours with no warning. Our ceiling is deliberately lower so that
-- ours fires first, visibly, in the health check.
--
-- TO CHANGE IT, one statement. For a Workspace owned script:
--   update mail_limits set per_hour = 200, per_day = 1200 where id = 1;
-- ---------------------------------------------------------------------
create table if not exists mail_limits (
  id       integer primary key default 1,
  per_hour integer not null,
  per_day  integer not null,
  note     text,
  constraint mail_limits_one_row check (id = 1),
  constraint mail_limits_sane check (per_hour > 0 and per_day >= per_hour)
);
insert into mail_limits (id, per_hour, per_day, note)
  values (1, 25, 80, 'Set for a free gmail.com account, which Google allows 100 a day. Raise to 200 and 1200 if the mailer script is owned by a Workspace account.')
  on conflict (id) do nothing;
alter table mail_limits enable row level security;
-- no policy: only the definer functions below read it

-- Two plain functions rather than one returning a pair. If the row has
-- been deleted they fall back to the safe end, not to no limit at all:
-- "no limit" is the failure mode that empties the day's quota.
create or replace function mail_limit_per_hour()
returns integer
language sql stable security definer set search_path to 'public' as $function$
  select coalesce((select per_hour from mail_limits where id = 1), 25);
$function$;

create or replace function mail_limit_per_day()
returns integer
language sql stable security definer set search_path to 'public' as $function$
  select coalesce((select per_day from mail_limits where id = 1), 80);
$function$;
create or replace function sign_in_caller_ip()
returns text
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_raw text;
  v_parts text[];
begin
  begin
    v_raw := current_setting('request.headers', true)::json->>'x-forwarded-for';
  exception when others then
    return null;                       -- absent or not json. Never fail here.
  end;
  if v_raw is null or btrim(v_raw) = '' then
    return null;
  end if;
  v_parts := string_to_array(v_raw, ',');
  -- the LAST entry, which is the one the nearest proxy added
  return nullif(btrim(v_parts[array_length(v_parts, 1)]), '');
end $function$;


-- ---------------------------------------------------------------------
-- request_sign_in_code: one sentence for everybody.
--
-- Returns jsonb so a field can be added later without changing the
-- signature:  {"ok": bool, "status": text, "message": text}
--
-- status is 'accepted' for EVERY outcome except a badly typed address,
-- which is 'bad_email'. That is deliberate: the browser receives this
-- whole object and anybody can read it, so a status that differed would
-- leak exactly what the identical message is there to hide.
-- ---------------------------------------------------------------------
create or replace function request_sign_in_code(p_email text)
returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  v_email   text := lower(btrim(p_email));
  v_hash    text;
  v_ip      text;
  v_code    text;
  v_n       int;
  v_ok      boolean;
  v_outcome text;
  v_per_hour int;
  v_per_day  int;
  -- The one message. Agreed wording, used for sent, not enrolled and
  -- every kind of rate limit alike.
  c_same constant text :=
    'If you are enrolled, your code arrives within 5 minutes. '
    || 'Nothing yet? Check spam or contact us.';
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    -- Safe to say out loud: it is about what was typed, not about who
    -- they are. No log row, because nothing was looked up.
    return jsonb_build_object('ok', false, 'status', 'bad_email',
      'message', 'That does not look like an email address. Please check it and try again.');
  end if;

  v_hash := encode(digest(v_email, 'sha256'), 'hex');
  v_ip   := sign_in_caller_ip();
  v_per_hour := mail_limit_per_hour();
  v_per_day  := mail_limit_per_day();

  delete from sign_in_attempts where at < now() - interval '24 hours';

  -- 1. per address, counted on ATTEMPTS so it behaves identically for an
  --    enrolled and an unenrolled address.
  select count(*) into v_n from sign_in_attempts
   where email_hash = v_hash and at > now() - interval '15 minutes';
  if v_n >= 5 then
    v_outcome := 'rate_limited_email';

  -- 2. per caller. A speed bump. Absent in the SQL editor, so skipped.
  elsif v_ip is not null
        and (select count(*) from sign_in_attempts
              where ip = v_ip and at > now() - interval '15 minutes') >= 15 then
    v_outcome := 'rate_limited_ip';

  -- 3. the whole site, from mail_limits. This one cannot be faked.
  elsif (select count(*) from sign_in_attempts
          where outcome = 'sent' and at > now() - interval '1 hour') >= v_per_hour
     or (select count(*) from sign_in_attempts
          where outcome = 'sent' and at > now() - interval '24 hours') >= v_per_day then
    v_outcome := 'rate_limited_site';

  else
    select exists (
        select 1 from participants p
         where p.email_norm = v_email
           and ( exists (select 1 from certificates c
                          where c.participant_id = p.id and c.revoked = false)
              or exists (select 1 from participant_enrolments e
                          where e.participant_id = p.id and e.status = 'active') )
    ) into v_ok;

    if v_ok then
      v_code := lpad(floor(random()*1000000)::text, 6, '0');
      insert into auth_codes (email_norm, code_hash, expires_at)
        values (v_email, crypt(v_code, gen_salt('bf')), now() + interval '10 minutes');
      -- the Apps Script mailer collects this within a minute
      insert into mail_outbox (to_email, code_plain, purpose)
        values (v_email, v_code, 'certificate_code');
      v_outcome := 'sent';
    else
      v_outcome := 'not_enrolled';
    end if;
  end if;

  insert into sign_in_attempts (email_hash, ip, outcome)
    values (v_hash, v_ip, v_outcome);

  -- Same answer whichever of the five outcomes it was.
  return jsonb_build_object('ok', true, 'status', 'accepted', 'message', c_same);
end $function$;


-- ---------------------------------------------------------------------
-- The old name, kept so nothing that calls it has to change on the day
-- file 12 runs. Same arguments, same boolean result.
-- ---------------------------------------------------------------------
create or replace function request_certificate_code(p_email text)
returns boolean
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
begin
  perform request_sign_in_code(p_email);
  return true;
end $function$;



-- =====================================================================
-- STEP 2  A hashed token for the health check, in the same pattern as
--         mailer_token: the plain token is never stored, only its
--         SHA-256 hash, so reading the table tells an attacker nothing.
-- =====================================================================
create table if not exists lms_health_token (
  id         integer primary key default 1 check (id = 1),
  token_hash text not null,
  updated_at timestamptz not null default now()
);
alter table lms_health_token enable row level security;
-- no policy at all: only the functions below ever touch it

create or replace function lms_set_health_token(p_token text)
returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $$
begin
  if auth.uid() is not null and not lms_is_admin() then
    raise exception 'Only the administrator can set the health token.';
  end if;
  if p_token is null or length(p_token) < 24 then
    raise exception 'Choose a longer token: at least 24 characters.';
  end if;
  insert into lms_health_token (id, token_hash, updated_at)
  values (1, encode(digest(p_token, 'sha256'), 'hex'), now())
  on conflict (id) do update
    set token_hash = excluded.token_hash, updated_at = now();
  return 'Health token set. Put the plain token in the Apps Script, under Project Settings, Script Properties. Never in the code and never in a Sheet.';
end $$;

create or replace function lms_health_token_ok(p_token text)
returns boolean
language plpgsql stable security definer set search_path to 'public', 'extensions' as $$
begin
  if p_token is null or length(p_token) < 24 then return false; end if;
  return exists (select 1 from lms_health_token
                  where id = 1 and token_hash = encode(digest(p_token, 'sha256'), 'hex'));
end $$;


-- =====================================================================
-- STEP 3  The outbox learns what KIND of email each row is, the mailer
--         records that it ran, and mail_fetch_pending passes both on.
--
-- TWO CHANGES, both needed by the Send Email Hook in Step 6.
--
-- 1. mail_outbox gains a purpose column. Until now every row was a
--    certificate code, so the mailer could assume the wording. Once the
--    Academy's own sign up and password reset codes go through the same
--    outbox, the mailer has to be told which is which, or a person
--    confirming a new account gets an email about a certificate.
--
-- 2. Nothing recorded when the mailer last collected its post, so a dead
--    mailer looked exactly like a quiet one.
--
-- mail_fetch_pending therefore returns one more column. That means DROP
-- and CREATE rather than CREATE OR REPLACE, because PostgreSQL will not
-- change the result shape of a live function. It is wrapped in one
-- transaction so the function is never missing, not even for an instant,
-- and the mailer that is deployed today keeps working untouched: an extra
-- field in the JSON it receives is simply ignored by it.
-- =====================================================================
alter table mail_outbox add column if not exists purpose text;
update mail_outbox set purpose = 'certificate_code' where purpose is null;
alter table mail_outbox alter column purpose set default 'certificate_code';

create table if not exists lms_system_heartbeat (
  name   text primary key,
  at     timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb
);
alter table lms_system_heartbeat enable row level security;
-- no policy at all: only the functions below ever touch it

begin;

drop function if exists mail_fetch_pending(text, integer);

create function mail_fetch_pending(p_token text, p_limit integer default 20)
returns table(id uuid, to_email text, code_plain text, purpose text)
language plpgsql security definer set search_path to 'public' as $function$
begin
  if not mailer_token_ok(p_token) then
    return;
  end if;

  -- added by file 12: so a dead mailer can be told from a quiet one
  insert into lms_system_heartbeat (name, at) values ('mailer_fetch', now())
  on conflict (name) do update set at = now();

  delete from mail_outbox
   where sent = false and created_at < now() - interval '1 hour';
  delete from mail_outbox
   where sent = true and created_at < now() - interval '1 day';

  return query
    update mail_outbox m
       set claimed_at = now()
     where m.id in (
       select m2.id from mail_outbox m2
        where m2.sent = false
          and (m2.claimed_at is null or m2.claimed_at < now() - interval '5 minutes')
        order by m2.created_at
        limit greatest(1, least(coalesce(p_limit, 20), 100))
     )
    returning m.id, m.to_email, m.code_plain,
              coalesce(m.purpose, 'certificate_code');
end $function$;

commit;


-- =====================================================================
-- STEP 4  PART 2. The health check.
--
--   select * from system_health('your-token-here');
--
-- Read only. It writes nothing. Every row carries a severity of ok,
-- warn or alarm, and the first row, OVERALL, is the worst of them, so an
-- alarm script only has to look at one value.
-- =====================================================================
create or replace function system_health(p_token text)
returns table (item text, severity text, value text, detail text)
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  v_rows record;
  v_out  text[][];
  v_worst text := 'ok';
  v_mins numeric; v_bytes bigint; v_limit bigint := 500*1024*1024;
  v_at timestamptz; v_n integer; v_sev text; v_val text; v_det text;
  v_jobs jsonb := '[]'::jsonb; j jsonb; v_has_cron boolean; v_has_details boolean;
  v_result text[];
begin
  -- A signed in person is never the alarm script. The script calls this
  -- with the public key and no signed in user.
  if auth.uid() is not null and not lms_is_admin() then
    return query select 'TOKEN'::text, 'alarm'::text, 'rejected'::text,
      'Only the alarm script or the administrator may run this.'::text;
    return;
  end if;
  if not lms_health_token_ok(p_token) then
    return query select 'TOKEN'::text, 'alarm'::text, 'rejected'::text,
      'The token is wrong, too short, or has never been set. Set it with lms_set_health_token.'::text;
    return;
  end if;

  create temporary table if not exists _h (ord integer, item text, severity text, value text, detail text)
    on commit drop;
  -- "where true" is not decoration. Supabase runs calls that arrive through
  -- the API with a protection that REFUSES any delete or update without a
  -- where clause, as error 21000, "DELETE requires a WHERE clause". A bare
  -- "delete from _h" is rejected and the whole health check returns 400,
  -- which the alarm then reports as the database being unreachable.
  -- The table is "on commit drop" and each API call is its own transaction,
  -- so this line only matters when the function is called twice inside one
  -- transaction, which is what happens in the SQL editor.
  delete from _h where true;

  -- 1. the oldest email still waiting to be sent
  select round(extract(epoch from (now() - min(created_at)))/60.0, 1)
    into v_mins from mail_outbox where sent = false;
  if v_mins is null then
    insert into _h values (1,'oldest unsent email','ok','none waiting','The outbox is empty.');
  else
    v_sev := case when v_mins > 20 then 'alarm' when v_mins > 7 then 'warn' else 'ok' end;
    insert into _h values (1,'oldest unsent email', v_sev, v_mins || ' minutes',
      'A sign in code waiting this long means the mailer is behind or stopped. Anything unsent for an hour is deleted, and that person never gets in.');
  end if;

  -- 2. when the mailer last collected its post
  select at into v_at from lms_system_heartbeat where name = 'mailer_fetch';
  if v_at is null then
    insert into _h values (2,'mailer last fetched','alarm','never recorded',
      'The mailer has not called in since this check was installed. If sign in is working, it may simply not have run yet.');
  else
    v_mins := round(extract(epoch from (now() - v_at))/60.0, 1);
    v_sev := case when v_mins > 60 then 'alarm' when v_mins > 30 then 'warn' else 'ok' end;
    insert into _h values (2,'mailer last fetched', v_sev, v_mins || ' minutes ago',
      'The Apps Script mailer calls mail_fetch_pending on a timer. Silence here means sign in codes are not going out.');
  end if;

  -- 3. database size against the free allowance
  v_bytes := pg_database_size(current_database());
  v_sev := case when v_bytes > v_limit * 0.90 then 'alarm'
                when v_bytes > v_limit * 0.75 then 'warn' else 'ok' end;
  insert into _h values (3,'database size', v_sev,
    pg_size_pretty(v_bytes) || ' of 500 MB (' || round(100.0*v_bytes/v_limit,1) || ' percent)',
    'The free plan allows 500 MB. select * from lms_storage_report() breaks it down by table.');

  -- 4. the scheduled jobs
  select exists (select 1 from pg_extension where extname='pg_cron') into v_has_cron;
  if not v_has_cron then
    insert into _h values (4,'scheduled jobs','warn','pg_cron is not installed',
      'The nightly access sweep and the watch slice prune exist as functions but nothing runs them. Turn pg_cron on, then run files 10 and 11 again.');
  else
    begin
      execute $q$
        select coalesce(jsonb_agg(jsonb_build_object(
                 'jobname', j.jobname, 'active', j.active,
                 'last_start', d.start_time, 'last_status', d.status)), '[]'::jsonb)
          from cron.job j
          left join lateral (select start_time, status from cron.job_run_details r
                              where r.jobid = j.jobid order by r.start_time desc limit 1) d on true
      $q$ into v_jobs;
      v_has_details := true;
    exception when others then
      begin
        execute $q$ select coalesce(jsonb_agg(jsonb_build_object(
                     'jobname', j.jobname, 'active', j.active)), '[]'::jsonb) from cron.job $q$
          into v_jobs;
        v_has_details := false;
      exception when others then
        v_jobs := '[]'::jsonb; v_has_details := false;
      end;
    end;

    if jsonb_array_length(v_jobs) = 0 then
      insert into _h values (4,'scheduled jobs','warn','pg_cron is on but no job is scheduled',
        'Run files 10 and 11 again now that pg_cron is available, so the nightly jobs get created.');
    else
      v_n := 4;
      for j in select * from jsonb_array_elements(v_jobs) loop
        v_n := v_n + 1;
        if not coalesce((j->>'active')::boolean, false) then
          v_sev := 'alarm'; v_val := 'switched off';
        elsif not v_has_details then
          v_sev := 'warn'; v_val := 'on, but this database cannot report its last run';
        elsif (j->>'last_start') is null then
          v_sev := 'warn'; v_val := 'on, never run yet';
        elsif (j->>'last_status') <> 'succeeded' then
          v_sev := 'alarm'; v_val := 'last run ' || (j->>'last_status') ||
                   ' at ' || to_char((j->>'last_start')::timestamptz, 'YYYY-MM-DD HH24:MI');
        elsif (j->>'last_start')::timestamptz < now() - interval '48 hours' then
          v_sev := 'alarm'; v_val := 'last succeeded ' ||
                   to_char((j->>'last_start')::timestamptz, 'YYYY-MM-DD HH24:MI') || ', too long ago';
        else
          v_sev := 'ok'; v_val := 'succeeded ' ||
                   to_char((j->>'last_start')::timestamptz, 'YYYY-MM-DD HH24:MI');
        end if;
        insert into _h values (v_n, 'scheduled job: ' || coalesce(j->>'jobname','unnamed'),
          v_sev, v_val, 'A job that stops running stops closing access for people who have left.');
      end loop;
    end if;
  end if;

  -- 5. sign ups still waiting to confirm
  select count(*) into v_n from auth.users
   where email_confirmed_at is null and created_at > now() - interval '24 hours';
  v_sev := case when v_n >= 5 then 'warn' else 'ok' end;
  insert into _h values (100,'unconfirmed sign ups, last 24 hours', v_sev, v_n::text,
    'A pile of these usually means confirmation emails are not arriving. A few is normal: people change their minds.');

  -- 6. the email allowance. This is the counter the site wide ceiling in
  -- step 1 reads, so seeing it here is how a flood becomes visible. The
  -- page tells nobody they were refused, on purpose, so this is the only
  -- place it shows.
  select count(*) into v_n from sign_in_attempts
   where outcome = 'sent' and at > now() - interval '24 hours';
  v_sev := case when v_n >= mail_limit_per_day() then 'alarm'
                when v_n >= (mail_limit_per_day() * 7) / 10 then 'warn' else 'ok' end;
  insert into _h values (110,'emails sent, last 24 hours', v_sev,
    v_n::text || ' of ' || mail_limit_per_day()::text || ' allowed',
    'The ceiling protects the day''s Gmail allowance, which Google locks for 24 hours if it runs out. Raise it in mail_limits if the mailer moves to a Workspace account.');

  -- 7. lookups that produced no code. A handful is ordinary: people mistype
  -- their address or forget which one they enrolled with. Hundreds is
  -- somebody working through a list of addresses.
  select count(*) into v_n from sign_in_attempts
   where outcome in ('not_enrolled','rate_limited_email','rate_limited_ip','rate_limited_site')
     and at > now() - interval '1 hour';
  v_sev := case when v_n >= 200 then 'alarm' when v_n >= 50 then 'warn' else 'ok' end;
  insert into _h values (120,'sign in attempts that sent nothing, last hour', v_sev, v_n::text,
    'Mostly mistyped addresses. A sudden pile is somebody testing a list of addresses to see who is enrolled.');

  -- every reference to the temporary table is qualified, because this
  -- function's own output columns are called item, severity and value too
  select case when bool_or(h.severity='alarm') then 'alarm'
              when bool_or(h.severity='warn') then 'warn' else 'ok' end
    into v_worst from _h h;

  return query select 'OVERALL'::text, v_worst,
    (select count(*)::text || ' checks, ' ||
            count(*) filter (where h.severity='alarm')::text || ' alarm, ' ||
            count(*) filter (where h.severity='warn')::text || ' warn' from _h h),
    'Look at this row first. If it says ok, nothing below needs reading.'::text;
  return query select h.item, h.severity, h.value, h.detail from _h h order by h.ord;
end $$;


-- =====================================================================
-- STEP 5  PART 5. A question a learner has been given cannot be hard
--         deleted, by anybody.
--
-- When a learner starts a set of questions, the system freezes which
-- questions they were given. Delete one of those rows and that frozen
-- list points at nothing, which is the fault file 11 had to work around.
-- This closes the last door, including for the administrator and
-- including the SQL editor, because there is no good reason to do it and
-- retiring the question does the same job safely.
--
-- NOTE: this also stops you deleting a QUIZ, LESSON, MODULE or COURSE
-- that has questions a learner has been given, because deleting those
-- would delete the questions underneath. That is deliberate. Archive the
-- course instead, or retire its questions first.
-- =====================================================================
create or replace function lms_guard_question_not_served() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  select count(*) into v_n from lms_quiz_attempts a
   where old.id = any(a.served_question_ids);
  if v_n > 0 then
    raise exception 'This question has already been given to a learner in % attempt(s), so deleting it would break their record. Retire it instead: update lms_questions set active = false where id = %.', v_n, old.id;
  end if;
  return old;
end $$;

drop trigger if exists t_guard_question_not_served on lms_questions;
create trigger t_guard_question_not_served before delete on lms_questions
  for each row execute function lms_guard_question_not_served();


-- =====================================================================
-- STEP 6  PART 1. The Send Email Hook, as a Postgres function.
--
-- THE PROBLEM. Supabase Auth generates the Academy's sign up confirmation
-- and password reset emails itself. They never pass through our database,
-- so the outbox never sees them and the Apps Script mailer cannot send
-- them. Supabase's own email service sends 2 an hour to project members
-- only, so left alone, no member of the public could ever confirm an
-- account.
--
-- WHY A FUNCTION AND NOT A WEB ADDRESS. Supabase will call either an HTTP
-- endpoint or a function in this database. An Apps Script web app looked
-- like the obvious endpoint and is the wrong answer for three separate
-- reasons: doPost cannot read the request headers, so it cannot check the
-- signature that proves the call really came from Supabase; an HTTP hook
-- has to answer within 5 seconds; and an Apps Script web app answers with
-- a redirect, which a webhook caller may read as a failure.
--
-- A function has none of those problems. Supabase calls it inside this
-- database, so there is no signature to check and no network to cross. It
-- writes the email into mail_outbox, the mailer that already runs every
-- minute collects it, and the alarm built in Step 4 watches it for free,
-- because it watches the outbox.
--
-- WHAT IT RECEIVES. One jsonb argument holding "user" and "email_data".
-- The piece that matters is email_data.token, which is the six digit code,
-- and email_data.email_action_type, which says what the code is for.
--
-- WHAT IT MUST NOT DO. It runs inside the transaction that is creating the
-- account, so if it raises, the sign up fails. That is the right behaviour
-- and it is chosen deliberately: a sign up that appears to work and sends
-- no email is the exact fault this whole file exists to remove. Better a
-- visible failure the person can retry than a silent one nobody sees.
-- =====================================================================
create or replace function send_email_hook(event jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_email   text;
  v_token   text;
  v_action  text;
  v_purpose text;
  v_sent_hour int;
  v_sent_day  int;
begin
  v_email  := lower(btrim(coalesce(event->'user'->>'email', '')));
  v_token  := btrim(coalesce(event->'email_data'->>'token', ''));
  v_action := lower(btrim(coalesce(event->'email_data'->>'email_action_type', '')));

  if v_email = '' or v_token = '' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 500,
      'message', 'The email could not be prepared because the address or the code was missing.'));
  end if;

  -- Only the two the Academy asks for are given their own wording. Anything
  -- else Supabase may send still goes out, under a general heading, rather
  -- than being dropped on the floor.
  v_purpose := case v_action
                 when 'signup'   then 'academy_signup'
                 when 'recovery' then 'academy_recovery'
                 when 'email_change' then 'academy_email_change'
                 when 'email_change_new' then 'academy_email_change'
                 when 'magiclink' then 'academy_signin'
                 when 'invite'    then 'academy_signup'
                 else 'academy_other'
               end;

  -- The same site wide ceiling as Step 1, for the same reason: the day's
  -- Gmail allowance is shared, and running it out locks sending for 24
  -- hours. Counted on what the server did, so it cannot be faked.
  select count(*) into v_sent_hour from sign_in_attempts
   where outcome = 'sent' and at > now() - interval '1 hour';
  select count(*) into v_sent_day from sign_in_attempts
   where outcome = 'sent' and at > now() - interval '24 hours';
  if v_sent_hour >= mail_limit_per_hour() or v_sent_day >= mail_limit_per_day() then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 429,
      'message', 'Too many emails have been sent in the last hour. Please try again shortly.'));
  end if;

  insert into mail_outbox (to_email, code_plain, purpose)
    values (v_email, v_token, v_purpose);

  insert into sign_in_attempts (email_hash, ip, outcome)
    values (encode(digest(v_email, 'sha256'), 'hex'), null, 'sent');

  -- An empty object is how Supabase is told all is well.
  return '{}'::jsonb;
end $function$;

-- Supabase calls this as its own internal role, which must be allowed to,
-- and nobody else may call it at all: it would otherwise be a way to make
-- the site email any address.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant execute on function send_email_hook(jsonb) to supabase_auth_admin';
    execute 'grant usage on schema public to supabase_auth_admin';
    raise notice 'Step 6: send_email_hook is ready. NEXT: switch it on under Authentication, then Hooks.';
  else
    raise notice 'Step 6: send_email_hook created. The supabase_auth_admin role is not present here, which is normal on a local copy. On Supabase, grant execute on it to supabase_auth_admin.';
  end if;
end $$;
revoke all on function send_email_hook(jsonb) from public, anon, authenticated;


-- =====================================================================
-- STEP 7  Permissions.
--
-- system_health and mail_fetch_pending are reachable by the alarm script
-- and the mailer, which call in with the public key and no signed in
-- user. Their token is what protects them, exactly as before. Setting
-- the token is not reachable that way: the administrator does it.
-- =====================================================================
revoke all on function lms_set_health_token(text) from public, anon, authenticated;
grant execute on function lms_set_health_token(text) to authenticated;
revoke all on function lms_health_token_ok(text) from public, anon, authenticated;

-- The sign in page is used by somebody who is NOT signed in, so anon has
-- to be able to call both. They are security definer and judge for
-- themselves who may have a code.
grant execute on function request_sign_in_code(text) to anon, authenticated;
grant execute on function request_certificate_code(text) to anon, authenticated;

-- sign_in_attempts has no lms_ prefix, so lms_tidy_table_privileges()
-- does not cover it. Supabase grants every privilege on a new public
-- table to anon and authenticated, including TRUNCATE, which row level
-- security never filters. Nobody needs any of it: the only reader is a
-- security definer function.
revoke all on table sign_in_attempts from anon, authenticated;
revoke all on sequence sign_in_attempts_id_seq from anon, authenticated;
revoke all on function sign_in_caller_ip() from public, anon, authenticated;
revoke all on table mail_limits from anon, authenticated;
revoke all on function mail_limit_per_hour() from public, anon, authenticated;
revoke all on function mail_limit_per_day() from public, anon, authenticated;

do $$
declare v_n integer;
begin
  select tables_tidied into v_n from lms_tidy_table_privileges();
  raise notice 'Step 6: checked permissions on % Academy tables and views.', v_n;
end $$;

do $$
begin
  if not exists (select 1 from lms_health_token where id = 1) then
    raise notice 'File 12 finished. NEXT: set the health token, with select lms_set_health_token(''a-long-random-string-of-your-own''); then run 12_verify.sql.';
  else
    raise notice 'File 12 finished. The health token is already set. Now run 12_verify.sql.';
  end if;
end $$;
