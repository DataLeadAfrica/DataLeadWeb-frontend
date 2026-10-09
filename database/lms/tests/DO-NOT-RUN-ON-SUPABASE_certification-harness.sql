-- LOCAL TEST HARNESS ONLY. NEVER RUN THIS ON SUPABASE.
-- A stand-in for the certification pieces file 13 leans on, transcribed
-- from the real definitions sent on 7 October 2026.
--
-- make_certificate_number below is a STAND-IN. File 13 CALLS the real
-- one rather than reimplementing it, so the exact format here does not
-- affect whether file 13 is correct. What matters is the signature,
-- (text, integer, text), and that the third argument accepts null.

create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programmes(id),
  slug text not null, title text not null, code text, week_number integer
);

alter table participants add column if not exists phone text;

-- THE UNIQUE RULE ON certificate_number.
--
-- The real certificates table has one. The local stand-in in
-- DO-NOT-RUN-ON-SUPABASE_local-harness.sql was written before file 13
-- existed and does not, so file 13's readiness check stopped every
-- local build with "a UNIQUE rule on certificates.certificate_number",
-- and the only way past it was to type the constraint in by hand and
-- remember to do it again next time.
--
-- File 13 insists on it for a good reason: without it, issuing the same
-- certificate twice makes two rows, and "safe to run twice" stops being
-- true. So the harness adds it here rather than the README asking a
-- person to.
do $$
begin
  if not exists (
    select 1 from pg_constraint con join pg_class c on c.oid = con.conrelid
     where c.relname = 'certificates' and con.contype = 'u'
       and pg_get_constraintdef(con.oid) ilike '%certificate_number%') then
    alter table certificates add constraint certificates_certificate_number_key
      unique (certificate_number);
    raise notice 'harness: added the UNIQUE rule on certificates.certificate_number';
  end if;
end $$;

-- The real database fills email_norm somehow. Here, a trigger, so the
-- lookup by email_norm that the real functions use also works locally.
create or replace function _h_participants_norm() returns trigger
language plpgsql as $$
begin
  new.email_norm := lower(btrim(new.email));
  return new;
end $$;
drop trigger if exists _h_participants_norm on participants;
create trigger _h_participants_norm before insert or update on participants
  for each row execute function _h_participants_norm();

create or replace function make_certificate_number(p_code text, p_year integer, p_module_code text)
returns text language plpgsql as $$
declare v_rand text;
begin
  v_rand := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  return coalesce(p_code,'DLA') || '-' || p_year::text || '-'
      || coalesce(nullif(p_module_code,''), 'GEN') || '-' || v_rand;
end $$;

-- The real verify_certificate, transcribed verbatim from the live
-- definition sent on 7 October 2026. Local only. This is here so the
-- test can prove that a certificate file 13 writes is readable by the
-- function the public /verify page actually calls.
alter table programmes add column if not exists course_url text;
alter table programmes add column if not exists duration_text text;

create or replace function verify_certificate(p_number text)
returns table(found boolean, full_name text, programme_title text, programme_slug text,
              module_title text, week_number integer, is_module boolean, course_url text,
              duration_text text, completed_on date, revoked boolean)
language plpgsql security definer set search_path to 'public' as $function$
begin
  return query
    select true, p.full_name, pr.title, pr.slug, m.title, m.week_number,
           (c.module_id is not null), pr.course_url, pr.duration_text,
           c.completed_on, c.revoked
      from certificates c
      join participants p on p.id  = c.participant_id
      join programmes  pr on pr.id = c.programme_id
      left join modules m on m.id  = c.module_id
     where upper(btrim(c.certificate_number)) = upper(btrim(p_number));
  if not found then
    return query select false, null::text, null::text, null::text, null::text,
                        null::int, null::boolean, null::text, null::text,
                        null::date, null::boolean;
  end if;
end $function$;
