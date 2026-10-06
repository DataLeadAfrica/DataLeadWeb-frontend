-- =====================================================================
-- 004  LEARNING: progress, watch tracking, quizzes
--
-- The non-skippable rule cannot be enforced in the browser, because the
-- browser belongs to the learner. So we cut each video into fixed
-- buckets and record which ones the SERVER has seen a heartbeat for.
-- Dragging the bar forward fills nothing.
--
-- Quizzes attach to EITHER a lesson (the short check after a lesson) OR
-- a module (the longer quiz at the end). Never both.
-- =====================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname='lms_question_type') then
    create type lms_question_type as enum ('single','multi','boolean','short_text');
  end if;
  if not exists (select 1 from pg_type where typname='lms_attempt_status') then
    create type lms_attempt_status as enum ('in_progress','passed','failed','abandoned');
  end if;
end $$;

-- ---------------------------------------------------------------- progress
create table if not exists lms_lesson_progress (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  lesson_id            uuid not null references lms_lessons(id) on delete cascade,
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  completed            boolean not null default false,
  completed_at         timestamptz,
  updated_at           timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index if not exists lms_progress_user_idx on lms_lesson_progress(user_id);

-- One row per ten seconds of video actually seen. Written only by a
-- server-side function, never by the client directly.
create table if not exists lms_watch_buckets (
  user_id       uuid not null references auth.users(id) on delete cascade,
  lesson_id     uuid not null references lms_lessons(id) on delete cascade,
  bucket_index  integer not null check (bucket_index >= 0),
  first_seen_at timestamptz not null default now(),
  primary key (user_id, lesson_id, bucket_index)
);

-- ---------------------------------------------------------------- quizzes
create table if not exists lms_quizzes (
  id                  uuid primary key default gen_random_uuid(),
  lesson_id           uuid references lms_lessons(id) on delete cascade,
  module_id           uuid references lms_modules(id) on delete cascade,
  title               text not null default '',
  pass_percent        integer not null default 70 check (pass_percent between 1 and 100),
  max_attempts        integer not null default 3 check (max_attempts between 1 and 20),
  serve_count         integer check (serve_count is null or serve_count > 0),
  retake_after_minutes integer not null default 0 check (retake_after_minutes >= 0),
  shuffle             boolean not null default true,
  status              lms_status not null default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- exactly one owner: a lesson check or a module quiz
  constraint lms_quizzes_one_owner check (
    (lesson_id is not null and module_id is null)
    or (lesson_id is null and module_id is not null)
  )
);
create unique index if not exists lms_quizzes_lesson_uniq
  on lms_quizzes(lesson_id) where lesson_id is not null;
create unique index if not exists lms_quizzes_module_uniq
  on lms_quizzes(module_id) where module_id is not null;

drop trigger if exists lms_quizzes_touch on lms_quizzes;
create trigger lms_quizzes_touch before update on lms_quizzes
  for each row execute function lms_touch();

create table if not exists lms_questions (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references lms_quizzes(id) on delete cascade,
  prompt      text not null,
  type        lms_question_type not null default 'single',
  position    integer not null check (position > 0),
  marks       integer not null default 1 check (marks > 0),
  explanation text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (quiz_id, position) deferrable initially deferred
);
create index if not exists lms_questions_quiz_idx
  on lms_questions(quiz_id, position) where active;

-- For single, multi and boolean, the options are the choices.
-- For short_text, each row marked correct is an ACCEPTED answer, so a
-- question can accept "vlookup" and "v lookup" without extra machinery.
create table if not exists lms_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references lms_questions(id) on delete cascade,
  label       text not null,
  is_correct  boolean not null default false,
  position    integer not null check (position > 0),
  unique (question_id, position) deferrable initially deferred
);
create index if not exists lms_options_question_idx on lms_options(question_id, position);

create table if not exists lms_quiz_attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  quiz_id            uuid not null references lms_quizzes(id) on delete cascade,
  attempt_no         integer not null check (attempt_no > 0),
  served_question_ids uuid[] not null default '{}',
  answers            jsonb not null default '{}'::jsonb,
  score              integer,
  max_score          integer,
  percent            numeric(5,2),
  passed             boolean,
  status             lms_attempt_status not null default 'in_progress',
  started_at         timestamptz not null default now(),
  submitted_at       timestamptz,
  unique (user_id, quiz_id, attempt_no)
);
create index if not exists lms_attempts_lookup
  on lms_quiz_attempts(user_id, quiz_id, status);
