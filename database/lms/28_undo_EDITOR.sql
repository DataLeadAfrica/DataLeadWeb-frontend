-- GENERATED. Do not edit.
--
-- Made by scripts/lms/make-editor-sql.mjs from the file named below.
-- The comments between the function bodies are removed. Every body is
-- byte for byte what that file holds, and a test checks it.
--
-- Paste THIS one into the Supabase SQL Editor.
--
-- source: database/lms/28_undo.sql
do $$
begin
  if coalesce(current_setting('lms.undo_28_force', true), '') <> 'yes, I mean it' then
    raise exception
      'This undo removes attendance taking: the scanner, the access code, the day form '
      'and the first sign-in screen all stop working, and no attendance can be recorded '
      'while it is undone. It will NOT delete anybody''s attendance records. If you mean '
      'it, paste this line at the top of this file and run the whole thing in one go, '
      'ending that line with a semicolon: '
      'select set_config(''lms.undo_28_force'', ''yes, I mean it'', false)';
  end if;
  raise notice 'Undo 28: going ahead. No attendance record will be deleted.';
end $$;

drop function if exists lms_attendance_correct(uuid, uuid, text);
drop function if exists lms_attendance_cohorts();
drop function if exists lms_attendance_register(text, date, date);
drop function if exists lms_attendance_live(uuid);
drop function if exists lms_attendance_submit(text, integer, text, text);
drop function if exists lms_attendance_my_day();
drop function if exists lms_attendance_use_code(text);
drop function if exists lms_attendance_scan(uuid, text, text);
drop function if exists lms_attendance_day(uuid);
drop function if exists lms_attendance_close_day(uuid);
drop function if exists lms_attendance_reveal_code(uuid, integer);
drop function if exists lms_attendance_open_day(text, text, text, integer);
drop function if exists lms_save_my_setup(text, text, text, text, text);
drop function if exists lms_my_setup();
drop function if exists lms_participant_cards_for_print(text);
drop function if exists lms_card_mark_lost(uuid);
drop function if exists lms_issue_participant_card(uuid);
drop function if exists lms_unambiguous_code(integer);
drop function if exists lms_wat_today();

do $$ begin
  raise notice 'Step 1: the nineteen functions are gone, so nothing can record attendance.';
end $$;

do $$
declare
  v_t      text;
  v_n      bigint;
  v_kept   text[] := '{}';
  v_gone   text[] := '{}';
  v_rows   bigint := 0;
begin
  foreach v_t in array array[
    'lms_attendance_responses', 'lms_attendance_checkins',
    'lms_attendance_days', 'lms_learner_setup', 'lms_participant_cards'
  ] loop
    if to_regclass('public.' || v_t) is null then
      continue;
    end if;

    execute format('select count(*) from %I', v_t) into v_n;

    if v_n > 0 then
      v_kept := v_kept || (v_t || ' (' || v_n || ')')::text;
      v_rows := v_rows + v_n;
    else
      -- RESTRICT rather than CASCADE, on purpose. If something outside
      -- file 28 has come to depend on one of these, the drop should stop
      -- and say so rather than quietly take that other thing with it.
      execute format('drop table %I', v_t);
      v_gone := v_gone || v_t::text;
    end if;
  end loop;

  if array_length(v_gone, 1) is not null then
    raise notice 'Step 2: dropped, because they held nothing: %',
      array_to_string(v_gone, ', ');
  end if;

  if array_length(v_kept, 1) is not null then
    raise notice '--------------------------------------------------------';
    raise notice 'Step 2: KEPT, because they hold records: %',
      array_to_string(v_kept, ', ');
    raise notice '  % row(s) were not destroyed. Nothing can write them now', v_rows;
    raise notice '  and nothing can read the two holding a secret, so they';
    raise notice '  are inert rather than live.';
    raise notice '  If you really do want the records gone, take a backup';
    raise notice '  first and then drop them by hand, one at a time.';
    raise notice '--------------------------------------------------------';
  end if;
end $$;

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
     and (p.proname like 'lms_attendance%'
          or p.proname in ('lms_wat_today', 'lms_unambiguous_code',
            'lms_issue_participant_card', 'lms_card_mark_lost',
            'lms_participant_cards_for_print', 'lms_my_setup',
            'lms_save_my_setup'));
  raise notice '--------------------------------------------------------';
  raise notice 'File 28 is undone.';
  raise notice '  Functions remaining: % (should be 0).', v_f;
  raise notice '  Tables remaining: % (0 if none held records).', v_t;
  raise notice '  No attendance record was deleted by this file.';
  raise notice '  TRUNCATE was NOT handed back on the badge table, on';
  raise notice '  purpose: restoring it would reopen a hole.';
  raise notice '  The front end screens ride in the same package and are';
  raise notice '  not removed by this file. They will show an error rather';
  raise notice '  than a blank page, which is the better of the two.';
  raise notice '  Run 28_verify_EDITOR.sql to see the result.';
  raise notice '--------------------------------------------------------';
end $$;
