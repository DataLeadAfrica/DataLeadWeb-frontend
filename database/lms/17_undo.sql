-- =====================================================================
-- 17_undo.sql
--
-- Takes file 17 off and puts the database back as file 16 left it.
--
-- IT REFUSES IF ANYBODY HAS USED THE CONTROL ROOM. If a course has been
-- created, sent for review or published through it, or any access has
-- been given or removed, this stops and changes nothing, because
-- undoing would throw away work somebody did. If you genuinely want
-- that, run this first, in the same editor session:
--
--   select set_config('lms.undo_17_force', 'yes, I mean it', true)
--
-- THREE FUNCTIONS ARE WRITTEN BACK OUT IN FULL rather than dropped,
-- because other things still call them and a dropped function leaves
-- the site broken in a way nobody connects to the undo. That was the
-- academy-6a review's third finding and it is not repeated here:
--
--   lms_publish_course   file 05's, including the free entitlement
--                        sweep, which is the part it would be easiest
--                        to lose and hardest to notice losing
--   lms_unpublish_course file 05's one argument version
--   lms_guard_lesson     file 10's, which refuses EVERY change to a
--                        lesson of a live course. File 17 loosened it
--                        to let words through, and this puts the strict
--                        one back.
--
-- lms_course_blockers is not in that list because file 17 never touched
-- it. That was the point of calling the new one lms_publish_checks.
--
-- NO SEMICOLON INSIDE A STRING LITERAL. See the note at the top of
-- 17_verify.sql.
-- =====================================================================

begin;

do $$
declare v_used integer := 0;
begin
  select count(*) into v_used from lms_admin_actions
   where action in ('course_created','course_published','course_sent_for_review',
                    'access_given','access_removed','exam_wait_lifted',
                    'course_price_changed','popup_started','questions_pasted');
  if v_used > 0 and coalesce(current_setting('lms.undo_17_force', true), '') <> 'yes, I mean it' then
    raise exception
      E'The control room has been used: % things have happened through it.\n'
      'Undoing would leave those without the functions that made them.\n'
      'If you mean it, run this first, in the same session:\n'
      '  select set_config(''lms.undo_17_force'', ''yes, I mean it'', true)',
      v_used;
  end if;
end $$;

-- ----- the functions file 17 added, dropped
drop function if exists lms_studio_overview();
drop function if exists lms_studio_staff();
drop function if exists lms_studio_health();
drop function if exists lms_studio_biggest_tables(integer);
drop function if exists lms_studio_certificates(text, integer, integer);
drop function if exists lms_studio_certificate_counts();
drop function if exists lms_activity_log(text, integer, integer);
drop function if exists lms_areas_overview();
drop function if exists lms_staff_learners(text, text, text, integer, integer);
drop function if exists lms_report_active_days(integer);
drop function if exists lms_report_funnel(uuid);
drop function if exists lms_report_lesson_drop(uuid);
drop function if exists lms_report_hard_questions(uuid, integer);
drop function if exists lms_report_who(text);
drop function if exists lms_log_export(text, integer);
drop function if exists lms_paste_questions(uuid, jsonb);
drop function if exists lms_publish_checks(uuid);
drop function if exists lms_publish_lesson_check(uuid);
drop function if exists lms_save_question(uuid, uuid, text, text, jsonb, uuid, integer);
drop function if exists lms_retire_question(uuid);
drop function if exists lms_question_is_locked(uuid);
drop function if exists lms_clock_to_seconds(text);
drop function if exists lms_create_course(text, text, text, lms_level);
drop function if exists lms_course_state(uuid);
drop function if exists lms_may_edit_course(uuid);
drop function if exists lms_send_for_review(uuid, text);
drop function if exists lms_send_back(uuid, text);
drop function if exists lms_archive_course(uuid);
drop function if exists lms_set_course_details(uuid, text, text, lms_level, text, text[], text[], text[], jsonb, text);
drop function if exists lms_set_course_price(uuid, integer, boolean);
drop function if exists lms_set_course_areas(uuid, text[]);
drop function if exists lms_set_course_next(uuid, uuid[]);
drop function if exists lms_lift_exam_wait(uuid, uuid);
drop function if exists lms_give_access(uuid, uuid, text, lms_grant_source, timestamptz);
drop function if exists lms_remove_access(uuid, uuid, text);
drop function if exists lms_create_path(text, text);
drop function if exists lms_set_path_courses(uuid, uuid[]);
drop function if exists lms_set_path_details(uuid, text, text, text);
drop function if exists lms_add_area_tool(text, text);
drop function if exists lms_remove_area_tool(uuid);
-- Fourteen arguments, not thirteen. The how_often one was added and
-- this line was not, so the drop matched nothing and the function
-- survived every undo.
drop function if exists lms_save_popup(uuid, text, text, text, uuid, uuid, text, text, text, text, text, text, timestamptz, timestamptz);
drop function if exists lms_start_popup(uuid);
drop function if exists lms_stop_popup(uuid);
drop function if exists lms_set_site_settings(text, text, boolean, text, text, text, integer);
drop function if exists lms_set_staff_role(uuid, lms_role);

-- THE BUILDER'S SIX, which this file forgot entirely. They were added
-- in step 3b, after the first draft of this undo was written, and
-- nobody went back. An undo that leaves functions behind is the same
-- class of fault as one that drops too much: the database is left in a
-- state that is neither before nor after, and the next person to run
-- file 17 gets "cannot change return type" from a function they did not
-- know was still there.
--
-- tests/control-room.test.mjs now reads every create in file 17 and
-- fails if this file does not drop each one, so the list cannot drift
-- again. It is derived, not typed.
drop function if exists lms_studio_course(uuid);
drop function if exists lms_studio_questions(uuid);
drop function if exists lms_save_lesson(uuid, uuid, text, text, lms_lesson_type, text, integer, text);
drop function if exists lms_add_module(uuid, text);
drop function if exists lms_remove_lesson(uuid);
drop function if exists lms_reorder_lessons(uuid, uuid[]);

-- the two argument unpublish goes, and the one argument one is restored below
drop function if exists lms_unpublish_course(uuid, text);

-- ----- the triggers file 17 added
drop trigger  if exists lms_admin_actions_no_change on lms_admin_actions;
drop function if exists lms_log_is_append_only();
drop trigger  if exists lms_options_answered_guard on lms_options;
drop function if exists lms_guard_answered_question();

-- lms_log_action goes LAST of the function drops, because everything
-- above called it.
drop function if exists lms_log_action(text, text, uuid, jsonb);

-- ----- FILE 05'S lms_publish_course, WRITTEN BACK OUT IN FULL
--
-- The free entitlement sweep inside it is the part that matters. Drop
-- this and publishing a free course stops opening it to everybody who
-- already has an account, and nothing anywhere says so.
create or replace function lms_publish_course(p_course uuid)
returns table (published boolean, message text)
language plpgsql security definer set search_path = public as $$
declare v_bad integer;
begin
  if not lms_is_admin() then
    return query select false, 'Only an administrator can publish a course.'; return;
  end if;
  select count(*) into v_bad from lms_course_blockers(p_course) where not ok;
  if v_bad > 0 then
    return query select false, 'This course is not ready yet. '||v_bad||' thing(s) still missing.'; return;
  end if;
  update lms_courses
     set status = 'published', published_at = coalesce(published_at, now())
   where id = p_course;

  -- If it is free, open it to everyone who already has an account.
  -- Without this, only people who sign up AFTER today would get it.
  insert into lms_entitlements (user_id, course_id, source)
  select p.id, p_course, 'free'
    from lms_profiles p
   where exists (select 1 from lms_courses c where c.id = p_course and c.price_kobo = 0)
     and not exists (select 1 from lms_entitlements e
                      where e.user_id = p.id and e.course_id = p_course and e.status = 'active');

  insert into lms_admin_actions (actor_id, action, subject_type, subject_id)
  values (auth.uid(), 'publish_course', 'course', p_course);
  return query select true, 'Published.';
end $$;

-- ----- FILE 05'S lms_unpublish_course, WRITTEN BACK OUT IN FULL
create or replace function lms_unpublish_course(p_course uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not lms_is_admin() then return false; end if;
  update lms_courses set status = 'draft' where id = p_course;
  insert into lms_admin_actions (actor_id, action, subject_type, subject_id)
  values (auth.uid(), 'unpublish_course', 'course', p_course);
  return true;   -- entitlements are untouched: nobody loses what they hold
end $$;

-- ----- FILE 10'S lms_guard_lesson, WRITTEN BACK OUT IN FULL
--
-- The strict one: no change at all to a lesson of a live course, not
-- even a typo. File 10's trigger already points at this name, so there
-- is nothing to re-create.
create or replace function lms_guard_lesson() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_module uuid := case when tg_op = 'DELETE' then old.module_id else new.module_id end;
begin
  if auth.uid() is null or lms_is_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if lms_course_status_of_module(v_module) = 'published' then
    raise exception 'That course is live. Ask the administrator to unpublish it before changing its lessons.';
  end if;
  if tg_op = 'UPDATE' and old.module_id is distinct from new.module_id
     and lms_course_status_of_module(old.module_id) = 'published' then
    raise exception 'That course is live. Ask the administrator to unpublish it first.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- ----- the columns file 17 added
--
-- Dropped, because nothing outside file 17 reads them. cover_url goes
-- with them, so any course carrying an uploaded cover falls back to the
-- drawn one, which is what it had before and still looks right.
alter table lms_courses
  drop column if exists sent_for_review_at,
  drop column if exists sent_for_review_by,
  drop column if exists review_note,
  drop column if exists cover_url;

do $$ begin
  raise notice 'Undo: file 17 is off. File 05 publishing and file 10 lesson guard are back as they were.';
  raise notice 'Undo: lms_course_blockers was never touched, so file 11 is unaffected.';
  raise notice 'Undo: the activity log keeps every line it already holds. Nothing in lms_admin_actions is removed.';
end $$;

commit;
