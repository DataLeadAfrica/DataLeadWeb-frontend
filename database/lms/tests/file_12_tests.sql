-- =====================================================================
-- DO NOT RUN THIS ON SUPABASE. LOCAL POSTGRESQL ONLY.
--
-- The seed files in this folder begin by DELETING every participant,
-- certificate, enrolment, programme and user account, because a test
-- database has to start from a known empty state. On the live database
-- that is not a test, it is the end of the certification system.
--
-- Nothing in this folder ever needs running by hand. It is committed so
-- the repository holds the evidence that the numbered files were tested,
-- and so somebody can re-run it on a local copy years from now.
-- =====================================================================
\set QUIET on
set role postgres;
select set_config('request.jwt.claim.sub','',false);

-- =====================================================================
-- P. PART 0: the sign in deadlock
-- =====================================================================
do $$ declare v_codes int; v_mail int; v_ret boolean; begin
  delete from auth_codes; delete from mail_outbox where to_email like '%gmail.com';
  v_ret := request_certificate_code('newstudent@gmail.com');
  select count(*) into v_codes from auth_codes where email_norm='newstudent@gmail.com';
  select count(*) into v_mail from mail_outbox where to_email='newstudent@gmail.com';
  perform t_rec('P1 an enrolled student with no certificate IS sent a code',
                v_codes = 1 and v_mail = 1, 'codes='||v_codes||' emails queued='||v_mail);
exception when others then perform t_rec('P1 an enrolled student with no certificate IS sent a code', false, SQLERRM);
end $$;
do $$ declare v_ret boolean; begin
  v_ret := request_certificate_code('nobody-at-all@gmail.com');
  perform t_rec('P2 the form says the same thing either way, so it leaks nothing',
                v_ret = true, 'returned '||v_ret::text);
end $$;
do $$ declare v_codes int; begin
  select count(*) into v_codes from auth_codes where email_norm='nobody-at-all@gmail.com';
  perform t_rec('P3 a complete stranger is sent nothing', v_codes = 0, 'codes='||v_codes);
end $$;
do $$ declare v_codes int; v_ret boolean; begin
  v_ret := request_certificate_code('graduate@gmail.com');
  select count(*) into v_codes from auth_codes where email_norm='graduate@gmail.com';
  perform t_rec('P4 somebody holding a certificate still gets a code', v_codes = 1, 'codes='||v_codes);
end $$;
do $$ declare v_codes int; v_ret boolean; begin
  v_ret := request_certificate_code('withdrawn@gmail.com');
  select count(*) into v_codes from auth_codes where email_norm='withdrawn@gmail.com';
  perform t_rec('P5 a withdrawn student with no certificate stays out', v_codes = 0, 'codes='||v_codes);
end $$;
do $$ declare v_codes int; v_ret boolean; begin
  v_ret := request_certificate_code('revoked@gmail.com');
  select count(*) into v_codes from auth_codes where email_norm='revoked@gmail.com';
  perform t_rec('P6 a revoked certificate alone stays out', v_codes = 0, 'codes='||v_codes);
end $$;
do $$ declare v_n int; begin
  for i in 1..9 loop perform request_certificate_code('graduate@gmail.com'); end loop;
  select count(*) into v_n from auth_codes where email_norm='graduate@gmail.com';
  -- file 12 moved this limit from 3 CODES to 5 ATTEMPTS in 15 minutes, so
  -- that it fires identically for an address that gets no code and
  -- therefore cannot be used to tell the two apart.
  perform t_rec('P7 the per address limit still bites, now at five attempts', v_n = 5, 'codes='||v_n);
exception when others then perform t_rec('P7 the per address limit still bites, now at five attempts', false, SQLERRM);
end $$;
do $$ declare v_ret boolean; v_codes int; begin
  v_ret := request_certificate_code('not an email');
  select count(*) into v_codes from auth_codes where email_norm='not an email';
  perform t_rec('P8 a malformed address is ignored quietly', v_ret and v_codes = 0, 'returned '||v_ret::text);
end $$;

-- =====================================================================
-- P. PART 2: the health check
-- =====================================================================
do $$ declare v_n int; begin
  select count(*) into v_n from system_health('this-token-is-definitely-wrong-xx')
   where severity = 'alarm' and item = 'TOKEN';
  perform t_rec('P9 the health check refuses a wrong token', v_n = 1, 'rows saying the token was rejected='||v_n);
exception when others then perform t_rec('P9 the health check refuses a wrong token', false, SQLERRM);
end $$;
do $$ declare v_tok text; v_n int; begin
  v_tok := 'health-token-for-local-tests-0000';
  perform lms_set_health_token(v_tok);
  select count(*) into v_n from system_health(v_tok);
  perform t_rec('P10 the health check answers with the right token', v_n >= 5, 'rows='||v_n);
exception when others then perform t_rec('P10 the health check answers with the right token', false, SQLERRM);
end $$;
do $$ declare r record; begin
  select * into r from system_health('health-token-for-local-tests-0000') where item='OVERALL';
  perform t_rec('P11 there is one OVERALL row the alarm script can read',
                r.severity in ('ok','warn','alarm'), 'severity='||coalesce(r.severity,'none')||' value='||coalesce(r.value,'none'));
exception when others then perform t_rec('P11 there is one OVERALL row the alarm script can read', false, SQLERRM);
end $$;
do $$ declare r record; begin
  -- this test needs an aged row of its own: the part 0 tests above clear the
  -- outbox and then queue fresh codes into it
  insert into mail_outbox (to_email, code_plain, created_at)
   values ('stuck@example.com','000000', now() - interval '25 minutes');
  select * into r from system_health('health-token-for-local-tests-0000') where item='oldest unsent email';
  perform t_rec('P12 it notices an email stuck in the outbox for 25 minutes',
                r.severity in ('warn','alarm'), 'severity='||coalesce(r.severity,'none')||' value='||coalesce(r.value,'none'));
exception when others then perform t_rec('P12 it notices an email stuck in the outbox for 25 minutes', false, SQLERRM);
end $$;
do $$ declare r record; begin
  select * into r from system_health('health-token-for-local-tests-0000') where item='mailer last fetched';
  perform t_rec('P13 before the mailer has ever run, that is an alarm',
                r.severity = 'alarm', 'severity='||coalesce(r.severity,'none')||' value='||coalesce(r.value,'none'));
exception when others then perform t_rec('P13 before the mailer has ever run, that is an alarm', false, SQLERRM);
end $$;
do $$ declare r record; v_x int; begin
  perform * from mail_fetch_pending('OLD-TOKEN-for-local-tests-only-0000', 5);
  select * into r from system_health('health-token-for-local-tests-0000') where item='mailer last fetched';
  perform t_rec('P14 once the mailer fetches, the heartbeat is recorded',
                r.severity = 'ok', 'severity='||coalesce(r.severity,'none')||' value='||coalesce(r.value,'none'));
exception when others then perform t_rec('P14 once the mailer fetches, the heartbeat is recorded', false, SQLERRM);
end $$;
do $$ declare r record; begin
  select * into r from system_health('health-token-for-local-tests-0000') where item='database size';
  perform t_rec('P15 it reports the database size against 500 MB',
                r.value like '%of 500 MB%', 'value='||coalesce(r.value,'none'));
exception when others then perform t_rec('P15 it reports the database size against 500 MB', false, SQLERRM);
end $$;
do $$ declare r record; begin
  select * into r from system_health('health-token-for-local-tests-0000')
   where item='unconfirmed sign ups, last 24 hours';
  perform t_rec('P16 it counts only the unconfirmed sign ups from the last day',
                r.value = '2', 'value='||coalesce(r.value,'none')||' (3 exist, one is 40 hours old)');
exception when others then perform t_rec('P16 it counts only the unconfirmed sign ups from the last day', false, SQLERRM);
end $$;
do $$ declare v_n int; begin
  select count(*) into v_n from system_health('health-token-for-local-tests-0000')
   where item like 'scheduled job%';
  perform t_rec('P17 it reports on the scheduled jobs, or says pg_cron is absent',
                v_n >= 1, 'rows about scheduled jobs='||v_n);
exception when others then perform t_rec('P17 it reports on the scheduled jobs, or says pg_cron is absent', false, SQLERRM);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ declare v_n int; v_rows int; begin
  select count(*) filter (where item='TOKEN' and severity='alarm'), count(*)
    into v_n, v_rows from system_health('health-token-for-local-tests-0000');
  perform t_rec('P18 a signed in learner is refused even holding the right token',
                v_n = 1 and v_rows = 1, 'rows back='||v_rows||', refusal rows='||v_n);
exception when others then perform t_rec('P18 a signed in learner is refused even holding the right token', true, 'refused: '||SQLERRM);
end $$;
do $$ begin
  perform lms_set_health_token('a-learner-should-not-set-this-000');
  perform t_rec('P19 a signed in learner CANNOT change the health token', false, 'it ran');
exception when others then perform t_rec('P19 a signed in learner CANNOT change the health token', true, 'refused: '||SQLERRM);
end $$;
reset role;

-- =====================================================================
-- P. PART 5: a question an attempt has seen cannot be hard deleted
-- =====================================================================
set role postgres;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
  delete from lms_questions where id='c0000000-0000-0000-0000-0000000000e1';
  perform t_rec('P20 a question an attempt has been given CANNOT be deleted', false, 'the delete went through');
exception when others then perform t_rec('P20 a question an attempt has been given CANNOT be deleted', true, 'refused: '||SQLERRM);
end $$;
do $$ declare v_n int; begin
  update lms_questions set active = false where id='c0000000-0000-0000-0000-0000000000e1';
  get diagnostics v_n = row_count;
  perform t_rec('P21 but it CAN be retired instead', v_n = 1, 'rows retired='||v_n);
exception when others then perform t_rec('P21 but it CAN be retired instead', false, SQLERRM);
end $$;
do $$ declare v_n int; begin
  delete from lms_questions where id='c0000000-0000-0000-0000-0000000000e2';
  get diagnostics v_n = row_count;
  perform t_rec('P22 a question nobody has been given can still be deleted', v_n = 1, 'rows deleted='||v_n);
exception when others then perform t_rec('P22 a question nobody has been given can still be deleted', false, SQLERRM);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$ begin
  delete from lms_questions where id='c0000000-0000-0000-0000-0000000000e1';
  perform t_rec('P23 not even the administrator can delete a served question', false, 'the delete went through');
exception when others then perform t_rec('P23 not even the administrator can delete a served question', true, 'refused: '||SQLERRM);
end $$;
reset role;

-- =====================================================================
-- P. permissions stay tight
-- =====================================================================
set role postgres;
do $$ declare v_bad text; begin
  select string_agg(distinct table_name||'/'||grantee||'/'||privilege_type, ', ')
    into v_bad from information_schema.role_table_grants
   where table_schema='public' and table_name like 'lms\_%'
     and grantee in ('anon','authenticated')
     and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER');
  perform t_rec('P24 no table grants TRUNCATE, REFERENCES or TRIGGER', v_bad is null,
                coalesce('still held: '||left(v_bad,120),'none'));
end $$;
do $$ declare v_bad text; begin
  select string_agg(distinct table_name||'/'||privilege_type, ', ')
    into v_bad from information_schema.role_table_grants
   where table_schema='public' and table_name like 'lms\_%'
     and grantee='anon' and privilege_type in ('INSERT','UPDATE','DELETE');
  perform t_rec('P25 a visitor who is not signed in holds no write privilege', v_bad is null,
                coalesce('still held: '||left(v_bad,120),'none'));
end $$;
reset role;

-- =====================================================================
-- Q. one identical reply for everybody who asks for a code
-- Every one of these runs as anon, because the sign in page and the
-- certificate claim page are both used by somebody not signed in.
-- Fixtures are built as the owner, because anon is deliberately not
-- allowed to touch the attempt log. Only the function may.
-- =====================================================================
set role postgres;
delete from auth_codes; delete from mail_outbox; delete from sign_in_attempts;
reset role;
set role anon;
do $$ declare v jsonb; begin
  v := request_sign_in_code('newstudent@gmail.com');
  perform t_rec('Q1 an enrolled student really is sent a code',
                (v->>'ok')::boolean
                and (select count(*) from mail_outbox where to_email='newstudent@gmail.com') = 1,
                'queued='||(select count(*) from mail_outbox where to_email='newstudent@gmail.com'));
exception when others then perform t_rec('Q1 an enrolled student really is sent a code', false, SQLERRM);
end $$;

do $$ declare v jsonb; begin
  v := request_sign_in_code('withdrawn@gmail.com');
  perform t_rec('Q2 a withdrawn student is sent nothing',
                (select count(*) from mail_outbox where to_email='withdrawn@gmail.com') = 0,
                'queued='||(select count(*) from mail_outbox where to_email='withdrawn@gmail.com'));
exception when others then perform t_rec('Q2 a withdrawn student is sent nothing', false, SQLERRM);
end $$;

-- The whole point. Four different people, one reply, character for character.
do $$ declare v_in jsonb; v_out jsonb; v_none jsonb; v_grad jsonb; begin
  v_in   := request_sign_in_code('newstudent@gmail.com');
  v_out  := request_sign_in_code('withdrawn@gmail.com');
  v_none := request_sign_in_code('nobody-at-all@gmail.com');
  v_grad := request_sign_in_code('graduate@gmail.com');
  perform t_rec('Q3 enrolled, withdrawn, unknown and graduate all get the IDENTICAL reply',
                v_in = v_out and v_out = v_none and v_none = v_grad,
                case when v_in = v_out and v_out = v_none and v_none = v_grad
                     then 'identical: '||left(v_in->>'message',46)
                     else 'DIFFERENT, the page is an oracle' end);
exception when others then perform t_rec('Q3 enrolled, withdrawn, unknown and graduate all get the IDENTICAL reply', false, SQLERRM);
end $$;

do $$ declare v jsonb; begin
  v := request_sign_in_code('newstudent@gmail.com');
  perform t_rec('Q4 the reply is the agreed wording',
                v->>'message' = 'If you are enrolled, your code arrives within 5 minutes. '
                             || 'Nothing yet? Check spam or contact us.',
                left(coalesce(v->>'message','null'),60));
exception when others then perform t_rec('Q4 the reply is the agreed wording', false, SQLERRM);
end $$;

do $$ declare v jsonb; begin
  v := request_sign_in_code('not-an-address');
  perform t_rec('Q5 only a badly typed address is answered differently',
                v->>'status' = 'bad_email' and not (v->>'ok')::boolean,
                'status='||coalesce(v->>'status','null'));
exception when others then perform t_rec('Q5 only a badly typed address is answered differently', false, SQLERRM);
end $$;

-- Being rate limited must look exactly like being sent a code, or the
-- limit itself becomes the oracle: hitting it proves codes were being sent.
reset role;
set role postgres;
delete from auth_codes; delete from mail_outbox; delete from sign_in_attempts;
reset role;
set role anon;
do $$ declare v_first jsonb; v_last jsonb; begin
  v_first := request_sign_in_code('newstudent@gmail.com');
  for i in 1..8 loop v_last := request_sign_in_code('newstudent@gmail.com'); end loop;
  perform t_rec('Q6 the per address limit bites, and says nothing about it',
                (select count(*) from mail_outbox where to_email='newstudent@gmail.com') = 5
                and v_last = v_first,
                'codes queued='||(select count(*) from mail_outbox where to_email='newstudent@gmail.com')
                ||case when v_last = v_first then ', reply unchanged' else ', REPLY DIFFERS' end);
exception when others then perform t_rec('Q6 the per address limit bites, and says nothing about it', false, SQLERRM);
end $$;

-- The limit counts ATTEMPTS, not codes. So it fires the same way for an
-- address that never gets a code, which is what stops it leaking.
reset role;
set role postgres;
delete from auth_codes; delete from mail_outbox; delete from sign_in_attempts;
reset role;
set role anon;
do $$ begin
  for i in 1..8 loop perform request_sign_in_code('withdrawn@gmail.com'); end loop;
end $$;
reset role;
set role postgres;
do $$ declare v_n int; begin
  select count(*) into v_n from sign_in_attempts where outcome = 'rate_limited_email';
  perform t_rec('Q7 the per address limit fires for an unenrolled address too',
                v_n = 3, 'rate limited attempts='||v_n);
exception when others then perform t_rec('Q7 the per address limit fires for an unenrolled address too', false, SQLERRM);
end $$;
reset role;

-- =====================================================================
-- R. the caller limit, and the backstop that cannot be faked
-- =====================================================================
-- x-forwarded-for grows from the left, so the LAST entry is the one the
-- nearest proxy added and the first is whatever the caller claimed.
reset role;
set role postgres;
delete from sign_in_attempts;
reset role;
set role postgres;
do $$ declare v_ip text; begin
  perform set_config('request.headers','{"x-forwarded-for":"1.2.3.4, 41.58.9.9"}',true);
  v_ip := sign_in_caller_ip();
  perform t_rec('R1 the caller is taken from the LAST entry, not the one they claimed',
                v_ip = '41.58.9.9', 'read as '||coalesce(v_ip,'null'));
exception when others then perform t_rec('R1 the caller is taken from the LAST entry, not the one they claimed', false, SQLERRM);
end $$;

-- A spoofed first entry changing on every request must not get round the
-- caller limit, because the entry that counts is the one it cannot choose.
reset role;
set role postgres;
delete from auth_codes; delete from mail_outbox; delete from sign_in_attempts;
reset role;
set role anon;
do $$ begin
  for i in 1..20 loop
    perform set_config('request.headers',
      '{"x-forwarded-for":"9.9.9.'||i||', 41.58.9.9"}', true);
    perform request_sign_in_code('person'||i||'@example.com');
  end loop;
end $$;
reset role;
set role postgres;
do $$ declare v_n int; begin
  select count(*) into v_n from sign_in_attempts where outcome = 'rate_limited_ip';
  perform t_rec('R2 a faked header on every request does NOT get round the caller limit',
                v_n = 5, 'refused by the caller limit='||v_n);
exception when others then perform t_rec('R2 a faked header on every request does NOT get round the caller limit', false, SQLERRM);
end $$;
reset role;

-- The backstop. Nothing the caller sends can touch this, because it counts
-- what the server actually did. The ceiling is whatever mail_limits says,
-- which defaults to 80 a day because Google allows a free gmail.com
-- account only 100 and hitting Google's own limit stops ALL sending for
-- 24 hours.
reset role;
set role postgres;
delete from auth_codes; delete from mail_outbox; delete from sign_in_attempts;
-- One short of the DAILY ceiling, spread over the past day rather than
-- bunched into the last few minutes. Bunched, they trip the hourly
-- ceiling instead and the test would be probing the wrong limit. That is
-- not hypothetical: the first version of this fixture did exactly that.
insert into sign_in_attempts (email_hash, ip, outcome, at)
  select md5(g::text), null, 'sent', now() - interval '2 hours' - (g * interval '10 minutes')
    from generate_series(1, (select per_day - 1 from mail_limits where id=1)) g;
reset role;
set role anon;
do $$ begin
  perform set_config('request.headers','',true);
  perform request_sign_in_code('newstudent@gmail.com');
end $$;
reset role;
set role postgres;
do $$ declare v_q int; begin
  select count(*) into v_q from mail_outbox;
  perform t_rec('R3a one short of the ceiling, the code still goes out', v_q = 1,
                'codes queued='||v_q);
exception when others then perform t_rec('R3a one short of the ceiling, the code still goes out', false, SQLERRM);
end $$;
reset role;
set role anon;
do $$ begin
  perform set_config('request.headers','',true);
  perform request_sign_in_code('graduate@gmail.com');
end $$;
reset role;
set role postgres;
do $$ declare v_q int; v_r int; begin
  select count(*) into v_q from mail_outbox;
  select count(*) into v_r from sign_in_attempts where outcome='rate_limited_site';
  perform t_rec('R3b at the ceiling, the next one is refused',
                v_q = 1 and v_r = 1, 'codes queued='||v_q||' refused by the ceiling='||v_r);
exception when others then perform t_rec('R3b at the ceiling, the next one is refused', false, SQLERRM);
end $$;

-- The hourly ceiling is a separate limit, so one bad hour cannot eat the
-- whole day's allowance in one go.
reset role;
set role postgres;
delete from auth_codes; delete from mail_outbox; delete from sign_in_attempts;
insert into sign_in_attempts (email_hash, ip, outcome, at)
  select md5(g::text), null, 'sent', now() - interval '2 minutes'
    from generate_series(1, (select per_hour from mail_limits where id=1)) g;
reset role;
set role anon;
do $$ begin
  perform set_config('request.headers','',true);
  perform request_sign_in_code('newstudent@gmail.com');
end $$;
reset role;
set role postgres;
do $$ declare v_q int; v_r int; begin
  select count(*) into v_q from mail_outbox;
  select count(*) into v_r from sign_in_attempts where outcome='rate_limited_site';
  perform t_rec('R3f the hourly ceiling bites on its own, well inside the daily one',
                v_q = 0 and v_r = 1,
                'codes queued='||v_q||' refused='||v_r);
exception when others then perform t_rec('R3f the hourly ceiling bites on its own, well inside the daily one', false, SQLERRM);
end $$;

-- The ceiling is READ FROM THE TABLE, not baked into the code, so moving
-- the mailer to an account with a bigger allowance is one UPDATE.
do $$ declare v_q_before int; v_q_after int; begin
  select count(*) into v_q_before from mail_outbox;
  update mail_limits set per_hour = 500, per_day = 1200 where id = 1;
  reset role;
  perform set_config('request.headers','',true);
  perform request_sign_in_code('graduate@gmail.com');
  select count(*) into v_q_after from mail_outbox;
  update mail_limits set per_hour = 25, per_day = 80 where id = 1;
  perform t_rec('R3c raising the ceiling in mail_limits lifts it immediately',
                v_q_after = v_q_before + 1,
                'queued before='||v_q_before||' after='||v_q_after);
exception when others then
  update mail_limits set per_hour = 25, per_day = 80 where id = 1;
  perform t_rec('R3c raising the ceiling in mail_limits lifts it immediately', false, SQLERRM);
end $$;

-- If somebody deletes the row, fall back to the safe end rather than to
-- no limit at all. No limit is the failure that empties the day's quota.
do $$ declare v_h int; v_d int; begin
  delete from mail_limits where id = 1;
  v_h := mail_limit_per_hour();
  v_d := mail_limit_per_day();
  insert into mail_limits (id, per_hour, per_day) values (1, 25, 80)
    on conflict (id) do update set per_hour = 25, per_day = 80;
  perform t_rec('R3d with the settings row gone it falls back to a limit, not to none',
                v_h = 25 and v_d = 80, 'per hour='||v_h||' per day='||v_d);
exception when others then
  insert into mail_limits (id, per_hour, per_day) values (1, 25, 80)
    on conflict (id) do update set per_hour = 25, per_day = 80;
  perform t_rec('R3d with the settings row gone it falls back to a limit, not to none', false, SQLERRM);
end $$;

do $$ declare v_bad text; begin
  select string_agg(distinct privilege_type, ', ') into v_bad
    from information_schema.role_table_grants
   where table_schema='public' and table_name='mail_limits'
     and grantee in ('anon','authenticated');
  perform t_rec('R3e nobody from the browser can read or raise the ceiling',
                v_bad is null, coalesce('still held: '||v_bad,'none'));
end $$;
reset role;
set role anon;
do $$ declare v jsonb; v_plain jsonb; begin
  perform set_config('request.headers','',true);
  v := request_sign_in_code('newstudent@gmail.com');
  perform t_rec('R4 and even at the ceiling the reply gives nothing away',
                v->>'message' = 'If you are enrolled, your code arrives within 5 minutes. '
                             || 'Nothing yet? Check spam or contact us.',
                left(coalesce(v->>'message','null'),46));
exception when others then perform t_rec('R4 and even at the ceiling the reply gives nothing away', false, SQLERRM);
end $$;

-- A missing or unreadable header must never break sign in.
reset role;
set role postgres;
delete from auth_codes; delete from mail_outbox; delete from sign_in_attempts;
reset role;
set role anon;
do $$ declare v jsonb; begin
  perform set_config('request.headers','not json at all',true);
  v := request_sign_in_code('newstudent@gmail.com');
  perform t_rec('R5 a missing or broken header does not break sign in',
                (select count(*) from mail_outbox where to_email='newstudent@gmail.com') = 1,
                'queued='||(select count(*) from mail_outbox where to_email='newstudent@gmail.com'));
exception when others then perform t_rec('R5 a missing or broken header does not break sign in', false, SQLERRM);
end $$;

-- The address itself is not kept, only a hash of it, and the log is shut.
reset role;
set role postgres;
do $$ declare v_bad text; v_leak int; begin
  select string_agg(distinct privilege_type, ', ') into v_bad
    from information_schema.role_table_grants
   where table_schema='public' and table_name='sign_in_attempts'
     and grantee in ('anon','authenticated');
  select count(*) into v_leak from sign_in_attempts where email_hash like '%@%';
  perform t_rec('R6 the log holds no address in the clear, and nobody may read it',
                v_bad is null and v_leak = 0,
                coalesce('privileges still held: '||v_bad, 'no privileges')
                ||', addresses in the clear='||v_leak);
exception when others then perform t_rec('R6 the log holds no address in the clear, and nobody may read it', false, SQLERRM);
end $$;
reset role;

-- =====================================================================
-- S. the Send Email Hook, so Academy email reaches the public at all
-- =====================================================================
set role postgres;
delete from mail_outbox; delete from sign_in_attempts;
do $$ declare v_out jsonb; v_row record; begin
  v_out := send_email_hook(jsonb_build_object(
    'user', jsonb_build_object('email','NewLearner@Gmail.com'),
    'email_data', jsonb_build_object('token','482913','email_action_type','signup')));
  select * into v_row from mail_outbox limit 1;
  perform t_rec('S1 a sign up confirmation is queued for the mailer to collect',
                v_out = '{}'::jsonb and v_row.to_email = 'newlearner@gmail.com'
                and v_row.code_plain = '482913' and v_row.purpose = 'academy_signup',
                'purpose='||coalesce(v_row.purpose,'null')||' to='||coalesce(v_row.to_email,'null'));
exception when others then perform t_rec('S1 a sign up confirmation is queued for the mailer to collect', false, SQLERRM);
end $$;

do $$ declare v_out jsonb; v_p text; begin
  delete from mail_outbox;
  v_out := send_email_hook(jsonb_build_object(
    'user', jsonb_build_object('email','learner@gmail.com'),
    'email_data', jsonb_build_object('token','112233','email_action_type','recovery')));
  select purpose into v_p from mail_outbox limit 1;
  perform t_rec('S2 a password reset is marked as one, so it gets the right wording',
                v_p = 'academy_recovery', 'purpose='||coalesce(v_p,'null'));
exception when others then perform t_rec('S2 a password reset is marked as one, so it gets the right wording', false, SQLERRM);
end $$;

do $$ declare v_out jsonb; v_p text; begin
  delete from mail_outbox;
  v_out := send_email_hook(jsonb_build_object(
    'user', jsonb_build_object('email','learner@gmail.com'),
    'email_data', jsonb_build_object('token','445566','email_action_type','something_new')));
  select purpose into v_p from mail_outbox limit 1;
  perform t_rec('S3 a kind of email we have not met is still sent, not dropped',
                v_p = 'academy_other', 'purpose='||coalesce(v_p,'null'));
exception when others then perform t_rec('S3 a kind of email we have not met is still sent, not dropped', false, SQLERRM);
end $$;

do $$ declare v_out jsonb; begin
  delete from mail_outbox;
  v_out := send_email_hook(jsonb_build_object(
    'user', jsonb_build_object('email','learner@gmail.com'),
    'email_data', jsonb_build_object('email_action_type','signup')));
  perform t_rec('S4 a hook call with no code fails loudly instead of sending nothing',
                v_out ? 'error' and (select count(*) from mail_outbox) = 0,
                'answered '||left(v_out::text,50));
exception when others then perform t_rec('S4 a hook call with no code fails loudly instead of sending nothing', false, SQLERRM);
end $$;

do $$ declare v_out jsonb; begin
  delete from mail_outbox; delete from sign_in_attempts;
  insert into sign_in_attempts (email_hash, ip, outcome, at)
    select md5(g::text), null, 'sent', now() - interval '2 minutes' from generate_series(1,100) g;
  v_out := send_email_hook(jsonb_build_object(
    'user', jsonb_build_object('email','learner@gmail.com'),
    'email_data', jsonb_build_object('token','778899','email_action_type','signup')));
  perform t_rec('S5 the hook obeys the same site wide ceiling',
                v_out ? 'error' and (select count(*) from mail_outbox) = 0,
                'answered '||left(v_out::text,50));
exception when others then perform t_rec('S5 the hook obeys the same site wide ceiling', false, SQLERRM);
end $$;

do $$ declare v_bad text; begin
  select string_agg(distinct grantee, ', ') into v_bad
    from information_schema.role_routine_grants
   where routine_schema='public' and routine_name='send_email_hook'
     and grantee in ('anon','authenticated','PUBLIC');
  perform t_rec('S6 nobody from the browser can call the hook and make us email anybody',
                v_bad is null, coalesce('reachable by: '||v_bad,'nobody'));
end $$;

-- The mailer now needs to know which kind of email each row is.
do $$ declare v_res text; begin
  select pg_get_function_result(p.oid) into v_res
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='mail_fetch_pending';
  perform t_rec('S7 the mailer is told the purpose of every row it collects',
                v_res = 'TABLE(id uuid, to_email text, code_plain text, purpose text)',
                coalesce(v_res,'no such function'));
end $$;

do $$ declare v_n int; v_p text; begin
  delete from mail_outbox; delete from sign_in_attempts;
  insert into mail_outbox (to_email, code_plain) values ('old@gmail.com','000111');
  select purpose into v_p from mail_outbox where to_email='old@gmail.com';
  perform t_rec('S8 a row written the old way still counts as a certificate code',
                v_p = 'certificate_code', 'purpose='||coalesce(v_p,'null'));
exception when others then perform t_rec('S8 a row written the old way still counts as a certificate code', false, SQLERRM);
end $$;
reset role;

-- =====================================================================
-- T. nothing in this database deletes or updates without a where clause
--
-- Supabase refuses a bare delete or update on anything arriving through
-- the API, as error 21000, "DELETE requires a WHERE clause". The local
-- harness has no such protection, so the suite cannot reproduce it by
-- calling the function: it would pass here and fail on the live site,
-- which is exactly what happened on 7 October. The health check went out
-- as "database unreachable" because of one "delete from _h;".
--
-- So this is a STATIC check of the stored function bodies instead. It is
-- weaker than a live reproduction and it is honest about that, but it
-- catches the whole class before it ships.
-- =====================================================================
set role postgres;
do $$ declare v_bad text; begin
  select string_agg(p.proname || ': ' || m[1], ', ')
    into v_bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral regexp_matches(
      p.prosrc,
      '(delete\s+from\s+[a-zA-Z_][a-zA-Z0-9_]*\s*;|update\s+[a-zA-Z_][a-zA-Z0-9_]*\s+set\s+[^;]*?;)',
      'gi') as m
   where n.nspname = 'public'
     and p.prosrc is not null
     and (p.proname like 'lms\_%' or p.proname in
          ('system_health','send_email_hook','request_sign_in_code','request_certificate_code',
           'mail_fetch_pending','mail_mark_sent','mail_ping','sign_in_caller_ip'))
     and m[1] !~* 'where';
  perform t_rec('T1 no function deletes or updates without a where clause',
                v_bad is null,
                coalesce('Supabase would refuse these: ' || left(v_bad, 150), 'none'));
end $$;
reset role;
