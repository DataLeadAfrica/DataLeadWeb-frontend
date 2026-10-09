-- =====================================================================
-- UNDO file 12. Only if something has gone wrong.
--
-- DO THIS FIRST, BEFORE RUNNING A SINGLE LINE BELOW.
--
-- 1. In the Supabase dashboard, go to Authentication, then Hooks, and turn
--    OFF the Send Email hook. This file drops the function that hook calls.
--    Dropping it while the hook is still switched on means every Academy
--    sign up and password reset FAILS, because Supabase will try to call
--    something that is not there.
--
-- 2. If the sign in page or the certificate claim page has already been
--    deployed calling request_sign_in_code, deploy the previous version of
--    those pages first. This file drops that function too.
--
-- Both of those are website and dashboard steps. Neither can be done from
-- here, which is why they are at the top rather than in a comment further
-- down.
--
-- READ THIS TOO. One thing is deliberately NOT undone.
--
-- Part 0 of file 12 is the only reason a bootcamp participant who has no
-- certificate yet can sign in at all. Reverting request_certificate_code
-- would lock every one of them out again, silently, with the page still
-- telling them to check their email. There is no error to see and no
-- complaint to act on, which is what made the fault so hard to find in
-- the first place.
--
-- So this file leaves that fix in place. There is a commented block at
-- the bottom if you truly want the old behaviour back.
-- =====================================================================

-- ---------------- part 5, the delete guard ----------------
drop trigger if exists t_guard_question_not_served on lms_questions;
drop function if exists lms_guard_question_not_served();

-- ---------------- the honest sign in answer ----------------
-- Dropping request_sign_in_code means the page must go back to calling
-- request_certificate_code. Do the website first if the page is already
-- on the new one, or sign in will break for everybody rather than just
-- being vague. Order: deploy the old page, THEN run this.
--
-- request_certificate_code is restored to doing the work itself rather
-- than wrapping, so it keeps working after the drop. It keeps the Part 0
-- fix, for the reason at the top of this file.
create or replace function request_certificate_code(p_email text)
returns boolean
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  v_email text := lower(btrim(p_email));
  v_code  text;
  v_recent int;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return true;
  end if;

  select count(*) into v_recent from auth_codes
   where email_norm = v_email and created_at > now() - interval '15 minutes';
  if v_recent >= 3 then
    return true;
  end if;

  if exists (
      select 1 from participants p
       where p.email_norm = v_email
         and ( exists (select 1 from certificates c
                        where c.participant_id = p.id and c.revoked = false)
            or exists (select 1 from participant_enrolments e
                        where e.participant_id = p.id and e.status = 'active') )
  ) then
    v_code := lpad(floor(random()*1000000)::text, 6, '0');
    insert into auth_codes (email_norm, code_hash, expires_at)
      values (v_email, crypt(v_code, gen_salt('bf')), now() + interval '10 minutes');
    insert into mail_outbox (to_email, code_plain) values (v_email, v_code);
  end if;

  return true;
end $function$;

drop function if exists request_sign_in_code(text);
drop function if exists sign_in_caller_ip();
drop function if exists mail_limit_per_hour();
drop function if exists mail_limit_per_day();
drop table if exists sign_in_attempts;
drop table if exists mail_limits;

-- ---------------- part 1, the Send Email Hook ----------------
-- Turn the hook OFF in the dashboard before this line runs. See the top.
drop function if exists send_email_hook(jsonb);

-- ---------------- part 2, the health check ----------------
drop function if exists system_health(text);
drop function if exists lms_set_health_token(text);
drop function if exists lms_health_token_ok(text);
drop table if exists lms_health_token;

-- mail_fetch_pending goes back to the three column version, without the
-- heartbeat line and without the purpose. This is the certification
-- mailer, so it is restored exactly, and in one transaction so it is never
-- missing. If you have already updated the Apps Script mailer, it keeps
-- working: a purpose it no longer receives simply reads as undefined and
-- the script falls back to the certificate wording.
begin;

drop function if exists mail_fetch_pending(text, integer);

create function mail_fetch_pending(p_token text, p_limit integer default 20)
returns table(id uuid, to_email text, code_plain text)
language plpgsql security definer set search_path to 'public' as $function$
begin
  if not mailer_token_ok(p_token) then
    return;
  end if;

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
    returning m.id, m.to_email, m.code_plain;
end $function$;

commit;

-- nothing references it now
drop table if exists lms_system_heartbeat;

-- mail_outbox.purpose is LEFT IN PLACE. Nothing reads it once the function
-- above is restored, an unused column costs nothing, and dropping it would
-- throw away the record of what the rows still in the outbox were for.

-- ---------------- what is left in place on purpose ----------------
-- request_certificate_code  keeps the fix. Reverting it locks out every
--                           bootcamp participant who has no certificate.
-- The tightened table permissions from file 10 are untouched.

-- =====================================================================
-- IF YOU REALLY WANT THE OLD SIGN IN BEHAVIOUR BACK
--
-- Only do this if you understand that every enrolled participant without
-- a certificate will stop being able to sign in, and will see no error.
-- Count who that is first:
--
--   select count(*) from participants p
--    where exists (select 1 from participant_enrolments e
--                   where e.participant_id = p.id and e.status = 'active')
--      and not exists (select 1 from certificates c
--                       where c.participant_id = p.id and c.revoked = false);
--
-- That is how many people it would shut out. If you still want it, the
-- original body is in 05_functions.sql as it was before file 12, or ask
-- me and I will write it out.
-- =====================================================================
