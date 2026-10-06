-- =====================================================================
-- 003  ACCESS: who may open what, and how money turns into access
--
-- One table decides access: lms_entitlements. Nothing else grants it.
-- Orders and enrolments are REASONS; a server-side function turns a
-- reason into an entitlement row. That is what stops the purchase path
-- and the bootcamp path fighting each other.
--
-- course_id NULL means the whole catalogue. That is how a bootcamp
-- student gets everything without one row per course, and without a
-- backfill every time a new course is published.
-- =====================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname='lms_grant_source') then
    create type lms_grant_source as enum ('free','purchase','roster','manual','scholarship');
  end if;
  if not exists (select 1 from pg_type where typname='lms_grant_status') then
    create type lms_grant_status as enum ('active','revoked');
  end if;
  if not exists (select 1 from pg_type where typname='lms_order_status') then
    create type lms_order_status as enum ('pending','paid','failed','refunded');
  end if;
end $$;

create table if not exists lms_entitlements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  course_id     uuid references lms_courses(id) on delete cascade,  -- null = everything
  source        lms_grant_source not null,
  status        lms_grant_status not null default 'active',
  granted_by    uuid references auth.users(id) on delete set null,
  granted_at    timestamptz not null default now(),
  expires_at    timestamptz,
  revoked_at    timestamptz,
  revoked_by    uuid references auth.users(id) on delete set null,
  revoke_reason text
);

-- one live grant per person per course, while keeping the history
create unique index if not exists lms_entitlements_live_course
  on lms_entitlements(user_id, course_id)
  where status = 'active' and course_id is not null;
create unique index if not exists lms_entitlements_live_all
  on lms_entitlements(user_id)
  where status = 'active' and course_id is null;
create index if not exists lms_entitlements_user_idx
  on lms_entitlements(user_id, status);

-- ---------------------------------------------------------------- orders
create table if not exists lms_orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  course_id    uuid not null references lms_courses(id) on delete restrict,
  reference    text not null unique,
  amount_kobo  integer not null check (amount_kobo >= 0),
  currency     text not null default 'NGN',
  status       lms_order_status not null default 'pending',
  initiated_at timestamptz not null default now(),
  paid_at      timestamptz
);
create index if not exists lms_orders_user_idx on lms_orders(user_id, status);

-- Paystack sends the same event more than once. The unique id below is
-- what makes a repeat delivery harmless instead of a double grant.
create table if not exists lms_payment_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null default 'paystack',
  provider_event_id text not null,
  order_id          uuid references lms_orders(id) on delete set null,
  payload           jsonb not null default '{}'::jsonb,
  received_at       timestamptz not null default now(),
  processed_at      timestamptz,
  unique (provider, provider_event_id)
);
