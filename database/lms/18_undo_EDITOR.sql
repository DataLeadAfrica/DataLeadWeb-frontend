-- GENERATED. Do not edit.
--
-- Made by scripts/lms/make-editor-sql.mjs from the file named below.
-- The comments between the function bodies are removed. Every body is
-- byte for byte what that file holds, and a test checks it.
--
-- Paste THIS one into the Supabase SQL Editor.
--
-- source: database/lms/18_undo.sql
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
