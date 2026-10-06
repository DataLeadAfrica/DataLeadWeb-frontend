# Live schema snapshot

Taken from the Data-Lead Academy database on 6 October 2026, by a read only query
against the certification Supabase project. This is the state of the database as it
actually is, not what any file says it should be.

**At the time of this snapshot, file 10 had not been run.** The staff role is still
called `uploader` and there is no `lms_facilitators` table.

This file contains no keys, tokens, passwords or project URLs. The bodies of the five
certification sign in and mailer functions are deliberately left out, because this
repository is public and those are sign in machinery; their names and purposes are listed
at the end.

## What is here

| Kind | Count |
| --- | --- |
| table | 25 |
| enum | 9 |
| index | 45 |
| policy | 29 |
| privilege | 36 |
| function | 29 |
| trigger | 5 |
| view | 1 |

## Enums

| Type | Values in order |
| --- | --- |
| `lms_attempt_status` | in_progress, passed, failed, abandoned |
| `lms_grant_source` | free, purchase, roster, manual, scholarship |
| `lms_grant_status` | active, revoked |
| `lms_lesson_type` | video, reading, quiz, download |
| `lms_level` | Beginner, Intermediate, Mastery |
| `lms_order_status` | pending, paid, failed, refunded |
| `lms_question_type` | single, multi, boolean, short_text |
| `lms_role` | learner, uploader, admin |
| `lms_status` | draft, published, archived |

## Tables

Each table below lists its columns, then its indexes, policies, privileges and triggers.

### auth_codes  (certification system, predates the Academy)

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `email_norm` | text | NOT NULL |  |
| `code_hash` | text | NOT NULL |  |
| `expires_at` | timestamp with time zone | NOT NULL |  |
| `attempts` | integer | NOT NULL | `0` |
| `consumed` | boolean | NOT NULL | `false` |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |

### certificates  (certification system, predates the Academy)

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `certificate_number` | text | NOT NULL |  |
| `participant_id` | uuid | NOT NULL |  |
| `programme_id` | uuid | NOT NULL |  |
| `completed_on` | date | NOT NULL |  |
| `issued_at` | timestamp with time zone | NOT NULL | `now()` |
| `issued_by` | text | null ok |  |
| `revoked` | boolean | NOT NULL | `false` |
| `revoked_reason` | text | null ok |  |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |
| `module_id` | uuid | null ok |  |

### lms_admin_actions

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `actor_id` | uuid | null ok |  |
| `action` | text | NOT NULL |  |
| `subject_type` | text | null ok |  |
| `subject_id` | uuid | null ok |  |
| `detail` | jsonb | NOT NULL | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |

Indexes:

- `lms_admin_actions_pkey`: CREATE UNIQUE INDEX lms_admin_actions_pkey ON public.lms_admin_actions USING btree (id)
- `lms_admin_actions_time_idx`: CREATE INDEX lms_admin_actions_time_idx ON public.lms_admin_actions USING btree (created_at DESC)

Row level security policies:

- `p_audit_admin`: command: SELECT<br>roles: authenticated<br>using: lms_is_admin()<br>check: -

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### lms_course_cards  (this is a VIEW, not a table)

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | null ok |  |
| `slug` | text | null ok |  |
| `title` | text | null ok |  |
| `tool` | text | null ok |  |
| `area` | text | null ok |  |
| `level` | USER-DEFINED | null ok |  |
| `summary` | text | null ok |  |
| `cover_code` | text | null ok |  |
| `price_kobo` | integer | null ok |  |
| `first_module_free` | boolean | null ok |  |
| `status` | USER-DEFINED | null ok |  |
| `published_at` | timestamp with time zone | null ok |  |
| `module_count` | bigint | null ok |  |
| `lesson_count` | bigint | null ok |  |
| `total_seconds` | bigint | null ok |  |

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### lms_courses

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `slug` | text | NOT NULL |  |
| `title` | text | NOT NULL |  |
| `tool` | text | NOT NULL | `''::text` |
| `area` | text | NOT NULL | `''::text` |
| `level` | USER-DEFINED | NOT NULL | `'Beginner'::lms_level` |
| `summary` | text | NOT NULL | `''::text` |
| `cover_code` | text | NOT NULL | `''::text` |
| `price_kobo` | integer | NOT NULL | `0` |
| `first_module_free` | boolean | NOT NULL | `false` |
| `status` | USER-DEFINED | NOT NULL | `'draft'::lms_status` |
| `published_at` | timestamp with time zone | null ok |  |
| `programme_id` | uuid | null ok |  |
| `created_by` | uuid | null ok |  |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |
| `updated_at` | timestamp with time zone | NOT NULL | `now()` |

Indexes:

- `lms_courses_area_idx`: CREATE INDEX lms_courses_area_idx ON public.lms_courses USING btree (area)
- `lms_courses_pkey`: CREATE UNIQUE INDEX lms_courses_pkey ON public.lms_courses USING btree (id)
- `lms_courses_slug_key`: CREATE UNIQUE INDEX lms_courses_slug_key ON public.lms_courses USING btree (slug)
- `lms_courses_status_idx`: CREATE INDEX lms_courses_status_idx ON public.lms_courses USING btree (status)

Row level security policies:

- `p_courses_admin_all`: command: ALL<br>roles: authenticated<br>using: lms_is_admin()<br>check: lms_is_admin()
- `p_courses_public`: command: SELECT<br>roles: anon, authenticated<br>using: ((status = 'published'::lms_status) OR lms_is_staff())<br>check: -

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

Triggers:

- `lms_courses_touch`: BEFORE UPDATE: EXECUTE FUNCTION lms_touch()

### lms_entitlements

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `user_id` | uuid | NOT NULL |  |
| `course_id` | uuid | null ok |  |
| `source` | USER-DEFINED | NOT NULL |  |
| `status` | USER-DEFINED | NOT NULL | `'active'::lms_grant_status` |
| `granted_by` | uuid | null ok |  |
| `granted_at` | timestamp with time zone | NOT NULL | `now()` |
| `expires_at` | timestamp with time zone | null ok |  |
| `revoked_at` | timestamp with time zone | null ok |  |
| `revoked_by` | uuid | null ok |  |
| `revoke_reason` | text | null ok |  |

Indexes:

- `lms_entitlements_live_all`: CREATE UNIQUE INDEX lms_entitlements_live_all ON public.lms_entitlements USING btree (user_id) WHERE ((status = 'active'::lms_grant_status) AND (course_id IS NULL))
- `lms_entitlements_live_course`: CREATE UNIQUE INDEX lms_entitlements_live_course ON public.lms_entitlements USING btree (user_id, course_id) WHERE ((status = 'active'::lms_grant_status) AND (course_id IS NOT NULL))
- `lms_entitlements_pkey`: CREATE UNIQUE INDEX lms_entitlements_pkey ON public.lms_entitlements USING btree (id)
- `lms_entitlements_user_idx`: CREATE INDEX lms_entitlements_user_idx ON public.lms_entitlements USING btree (user_id, status)

Row level security policies:

- `p_ent_admin`: command: ALL<br>roles: authenticated<br>using: lms_is_admin()<br>check: lms_is_admin()
- `p_ent_self`: command: SELECT<br>roles: authenticated<br>using: ((user_id = auth.uid()) OR lms_is_admin())<br>check: -

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### lms_lesson_progress

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `user_id` | uuid | NOT NULL |  |
| `lesson_id` | uuid | NOT NULL |  |
| `last_position_seconds` | integer | NOT NULL | `0` |
| `completed` | boolean | NOT NULL | `false` |
| `completed_at` | timestamp with time zone | null ok |  |
| `updated_at` | timestamp with time zone | NOT NULL | `now()` |

Indexes:

- `lms_lesson_progress_pkey`: CREATE UNIQUE INDEX lms_lesson_progress_pkey ON public.lms_lesson_progress USING btree (id)
- `lms_lesson_progress_user_id_lesson_id_key`: CREATE UNIQUE INDEX lms_lesson_progress_user_id_lesson_id_key ON public.lms_lesson_progress USING btree (user_id, lesson_id)
- `lms_progress_user_idx`: CREATE INDEX lms_progress_user_idx ON public.lms_lesson_progress USING btree (user_id)

Row level security policies:

- `p_prog_self`: command: SELECT<br>roles: authenticated<br>using: ((user_id = auth.uid()) OR lms_is_admin())<br>check: -
- `p_prog_self_write`: command: UPDATE<br>roles: authenticated<br>using: (user_id = auth.uid())<br>check: (user_id = auth.uid())

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### lms_lessons

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `module_id` | uuid | NOT NULL |  |
| `title` | text | NOT NULL |  |
| `summary` | text | NOT NULL | `''::text` |
| `type` | USER-DEFINED | NOT NULL | `'video'::lms_lesson_type` |
| `position` | integer | NOT NULL |  |
| `video_provider` | text | null ok |  |
| `video_ref` | text | null ok |  |
| `duration_seconds` | integer | null ok |  |
| `bucket_seconds` | integer | NOT NULL | `10` |
| `coverage_percent` | integer | NOT NULL | `92` |
| `content_md` | text | NOT NULL | `''::text` |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |
| `updated_at` | timestamp with time zone | NOT NULL | `now()` |

Indexes:

- `lms_lessons_module_id_position_key`: CREATE UNIQUE INDEX lms_lessons_module_id_position_key ON public.lms_lessons USING btree (module_id, "position")
- `lms_lessons_module_idx`: CREATE INDEX lms_lessons_module_idx ON public.lms_lessons USING btree (module_id, "position")
- `lms_lessons_pkey`: CREATE UNIQUE INDEX lms_lessons_pkey ON public.lms_lessons USING btree (id)

Row level security policies:

- `p_lessons_admin`: command: ALL<br>roles: authenticated<br>using: lms_is_admin()<br>check: lms_is_admin()
- `p_lessons_public`: command: SELECT<br>roles: anon, authenticated<br>using: (lms_is_staff() OR (EXISTS ( SELECT 1<br>   FROM (lms_modules m<br>     JOIN lms_courses c ON ((c.id = m.course_id)))<br>  WHERE ((m.id = lms_lessons.module_id) AND (c.status = 'published'::lms_status)))))<br>check: -
- `p_lessons_uploader`: command: UPDATE<br>roles: authenticated<br>using: (lms_my_role() = 'uploader'::lms_role)<br>check: (lms_my_role() = 'uploader'::lms_role)

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

Triggers:

- `lms_lessons_touch`: BEFORE UPDATE: EXECUTE FUNCTION lms_touch()

### lms_modules

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `course_id` | uuid | NOT NULL |  |
| `title` | text | NOT NULL |  |
| `summary` | text | NOT NULL | `''::text` |
| `position` | integer | NOT NULL |  |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |

Indexes:

- `lms_modules_course_id_position_key`: CREATE UNIQUE INDEX lms_modules_course_id_position_key ON public.lms_modules USING btree (course_id, "position")
- `lms_modules_course_idx`: CREATE INDEX lms_modules_course_idx ON public.lms_modules USING btree (course_id, "position")
- `lms_modules_pkey`: CREATE UNIQUE INDEX lms_modules_pkey ON public.lms_modules USING btree (id)

Row level security policies:

- `p_modules_admin`: command: ALL<br>roles: authenticated<br>using: lms_is_admin()<br>check: lms_is_admin()
- `p_modules_public`: command: SELECT<br>roles: anon, authenticated<br>using: (lms_is_staff() OR (EXISTS ( SELECT 1<br>   FROM lms_courses c<br>  WHERE ((c.id = lms_modules.course_id) AND (c.status = 'published'::lms_status)))))<br>check: -

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### lms_options

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `question_id` | uuid | NOT NULL |  |
| `label` | text | NOT NULL |  |
| `is_correct` | boolean | NOT NULL | `false` |
| `position` | integer | NOT NULL |  |

Indexes:

- `lms_options_pkey`: CREATE UNIQUE INDEX lms_options_pkey ON public.lms_options USING btree (id)
- `lms_options_question_id_position_key`: CREATE UNIQUE INDEX lms_options_question_id_position_key ON public.lms_options USING btree (question_id, "position")
- `lms_options_question_idx`: CREATE INDEX lms_options_question_idx ON public.lms_options USING btree (question_id, "position")

Row level security policies:

- `p_opt_admin_only`: command: ALL<br>roles: authenticated<br>using: lms_is_admin()<br>check: lms_is_admin()

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### lms_orders

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `user_id` | uuid | NOT NULL |  |
| `course_id` | uuid | NOT NULL |  |
| `reference` | text | NOT NULL |  |
| `amount_kobo` | integer | NOT NULL |  |
| `currency` | text | NOT NULL | `'NGN'::text` |
| `status` | USER-DEFINED | NOT NULL | `'pending'::lms_order_status` |
| `initiated_at` | timestamp with time zone | NOT NULL | `now()` |
| `paid_at` | timestamp with time zone | null ok |  |

Indexes:

- `lms_orders_pkey`: CREATE UNIQUE INDEX lms_orders_pkey ON public.lms_orders USING btree (id)
- `lms_orders_reference_key`: CREATE UNIQUE INDEX lms_orders_reference_key ON public.lms_orders USING btree (reference)
- `lms_orders_user_idx`: CREATE INDEX lms_orders_user_idx ON public.lms_orders USING btree (user_id, status)

Row level security policies:

- `p_orders_self`: command: SELECT<br>roles: authenticated<br>using: ((user_id = auth.uid()) OR lms_is_admin())<br>check: -

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### lms_path_courses

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `path_id` | uuid | NOT NULL |  |
| `course_id` | uuid | NOT NULL |  |
| `position` | integer | NOT NULL |  |

Indexes:

- `lms_path_courses_order`: CREATE INDEX lms_path_courses_order ON public.lms_path_courses USING btree (path_id, "position")
- `lms_path_courses_pkey`: CREATE UNIQUE INDEX lms_path_courses_pkey ON public.lms_path_courses USING btree (path_id, course_id)

Row level security policies:

- `p_pathc_admin`: command: ALL<br>roles: authenticated<br>using: lms_is_admin()<br>check: lms_is_admin()
- `p_pathc_public`: command: SELECT<br>roles: anon, authenticated<br>using: true<br>check: -

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### lms_paths

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `slug` | text | NOT NULL |  |
| `name` | text | NOT NULL |  |
| `description` | text | NOT NULL | `''::text` |
| `position` | integer | NOT NULL | `1` |
| `status` | USER-DEFINED | NOT NULL | `'draft'::lms_status` |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |

Indexes:

- `lms_paths_pkey`: CREATE UNIQUE INDEX lms_paths_pkey ON public.lms_paths USING btree (id)
- `lms_paths_slug_key`: CREATE UNIQUE INDEX lms_paths_slug_key ON public.lms_paths USING btree (slug)

Row level security policies:

- `p_paths_admin`: command: ALL<br>roles: authenticated<br>using: lms_is_admin()<br>check: lms_is_admin()
- `p_paths_public`: command: SELECT<br>roles: anon, authenticated<br>using: ((status = 'published'::lms_status) OR lms_is_admin())<br>check: -

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### lms_payment_events

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `provider` | text | NOT NULL | `'paystack'::text` |
| `provider_event_id` | text | NOT NULL |  |
| `order_id` | uuid | null ok |  |
| `payload` | jsonb | NOT NULL | `'{}'::jsonb` |
| `received_at` | timestamp with time zone | NOT NULL | `now()` |
| `processed_at` | timestamp with time zone | null ok |  |

Indexes:

- `lms_payment_events_pkey`: CREATE UNIQUE INDEX lms_payment_events_pkey ON public.lms_payment_events USING btree (id)
- `lms_payment_events_provider_provider_event_id_key`: CREATE UNIQUE INDEX lms_payment_events_provider_provider_event_id_key ON public.lms_payment_events USING btree (provider, provider_event_id)

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### lms_profiles

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL |  |
| `full_name` | text | NOT NULL | `''::text` |
| `phone` | text | null ok |  |
| `role` | USER-DEFINED | NOT NULL | `'learner'::lms_role` |
| `participant_id` | uuid | null ok |  |
| `linked_at` | timestamp with time zone | null ok |  |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |
| `updated_at` | timestamp with time zone | NOT NULL | `now()` |

Indexes:

- `lms_profiles_participant_uniq`: CREATE UNIQUE INDEX lms_profiles_participant_uniq ON public.lms_profiles USING btree (participant_id) WHERE (participant_id IS NOT NULL)
- `lms_profiles_pkey`: CREATE UNIQUE INDEX lms_profiles_pkey ON public.lms_profiles USING btree (id)
- `lms_profiles_role_idx`: CREATE INDEX lms_profiles_role_idx ON public.lms_profiles USING btree (role)

Row level security policies:

- `p_profiles_admin_write`: command: UPDATE<br>roles: authenticated<br>using: lms_is_admin()<br>check: lms_is_admin()
- `p_profiles_self_read`: command: SELECT<br>roles: authenticated<br>using: ((id = auth.uid()) OR lms_is_admin())<br>check: -
- `p_profiles_self_write`: command: UPDATE<br>roles: authenticated<br>using: (id = auth.uid())<br>check: ((id = auth.uid()) AND (role = lms_my_role()))

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

Triggers:

- `lms_profiles_touch`: BEFORE UPDATE: EXECUTE FUNCTION lms_touch()

### lms_questions

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `quiz_id` | uuid | NOT NULL |  |
| `prompt` | text | NOT NULL |  |
| `type` | USER-DEFINED | NOT NULL | `'single'::lms_question_type` |
| `position` | integer | NOT NULL |  |
| `marks` | integer | NOT NULL | `1` |
| `explanation` | text | NOT NULL | `''::text` |
| `active` | boolean | NOT NULL | `true` |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |

Indexes:

- `lms_questions_pkey`: CREATE UNIQUE INDEX lms_questions_pkey ON public.lms_questions USING btree (id)
- `lms_questions_quiz_id_position_key`: CREATE UNIQUE INDEX lms_questions_quiz_id_position_key ON public.lms_questions USING btree (quiz_id, "position")
- `lms_questions_quiz_idx`: CREATE INDEX lms_questions_quiz_idx ON public.lms_questions USING btree (quiz_id, "position") WHERE active

Row level security policies:

- `p_q_admin`: command: ALL<br>roles: authenticated<br>using: lms_is_admin()<br>check: lms_is_admin()
- `p_q_public`: command: SELECT<br>roles: authenticated<br>using: (lms_is_admin() OR (EXISTS ( SELECT 1<br>   FROM lms_quizzes z<br>  WHERE ((z.id = lms_questions.quiz_id) AND (z.status = 'published'::lms_status)))))<br>check: -

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### lms_quiz_attempts

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `user_id` | uuid | NOT NULL |  |
| `quiz_id` | uuid | NOT NULL |  |
| `attempt_no` | integer | NOT NULL |  |
| `served_question_ids` | ARRAY | NOT NULL | `'{}'::uuid[]` |
| `answers` | jsonb | NOT NULL | `'{}'::jsonb` |
| `score` | integer | null ok |  |
| `max_score` | integer | null ok |  |
| `percent` | numeric | null ok |  |
| `passed` | boolean | null ok |  |
| `status` | USER-DEFINED | NOT NULL | `'in_progress'::lms_attempt_status` |
| `started_at` | timestamp with time zone | NOT NULL | `now()` |
| `submitted_at` | timestamp with time zone | null ok |  |

Indexes:

- `lms_attempts_lookup`: CREATE INDEX lms_attempts_lookup ON public.lms_quiz_attempts USING btree (user_id, quiz_id, status)
- `lms_quiz_attempts_pkey`: CREATE UNIQUE INDEX lms_quiz_attempts_pkey ON public.lms_quiz_attempts USING btree (id)
- `lms_quiz_attempts_user_id_quiz_id_attempt_no_key`: CREATE UNIQUE INDEX lms_quiz_attempts_user_id_quiz_id_attempt_no_key ON public.lms_quiz_attempts USING btree (user_id, quiz_id, attempt_no)

Row level security policies:

- `p_att_self`: command: SELECT<br>roles: authenticated<br>using: ((user_id = auth.uid()) OR lms_is_admin())<br>check: -

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### lms_quizzes

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `lesson_id` | uuid | null ok |  |
| `module_id` | uuid | null ok |  |
| `title` | text | NOT NULL | `''::text` |
| `pass_percent` | integer | NOT NULL | `70` |
| `max_attempts` | integer | NOT NULL | `3` |
| `serve_count` | integer | null ok |  |
| `retake_after_minutes` | integer | NOT NULL | `0` |
| `shuffle` | boolean | NOT NULL | `true` |
| `status` | USER-DEFINED | NOT NULL | `'draft'::lms_status` |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |
| `updated_at` | timestamp with time zone | NOT NULL | `now()` |

Indexes:

- `lms_quizzes_lesson_uniq`: CREATE UNIQUE INDEX lms_quizzes_lesson_uniq ON public.lms_quizzes USING btree (lesson_id) WHERE (lesson_id IS NOT NULL)
- `lms_quizzes_module_uniq`: CREATE UNIQUE INDEX lms_quizzes_module_uniq ON public.lms_quizzes USING btree (module_id) WHERE (module_id IS NOT NULL)
- `lms_quizzes_pkey`: CREATE UNIQUE INDEX lms_quizzes_pkey ON public.lms_quizzes USING btree (id)

Row level security policies:

- `p_quiz_admin`: command: ALL<br>roles: authenticated<br>using: lms_is_admin()<br>check: lms_is_admin()
- `p_quiz_public`: command: SELECT<br>roles: authenticated<br>using: ((status = 'published'::lms_status) OR lms_is_admin())<br>check: -

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

Triggers:

- `lms_quizzes_touch`: BEFORE UPDATE: EXECUTE FUNCTION lms_touch()

### lms_settings

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | integer | NOT NULL | `1` |
| `headline` | text | NOT NULL | `'Learn one tool at a time.'::text` |
| `subhead` | text | NOT NULL | `''::text` |
| `announce_on` | boolean | NOT NULL | `false` |
| `announce_text` | text | NOT NULL | `''::text` |
| `welcome_provider` | text | null ok |  |
| `welcome_ref` | text | null ok |  |
| `welcome_seconds` | integer | null ok |  |
| `updated_at` | timestamp with time zone | NOT NULL | `now()` |

Indexes:

- `lms_settings_pkey`: CREATE UNIQUE INDEX lms_settings_pkey ON public.lms_settings USING btree (id)

Row level security policies:

- `p_settings_admin`: command: ALL<br>roles: authenticated<br>using: lms_is_admin()<br>check: lms_is_admin()
- `p_settings_public`: command: SELECT<br>roles: anon, authenticated<br>using: true<br>check: -

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

Triggers:

- `lms_settings_touch`: BEFORE UPDATE: EXECUTE FUNCTION lms_touch()

### lms_watch_buckets

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `user_id` | uuid | NOT NULL |  |
| `lesson_id` | uuid | NOT NULL |  |
| `bucket_index` | integer | NOT NULL |  |
| `first_seen_at` | timestamp with time zone | NOT NULL | `now()` |

Indexes:

- `lms_watch_buckets_pkey`: CREATE UNIQUE INDEX lms_watch_buckets_pkey ON public.lms_watch_buckets USING btree (user_id, lesson_id, bucket_index)

Row level security policies:

- `p_buckets_self`: command: SELECT<br>roles: authenticated<br>using: ((user_id = auth.uid()) OR lms_is_admin())<br>check: -

Table privileges:

- `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### mail_outbox  (certification system, predates the Academy)

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `to_email` | text | NOT NULL |  |
| `code_plain` | text | NOT NULL |  |
| `sent` | boolean | NOT NULL | `false` |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |
| `claimed_at` | timestamp with time zone | null ok |  |

### mailer_token  (certification system, predates the Academy)

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | integer | NOT NULL | `1` |
| `token_hash` | text | NOT NULL |  |
| `updated_at` | timestamp with time zone | NOT NULL | `now()` |

### participant_enrolments  (certification system, predates the Academy)

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `participant_id` | uuid | NOT NULL |  |
| `programme_id` | uuid | NOT NULL |  |
| `cohort` | text | NOT NULL | `'default'::text` |
| `status` | text | NOT NULL | `'active'::text` |
| `starts_on` | date | null ok |  |
| `ends_on` | date | null ok |  |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |

### participants  (certification system, predates the Academy)

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `full_name` | text | NOT NULL |  |
| `email` | text | null ok |  |
| `email_norm` | text | null ok |  |
| `phone` | text | null ok |  |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |

### programmes  (certification system, predates the Academy)

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | NOT NULL | `gen_random_uuid()` |
| `slug` | text | NOT NULL |  |
| `title` | text | NOT NULL |  |
| `code` | text | NOT NULL |  |
| `duration_text` | text | null ok |  |
| `tools` | ARRAY | null ok |  |
| `course_url` | text | null ok |  |
| `template_key` | text | NOT NULL | `'default'::text` |
| `active` | boolean | NOT NULL | `true` |
| `created_at` | timestamp with time zone | NOT NULL | `now()` |

## View definition

### lms_course_cards

```sql
SELECT id,<br>    slug,<br>    title,<br>    tool,<br>    area,<br>    level,<br>    summary,<br>    cover_code,<br>    price_kobo,<br>    first_module_free,<br>    status,<br>    published_at,<br>    ( SELECT count(*) AS count<br>           FROM lms_modules m<br>          WHERE (m.course_id = c.id)) AS module_count,<br>    ( SELECT count(*) AS count<br>           FROM (lms_lessons l<br>             JOIN lms_modules m ON ((m.id = l.module_id)))<br>          WHERE (m.course_id = c.id)) AS lesson_count,<br>    COALESCE(( SELECT sum(l.duration_seconds) AS sum<br>           FROM (lms_lessons l<br>             JOIN lms_modules m ON ((m.id = l.module_id)))<br>          WHERE (m.course_id = c.id)), (0)::bigint) AS total_seconds<br>   FROM lms_courses c;
```

## Functions

### Academy functions, in full

#### lms_attempt_marks(p_attempt uuid)

```sql
CREATE OR REPLACE FUNCTION public.lms_attempt_marks(p_attempt uuid)
 RETURNS TABLE(question_id uuid, prompt text, was_right boolean, explanation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$

```

#### lms_claim_bootcamp_access()

```sql
CREATE OR REPLACE FUNCTION public.lms_claim_bootcamp_access()
 RETURNS TABLE(granted boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_email text; v_part uuid; v_ends date;
begin
  if v_uid is null then
    return query select false, 'Please sign in first.'; return;
  end if;
  select email, email_confirmed_at into v_email, v_ends
    from auth.users where id = v_uid;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    return query select false, 'Please confirm your email address first.'; return;
  end if;

  perform lms_link_participant(v_uid, v_email);
  select participant_id into v_part from lms_profiles where id = v_uid;
  if v_part is null then
    return query select false, 'We could not find a bootcamp enrolment for this email address.'; return;
  end if;

  select max(e.ends_on) into v_ends
    from participant_enrolments e
   where e.participant_id = v_part and e.status = 'active';

  if not exists (select 1 from participant_enrolments e
                  where e.participant_id = v_part and e.status = 'active') then
    return query select false, 'That enrolment is not active.'; return;
  end if;

  insert into lms_entitlements (user_id, course_id, source, expires_at)
  values (v_uid, null, 'roster',
          case when v_ends is null then null else (v_ends + 1)::timestamptz end)
  on conflict do nothing;

  return query select true, 'Your bootcamp access is open. Every course is available to you.';
end $function$

```

#### lms_complete_lesson(p_lesson uuid)

```sql
CREATE OR REPLACE FUNCTION public.lms_complete_lesson(p_lesson uuid)
 RETURNS TABLE(completed boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_type lms_lesson_type; v_need integer; v_cov numeric; v_quiz uuid;
begin
  if v_uid is null then return query select false, 'Please sign in.'; return; end if;
  if not lms_lesson_is_open(p_lesson) then return query select false, 'You do not have access to this lesson.'; return; end if;
  if not lms_is_lesson_unlocked(p_lesson) then return query select false, 'Finish the lesson before this one first.'; return; end if;

  select type, coverage_percent into v_type, v_need from lms_lessons where id = p_lesson;

  if v_type = 'video' then
    v_cov := lms_watch_coverage(p_lesson);
    if v_cov < v_need then
      return query select false, 'Watch the whole lesson first. You are at '||v_cov||' percent.'; return;
    end if;
  end if;

  select id into v_quiz from lms_quizzes where lesson_id = p_lesson and status = 'published';
  if v_quiz is not null and not exists (
      select 1 from lms_quiz_attempts
       where user_id = v_uid and quiz_id = v_quiz and passed) then
    return query select false, 'Answer the questions for this lesson first.'; return;
  end if;

  insert into lms_lesson_progress (user_id, lesson_id, completed, completed_at)
  values (v_uid, p_lesson, true, now())
  on conflict (user_id, lesson_id) do update
    set completed = true, completed_at = coalesce(lms_lesson_progress.completed_at, now()), updated_at = now();

  return query select true, 'Lesson complete.';
end $function$

```

#### lms_course_blockers(p_course uuid)

```sql
CREATE OR REPLACE FUNCTION public.lms_course_blockers(p_course uuid)
 RETURNS TABLE(ok boolean, label text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with c as (select * from lms_courses where id = p_course),
  m as (select count(*) n from lms_modules where course_id = p_course),
  l as (select count(*) n from lms_lessons le
          join lms_modules mo on mo.id = le.module_id where mo.course_id = p_course),
  v as (select count(*) n from lms_lessons le
          join lms_modules mo on mo.id = le.module_id
         where mo.course_id = p_course and le.type = 'video'
           and (le.video_ref is null or le.duration_seconds is null))
  select btrim(coalesce((select title from c),'')) <> '', 'Has a title'
  union all select btrim(coalesce((select summary from c),'')) <> '', 'Has a short description'
  union all select btrim(coalesce((select tool from c),'')) <> '', 'Has a tool'
  union all select (select n from m) > 0, 'Has at least one module'
  union all select (select n from l) > 0, 'Has at least one lesson'
  union all select (select n from v) = 0, 'Every video lesson has its video'
$function$

```

#### lms_course_progress(p_course uuid)

```sql
CREATE OR REPLACE FUNCTION public.lms_course_progress(p_course uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with t as (select count(*) n from lms_lessons l join lms_modules m on m.id=l.module_id
              where m.course_id = p_course),
       d as (select count(*) n from lms_lesson_progress p
              join lms_lessons l on l.id = p.lesson_id
              join lms_modules m on m.id = l.module_id
             where m.course_id = p_course and p.user_id = auth.uid() and p.completed)
  select case when (select n from t) = 0 then 0
              else round(100.0 * (select n from d) / (select n from t), 1) end
$function$

```

#### lms_create_quiz(p_lesson uuid, p_module uuid, p_title text)

```sql
CREATE OR REPLACE FUNCTION public.lms_create_quiz(p_lesson uuid, p_module uuid, p_title text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$

```

#### lms_grant_free_courses(p_user uuid)

```sql
CREATE OR REPLACE FUNCTION public.lms_grant_free_courses(p_user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_n integer := 0;
begin
  insert into lms_entitlements (user_id, course_id, source)
  select p_user, c.id, 'free'
    from lms_courses c
   where c.status = 'published' and c.price_kobo = 0
     and not exists (
       select 1 from lms_entitlements e
        where e.user_id = p_user and e.course_id = c.id and e.status = 'active');
  get diagnostics v_n = row_count;
  return v_n;
end $function$

```

#### lms_handle_new_user()

```sql
CREATE OR REPLACE FUNCTION public.lms_handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_part uuid;
begin
  insert into lms_profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  if new.email_confirmed_at is not null then
    perform lms_link_participant(new.id, new.email);
  end if;

  perform lms_grant_free_courses(new.id);
  return new;
end $function$

```

#### lms_has_course_access(p_course uuid)

```sql
CREATE OR REPLACE FUNCTION public.lms_has_course_access(p_course uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from lms_entitlements e
     where e.user_id = auth.uid()
       and e.status = 'active'
       and (e.expires_at is null or e.expires_at > now())
       and (e.course_id is null or e.course_id = p_course)
  )
$function$

```

#### lms_import_questions(p_quiz uuid, p_items jsonb)

```sql
CREATE OR REPLACE FUNCTION public.lms_import_questions(p_quiz uuid, p_items jsonb)
 RETURNS TABLE(imported integer, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  return query select v_pos, v_pos ||' question(s) imported.';
end $function$

```

#### lms_is_admin()

```sql
CREATE OR REPLACE FUNCTION public.lms_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select lms_my_role() = 'admin'
$function$

```

#### lms_is_lesson_unlocked(p_lesson uuid)

```sql
CREATE OR REPLACE FUNCTION public.lms_is_lesson_unlocked(p_lesson uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_prev uuid;
begin
  if auth.uid() is null then return false; end if;
  if not lms_lesson_is_open(p_lesson) then return false; end if;

  select prev.id into v_prev
    from lms_lessons cur
    join lms_modules cm on cm.id = cur.module_id
    join lms_modules pm on pm.course_id = cm.course_id
    join lms_lessons prev on prev.module_id = pm.id
   where cur.id = p_lesson
     and (pm.position, prev.position) < (cm.position, cur.position)
   order by pm.position desc, prev.position desc
   limit 1;

  if v_prev is null then return true; end if;
  return exists (select 1 from lms_lesson_progress
                  where user_id = auth.uid() and lesson_id = v_prev and completed);
end $function$

```

#### lms_is_staff()

```sql
CREATE OR REPLACE FUNCTION public.lms_is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select lms_my_role() in ('admin', 'uploader')
$function$

```

#### lms_lesson_is_open(p_lesson uuid)

```sql
CREATE OR REPLACE FUNCTION public.lms_lesson_is_open(p_lesson uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with l as (
    select le.id, m.position as mpos, c.id as cid, c.price_kobo,
           c.first_module_free, c.status
      from lms_lessons le
      join lms_modules m on m.id = le.module_id
      join lms_courses c on c.id = m.course_id
     where le.id = p_lesson
  )
  select coalesce((
    select (l.status = 'published')
       and ( l.price_kobo = 0
          or (l.first_module_free and l.mpos = 1)
          or lms_has_course_access(l.cid) )
    from l), false)
$function$

```

#### lms_link_participant(p_user uuid, p_email text)

```sql
CREATE OR REPLACE FUNCTION public.lms_link_participant(p_user uuid, p_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_part uuid; v_norm text := lower(btrim(coalesce(p_email,'')));
begin
  if v_norm = '' then return false; end if;
  if exists (select 1 from lms_profiles where id = p_user and participant_id is not null)
    then return true; end if;

  select p.id into v_part from participants p where p.email_norm = v_norm limit 1;
  if v_part is null then return false; end if;
  -- never steal a participant already linked to another account
  if exists (select 1 from lms_profiles where participant_id = v_part) then return false; end if;

  update lms_profiles
     set participant_id = v_part, linked_at = now()
   where id = p_user;
  return true;
end $function$

```

#### lms_my_role()

```sql
CREATE OR REPLACE FUNCTION public.lms_my_role()
 RETURNS lms_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select role from lms_profiles where id = auth.uid()), 'learner')
$function$

```

#### lms_publish_course(p_course uuid)

```sql
CREATE OR REPLACE FUNCTION public.lms_publish_course(p_course uuid)
 RETURNS TABLE(published boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_bad integer;
begin
  if not lms_is_admin() then
    return query select false, 'Only an administrator can publish a course.'; return;
  end if;
  select count(*) into v_bad from lms_course_blockers(p_course) where not ok;
  if v_bad > 0 then
    return query select false, 'This course is not ready yet. '||v_bad||' thing(s) still missing.'; return;
  end if;
  update lms_courses
     set status = 'published', published_at = coalesce(published_at, now())
   where id = p_course;

  -- If it is free, open it to everyone who already has an account.
  -- Without this, only people who sign up AFTER today would get it.
  insert into lms_entitlements (user_id, course_id, source)
  select p.id, p_course, 'free'
    from lms_profiles p
   where exists (select 1 from lms_courses c where c.id = p_course and c.price_kobo = 0)
     and not exists (select 1 from lms_entitlements e
                      where e.user_id = p.id and e.course_id = p_course and e.status = 'active');

  insert into lms_admin_actions (actor_id, action, subject_type, subject_id)
  values (auth.uid(), 'publish_course', 'course', p_course);
  return query select true, 'Published.';
end $function$

```

#### lms_quiz_kind(p_quiz uuid)

```sql
CREATE OR REPLACE FUNCTION public.lms_quiz_kind(p_quiz uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when lesson_id is not null then 'check' else 'quiz' end
    from lms_quizzes where id = p_quiz
$function$

```

#### lms_record_watch(p_lesson uuid, p_bucket integer, p_position integer)

```sql
CREATE OR REPLACE FUNCTION public.lms_record_watch(p_lesson uuid, p_bucket integer, p_position integer DEFAULT NULL::integer)
 RETURNS TABLE(coverage numeric, unlocked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_dur integer; v_bs integer; v_need integer; v_total integer; v_have integer;
  v_recent integer;
begin
  if v_uid is null then return; end if;
  if not lms_lesson_is_open(p_lesson) then return; end if;

  select duration_seconds, bucket_seconds, coverage_percent
    into v_dur, v_bs, v_need
    from lms_lessons where id = p_lesson;
  if v_dur is null then return; end if;

  v_total := greatest(1, ceil(v_dur::numeric / v_bs)::int);
  if p_bucket < 0 or p_bucket >= v_total then return; end if;

  -- A real player sends about one bucket per bucket_seconds. Many more
  -- than that in the last minute is a script, so stop recording.
  select count(*) into v_recent
    from lms_watch_buckets
   where user_id = v_uid and lesson_id = p_lesson
     and first_seen_at > now() - interval '1 minute';
  if v_recent > (60 / v_bs) + 3 then
    return query select
      round(100.0 * (select count(*) from lms_watch_buckets
                      where user_id=v_uid and lesson_id=p_lesson) / v_total, 2),
      false;
    return;
  end if;

  insert into lms_watch_buckets (user_id, lesson_id, bucket_index)
  values (v_uid, p_lesson, p_bucket)
  on conflict do nothing;

  insert into lms_lesson_progress (user_id, lesson_id, last_position_seconds)
  values (v_uid, p_lesson, coalesce(p_position, 0))
  on conflict (user_id, lesson_id) do update
    set last_position_seconds = greatest(lms_lesson_progress.last_position_seconds,
                                         coalesce(excluded.last_position_seconds,0)),
        updated_at = now();

  select count(*) into v_have
    from lms_watch_buckets where user_id = v_uid and lesson_id = p_lesson;

  return query select round(100.0 * v_have / v_total, 2), (100.0 * v_have / v_total) >= v_need;
end $function$

```

#### lms_start_quiz(p_quiz uuid)

```sql
CREATE OR REPLACE FUNCTION public.lms_start_quiz(p_quiz uuid)
 RETURNS TABLE(attempt_id uuid, question_id uuid, prompt text, qtype lms_question_type, marks integer, option_id uuid, option_label text, option_position integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid(); v_q lms_quizzes%rowtype;
  v_course uuid; v_used integer; v_open uuid; v_ids uuid[]; v_last timestamptz;
begin
  if v_uid is null then return; end if;
  select * into v_q from lms_quizzes where id = p_quiz and status = 'published';
  if not found then return; end if;

  select c.id into v_course from lms_courses c
    join lms_modules m on m.course_id = c.id
    left join lms_lessons l on l.module_id = m.id
   where m.id = coalesce(v_q.module_id, (select module_id from lms_lessons where id = v_q.lesson_id))
   limit 1;
  if v_course is null or not (lms_has_course_access(v_course)
      or exists (select 1 from lms_courses where id=v_course and price_kobo=0)) then return; end if;

  select id, served_question_ids into v_open, v_ids
    from lms_quiz_attempts
   where user_id = v_uid and quiz_id = p_quiz and status = 'in_progress'
   order by started_at desc limit 1;

  if v_open is null then
    if exists (select 1 from lms_quiz_attempts where user_id=v_uid and quiz_id=p_quiz and passed) then
      return;  -- already passed, nothing to retake
    end if;
    select count(*), max(submitted_at) into v_used, v_last
      from lms_quiz_attempts where user_id=v_uid and quiz_id=p_quiz and status <> 'abandoned';
    if v_used >= v_q.max_attempts then return; end if;
    if v_q.retake_after_minutes > 0 and v_last is not null
       and v_last > now() - make_interval(mins => v_q.retake_after_minutes) then return; end if;

    select array_agg(q.id) into v_ids from (
      select id from lms_questions
       where quiz_id = p_quiz and active
       order by case when v_q.shuffle then random() end, position
       limit coalesce(v_q.serve_count, 1000)
    ) q;
    if v_ids is null then return; end if;

    insert into lms_quiz_attempts (user_id, quiz_id, attempt_no, served_question_ids)
    values (v_uid, p_quiz, coalesce(v_used,0) + 1, v_ids)
    returning id into v_open;
  end if;

  -- Short answer questions come back with no option rows, which is
  -- correct: there is nothing to choose from. They must still appear,
  -- or the learner never sees the question at all.
  return query
    select v_open, q.id, q.prompt, q.type, q.marks, o.id, o.label, o.position
      from lms_questions q
      left join lms_options o
        on o.question_id = q.id and q.type <> 'short_text'
     where q.id = any(v_ids)
     order by q.position, o.position nulls first;
end $function$

```

#### lms_submit_quiz(p_attempt uuid, p_answers jsonb)

```sql
CREATE OR REPLACE FUNCTION public.lms_submit_quiz(p_attempt uuid, p_answers jsonb)
 RETURNS TABLE(kind text, correct_count integer, question_count integer, score integer, max_score integer, percent numeric, passed boolean, pass_mark integer, feedback text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      when v_right = v_n then 'All ' ||v_n ||' correct. On you go.'
      else v_right ||' of ' ||v_n ||' correct. Have another look at the ones you missed.'
    end;
  else
    v_msg := case
      when v_pass then 'Passed with ' ||v_pct ||' percent.'
      else 'Not this time. You scored ' ||v_pct ||' percent and need ' ||v_q.pass_percent ||'.'
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
end $function$

```

#### lms_touch()

```sql
CREATE OR REPLACE FUNCTION public.lms_touch()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end $function$

```

#### lms_unpublish_course(p_course uuid)

```sql
CREATE OR REPLACE FUNCTION public.lms_unpublish_course(p_course uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not lms_is_admin() then return false; end if;
  update lms_courses set status = 'draft' where id = p_course;
  insert into lms_admin_actions (actor_id, action, subject_type, subject_id)
  values (auth.uid(), 'unpublish_course', 'course', p_course);
  return true;   -- entitlements are untouched: nobody loses what they hold
end $function$

```

#### lms_watch_coverage(p_lesson uuid)

```sql
CREATE OR REPLACE FUNCTION public.lms_watch_coverage(p_lesson uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when l.duration_seconds is null then 0
    else round(100.0 * (select count(*) from lms_watch_buckets b
                         where b.user_id = auth.uid() and b.lesson_id = l.id)
               / greatest(1, ceil(l.duration_seconds::numeric / l.bucket_seconds)), 2)
  end
  from lms_lessons l where l.id = p_lesson
$function$

```

### Certification functions, names only

Their bodies are left out on purpose: this repository is public and these are the sign in
and email machinery for the existing portal. The full bodies are in the snapshot query output.

| Function | What it does |
| --- | --- |
| `mail_fetch_pending(p_token text, p_limit integer)` | Hands pending sign in emails to the Apps Script mailer, guarded by a shared token. Also deletes unsent rows older than one hour and sent rows older than one day. |
| `mail_mark_sent(p_token text, p_ids uuid[])` | Deletes the outbox rows the mailer has successfully sent. |
| `mail_ping(p_token text)` | A health check: how many codes are waiting. |
| `participant_login(p_email text, p_code text)` | Exchanges a one time code for a session token for the existing learning portal. |
| `request_certificate_code(p_email text)` | Mints a six digit sign in code, but only for somebody who already holds a certificate. See STATUS.md: this is the sign in deadlock. |

