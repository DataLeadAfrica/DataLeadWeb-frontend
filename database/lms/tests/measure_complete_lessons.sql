-- every learner completes every lesson. On m_after the triggers fire.
set role postgres;
select set_config('request.jwt.claim.sub','',false);
insert into lms_lesson_progress (user_id, lesson_id, last_position_seconds, completed, completed_at, check_passed)
select ('aaaa0000-0000-0000-0000-' || lpad(u::text,12,'0'))::uuid,
       ('99999999-0000-0000-0001-' || lpad(l::text,12,'0'))::uuid, 600, true, now(), true
  from generate_series(1,20) u, generate_series(1,30) l
on conflict (user_id, lesson_id) do nothing;
reset role;
