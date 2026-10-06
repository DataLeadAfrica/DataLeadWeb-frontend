-- =====================================================================
-- 002  CATALOGUE: courses, modules, lessons, paths, page settings
--
-- Shape: a COURSE holds MODULES, a module holds LESSONS, in that order.
-- Module counts and hours are never stored. They are counted from the
-- rows themselves, so a typed number can never disagree with reality.
-- =====================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname='lms_status') then
    create type lms_status as enum ('draft','published','archived');
  end if;
  if not exists (select 1 from pg_type where typname='lms_level') then
    create type lms_level as enum ('Beginner','Intermediate','Mastery');
  end if;
  if not exists (select 1 from pg_type where typname='lms_lesson_type') then
    create type lms_lesson_type as enum ('video','reading','quiz','download');
  end if;
end $$;

-- ---------------------------------------------------------------- courses
create table if not exists lms_courses (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  tool             text not null default '',
  area             text not null default '',
  level            lms_level not null default 'Beginner',
  summary          text not null default '',
  cover_code       text not null default '',
  price_kobo       integer not null default 0 check (price_kobo >= 0),
  first_module_free boolean not null default false,
  status           lms_status not null default 'draft',
  published_at     timestamptz,
  -- Option A: an Academy course is also a programme row, so the existing
  -- certificate numbering and /verify page work with no changes at all.
  programme_id     uuid references programmes(id) on delete set null,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint lms_courses_published_has_date
    check (status <> 'published' or published_at is not null)
);
create index if not exists lms_courses_status_idx on lms_courses(status);
create index if not exists lms_courses_area_idx on lms_courses(area);

drop trigger if exists lms_courses_touch on lms_courses;
create trigger lms_courses_touch before update on lms_courses
  for each row execute function lms_touch();

-- ---------------------------------------------------------------- modules
create table if not exists lms_modules (
  id        uuid primary key default gen_random_uuid(),
  course_id uuid not null references lms_courses(id) on delete cascade,
  title     text not null,
  summary   text not null default '',
  position  integer not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (course_id, position) deferrable initially deferred
);
create index if not exists lms_modules_course_idx on lms_modules(course_id, position);

-- ---------------------------------------------------------------- lessons
create table if not exists lms_lessons (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references lms_modules(id) on delete cascade,
  title       text not null,
  summary     text not null default '',
  type        lms_lesson_type not null default 'video',
  position    integer not null check (position > 0),
  -- provider plus reference, never a full URL, so the host can change
  -- without a migration and without touching any other column
  video_provider text,
  video_ref      text,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  -- how the non-skippable rule is measured for THIS lesson
  bucket_seconds   integer not null default 10 check (bucket_seconds between 5 and 60),
  coverage_percent integer not null default 92 check (coverage_percent between 50 and 100),
  content_md  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (module_id, position) deferrable initially deferred,
  -- a video lesson is only complete when it has both a video and a length
  constraint lms_lessons_video_complete check (
    type <> 'video'
    or (video_provider is not null and video_ref is not null and duration_seconds is not null)
    or (video_provider is null and video_ref is null and duration_seconds is null)
  )
);
create index if not exists lms_lessons_module_idx on lms_lessons(module_id, position);

drop trigger if exists lms_lessons_touch on lms_lessons;
create trigger lms_lessons_touch before update on lms_lessons
  for each row execute function lms_touch();

-- ---------------------------------------------------------------- paths
create table if not exists lms_paths (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text not null default '',
  position    integer not null default 1,
  status      lms_status not null default 'draft',
  created_at  timestamptz not null default now()
);

create table if not exists lms_path_courses (
  path_id   uuid not null references lms_paths(id) on delete cascade,
  course_id uuid not null references lms_courses(id) on delete cascade,
  position  integer not null check (position > 0),
  primary key (path_id, course_id)
);
create index if not exists lms_path_courses_order
  on lms_path_courses(path_id, position);

-- ---------------------------------------------------------------- settings
-- One row. The words on the landing page live here so they can be
-- changed from the control room without a code change.
create table if not exists lms_settings (
  id                integer primary key default 1 check (id = 1),
  headline          text not null default 'Learn one tool at a time.',
  subhead           text not null default '',
  announce_on       boolean not null default false,
  announce_text     text not null default '',
  welcome_provider  text,
  welcome_ref       text,
  welcome_seconds   integer,
  updated_at        timestamptz not null default now()
);
insert into lms_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists lms_settings_touch on lms_settings;
create trigger lms_settings_touch before update on lms_settings
  for each row execute function lms_touch();
