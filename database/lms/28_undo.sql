-- Undoes file 28. REFUSES unless you say you mean it, and then REFUSES
-- AGAIN to throw away anybody's attendance.
--
-- PASTE 28_undo_EDITOR.sql, NOT THIS ONE.
--
-- WHY THIS UNDO IS NOT LIKE THE OTHERS. Files 17 to 27 moved guards and
-- rewrote functions, so undoing them put a rule back and touched nobody's
-- records. File 28 makes five tables, and attendance is a record of
-- something that actually happened to a person on a particular day. The
-- standing rule is that nothing a learner has touched is removed
-- outright, and that rule does not stop applying because somebody is
-- running an undo.
--
-- SO THIS FILE WILL NOT DROP A TABLE THAT HOLDS ANYTHING. It removes the
-- twenty-three functions, which is what makes the feature stop working, and
-- then looks at the five tables. Any that are empty are dropped. Any
-- that hold rows are LEFT EXACTLY WHERE THEY ARE, and this file says so
-- and says how many rows it is refusing to destroy. The tables are inert
-- once the functions are gone: nothing can write them, and no browser
-- role could ever read the two holding a secret.
--
-- If you genuinely want the records gone as well, that is a decision
-- somebody should make deliberately with a backup in hand, not a side
-- effect of pasting an undo. This file will tell you the one statement
-- to run and will not run it for you.
--
-- WHAT IT DELIBERATELY DOES NOT PUT BACK. File 28 step 13 took TRUNCATE
-- away on lms_module_badges, which file 24 had left granted to the
-- browser roles. That is not restored. Handing back the ability to empty
-- the badge table in one statement would be reopening a hole, and no
-- part of the site has ever used it.

-- THE WHOLE FILE IS ONE TRANSACTION, AND THE GUARD IS INSIDE IT. That
-- is not tidiness, it is the guard working at all.
--
-- The guard below raises when the flag is not set. A raise stops the
-- script only in a client that stops on an error. The Supabase editor
-- does. psql, run plainly, does not: it reports the error, carries on
-- to the next statement, and drops everything anyway. The refusal
-- message is printed and ignored, which is the worst of both.
--
-- Inside a transaction there is nothing to ignore. The raise aborts it,
-- every statement after it is refused by Postgres itself, and the
-- commit at the end becomes a rollback. So an undo nobody meant to run
-- changes nothing, in any client.
--
-- This was found by running the undo without the flag and then looking
-- at whether the functions were still there, rather than by reading the
-- error message and believing it.
begin;

do $$
begin
  if coalesce(current_setting('lms.undo_28_force', true), '') <> 'yes, I mean it' then
    raise exception
      'This undo removes attendance taking: the scanner, the access code, the day form '
      'and the first sign-in screen all stop working, and no attendance can be recorded '
      'while it is undone. It will NOT delete anybody''s attendance records. If you mean '
      'it, paste this line at the very top of this file, above the begin, and run the '
      'whole thing in one go, ending that line with a semicolon: '
      'select set_config(''lms.undo_28_force'', ''yes, I mean it'', false)';
  end if;
  raise notice 'Undo 28: going ahead. No attendance record will be deleted.';
end $$;

-- -------------------------------------------------------------- step 1
-- The twenty-three functions. Dropped with their argument lists,
-- because a bare name is ambiguous once a database has been through a
-- few files.
drop function if exists lms_attendance_correct(uuid, uuid, text);
drop function if exists lms_attendance_cohorts();
drop function if exists lms_attendance_register(text, date, date);
drop function if exists lms_attendance_days_list(text, date, date);
drop function if exists lms_attendance_roster(text);
drop function if exists lms_attendance_live(uuid);
drop function if exists lms_attendance_submit(text, integer, text, text);
drop function if exists lms_attendance_my_day();
drop function if exists lms_attendance_use_code(text);
drop function if exists lms_attendance_scan(uuid, text, text);
drop function if exists lms_attendance_today(text);
drop function if exists lms_attendance_day(uuid);
drop function if exists lms_attendance_close_day(uuid);
drop function if exists lms_attendance_reveal_code(uuid, integer);
drop function if exists lms_attendance_open_day(text, text, text, integer);
drop function if exists lms_save_my_setup(text, text, text, text, text);
drop function if exists lms_my_setup();
drop function if exists lms_participant_cards_for_print(text);
drop function if exists lms_issue_cards_for_cohort(text);
drop function if exists lms_card_mark_lost(uuid);
drop function if exists lms_issue_participant_card(uuid);
drop function if exists lms_unambiguous_code(integer);
drop function if exists lms_wat_today();

do $$ begin
  raise notice 'Step 1: the twenty-three functions are gone, so nothing can record attendance.';
end $$;

-- -------------------------------------------------------------- step 2
-- The five tables, but only the empty ones.
--
-- Counted and dropped through EXECUTE, because a table named in ordinary
-- SQL is resolved when the statement is PLANNED, so this block would
-- raise on a database where file 28 never ran rather than doing nothing,
-- which is what an undo should do when there is nothing to undo.
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

-- -------------------------------------------------------------- step 3
-- What the database looks like now.
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
            'lms_issue_cards_for_cohort',
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

-- Nothing above has actually happened until this line runs. If the
-- guard refused, this becomes a rollback and the database is untouched.
commit;
