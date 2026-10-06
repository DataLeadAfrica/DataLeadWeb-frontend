-- =====================================================================
-- 010  TWO KINDS OF QUESTIONS
--
-- A LESSON CHECK is the short set after a lesson. It is there to make
-- the lesson stick, not to judge anybody, so it reports "3 of 4
-- correct" and never a score or a percentage. You may retry freely.
--
-- A MODULE QUIZ is the real assessment at the end of a module. It has
-- a pass mark, a limited number of attempts and an optional wait
-- between them.
--
-- Which one a quiz is follows from what it hangs off: a lesson or a
-- module. There is no third state to get wrong.
-- =====================================================================

create or replace function lms_quiz_kind(p_quiz uuid)
returns text
language sql stable security definer set search_path = public as $$
  select case when lesson_id is not null then 'check' else 'quiz' end
    from lms_quizzes where id = p_quiz
$$;

-- Sensible settings for each kind, so nobody has to think about pass
-- marks when adding three questions to a lesson.
create or replace function lms_create_quiz(p_lesson uuid, p_module uuid, p_title text default '')
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not lms_is_admin() then raise exception 'Only an administrator can add questions.'; end if;
  if (p_lesson is null) = (p_module is null) then
    raise exception 'A set of questions belongs to either a lesson or a module, not both.';
  end if;

  insert into lms_quizzes (lesson_id, module_id, title, pass_percent, max_attempts,
                           retake_after_minutes, shuffle, status)
  values (p_lesson, p_module,
          coalesce(nullif(btrim(p_title),''), case when p_lesson is not null
                   then 'Check what you remember' else 'Module quiz' end),
          case when p_lesson is not null then 100 else 70 end,   -- a check is retried until right
          case when p_lesson is not null then 20  else 3  end,
          0,
          true,
          'draft')
  returning id into v_id;
  return v_id;
end $$;

-- Replaces the marking function so a check reports counts, not a score.
drop function if exists lms_submit_quiz(uuid, jsonb);
create or replace function lms_submit_quiz(p_attempt uuid, p_answers jsonb)
returns table (kind text, correct_count integer, question_count integer,
               score integer, max_score integer, percent numeric,
               passed boolean, pass_mark integer, feedback text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_a lms_quiz_attempts%rowtype; v_q lms_quizzes%rowtype;
  v_score integer := 0; v_max integer := 0; v_right integer := 0; v_n integer := 0;
  v_pct numeric; v_pass boolean; v_kind text; v_msg text;
  r record; v_given jsonb; v_ok boolean;
begin
  if v_uid is null then return; end if;
  select * into v_a from lms_quiz_attempts
   where id = p_attempt and user_id = v_uid and status = 'in_progress';
  if not found then return; end if;
  select * into v_q from lms_quizzes where id = v_a.quiz_id;
  v_kind := case when v_q.lesson_id is not null then 'check' else 'quiz' end;

  for r in select q.id, q.type, q.marks from lms_questions q
            where q.id = any(v_a.served_question_ids)
  loop
    v_n := v_n + 1;
    v_max := v_max + r.marks;
    v_given := p_answers -> r.id::text;
    v_ok := false;

    if r.type = 'short_text' then
      v_ok := exists (select 1 from lms_options o
        where o.question_id = r.id and o.is_correct
          and lower(btrim(o.label)) = lower(btrim(coalesce(v_given #>> '{}', ''))));
    elsif r.type = 'multi' then
      -- A multi answer should arrive as a list. If a client sends a bare
      -- value instead, treat it as a list of one rather than crashing
      -- the whole submission.
      v_ok := (select coalesce(
        (select array_agg(o.id::text order by o.id::text)
           from lms_options o where o.question_id = r.id and o.is_correct)
        = (select array_agg(x order by x) from jsonb_array_elements_text(
             case when jsonb_typeof(v_given) = 'array' then v_given
                  when v_given is null then '[]'::jsonb
                  else jsonb_build_array(v_given #>> '{}') end) x), false));
    else
      v_ok := exists (select 1 from lms_options o
        where o.question_id = r.id and o.is_correct
          and o.id::text = coalesce(v_given #>> '{}', ''));
    end if;

    if v_ok then v_score := v_score + r.marks; v_right := v_right + 1; end if;
  end loop;

  v_pct  := case when v_max = 0 then 0 else round(100.0 * v_score / v_max, 2) end;
  v_pass := v_pct >= v_q.pass_percent;

  -- A check speaks in counts. A quiz speaks in marks.
  if v_kind = 'check' then
    v_msg := case
      when v_right = v_n then 'All ' || v_n || ' correct. On you go.'
      else v_right || ' of ' || v_n || ' correct. Have another look at the ones you missed.'
    end;
  else
    v_msg := case
      when v_pass then 'Passed with ' || v_pct || ' percent.'
      else 'Not this time. You scored ' || v_pct || ' percent and need ' || v_q.pass_percent || '.'
    end;
  end if;

  update lms_quiz_attempts
     set answers = coalesce(p_answers, '{}'::jsonb),
         score = v_score, max_score = v_max, percent = v_pct, passed = v_pass,
         status = (case when v_pass then 'passed' else 'failed' end)::lms_attempt_status,
         submitted_at = now()
   where id = p_attempt;

  return query select v_kind, v_right, v_n, v_score, v_max, v_pct, v_pass,
                      v_q.pass_percent, v_msg;
end $$;

-- Tells the learner which ones they got wrong, WITHOUT telling them the
-- right answer. They have to go back to the lesson, which is the point.
create or replace function lms_attempt_marks(p_attempt uuid)
returns table (question_id uuid, prompt text, was_right boolean, explanation text)
language plpgsql security definer set search_path = public as $$
declare v_a lms_quiz_attempts%rowtype; v_given jsonb; r record; v_ok boolean;
begin
  select * into v_a from lms_quiz_attempts where id = p_attempt and user_id = auth.uid();
  if not found or v_a.submitted_at is null then return; end if;

  for r in select q.id, q.prompt, q.type, q.explanation from lms_questions q
            where q.id = any(v_a.served_question_ids) order by q.position
  loop
    v_given := v_a.answers -> r.id::text;
    if r.type = 'short_text' then
      v_ok := exists (select 1 from lms_options o where o.question_id=r.id and o.is_correct
        and lower(btrim(o.label)) = lower(btrim(coalesce(v_given #>> '{}',''))));
    elsif r.type = 'multi' then
      v_ok := (select coalesce((select array_agg(o.id::text order by o.id::text)
          from lms_options o where o.question_id=r.id and o.is_correct)
        = (select array_agg(x order by x) from jsonb_array_elements_text(
             case when jsonb_typeof(v_given) = 'array' then v_given
                  when v_given is null then '[]'::jsonb
                  else jsonb_build_array(v_given #>> '{}') end) x), false));
    else
      v_ok := exists (select 1 from lms_options o where o.question_id=r.id and o.is_correct
        and o.id::text = coalesce(v_given #>> '{}',''));
    end if;
    return query select r.id, r.prompt, v_ok, case when v_ok then r.explanation else '' end;
  end loop;
end $$;

-- ---------------------------------------------------------------- import
-- Takes a whole set of questions at once, so a question bank that
-- already exists in a document can be pasted in rather than retyped.
-- Replaces every question in the quiz, so the paste is the truth.
create or replace function lms_import_questions(p_quiz uuid, p_items jsonb)
returns table (imported integer, message text)
language plpgsql security definer set search_path = public as $$
declare it jsonb; op jsonb; v_q uuid; v_pos integer := 0; v_opos integer;
begin
  if not lms_is_admin() then
    return query select 0, 'Only an administrator can import questions.'; return;
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return query select 0, 'Nothing to import.'; return;
  end if;

  delete from lms_questions where quiz_id = p_quiz;

  for it in select * from jsonb_array_elements(p_items) loop
    v_pos := v_pos + 1;
    insert into lms_questions (quiz_id, prompt, type, position, marks, explanation)
    values (p_quiz,
            coalesce(it ->> 'prompt',''),
            coalesce(nullif(it ->> 'type',''),'single')::lms_question_type,
            v_pos,
            greatest(1, coalesce((it ->> 'marks')::int, 1)),
            coalesce(it ->> 'explanation',''))
    returning id into v_q;

    v_opos := 0;
    for op in select * from jsonb_array_elements(coalesce(it -> 'options','[]'::jsonb)) loop
      v_opos := v_opos + 1;
      insert into lms_options (question_id, label, is_correct, position)
      values (v_q, coalesce(op ->> 'label',''),
              coalesce((op ->> 'correct')::boolean, false), v_opos);
    end loop;
  end loop;

  insert into lms_admin_actions (actor_id, action, subject_type, subject_id, detail)
  values (auth.uid(), 'import_questions', 'quiz', p_quiz,
          jsonb_build_object('count', v_pos));

  return query select v_pos, v_pos || ' question(s) imported.';
end $$;

grant execute on function lms_quiz_kind(uuid), lms_submit_quiz(uuid,jsonb),
  lms_attempt_marks(uuid) to authenticated;
grant execute on function lms_create_quiz(uuid,uuid,text),
  lms_import_questions(uuid,jsonb) to authenticated;
