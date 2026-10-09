-- =====================================================================
-- 14_undo.sql
--
-- READ THIS BEFORE RUNNING IT.
--
-- Running this file RE-OPENS TWO SECURITY LEAKS. That is not a side
-- effect of undoing file 14, it is most of what undoing file 14 means:
--
--   1. Every lesson's video id becomes readable again by anybody holding
--      the publishable key, signed in or not. An unlisted YouTube id
--      plays for anybody who has it, so this is the whole paid catalogue
--      given away in one request.
--
--   2. Draft courses become readable again through lms_course_cards,
--      with their titles and their prices, by anybody.
--
-- There is almost no reason to want that. This file exists because every
-- other numbered file has one, and because an undo that does not exist is
-- an undo that gets improvised at two in the morning. If something in
-- file 14 is wrong, the better move is nearly always to fix that one
-- piece rather than to put the leaks back.
--
-- To make the choice deliberate, the undo does nothing unless you tell it
-- to. Change the line below from 'no' to 'yes, put the leaks back', then
-- run it.
-- =====================================================================

do $$
declare
  v_i_really_mean_it text := 'no';
begin
  if v_i_really_mean_it <> 'yes, put the leaks back' then
    raise exception E'14_undo.sql did nothing.\n\nThis file re-opens two security leaks: every video id becomes readable by anybody, and draft courses become public. If that is really what you want, edit the line\n  v_i_really_mean_it text := ''no'';\nnear the top of the file and run it again.';
  end if;
end $$;


-- --------------------------------------------- the two leaks, re-opened
grant select on lms_lessons to anon, authenticated;
alter view lms_course_cards set (security_invoker = false);

-- ------------------------------------------------------- the new doors
drop function if exists lms_open_lesson(uuid);
drop function if exists lms_staff_lesson(uuid);

-- --------------------------------------------- the public catalogue
drop function if exists lms_public_catalogue();
drop function if exists lms_public_course(text);

-- ------------------------------------------------- the publish checklist
-- Back to the file 13 version, word for word, so the outcomes rule goes
-- and everything else stays.
create or replace function lms_course_blockers(p_course uuid)
returns table(ok boolean, label text)
language sql stable security definer set search_path = public as $function$
  with c as (select * from lms_courses where id = p_course),
  m as (select count(*) n from lms_modules where course_id = p_course),
  l as (select count(*) n from lms_lessons le
          join lms_modules mo on mo.id = le.module_id where mo.course_id = p_course),
  novid as (select count(*) n,
                   string_agg(coalesce(nullif(btrim(le.title),''),'untitled'), ', ' order by le.title) as names
              from lms_lessons le
              join lms_modules mo on mo.id = le.module_id
             where mo.course_id = p_course and le.type = 'video'
               and (le.video_ref is null or le.duration_seconds is null)),
  emptyq as (
    select count(*) n,
           string_agg(coalesce(nullif(btrim(q.title),''),'untitled'), ', '
                      order by q.title) as names
      from lms_quizzes q
     where (q.lesson_id in (select le.id from lms_lessons le
                             join lms_modules mo on mo.id = le.module_id
                            where mo.course_id = p_course)
            or q.module_id in (select id from lms_modules where course_id = p_course))
       and not exists (select 1 from lms_questions qq
                        where qq.quiz_id = q.id and qq.active))
  select btrim(coalesce((select title from c),'')) <> '', 'Has a title'
  union all select btrim(coalesce((select summary from c),'')) <> '', 'Has a short description'
  union all select btrim(coalesce((select tool from c),'')) <> '', 'Has a tool'
  union all select (select n from m) > 0, 'Has at least one module'
  union all select (select n from l) > 0, 'Has at least one lesson'
  union all select (select n from novid) = 0,
    case when (select n from novid) = 0
         then 'Every video lesson has its video and its length'
         else 'Every video lesson has its video and its length. Still missing: '
              || (select names from novid)
              || '. Without the length the non skippable rule cannot work.'
    end
  union all select (select programme_id from c) is not null,
    case when (select programme_id from c) is not null
         then 'Has a programme, so a certificate can be issued'
         else 'Has a programme, so a certificate can be issued. '
              || 'Set lms_courses.programme_id, or a learner will finish this course '
              || 'and find there is no certificate at the end.'
    end
  union all select (select n from emptyq) = 0,
    case when (select n from emptyq) = 0
         then 'Every set of questions has at least one question'
         else 'Every set of questions has at least one question. Still empty: '
              || (select names from emptyq)
              || '. Add a question, or delete the empty set.'
    end
$function$;

-- ------------------------------------------------------- the new columns
-- The CONSTRAINTS go. The COLUMNS stay.
--
-- Dropping a column throws away whatever anybody has written in it, and
-- outcomes, audience, prerequisites and the FAQ are words somebody sat
-- down and wrote. An unused column costs nothing; a deleted one costs
-- somebody an afternoon. If you really want them gone, the four lines are
-- at the bottom of this file, commented out, and you can read them and
-- decide.
alter table lms_courses drop constraint if exists lms_courses_seo_title_len;
alter table lms_courses drop constraint if exists lms_courses_seo_desc_len;
alter table lms_courses drop constraint if exists lms_courses_faq_shape;
drop function if exists lms_faq_is_valid(jsonb);

-- alter table lms_courses drop column if exists outcomes;
-- alter table lms_courses drop column if exists audience;
-- alter table lms_courses drop column if exists prerequisites;
-- alter table lms_courses drop column if exists faq;
-- alter table lms_courses drop column if exists seo_title;
-- alter table lms_courses drop column if exists seo_description;

do $$ begin
  raise notice '';
  raise notice 'File 14 has been undone, and the two leaks are open again.';
  raise notice 'The six columns on lms_courses were kept, because they hold words somebody wrote. The lines to drop them are commented out at the bottom of this file.';
end $$;
