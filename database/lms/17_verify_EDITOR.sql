with checks (n, checking, answer, note) as (
  select 1,
    'check 1',
    case when exists (
      select 1 from pg_trigger t
       where t.tgrelid = to_regclass('public.lms_admin_actions')
         and t.tgname = 'lms_admin_actions_no_change' and not t.tgisinternal
    ) then 'yes' else 'NO' end,
    ''

  union all select 2,
    'check 2',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_create_course'
    ) like '%insert into programmes%lms_ensure_course_exam%lms_modules%'
      or (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_create_course'
    ) like '%programmes%' then 'yes' else 'NO' end,
    ''

  union all select 3,
    'check 3',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_publish_course'
    ) like '%lms_is_admin()%Only an administrator can publish a course.%' then 'yes' else 'NO' end,
    ''

  union all select 4,
    'check 4',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_may_edit_course'
    ) like '%c.created_by = auth.uid()%' then 'yes' else 'NO' end,
    ''

  union all select 5,
    'check 5',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_staff_learners'
    ) and (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_staff_learners'
    ) like '%Only an administrator can see the learner list.%' then 'yes' else 'NO' end,
    ''

  union all select 6,
    'check 6',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_publish_checks'
         and pg_get_function_result(p.oid) like '%fix_tab%'
    ) then 'yes' else 'NO' end,
    ''

  union all select 7,
    'check 7',
    case when (
      select pg_get_function_result(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_course_blockers'
    ) = 'TABLE(ok boolean, label text)' then 'yes' else 'NO' end,
    ''

  union all select 8,
    'check 8',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_publish_course'
    ) like '%insert into lms_entitlements%price_kobo = 0%' then 'yes' else 'NO' end,
    ''

  union all select 9,
    'check 9',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_publish_course'
    ) like '%update lms_quizzes%lesson_id in%' then 'yes' else 'NO' end,
    ''

  union all select 10,
    'check 10',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_guard_lesson'
    ) like '%video of a live lesson cannot change%' then 'yes' else 'NO' end,
    ''

  union all select 11,
    'check 11',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_guard_lesson'
    ) like '%cannot be reordered%' then 'yes' else 'NO' end,
    ''

  union all select 12,
    'check 12',
    case when (
      select count(*) from pg_trigger t
       where t.tgrelid = to_regclass('public.lms_lessons') and not t.tgisinternal
         and pg_get_triggerdef(t.oid) like '%lms_guard%'
    ) = 1 then 'yes' else 'NO' end,
    ''

  union all select 13,
    'check 13',
    case when exists (
      select 1 from pg_trigger t
       where t.tgrelid = to_regclass('public.lms_options')
         and t.tgname = 'lms_options_answered_guard' and not t.tgisinternal
    ) then 'yes' else 'NO' end,
    ''

  union all select 14,
    'check 14',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_question_is_locked'
    ) like '%served_question_ids%' then 'yes' else 'NO' end,
    ''

  union all select 15,
    'check 15',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_paste_questions'
         and pg_get_function_result(p.oid) like '%outcome%'
    ) then 'yes' else 'NO' end,
    ''

  union all select 16,
    'check 16',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_paste_questions'
    ) like '%PASS ONE%PASS TWO%' then 'yes' else 'NO' end,
    ''

  union all select 17,
    'check 17',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_give_access'
    ) like '%An access grant with no reason%' then 'yes' else 'NO' end,
    ''

  union all select 18,
    'check 18',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_give_access'
    ) like '%do update set source%' then 'yes' else 'NO' end,
    ''

  union all select 19,
    'check 19',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_give_access'
    ) like '%follows the roster%' then 'yes' else 'NO' end,
    ''

  union all select 20,
    'check 20',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_remove_access'
    ) like '%status = ''revoked''%' then 'yes' else 'NO' end,
    ''

  union all select 21,
    'check 21',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_lift_exam_wait'
    ) like '%update lms_quiz_attempts%submitted_at%' then 'yes' else 'NO' end,
    ''

  union all select 22,
    'check 22',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_report_who'
    ) like '%lms_learner_totals%' then 'yes' else 'NO' end,
    ''

  union all select 23,
    'check 23',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_report_who'
    ) like '%report_who_read%' then 'yes' else 'NO' end,
    ''

  union all select 24,
    'check 24',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_log_export'
    ) then 'yes' else 'NO' end,
    ''

  union all select 25,
    'check 25',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_log_export'
    ) like '%Only an administrator can export learner data.%' then 'yes' else 'NO' end,
    ''

  union all select 26,
    'check 26',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_report_hard_questions'
    ) like '%s.seen >= 5%' then 'yes' else 'NO' end,
    ''

  union all select 27,
    'check 27',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_save_popup'
    ) like '%Never over a lesson, a check or an exam.%' then 'yes' else 'NO' end,
    ''

  union all select 28,
    'check 28',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_save_popup'
    ) like '%''draft''%' then 'yes' else 'NO' end,
    ''

  union all select 29,
    'check 29',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_start_popup'
    ) like '%status = ''ended''%status = ''live''%' then 'yes' else 'NO' end,
    ''

  union all select 30,
    'check 30',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_staff_role'
    ) like '%made in Supabase%' then 'yes' else 'NO' end,
    ''

  union all select 31,
    'check 31',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_staff_role'
    ) like '%cannot change your own role%' then 'yes' else 'NO' end,
    ''

  union all select 32,
    'check 32',
    case when (
      select pg_get_function_result(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_add_facilitator'
    ) = 'TABLE(ok boolean, message text)' then 'yes' else 'NO' end,
    ''

  union all select 33,
    'check 33',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_course_price'
    ) like '%was_kobo%now_kobo%' then 'yes' else 'NO' end,
    ''

  union all select 34,
    'check 34',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_activity_log'
    ) like '%lms_is_admin()%created_by = auth.uid()%' then 'yes' else 'NO' end,
    ''

  union all select 35,
    'check 35',
    case when not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public'
         and p.proname in (
           'lms_create_course','lms_publish_checks','lms_publish_course','lms_staff_learners',
           'lms_give_access','lms_remove_access','lms_lift_exam_wait','lms_set_course_price',
           'lms_report_who','lms_studio_overview','lms_studio_health','lms_activity_log',
           'lms_set_staff_role','lms_studio_staff','lms_save_popup','lms_set_site_settings')
         and has_function_privilege('anon', p.oid, 'execute')
    ) then 'yes' else 'NO' end,
    ''

  union all select 36,
    'check 36',
    case when not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public'
         and p.proname in ('lms_log_action','lms_log_is_append_only','lms_guard_answered_question')
         and (has_function_privilege('anon', p.oid, 'execute')
              or has_function_privilege('authenticated', p.oid, 'execute'))
    ) then 'yes' else 'NO' end,
    ''

  union all select 37,
    'check 37',
    case when exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_publish_lesson_check'
    ) then 'yes' else 'NO' end,
    ''

  union all select 38,
    'check 38',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_send_back'
    ) like '%nobody knows how to fix%' then 'yes' else 'NO' end,
    ''

  union all select 39,
    'check 39',
    case when exists (
      select 1 from information_schema.columns
       where table_name = 'lms_courses' and column_name = 'sent_for_review_at'
    ) and not exists (
      select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
       where t.typname = 'lms_status' and e.enumlabel = 'review'
    ) then 'yes' else 'NO' end,
    ''

  union all select 40,
    'check 40',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_log_action'
    ) like '%exception when others then%lms_system_heartbeat%' then 'yes' else 'NO' end,
    ''

  union all select 41,
    'check 41',
    case when (
      select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'lms_set_staff_role'
    ) like '%made and removed in Supabase%' then 'yes' else 'NO' end,
    ''
)
select n as "#", checking as "what", answer as "answer", note as "note"
  from checks order by n;
