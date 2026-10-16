-- GENERATED. Do not edit.
--
-- Made by scripts/lms/make-editor-sql.mjs from the file named below.
-- The comments between the function bodies are removed. Every body is
-- byte for byte what that file holds, and a test checks it.
--
-- Paste THIS one into the Supabase SQL Editor.
--
-- source: database/lms/17_undo.sql
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

drop function if exists lms_save_popup(uuid, text, text, text, uuid, uuid, text, text, text, text, text, text, timestamptz, timestamptz);
drop function if exists lms_start_popup(uuid);
drop function if exists lms_stop_popup(uuid);
drop function if exists lms_set_site_settings(text, text, boolean, text, text, text, integer);
drop function if exists lms_set_staff_role(uuid, lms_role);

drop function if exists lms_studio_course(uuid);
drop function if exists lms_studio_questions(uuid);
drop function if exists lms_save_lesson(uuid, uuid, text, text, lms_lesson_type, text, integer, text);
drop function if exists lms_add_module(uuid, text);
drop function if exists lms_remove_lesson(uuid);
drop function if exists lms_reorder_lessons(uuid, uuid[]);

drop function if exists lms_unpublish_course(uuid, text);

drop trigger  if exists lms_admin_actions_no_change on lms_admin_actions;
drop function if exists lms_log_is_append_only();
drop trigger  if exists lms_options_answered_guard on lms_options;
drop function if exists lms_guard_answered_question();

drop function if exists lms_log_action(text, text, uuid, jsonb);

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
