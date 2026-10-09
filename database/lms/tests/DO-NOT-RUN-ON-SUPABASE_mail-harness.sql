-- LOCAL TEST ONLY. The certification mailer tables and functions, copied from
-- the live snapshot so file 12 can be tested against their real shapes.
create table if not exists auth_codes (
  id uuid primary key default gen_random_uuid(),
  email_norm text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists mail_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  code_plain text not null,
  sent boolean not null default false,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
create table if not exists mailer_token (
  id integer not null default 1 primary key,
  token_hash text not null,
  updated_at timestamptz not null default now()
);

create or replace function mailer_token_ok(p_token text)
returns boolean language plpgsql security definer set search_path to 'public','extensions' as $function$
begin
  if p_token is null or length(p_token) < 20 then
    return false;
  end if;
  return exists (
    select 1 from mailer_token
     where id = 1
       and token_hash = encode(digest(p_token, 'sha256'), 'hex'));
end $function$;

create or replace function mail_fetch_pending(p_token text, p_limit integer default 20)
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

create or replace function mail_mark_sent(p_token text, p_ids uuid[])
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare v_n int;
begin
  if not mailer_token_ok(p_token) then
    return 0;
  end if;
  delete from mail_outbox where id = any(p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $function$;

create or replace function mail_ping(p_token text)
returns text language plpgsql security definer set search_path to 'public' as $function$
begin
  if not mailer_token_ok(p_token) then
    return 'BAD TOKEN';
  end if;
  return 'OK, ' || (select count(*) from mail_outbox where sent = false)::text
         || ' code(s) waiting';
end $function$;

create or replace function request_certificate_code(p_email text)
returns boolean language plpgsql security definer set search_path to 'public','extensions' as $function$
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

  -- only mint a code if this person actually has a certificate
  if exists (
      select 1 from certificates c
        join participants p on p.id = c.participant_id
       where p.email_norm = v_email and c.revoked = false) then
    v_code := lpad(floor(random()*1000000)::text, 6, '0');
    insert into auth_codes (email_norm, code_hash, expires_at)
      values (v_email, crypt(v_code, gen_salt('bf')), now() + interval '10 minutes');
    insert into mail_outbox (to_email, code_plain) values (v_email, v_code);
  end if;

  return true;
end $function$;

insert into mailer_token (id, token_hash)
values (1, encode(digest('OLD-TOKEN-for-local-tests-only-0000', 'sha256'), 'hex'))
on conflict (id) do nothing;
