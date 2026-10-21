-- GENERATED. Do not edit.
--
-- Made by scripts/lms/make-editor-sql.mjs from the file named below.
-- The comments between the function bodies are removed. Every body is
-- byte for byte what that file holds, and a test checks it.
--
-- Paste THIS one into the Supabase SQL Editor.
--
-- source: database/lms/20_undo.sql
begin;

do $$
begin
  if coalesce(current_setting('lms.undo_20_force', true), '') <> 'yes, I mean it' then
    raise exception
      'This undo stops anything creating a lesson check, which means no course built in the '
      'control room can be published. If you mean it, paste this line at the top of this file, '
      'above the begin, and run the whole thing in one go, ending that line with a semicolon: '
      'select set_config(''lms.undo_20_force'', ''yes, I mean it'', false)'
      using errcode = '42501';
  end if;
  raise notice 'Undo 20: going ahead. New video lessons will have no check from now on.';
end $$;

create or replace function lms_save_lesson(
  p_lesson uuid default null,
  p_module uuid default null,
  p_title text default null,
  p_summary text default null,
  p_type lms_lesson_type default null,
  p_video_ref text default null,
  p_duration_seconds integer default null,
  p_chapters_text text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_lesson; v_course uuid; v_pos integer; v_ref text;
begin
  select m.course_id into v_course from lms_modules m
   where m.id = coalesce(p_module, (select l.module_id from lms_lessons l where l.id = p_lesson));
  if not lms_may_edit_course(v_course) then
    raise exception 'That course is not yours.' using errcode = '42501';
  end if;

  -- A YouTube address, in any of the forms somebody might paste, down to
  -- the eleven character id. Anything that is already just an id is left
  -- alone.
  v_ref := nullif(btrim(coalesce(p_video_ref, '')), '');
  if v_ref is not null then
    v_ref := coalesce(
      substring(v_ref from 'youtu\.be/([A-Za-z0-9_-]{6,})'),
      substring(v_ref from '[?&]v=([A-Za-z0-9_-]{6,})'),
      substring(v_ref from 'embed/([A-Za-z0-9_-]{6,})'),
      v_ref);
    if v_ref !~ '^[A-Za-z0-9_-]{6,}$' then
      raise exception '% is not a YouTube link or id.', btrim(p_video_ref) using errcode = '22023';
    end if;
  end if;

  if v_id is null then
    select coalesce(max(l.position), 0) + 1 into v_pos from lms_lessons l where l.module_id = p_module;
    insert into lms_lessons (module_id, title, summary, type, position,
                             video_provider, video_ref, duration_seconds, coverage_percent)
    values (p_module, coalesce(btrim(p_title), 'Untitled lesson'), coalesce(p_summary, ''),
            coalesce(p_type, 'video'), v_pos,
            case when v_ref is null then null else 'youtube' end, v_ref,
            p_duration_seconds, 100)
    returning id into v_id;
  else
    update lms_lessons
       set title = coalesce(nullif(btrim(p_title), ''), title),
           summary = coalesce(p_summary, summary),
           type = coalesce(p_type, type),
           video_provider = case when v_ref is null then video_provider else 'youtube' end,
           video_ref = coalesce(v_ref, video_ref),
           duration_seconds = coalesce(p_duration_seconds, duration_seconds)
     where id = v_id;
  end if;

  -- The chapters, through file 16's parser, which refuses a bad list
  -- with a message naming the line.
  if p_chapters_text is not null then
    perform lms_set_lesson_chapters(v_id, p_chapters_text);
  end if;

  return v_id;
end $$;

create or replace function lms_create_quiz(p_lesson uuid, p_module uuid, p_title text default '')
returns uuid
language plpgsql security definer set search_path = public as $body$
declare v_id uuid;
begin
  if not lms_can_edit() then raise exception 'Only staff can add questions.'; end if;
  if (p_lesson is null) = (p_module is null) then
    raise exception 'A set of questions belongs to either a lesson or a module, not both.';
  end if;
  insert into lms_quizzes (lesson_id, module_id, title, pass_percent, max_attempts,
                           retake_after_minutes, shuffle, status)
  values (p_lesson, p_module,
          coalesce(nullif(btrim(p_title),''), case when p_lesson is not null
                   then 'Check what you remember' else 'Module quiz' end),
          case when p_lesson is not null then 100 else 70 end,
          case when p_lesson is not null then 20  else 3  end,
          0, true, 'draft')
  returning id into v_id;
  return v_id;
end $body$;

grant execute on function lms_create_quiz(uuid, uuid, text) to authenticated;

do $$
declare v_without integer;
begin
  select count(*) into v_without
    from lms_lessons l
    join lms_modules m on m.id = l.module_id
    join lms_courses c on c.id = m.course_id
   where l.type = 'video' and c.status <> 'archived'
     and not exists (select 1 from lms_quizzes q where q.lesson_id = l.id);
  raise notice 'Undo 20: done. Existing checks are kept, so % video lesson(s) are without one. '
               'Any lesson made from here will be.', v_without;
end $$;

commit;
