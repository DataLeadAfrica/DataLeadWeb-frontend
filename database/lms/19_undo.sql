-- Puts the database back as file 18 left it.
--
-- READ THIS BEFORE RUNNING IT. The undo restores the old gate, which
-- trusts auth.users.email_confirmed_at. While Supabase "Confirm email"
-- is OFF, that column is set the instant an account row is inserted, so
-- restoring it means every typed address counts as proven: somebody who
-- signs up with an appointed facilitator's address is handed the
-- control room, and somebody who signs up with a certified person's
-- address is handed their certificates.
--
-- So this file refuses unless you say you mean it. PASTE THIS LINE AT
-- THE VERY TOP OF THIS FILE, above the "begin", and run the whole thing
-- in one go:
--
--   select set_config('lms.undo_19_force', 'yes, I mean it', false)
--
-- End that line with a semicolon. It is described rather than shown
-- because no file meant for the SQL Editor carries one inside a comment
-- or a string.
--
-- IF YOU ARE UNDOING THIS, TURN "CONFIRM EMAIL" BACK ON FIRST. That is
-- the setting that made the old gate honest. The two belong together
-- and this file cannot check the setting for you.
--
-- WHAT IS KEPT, DELIBERATELY:
--
--   lms_profiles.email_verified_at   The column and every timestamp in
--                                    it stay. They are a record of who
--                                    proved their address and when, and
--                                    throwing that away to undo a
--                                    behaviour change would be the
--                                    wrong trade by a long way. Nothing
--                                    reads the column once this has
--                                    run, so it sits harmlessly until
--                                    file 19 is applied again.
--
--   lms_email_verify_state           The first run mark. If it were
--                                    dropped, re-applying file 19 after
--                                    Confirm email was turned off would
--                                    backfill every account created in
--                                    between as proven. Keeping it is
--                                    what makes a second apply safe.
--
-- What goes: the two functions, the code table, and the five gates,
-- which are written back out below exactly as files 05, 10 and 17 left
-- them.

begin;

do $$
begin
  if coalesce(current_setting('lms.undo_19_force', true), '') <> 'yes, I mean it' then
    raise exception
      'This undo restores a gate that trusts a typed address. While Supabase Confirm email '
      'is off that means anybody signing up with a facilitator or certified person address '
      'gets their access. If you mean it, paste this line at the top of this file, above '
      'the begin, and run the whole thing in one go, ending that line with a semicolon: '
      'select set_config(''lms.undo_19_force'', ''yes, I mean it'', false)'
      using errcode = '42501';
  end if;
  raise notice 'Undo 19: going ahead. Turn Confirm email back ON in Supabase if you have not.';
end $$;

drop function if exists lms_request_email_check();
drop function if exists lms_confirm_email_check(text);
drop table if exists lms_email_checks;

-- The five gates, back as files 05, 10 and 17 wrote them.

create or replace function lms_handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_part uuid;
begin
  insert into lms_profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  if new.email_confirmed_at is not null then
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
  select email, email_confirmed_at into v_email, v_ends
    from auth.users where id = v_uid;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
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
    return query select false, 'That enrolment is not active.'; return;
  end if;

  insert into lms_entitlements (user_id, course_id, source, expires_at)
  values (v_uid, null, 'roster',
          case when v_ends is null then null else (v_ends + 1)::timestamptz end)
  on conflict do nothing;

  return query select true, 'Your bootcamp access is open. Every course is available to you.';
end $$;

-- Dropped first for the same reason file 19 drops it: the shape is
-- going back from five columns to four, and "create or replace" cannot
-- change a return type.
drop function if exists lms_sync_my_access();

create or replace function lms_sync_my_access()
returns table (role text, bootcamp boolean, changed boolean, message text)
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

  select u.email, u.email_confirmed_at into v_email, v_confirmed
    from auth.users u where u.id = v_uid;

  select p.role into v_role from lms_profiles p where p.id = v_uid;
  v_role := coalesce(v_role, 'learner'::lms_role);

  -- An unproven address grants nothing. This is the whole reason email
  -- confirmation is switched on.
  if v_confirmed is null then
    return query select v_role::text, false, false,
      'Confirm your email address to unlock your access.';
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
    coalesce(nullif(v_msg, ''), 'Nothing has changed since you were last here.');
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

  -- if they already have a confirmed account, apply it now rather than
  -- leaving them to sign out and back in
  select id into v_uid from auth.users
   where lower(btrim(email)) = v_norm and email_confirmed_at is not null;
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
      -- LEARNERS, CONFIRMED, not every row in auth.users. As written it
      -- counted staff and unconfirmed sign ups too, so on a database
      -- with two administrators and nobody else it said 2 new learners.
      -- An unconfirmed account is also not a learner yet: it is an
      -- address somebody typed, and the nightly prune may well delete it.
      'new_learners', (select count(*)
                         from auth.users u
                         join lms_profiles p on p.id = u.id
                        where u.created_at >= current_date - 7
                          and u.email_confirmed_at is not null
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

do $$
declare v_left integer;
begin
  select count(*) into v_left
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('lms_request_email_check', 'lms_confirm_email_check');
  raise notice 'Undo 19: % of the two check functions remain (0 is right). The column '
               'email_verified_at and its timestamps are kept on purpose.', v_left;
end $$;

commit;
