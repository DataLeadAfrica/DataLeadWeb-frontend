with

allowed as (
  select unnest(array[

    'lms_can_edit', 'lms_is_admin', 'lms_is_staff', 'lms_lesson_is_open',
    'lms_my_role',

    'lms_live_popup', 'lms_my_path', 'lms_public_catalogue',
    'lms_public_course', 'lms_public_landing',

    'lms_faq_is_valid',

    'lms_check_question_chapter', 'lms_guard_course', 'lms_guard_lesson',
    'lms_guard_module', 'lms_guard_option', 'lms_guard_path',
    'lms_guard_question', 'lms_guard_question_not_served',
    'lms_guard_quiz', 'lms_guard_quiz_not_empty', 'lms_handle_new_user',
    'lms_no_new_module_quiz', 'lms_progress_keep_coverage',
    'lms_progress_tidy_up', 'lms_touch'
  ]) as proname
),
shut_to_all as (
  select unnest(array[
    'lms_link_participant(uuid, text)',
    'lms_grant_free_courses(uuid)',
    'lms_storage_report()',
    'lms_set_lesson_chapters(uuid, text)',
    'lms_claim_bootcamp_access()',
    'lms_course_blockers(uuid)',
    'lms_course_progress(uuid)',
    'lms_course_status_of_lesson(uuid)',
    'lms_course_status_of_module(uuid)',
    'lms_course_status_of_quiz(uuid)',
    'lms_import_questions(uuid, jsonb)',
    'lms_is_lesson_unlocked(uuid)',
    'lms_quiz_kind(uuid)',
    'lms_watch_coverage(uuid)'
  ]) as sig
),
signed_in_only as (
  select unnest(array[
    'lms_has_course_access(uuid)',
    'lms_complete_lesson(uuid)',
    'lms_record_watch(uuid, integer, integer)',
    'lms_start_quiz(uuid)',
    'lms_submit_quiz(uuid, jsonb)',
    'lms_sync_my_access()',
    'lms_add_facilitator(text, text, text)',
    'lms_remove_facilitator(text)'
  ]) as sig
),
takes_a_person as (
  select unnest(array[
    'lms_add_facilitator(text, text, text)',
    'lms_give_access(uuid, uuid, text, lms_grant_source, timestamp with time zone)',
    'lms_learner_record(uuid)',
    'lms_lift_exam_wait(uuid, uuid)',
    'lms_link_certification_record(uuid, uuid, text)',
    'lms_remove_access(uuid, uuid, text)',
    'lms_remove_facilitator(text)',
    'lms_set_staff_role(uuid, lms_role)'
  ]) as sig
),
no_caller_check as (
  select unnest(array[
    'lms_apply_signup_answers(uuid)',
    'lms_grant_free_courses(uuid)',
    'lms_link_participant(uuid, text)',
    'lms_strip_signup_metadata(uuid)'
  ]) as sig
),
checks (n, checking, answer, note) as (

  select 1,
    'check 1',
    case when (
      select count(*) from (values
        ('lms_link_participant(uuid, text)'),
        ('lms_grant_free_courses(uuid)'),
        ('lms_storage_report()')) as t(sig)
       where to_regprocedure('public.' || sig) is null
          or has_function_privilege('anon', sig, 'EXECUTE')
          or has_function_privilege('authenticated', sig, 'EXECUTE')
    ) = 0 then 'yes' else 'NO' end,
    ''

  union all select 2,
    'check 2',
    case when to_regprocedure('public.lms_set_lesson_chapters(uuid, text)') is null then 'NO'
         when not has_function_privilege('anon', 'lms_set_lesson_chapters(uuid, text)', 'EXECUTE')
          and not has_function_privilege('authenticated', 'lms_set_lesson_chapters(uuid, text)', 'EXECUTE')
         then 'yes' else 'NO' end,
    ''

  union all select 3,
    'check 3',
    case when (select count(*) from shut_to_all
                where to_regprocedure('public.' || sig) is null
                   or has_function_privilege('anon', sig, 'EXECUTE')
                   or has_function_privilege('authenticated', sig, 'EXECUTE')) = 0
         then 'yes' else 'NO' end,
    ''

  union all select 4,
    'check 4',
    case when (select count(*) from signed_in_only
                where to_regprocedure('public.' || sig) is null
                   or has_function_privilege('anon', sig, 'EXECUTE')
                   or not has_function_privilege('authenticated', sig, 'EXECUTE')) = 0
         then 'yes' else 'NO' end,
    ''

  union all select 5,
    'check 5',
    case when (
      select count(*) from (values
        ('lms_can_edit()'), ('lms_is_admin()'), ('lms_is_staff()'),
        ('lms_lesson_is_open(uuid)'), ('lms_my_role()')) as t(sig)
       where to_regprocedure('public.' || sig) is null
          or not has_function_privilege('anon', sig, 'EXECUTE')
          or not has_function_privilege('authenticated', sig, 'EXECUTE')
    ) = 0 then 'yes' else 'NO' end,
    ''

  union all select 6,
    'check 6',
    case when (
      select count(*) from (values
        ('lms_live_popup(text)'), ('lms_my_path(text)'), ('lms_public_catalogue()'),
        ('lms_public_course(text)'), ('lms_public_landing()')) as t(sig)
       where to_regprocedure('public.' || sig) is null
          or not has_function_privilege('anon', sig, 'EXECUTE')
    ) = 0 then 'yes' else 'NO' end,
    ''

  union all select 7,
    'check 7',
    case when to_regprocedure('public.lms_faq_is_valid(jsonb)') is null then 'NO'
         when has_function_privilege('authenticated', 'lms_faq_is_valid(jsonb)', 'EXECUTE')
         then 'yes' else 'NO' end,
    ''

  union all select 8,
    'check 8',
    case when (
      select count(*) from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like 'lms\_%'
         and has_function_privilege('anon', p.oid, 'EXECUTE')
         and p.proname not in (select proname from allowed)
    ) = 0 then 'yes' else 'NO' end,
    ''

  union all select 9,
    'check 9',
    case when (
      select count(*) from (values
        ('mail_fetch_pending(text, integer)'), ('mail_mark_sent(text, uuid[])'),
        ('mail_ping(text)'), ('mailer_token_ok(text)'), ('system_health(text)')) as t(sig)
       where to_regprocedure('public.' || sig) is not null
         and not has_function_privilege('anon', sig, 'EXECUTE')
    ) = 0 then 'yes' else 'NO' end,
    ''

  union all select 10,
    'check 10',
    case when (select count(*) from takes_a_person
                where to_regprocedure('public.' || sig) is null
                   or has_function_privilege('anon', sig, 'EXECUTE')
                   or (select count(*) from pg_proc p
                        join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public'
                         and p.oid = to_regprocedure('public.' || sig)
                         and regexp_replace(pg_get_functiondef(p.oid),
                               '--[^' || chr(10) || ']*', '', 'g') like '%lms_is_admin()%') = 0
              ) = 0 then 'yes' else 'NO' end,
    ''

  union all select 11,
    'check 11',
    case when (select count(*) from no_caller_check
                where to_regprocedure('public.' || sig) is null
                   or has_function_privilege('anon', sig, 'EXECUTE')
                   or has_function_privilege('authenticated', sig, 'EXECUTE')) = 0
         then 'yes' else 'NO' end,
    ''
)
select n as "#", checking as "what", answer as "answer", note as "note"
  from checks order by n;

select p.proname as "executable by a visitor and not on the allow list"
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'lms\_%'
   and has_function_privilege('anon', p.oid, 'EXECUTE')
   and p.proname not in (
     select unnest(array[
       'lms_can_edit', 'lms_is_admin', 'lms_is_staff', 'lms_lesson_is_open',
       'lms_my_role', 'lms_live_popup', 'lms_my_path', 'lms_public_catalogue',
       'lms_public_course', 'lms_public_landing', 'lms_faq_is_valid',
       'lms_check_question_chapter', 'lms_guard_course', 'lms_guard_lesson',
       'lms_guard_module', 'lms_guard_option', 'lms_guard_path',
       'lms_guard_question', 'lms_guard_question_not_served',
       'lms_guard_quiz', 'lms_guard_quiz_not_empty', 'lms_handle_new_user',
       'lms_no_new_module_quiz', 'lms_progress_keep_coverage',
       'lms_progress_tidy_up', 'lms_touch'
     ])
   )
 order by 1;
