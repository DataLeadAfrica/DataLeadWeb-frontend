-- Puts the database back as file 17 left it.
--
-- READ THIS BEFORE RUNNING IT. The undo restores a known security
-- fault: it hands back table-wide UPDATE on lms_profiles, which is what
-- let a learner set their own participant_id and claim an unlinked
-- certification record. File 05 says in its own comment that linking is
-- only ever done on a proven address, and the table-wide grant is what
-- made that untrue.
--
-- So this file refuses to run unless you say you mean it. PASTE THIS
-- LINE AT THE VERY TOP OF THIS FILE, above the "begin", and then run
-- the whole thing in one go:
--
--   select set_config('lms.undo_18_force', 'yes, I mean it', false)
--
-- End that line with a semicolon, and the rest of this file follows it.
-- The semicolon is described rather than shown because no file meant for
-- the SQL Editor carries one inside a comment or a string, which is a
-- rule that costs nothing and might be right.
--
-- One paste, one run, and the "false" matters. A setting made with
-- "true" lasts only to the end of the transaction it was made in, and
-- the undo opens a transaction of its own, so a "true" set beforehand
-- is already gone by the time the check runs. A setting made with
-- "false" lasts for the session, which is what carries it across.
--
-- There is no state to lose either way. File 18 adds one function and
-- narrows one grant, and nothing stores anything on the strength of it,
-- so the only reason to run this is to get back to exactly what file 17
-- left behind.
--
-- A name somebody has already saved is NOT removed. It is in
-- lms_profiles.full_name, where it would have been if it had been typed
-- at sign up, and deleting a person's own name to undo a privilege
-- change would be the wrong trade by a long way.

begin;

do $$
begin
  if coalesce(current_setting('lms.undo_18_force', true), '') <> 'yes, I mean it' then
    raise exception
      'This undo restores table-wide UPDATE on lms_profiles, which let a learner claim '
      'somebody else certification record. If you mean it, paste this line at the top of '
      'this file, above the begin, and run the whole thing in one go, ending that line '
      'with a semicolon: '
      'select set_config(''lms.undo_18_force'', ''yes, I mean it'', false)'
      using errcode = '42501';
  end if;
  raise notice 'Undo 18: going ahead, and putting back a grant that is known to be too wide.';
end $$;

drop function if exists lms_set_my_name(text);

-- Back to what file 06 line 184 left: table-wide UPDATE, no column
-- grants. The column grants are dropped first, or they would sit
-- alongside the table-wide one and the verify would read differently
-- from a fresh build of files 01 to 17.
revoke update (full_name, phone) on lms_profiles from authenticated;
grant update on lms_profiles to authenticated;

do $$
declare v_cols text;
begin
  select coalesce(string_agg(column_name, ', ' order by column_name), 'none') into v_cols
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'lms_profiles'
     and grantee = 'authenticated' and privilege_type = 'UPDATE';
  raise notice 'Undo 18: lms_set_my_name dropped. Column grants now: %. Table-wide UPDATE: %.',
    v_cols,
    case when has_table_privilege('authenticated', 'lms_profiles', 'UPDATE')
         then 'held again' else 'still not held' end;
end $$;

commit;
