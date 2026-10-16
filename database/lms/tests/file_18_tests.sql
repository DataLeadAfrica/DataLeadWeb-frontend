-- Tests file 18. NOT for the Supabase editor: it makes accounts and a
-- certification record, acts as a learner, and rolls everything back.
-- Run it on a local copy after files 01 to 18.
--
-- THE POINT OF THIS FILE. The fault file 18 closes was live, and it got
-- there because a rule was written in a comment and never enforced:
-- "Linking is only ever done on a PROVEN address. Doing it on a typed
-- one would let anybody claim somebody else's certificates."
--
-- Every permission test before this one asked whether a FUNCTION
-- refuses. This asks whether a table refuses, which is a different
-- question and the one that was never asked. It therefore writes
-- directly to lms_profiles as the browser could, rather than through
-- any function.
--
-- EVERY TEST RUNS AS authenticated. Row level security does not apply
-- to a table's owner unless FORCE is set, and psql connects as the
-- owner, so a test that forgets "set local role authenticated" passes
-- whatever the policies say. Two tests in file 17 proved nothing for
-- exactly that reason before it was noticed.

\set ON_ERROR_STOP on
begin;

create temporary table t18_out (n integer, label text, got text, want text) on commit drop;

create or replace function t18_say(p_label text, p_got text, p_want text)
returns void language plpgsql as $$
begin
  insert into t18_out values ((select coalesce(max(n), 0) + 1 from t18_out), p_label, p_got, p_want);
end $$;

create or replace function t18_be(p_user uuid)
returns void language plpgsql as $$
begin
  if p_user is null then
    perform set_config('request.jwt.claim.sub', '', true);
  else
    perform set_config('request.jwt.claim.sub', p_user::text, true);
  end if;
end $$;

-- --------------------------------------------------------------- setup
-- Two accounts and a certification record NOBODY has linked. That last
-- part is the normal state for anybody certified before they made an
-- Academy account, and it is what was exposed.
insert into auth.users (id, email, email_confirmed_at)
     values ('f8000000-0000-0000-0000-000000000001', 'learner18@example.com', now()),
            ('f8000000-0000-0000-0000-000000000002', 'other18@example.com', now())
  on conflict (id) do nothing;

insert into lms_profiles (id, full_name, role)
     values ('f8000000-0000-0000-0000-000000000001', '', 'learner'),
            ('f8000000-0000-0000-0000-000000000002', 'Other Person', 'learner')
  on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

insert into participants (id, full_name, email_norm)
     values ('f8000000-0000-0000-0000-00000000000a', 'Certified Stranger', 'stranger18@example.com')
  on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 1. What a learner may write about themselves
-- ---------------------------------------------------------------------
-- EVERY OUTCOME IS CAPTURED FIRST AND RECORDED AFTER reset role.
-- authenticated cannot write the temporary results table, so calling
-- t18_say while still in the role fails with "permission denied for
-- table t18_out" and takes the whole file down. File 17 hit this too.
do $$
declare
  v_learner uuid := 'f8000000-0000-0000-0000-000000000001';
  r_claim text; r_role text; r_linked text; r_name text; r_phone text; r_other text;
begin
  perform t18_be(v_learner);
  set local role authenticated;

  -- THE ONE THAT WAS LIVE.
  begin
    update lms_profiles set participant_id = 'f8000000-0000-0000-0000-00000000000a'
     where id = v_learner;
    r_claim := case when found then 'allowed' else 'no row matched' end;
  exception when insufficient_privilege then r_claim := 'refused';
  end;

  begin
    update lms_profiles set role = 'admin' where id = v_learner;
    r_role := 'allowed';
  exception when others then r_role := 'refused';
  end;

  begin
    update lms_profiles set linked_at = now() where id = v_learner;
    r_linked := 'allowed';
  exception when insufficient_privilege then r_linked := 'refused';
  end;

  -- And the two they may.
  begin
    update lms_profiles set full_name = 'Written Directly' where id = v_learner;
    r_name := 'allowed';
  exception when others then r_name := 'refused: ' || sqlerrm;
  end;

  begin
    update lms_profiles set phone = '08000000000' where id = v_learner;
    r_phone := 'allowed';
  exception when others then r_phone := 'refused: ' || sqlerrm;
  end;

  -- Somebody else's row is refused by the policy, as it always was.
  begin
    update lms_profiles set full_name = 'Hijacked'
     where id = 'f8000000-0000-0000-0000-000000000002';
    r_other := case when found then 'allowed' else 'no row matched' end;
  exception when others then r_other := 'refused';
  end;

  reset role;

  perform t18_say('1a a learner cannot claim an unlinked certification record', r_claim, 'refused');
  perform t18_say('1b nor make themselves an administrator', r_role, 'refused');
  perform t18_say('1c nor rewrite when they were linked', r_linked, 'refused');
  perform t18_say('1d but they may write their own name', r_name, 'allowed');
  perform t18_say('1e and their own phone', r_phone, 'allowed');
  perform t18_say('1f and not somebody else name', r_other, 'no row matched');
end $$;

-- ---------------------------------------------------------------------
-- 2. EVERY column, so the next one added is covered by default
-- ---------------------------------------------------------------------
-- Written as a loop over the real column list rather than one test per
-- column. A hand written list is a list that goes out of date, and the
-- fault this file is about was a column nobody thought about.
do $$
declare
  v_learner uuid := 'f8000000-0000-0000-0000-000000000001';
  v_col  text;
  v_bad  text[] := '{}';
  v_allowed text[] := array['full_name', 'phone'];
begin
  perform t18_be(v_learner);
  set local role authenticated;

  for v_col in
    select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'lms_profiles'
       and column_name <> 'id'
     order by column_name
  loop
    if has_column_privilege('authenticated', 'lms_profiles', v_col, 'UPDATE')
       and not (v_col = any(v_allowed)) then
      v_bad := v_bad || v_col;
    end if;
  end loop;

  reset role;

  perform t18_say('2a no column beyond name and phone is writable by a signed in person',
    case when array_length(v_bad, 1) is null then 'none'
         else array_to_string(v_bad, ', ') end,
    'none');

  -- And the two that should be, are. A file that revoked everything
  -- would pass the test above and break the page.
  perform t18_say('2b and those two really are writable',
    case when has_column_privilege('authenticated', 'lms_profiles', 'full_name', 'UPDATE')
          and has_column_privilege('authenticated', 'lms_profiles', 'phone', 'UPDATE')
         then 'both' else 'not both' end, 'both');
end $$;

-- ---------------------------------------------------------------------
-- 3. The name function
-- ---------------------------------------------------------------------
do $$
declare
  v_learner uuid := 'f8000000-0000-0000-0000-000000000001';
  r_tidy text; r_saved text; r_empty text; r_long text; r_angle text;
  r_after text; r_other text;
begin
  perform t18_be(v_learner);
  set local role authenticated;

  -- Runs of spaces collapse, so a name is stored the way it reads back.
  r_tidy := lms_set_my_name('  Ada   Lovelace  ');
  r_saved := (select full_name from lms_profiles where id = v_learner);

  begin
    perform lms_set_my_name('   ');
    r_empty := 'allowed';
  exception when others then r_empty := 'refused';
  end;

  begin
    perform lms_set_my_name(repeat('a', 81));
    r_long := 'allowed';
  exception when others then r_long := 'refused';
  end;

  begin
    perform lms_set_my_name('<script>Ada');
    r_angle := 'allowed';
  exception when others then r_angle := 'refused';
  end;

  r_after := (select full_name from lms_profiles where id = v_learner);

  reset role;

  -- READ AFTER reset role, not before. The self-read policy only lets
  -- somebody see their OWN profile, so this select returns no row at all
  -- while acting as the learner and the check reads as a failure when
  -- what it is actually seeing is the read rule working. The question
  -- here is whether the other row was changed, which only the owner can
  -- answer.
  r_other := (select full_name from lms_profiles
               where id = 'f8000000-0000-0000-0000-000000000002');

  perform t18_say('3a the name function tidies the spacing', r_tidy, 'Ada Lovelace');
  perform t18_say('3b and it is the name the profile now holds', r_saved, 'Ada Lovelace');
  perform t18_say('3c an empty name is refused', r_empty, 'refused');
  perform t18_say('3d a name over 80 characters is refused', r_long, 'refused');
  perform t18_say('3e a name with angle brackets is refused', r_angle, 'refused');
  perform t18_say('3f and a refused attempt leaves the saved name alone', r_after, 'Ada Lovelace');
  perform t18_say('3g and it never touches anybody else row', r_other, 'Other Person');
end $$;

-- ---------------------------------------------------------------------
-- 4. Signed out
-- ---------------------------------------------------------------------
do $$
declare r text;
begin
  perform t18_be(null);
  set local role anon;
  begin
    perform lms_set_my_name('Nobody');
    r := 'allowed';
  exception when others then r := 'refused';
  end;
  reset role;
  perform t18_say('4a a signed out visitor cannot set a name', r, 'refused');
end $$;

-- ------------------------------------------------------------- results
\pset tuples_only off
\pset format aligned
select n as "#", label as "what was checked",
       case when got is not distinct from want then 'pass' else 'FAIL' end as "result",
       got as "got", want as "wanted"
  from t18_out order by n;

select case when count(*) = 0 then 'ALL PASS'
            else count(*) || ' FAILED' end as "summary"
  from t18_out where got is distinct from want;

rollback;
