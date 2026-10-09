# PREVIEW-DATA.md

Everything the Academy pages ask of Supabase, so a preview can be screenshotted without reaching
Supabase at all.

**No mock or test code is in the website.** Nothing here is imported by anything. This is a
description, for whoever is standing the preview up to intercept with.

**Every call lives in one file, `src/lib/academy.ts`.** The pages contain no Supabase code, so this
list is complete by construction rather than by my having remembered them all. If a page shows
something, it came through one of the functions below.

The client is `certDb`, from `src/lib/certificates.ts`, pointing at the certification project. It
may be `null` if the configuration is missing, and every function below returns a polite message in
that case rather than throwing.

---

## Read this first: what a failed send looks like

**supabase-js does not throw when the network fails.** Its auth methods catch their own fetch
error and **return** it, the same shape as a refusal from the server. An earlier version of this
code wrapped each call in a try/catch and took "nothing was thrown" to mean "the server answered",
so every failure was read as the one failure that has to be hidden, and three real ones were hidden
with it.

The error is now read, and the decision is made on its kind. The same five cases apply to **sign
up**, **send another code** and **reset**, and all fifteen have a test:

| What came back | What the page does | What it says |
| --- | --- | --- |
| The request never arrived (`status 0`, `AuthRetryableFetchError`) | Stays on the form | *We could not reach the Academy. Check your connection and try again.* |
| `429` whose message matches `after N seconds` | **Carries on to the code screen as though it had worked** | nothing |
| `429` anything else, the project's hourly email allowance | Stays on the form | *We are sending a lot of emails right now. Please try again in an hour.* |
| `500` or above, the server, the hook or the mailer | Stays on the form | *We could not send your code just now. Please try again in a few minutes.* |
| Anything else | Carries on to the code screen | nothing |

**Only the second row is hidden**, and only because Supabase sends it for an address it already
knows. Every other row is a case where no email was sent, so moving the person to the code screen
would leave them waiting for something that is not coming.

A dropped connection is also reported honestly on **sign in** and when **a code is typed**. Before,
one said the password was wrong and the other said the code was wrong, which sent people off to
reset a password that was fine, or to burn a good code.

**One residual leak, written down rather than hidden.** The `500` can only happen when an email was
really being sent, which on sign up means the address was new. In principle somebody watching very
closely could read something into that. It needs the mailer to be broken at that exact moment, and
the alternative is telling a real person a code is coming when we know it is not.

---

## How to intercept

All of these are HTTPS calls from the browser to the Supabase project. Two shapes:

| Kind | URL | Method |
| --- | --- | --- |
| Auth | `{SUPABASE_URL}/auth/v1/...` | POST, except `getSession` which is local |
| RPC | `{SUPABASE_URL}/rest/v1/rpc/{name}` | POST |

**`getSession` makes no network call at all.** It reads the session the Supabase client keeps in
`localStorage` under a key like `sb-<project-ref>-auth-token`. To preview a signed in page, put a
session object there before the page loads. To preview a signed out page, remove it.

---

## 1. signUp

**Where:** the Create my account button on `/lms/sign-up`.
**Call:** `certDb.auth.signUp({ email, password, options: { data: { full_name } } })`
**Endpoint:** `POST /auth/v1/signup`

Inputs:

```json
{ "email": "ada@example.com", "password": "a-good-password", "data": { "full_name": "Ada Nwosu" } }
```

Success reply:

```json
{
  "user": {
    "id": "9f1c7e02-5b41-4a2e-9c8a-6b2d0f4e7a11",
    "email": "ada@example.com",
    "email_confirmed_at": null,
    "user_metadata": { "full_name": "Ada Nwosu" }
  },
  "session": null
}
```

`session` is null because the address is not confirmed yet. That is the normal path, not a failure.
The page moves to the code screen.

The page prints no sentence of its own here. The code screen already says where the code went and
the meter beside it already counts down how long it lasts, so a message would be the same thing a
third time.

Error replies: the five cases in the table at the top of this file, all of which apply here.

There is **no "already registered" state** to screenshot. Supabase returns a fake success for an
address that is taken, so it looks exactly like a new one. There is no "per address rate limited"
state either, for the same reason.

There **are** three failure states worth screenshotting, and all three keep the person on the
form: no connection, the hourly allowance, and a 500. Abort the request for the first; answer with
`429 Email rate limit exceeded` and `500` for the other two.

---

## 2. verifyOtp, type signup

**Where:** the six code boxes on `/lms/sign-up`, and on `/lms/sign-in` when an unconfirmed account
signs in.
**Call:** `certDb.auth.verifyOtp({ email, token, type: "signup" })`
**Endpoint:** `POST /auth/v1/verify`

Inputs:

```json
{ "email": "ada@example.com", "token": "482913", "type": "signup" }
```

Success reply:

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "v1-xxxxxxxx",
  "user": {
    "id": "9f1c7e02-5b41-4a2e-9c8a-6b2d0f4e7a11",
    "email": "ada@example.com",
    "email_confirmed_at": "2026-10-08T09:14:22.000Z",
    "user_metadata": { "full_name": "Ada Nwosu" }
  }
}
```

The person is now signed in. The page calls `lms_sync_my_access` and goes to `/lms/me`.

Error reply:

```json
{ "code": 403, "error_code": "otp_expired", "msg": "Token has expired or is invalid" }
```

The page shows: *That code was not right, or it has run out. Ask for a new one and try again.* The
boxes clear.

---

## 3. resend

**Where:** Send another code, on the code screens of `/lms/sign-up` and `/lms/sign-in`.
**Call:** `certDb.auth.resend({ type: "signup", email })`
**Endpoint:** `POST /auth/v1/resend`

Inputs:

```json
{ "type": "signup", "email": "ada@example.com" }
```

Success reply:

```json
{ "messageId": null }
```

The page shows: *A new code is on its way.* and both rings start again: the code's ten minutes,
and the sixty seconds before another can be asked for.

Error replies: the same five cases. The per address wait and "already confirmed" both happen only
for an address that exists, so both are reported as success. The other three keep the person on
the code screen and replace the note with a message.

In practice the 60 second ring means the per address wait cannot be hit by pressing the button.

---

## 4. signInWithPassword

**Where:** the Sign in button on `/lms/sign-in`.
**Call:** `certDb.auth.signInWithPassword({ email, password })`
**Endpoint:** `POST /auth/v1/token?grant_type=password`

Inputs:

```json
{ "email": "ada@example.com", "password": "a-good-password" }
```

Success reply: the same shape as verifyOtp above, with `access_token`, `refresh_token` and `user`.

Error reply, wrong password **or** no such account. **These must be identical**, and the page shows
one sentence for both:

```json
{ "code": 400, "error_code": "invalid_credentials", "msg": "Invalid login credentials" }
```

Page shows: *That email address and password do not match. Please check both and try again.*

Error reply, the one case told apart:

```json
{ "code": 400, "error_code": "email_not_confirmed", "msg": "Email not confirmed" }
```

Page shows: *This address has not been confirmed yet. We can send you a new code.* then calls
`resend` and moves to the code screen.

---

## 5. resetPasswordForEmail

**Where:** Send me a code on `/lms/reset`.
**Call:** `certDb.auth.resetPasswordForEmail(email)`
**Endpoint:** `POST /auth/v1/recover`

Inputs:

```json
{ "email": "ada@example.com" }
```

Success reply:

```json
{}
```

**An address with no account returns the same `{}`.** Supabase is deliberately quiet, and so is
the page. Both move to the code screen, which says: *If ada@example.com has an account, a 6 digit
code is on its way.*

**The per address 429 is not read either**, for the same reason as sign up: Supabase sends it only
for addresses it already knows, so reporting it would be the leak this page exists to avoid.

```json
{ "code": 429, "error_code": "over_request_rate_limit",
  "msg": "For security purposes, you can only request this after 60 seconds." }
```

For a preview that means there is **no "unknown address" state and no "per address rate limited"
state** on reset. Every reply produces the same screen, which is the point. The other three
failures in the table do show, because none of them says anything about one address.

This same call is also what "Send another code" uses on the reset code screen. If the resend could
answer differently from the first send, the page would leak on the second press what it was careful
not to leak on the first.

---

## 6. verifyOtp, type recovery

**Where:** the six code boxes on `/lms/reset`.
**Call:** `certDb.auth.verifyOtp({ email, token, type: "recovery" })`
**Endpoint:** `POST /auth/v1/verify`

Inputs:

```json
{ "email": "ada@example.com", "token": "771204", "type": "recovery" }
```

Success reply: the same session shape as above. The person is now signed in, which is what lets the
next step change their password without asking for the old one.

Error reply: the same `otp_expired` shape as section 2, with the same message.

---

## 7. updateUser

**Where:** Save and continue, the last step of `/lms/reset`.
**Call:** `certDb.auth.updateUser({ password })`
**Endpoint:** `PUT /auth/v1/user`

Inputs:

```json
{ "password": "a-new-good-password" }
```

Success reply:

```json
{ "user": { "id": "9f1c7e02-5b41-4a2e-9c8a-6b2d0f4e7a11", "email": "ada@example.com" } }
```

The page calls `lms_sync_my_access` and goes to `/lms/me`.

Error reply:

```json
{ "code": 422, "error_code": "weak_password", "msg": "Password should be at least 8 characters" }
```

The page shows its own message, *Please choose a password of at least 8 characters*, and in fact
catches this before the call is made.

---

## 8. getSession

**Where:** `RequireAccount` on every protected page, and `/lms/me`.
**Call:** `certDb.auth.getSession()`
**Endpoint:** none. It reads `localStorage`.

**This is the one to set up for a preview**, because it decides signed in or signed out.

Signed in. Put this in `localStorage` under the key `sb-<project-ref>-auth-token`:

```json
{
  "access_token": "eyJ-anything-the-page-does-not-read-it",
  "token_type": "bearer",
  "expires_at": 4102444800,
  "refresh_token": "v1-preview",
  "user": {
    "id": "9f1c7e02-5b41-4a2e-9c8a-6b2d0f4e7a11",
    "email": "ada@example.com",
    "user_metadata": { "full_name": "Ada Nwosu" }
  }
}
```

`expires_at` is seconds, and that value is the year 2100, so the client treats it as current and
does not try to refresh it over the network.

The page reads exactly three things: `user.email`, `user.user_metadata.full_name`, and whether a
session exists at all.

Signed out: remove that key. `getSession` returns `{ data: { session: null } }` and
`RequireAccount` sends the person to `/lms/sign-in`.

---

## 9. signOut

**Where:** the Sign out button on `/lms/me`.
**Call:** `certDb.auth.signOut()`
**Endpoint:** `POST /auth/v1/logout`

Success reply: `204 No Content`. The client clears `localStorage` and the page goes to
`/lms/sign-in`.

Worth knowing for a preview: the page navigates **whether or not** the call succeeds. Somebody who
presses sign out should end up signed out locally even if the network is down.

---

## 10. lms_sync_my_access

**Where:** after a successful sign in, confirm or password reset, **or** once when `/lms/me` opens
directly. Never both: see the note under this section.
**Call:** `certDb.rpc("lms_sync_my_access")`
**Endpoint:** `POST /rest/v1/rpc/lms_sync_my_access`

Inputs: none. It works out who is asking from the signed in session.

Success reply, **nothing changed**, which is the usual one:

```json
[{ "role": "learner", "bootcamp": false, "changed": false, "message": "No change." }]
```

The page shows nothing at all. A notice on every page open stops being read by the third page.

Success reply, **something changed**, the one worth previewing:

```json
[{ "role": "learner", "bootcamp": true, "changed": true,
   "message": "You are on an active bootcamp, so every course is open to you." }]
```

The page shows that sentence once, in the quiet grey notice at the top of `/lms/me`, with a Hide
button.

Another changed reply, the unhappy direction:

```json
[{ "role": "learner", "bootcamp": false, "changed": true,
   "message": "Your bootcamp access has ended. Courses you bought are still yours." }]
```

Error reply: the page shows nothing and carries on. Access refresh failing must never stop
somebody reaching their courses.

```json
{ "code": "42501", "message": "permission denied for function lms_sync_my_access" }
```

### It is called once, not twice

`changed` is true exactly once, the first time the function notices a difference. Sign up, sign in
and reset all call the sync themselves before sending the person to `/lms/me`, so when `/lms/me`
called it again the change had already been reported and used up, and `changed` came back false.
The notice was never shown to the one person it was written for: somebody who had just arrived.

Now whoever calls the sync carries the answer with them, in the navigation state under the key
`access`. `/lms/me` reads it instead of calling again, and then wipes it out of the history entry
so a reload does not show the notice a second time.

**For a preview this means:** arriving at `/lms/me` from a sign in uses the sync reply from the
sign in. Opening `/lms/me` directly makes its own call. Both paths need a reply; they just do not
both happen on the same visit.

The reply also decides the pass card. `bootcamp: true` draws the orange bootcamp pass, `false`
draws the plain account card, and the `role` is what the badge in its corner says.

---

## 11. lms_my_role, no longer called

`/lms/me` used to ask for the role separately, with `certDb.rpc("lms_my_role")`. It does not any
more. That was a second round trip for something `lms_sync_my_access` had already returned, and the
two could disagree for a moment, so the page showed one role and then swapped it for another.

The role now comes from the sync alone. **There is nothing to intercept here.** The function still
exists in the database and is still used by the database's own policies.

The three values are `learner`, `facilitator` and `admin`, and the page turns them into Learner,
Facilitator and Administrator. Anything unexpected falls back to Learner, which is the least
privileged label and so the safe thing to show when we do not know.

---

## The states worth screenshotting

| Page | State | How to produce it |
| --- | --- | --- |
| `/lms` | The placeholder | Nothing needed |
| `/lms/sign-up` | Empty form | Nothing needed |
| `/lms/sign-up` | Filled form, strength meter at Good | Type a 13 character password |
| `/lms/sign-up` | Password shown | Press Show |
| `/lms/sign-up` | Name too short, name box red | Submit with a one letter name |
| `/lms/sign-up` | That error clearing | Then type in the name box |
| `/lms/sign-up` | Code screen, both rings running | Succeed at signUp |
| `/lms/sign-up` | Code screen, three digits in | Type three digits |
| `/lms/sign-up` | Code refused, boxes empty, cursor in box 1 | Return `otp_expired` |
| `/lms/sign-up` | Code accepted, boxes green, rail on Ready | Return a session from verifyOtp |
| `/lms/sign-up` | Resend ready | Wait 60 seconds, or wind the clock forward |
| `/lms/sign-up` | No connection | Abort the request to `/auth/v1/signup` |
| `/lms/sign-up` | Hourly email allowance used up | `429` with `Email rate limit exceeded` |
| `/lms/sign-up` | The mailer is down | `500` from `/auth/v1/signup` |
| `/lms/sign-in` | No connection | Abort `/auth/v1/token`. It must NOT say the password is wrong |
| `/lms/sign-in` | Empty form | Nothing needed |
| `/lms/sign-in` | Wrong password | Return `invalid_credentials` |
| `/lms/sign-in` | Unconfirmed account, on the code screen | Return `email_not_confirmed` |
| `/lms/reset` | Empty form | Nothing needed |
| `/lms/reset` | Code screen, conditional wording | Return `{}` from recover |
| `/lms/reset` | New password step, rail on New password | Succeed at verifyOtp recovery |
| `/lms/me` | Bootcamp pass and the access notice | Arrive from a sign in with `changed: true, bootcamp: true` |
| `/lms/me` | Plain account card, no notice | Open directly with `changed: false, bootcamp: false` |
| `/lms/me` | As an administrator | `role: "admin"` in the sync reply |
| `/lms/me` | Signed out redirect | Remove the session key, open `/lms/me` |

### A worked interception

This is the shape that produced the screenshots for this phase. It is written here rather than
shipped as a file, so that no test code goes anywhere near the repository.

```js
const CODE = "482915";

// Auth: every send succeeds, the right code returns a session, any other
// code is refused.
await page.route("**/auth/v1/**", (route) => {
  const url = route.request().url();
  const body = route.request().postData() || "";
  if (url.includes("/verify") && !body.includes(CODE)) {
    return route.fulfill({ status: 403, contentType: "application/json",
      body: JSON.stringify({ message: "Token has expired or is invalid" }) });
  }
  if (url.includes("/verify") || url.includes("/token")) {
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(SESSION) });          // the object from section 8
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});

// The access sync. Register the catch all FIRST: the last route registered
// is the one that wins.
await page.route("**/rest/v1/rpc/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await page.route("**/rest/v1/rpc/lms_sync_my_access", (route) =>
  route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify([{ role: "learner", bootcamp: true, changed: true,
      message: "Your bootcamp access is open, so every course is free to you." }]) }));
```

For `/lms/me` opened directly, put `SESSION` into `localStorage` under
`sb-<project-ref>-auth-token` before the page loads, as section 8 describes. Give its
`access_token` a JWT shaped value, three parts separated by dots, and an `expires_at` well in the
future, or the client will throw it away and try to refresh it.

Each account page should also be looked at **at phone width**, because they are a single column and
that is where most learners will meet them.

---

## Two things the preview cannot show, and should not pretend to

**Whether the emails arrive.** Every code in this phase is sent by Supabase through the Send Email
Hook and the Apps Script mailer. None of that is reachable from a preview. Phase 5 is where a real
address receives a real code.

**Whether `lms_sync_my_access` says the right thing.** The replies above are the shapes, invented to
show the page's states. What the function actually decides depends on the two email lists in the
live database. The page is correct if it shows the message it was handed; whether that message is
true is the database's business and was tested there.

---

## Phase 3: the two public calls, and the edge function

Everything above is the account pages. These two are the public ones, added in database file 14,
and they are what the three public pages AND the edge function both read, so a crawler and a
person can never be shown different numbers.

### 12. lms_public_catalogue

**Where:** `/lms` (the tool rack and Latest courses), `/lms/courses` (everything), a course page
(related courses), and the band on `/courses`.
**Call:** `certDb.rpc("lms_public_catalogue")`
**Endpoint:** `POST /rest/v1/rpc/lms_public_catalogue`

Inputs: none. It returns published courses only, newest first.

```json
[{
  "id": "11111111-1111-1111-1111-111111111111",
  "slug": "stata-for-survey-data",
  "title": "STATA for survey data",
  "summary": "Clean, label and analyse survey exports, then build the tables your report needs.",
  "tool": "STATA", "area": "Analysis", "level": "Beginner", "cover_code": "ST",
  "price_kobo": 1000000, "first_module_free": true,
  "published_at": "2026-10-01T09:00:00Z", "updated_at": "2026-10-05T09:00:00Z",
  "module_count": 3, "lesson_count": 12, "quiz_count": 2, "total_seconds": 5760
}]
```

An empty array is a real state worth screenshotting: it is what the Academy looks like before the
first course is published. The landing page drops the tool rack, the catalogue shows its empty
state, and the band on `/courses` hides itself entirely.

Four or more distinct `tool` values draws the tool rack. Fewer draws pills instead.

### 13. lms_public_course

**Where:** `/lms/courses/:slug`.
**Call:** `certDb.rpc("lms_public_course", { p_slug })`
**Endpoint:** `POST /rest/v1/rpc/lms_public_course`

Everything from the catalogue, plus:

```json
[{
  "outcomes": ["Import a survey export and label every variable", "..."],
  "audience": ["Researchers and M&E officers working with survey data"],
  "prerequisites": ["No STATA experience needed"],
  "faq": [{"question": "Do I need STATA installed?", "answer": "For the practice files, yes."}],
  "seo_title": null, "seo_description": null,
  "modules": [{
    "position": 1, "title": "Getting your data in", "summary": "",
    "seconds": 1980, "lessons": 4, "quizzes": 1, "free": true,
    "lesson_list": [
      {"position": 1, "title": "Opening a dataset", "type": "video", "seconds": 380}
    ]
  }]
}]
```

**An empty array means the course is a draft or does not exist.** The page shows "Course not
found" and the edge function answers a real 404. That is different from the call failing, which
shows "we could not load this course just now", and the two must not be confused in a preview.

**There is no `video_ref` and no `content_md` anywhere in either reply, and there never will be.**
File 14 removed the grant that made them readable, and there is a test that reads the column names
of both functions and fails if one ever looks like a video or a lesson body.

### 14. The edge function, api/academy-meta.js

Not a Supabase call: it is what answers `/lms`, `/lms/courses` and `/lms/courses/:slug` **before
the browser gets anything**. It calls the two functions above itself, writes the tags and a plain
copy of the content into `index.html`, and sends that.

For a preview this matters in one way: **View Page Source already contains the real content**, so
checking the page is not the same as checking what a crawler sees. `tests/academy-meta.test.mjs`
runs it in plain Node against a stubbed `fetch` and covers the five cases.

| Case | How to produce it | What it answers |
| --- | --- | --- |
| A published course | the JSON above | 200, real title, content in `#root` |
| A draft, or no such slug | `[]`, **answered properly** | **404** and `noindex` |
| Supabase slow | delay the reply past 1.5 seconds | the ordinary page, **200, no `noindex`**, `s-maxage=30` |
| Supabase down | make the request throw | the same. Never a 500, never a 404 |
| A paused project | answer 503 with an HTML body | the same |
| A query string | `/lms/courses?tool=stata` | canonical without it |
| The vercel.app host | send `host: dataleadweb-frontend.vercel.app` | every tag still names `dataleadafrica.com` |

**The difference between row two and rows three to five is the most important thing on this
page.** An empty array is Supabase saying "there is no such course". A timeout, a throw or a 503
is Supabase saying nothing at all. Only the first may become a 404. Treating the others as a 404
tells Google every course is gone, and the free plan pauses after a week without visitors, so
that is not a hypothetical.

### The states worth screenshotting, Phase 3

| Page | State | How to produce it |
| --- | --- | --- |
| `/lms` | The tool rack, with a course under it | four or more tools in the catalogue |
| `/lms` | Pills instead of the rack | one to three tools |
| `/lms` | Before anything is published | an empty catalogue |
| `/lms/courses` | The full grid | six courses |
| `/lms/courses` | Filtered | press an area, and check the address does NOT change |
| `/lms/courses` | Nothing matches | type something that matches no course |
| `/lms/courses` | Before launch | an empty catalogue |
| `/lms/courses/:slug` | The whole page | the JSON above |
| `/lms/courses/:slug` | The buy card, signed out | `price_kobo` above zero, no session. "Create an account" and "Online payment opens soon" |
| `/lms/courses/:slug` | The buy card, signed in without the course | a session, and `lms_has_course_access` answering `false`. **No** "Create an account". The price, "Online payment opens soon", and "Try module 1 free" |
| `/lms/courses/:slug` | The buy card, signed in with the course | `lms_has_course_access` answering `true`. "Continue learning" |
| `/lms/courses/:slug` | A free course | `price_kobo: 0`. "Start free", or "Continue learning" when signed in |
| `/lms/courses/:slug` | Not found | `[]` |
| `/lms/courses/:slug` | Could not load | make the call throw. "We could not load this course", **not** "not found" |
| `/lms/courses/:slug` | On a phone | the buy card becomes a bar at the bottom, with the payment line inside it under the price, and the WhatsApp button sits above it |
| `/lms` | The headline from the database | a `lms_settings` row with `headline` and `subhead` |
| `/lms` | The announcement | the same row with `announce_on: true` and some `announce_text` |
| `/lms` | The written words | no row, or an empty one. The hero must not go blank |
| `/lms` | Learning paths | published rows in `lms_paths` with courses in `lms_path_courses` |
| `/lms` | No learning paths | none published. The whole section must be absent, not an empty heading |
| `/lms/courses` | Could not load | make the call throw. "We could not load the courses", **not** "the first courses are on their way" |


---

## Phase 3 review round: three more calls

### 15. lms_has_course_access

**Where:** the buy card on `/lms/courses/:slug`, and the bar on a phone, for anybody signed in
looking at a paid course.
**Call:** `certDb.rpc("lms_has_course_access", { p_course })`
**Endpoint:** `POST /rest/v1/rpc/lms_has_course_access`

Returns a bare `true` or `false`.

```json
true
```

It is only asked when somebody is signed in **and** the course costs something. A free course is
open to anybody signed in, and that rule lives in the database, in `lms_lesson_is_open`, not on
the page.

**While the answer is on its way**, the card shows the signed in, no access state. That is
deliberate: showing "Create an account" to somebody who has one, and then correcting it a moment
later, is worse than being briefly cautious. The same applies when the call fails, because the
safe wrong answer is "you do not have it yet" and the server decides for real when they try to
open a lesson.

### 16. lms_settings

**Where:** the `/lms` hero, in the page and in the edge function.
**Call:** `certDb.from("lms_settings").select("headline,subhead,announce_on,announce_text").eq("id", 1).maybeSingle()`
**Endpoint:** `GET /rest/v1/lms_settings?id=eq.1&select=headline,subhead,announce_on,announce_text`

```json
{
  "headline": "Two tools, one term.",
  "subhead": "Short courses in the tools that get you hired, in the order that makes sense.",
  "announce_on": true,
  "announce_text": "Enrolment for the October cohort is open."
}
```

Every field is optional in practice. A blank or missing value falls back to the words written in
`api/_seo-rules.js`, which are the words on the page today. `announce_on: false` hides the
announcement whatever `announce_text` says.

The last word of the headline is drawn in the signal colour. That is a rule, not a stored piece
of markup, so any headline works and a one word headline is left plain rather than turned
entirely orange.

**The `<title>` and `<meta description>` are not in this table and never will be.** See
`docs/lms/SEO.md` section 6.

### 17. lms_paths and lms_path_courses

**Where:** the Learning paths section on `/lms`.
**Call:** `certDb.from("lms_paths").select(...).eq("status","published").order("position")`
**Endpoint:**
`GET /rest/v1/lms_paths?status=eq.published&select=id,slug,name,description,position,lms_path_courses(position,lms_courses(slug,title,summary,cover_code,status))&order=position.asc`

```json
[{
  "id": "p1", "slug": "survey-to-report", "name": "Survey to report",
  "description": "Collect the data, clean it, and write the report, in order.",
  "position": 1,
  "lms_path_courses": [
    {"position": 1, "lms_courses": {"slug": "survey-forms-with-xlsform", "title": "Survey forms with XLSForm", "summary": "...", "cover_code": "XF", "status": "published"}},
    {"position": 2, "lms_courses": {"slug": "stata-for-survey-data", "title": "STATA for survey data", "summary": "...", "cover_code": "ST", "status": "published"}}
  ]
}]
```

Two filters happen in the page, and both are worth testing in a preview:

- A course inside a path that is **not published** is dropped, because a path must never link to
  a page that is not there. Put a `"status": "draft"` course in a path and check it does not
  appear.
- A path left with **no published courses** disappears entirely.

An empty list is normal and the whole section is absent, not an empty heading.

---

## Phase 4: the learning pages

Eight more calls, all of them private to one signed in learner and all of them revoked from
`anon` in database file 15. Nothing below is reachable by a stranger, and nothing below except
`lms_open_lesson` can return a video reference.

### 18. lms_my_course

**Where:** `/lms/learn/:slug`, and the outline beside the player.
**Call:** `certDb.rpc("lms_my_course", { p_slug })`
**Endpoint:** `POST /rest/v1/rpc/lms_my_course`

One call builds a whole learning page. Built from the tables directly it would be a dozen round
trips, and on a Nigerian mobile connection a dozen round trips is the difference between a page
and a wait. It is also how the course page and the player agree about what is open: they draw
the same outline, so they read it from the same place.

```json
[{
  "course_id": "11111111-1111-1111-1111-111111111111",
  "slug": "stata-for-survey-data",
  "title": "STATA for survey data",
  "summary": "Clean, label and analyse survey exports.",
  "tool": "STATA", "level": "Beginner", "cover_code": "ST",
  "lesson_count": 4, "lessons_done": 1,
  "quiz_count": 1, "quizzes_passed": 0,
  "percent": 20,
  "resume_lesson_id": "lesson-2",
  "resume_lesson_title": "Cleaning survey data",
  "resume_second": 150,
  "certificate_number": null,
  "certificate_issued_on": null,
  "modules": [{
    "position": 1,
    "title": "Getting your data in",
    "summary": "",
    "seconds": 900,
    "lesson_count": 3,
    "lessons_done": 1,
    "lessons": [{
      "id": "lesson-1", "position": 1, "title": "Opening a dataset", "type": "video",
      "seconds": 300, "coverage_needed": 90,
      "completed": true, "check_passed": true, "has_check": true,
      "coverage": 100, "unlocked": true, "last_position": 300
    }],
    "quiz": {
      "id": "quiz-1", "title": "Module 1 quiz",
      "pass_mark": 70, "question_count": 10,
      "tries_allowed": 3, "tries_used": 0,
      "passed": false, "best_percent": null,
      "next_opens_at": null
    }
  }]
}]
```

**Three answers, and the page shows something different for each:**

| Reply | What it means | What the page shows |
| --- | --- | --- |
| a row | They have access | The course |
| `[]` | The database answered: no such published course, or no access | "This course is not open to you", calmly, saying nothing has been lost |
| the call fails | We could not ask | "We could not load this just now. Your progress is safe." |

The second and third must never be confused. Telling somebody they have lost a course they paid
for, when the truth is that the database did not answer, is the worst wrong thing that page can
say.

**There is no `video_ref` in it and there never will be.** File 15 test 4 reads the whole output
and fails if one appears.

**States worth producing in a preview:**

| State | How |
| --- | --- |
| A locked lesson | `unlocked: false`. It must not be a link |
| A finished lesson | `completed: true, check_passed: true`. Shows the CHECK PASSED badge |
| The one in progress | `completed: false, unlocked: true, coverage: 52`. Shows "52% watched" |
| A quiz that is shut | `next_opens_at` a time in the future. The row says WAITING |
| A module with nothing in it | `lessons: []`. The card is still drawn, not a hole |
| A course edited underneath | any `resume_lesson_id` that is not in `modules`. Must not break |

### 19. lms_quiz_status

**Where:** the module quiz page, the quiz row on the course page, and the lesson check.
**Call:** `certDb.rpc("lms_quiz_status", { p_quiz })`
**Endpoint:** `POST /rest/v1/rpc/lms_quiz_status`

This exists because `lms_start_quiz` returns an empty table for six different reasons, so a page
receiving one knows only that something is wrong.

```json
[{
  "kind": "quiz",
  "title": "Module 1 quiz",
  "pass_mark": 70,
  "question_count": 10,
  "tries_allowed": 3,
  "tries_used": 3,
  "tries_left": 0,
  "passed": false,
  "best_percent": 40.00,
  "open_attempt_id": null,
  "next_opens_at": "2026-10-09T13:20:00Z",
  "can_start": false,
  "reason": "You have used your tries for now. The quiz opens again at 14:20 on 09 Oct. The lessons in this module stay open, so you can watch any of them again first."
}]
```

| Field | Worth knowing |
| --- | --- |
| `kind` | `check` or `quiz`. They have completely different rules |
| `tries_allowed` | **0 means unlimited**, which is every lesson check |
| `tries_used` | In the **current window**. After a 24 hour wait it starts again at 0 |
| `tries_left` | `null` when unlimited |
| `reason` | Written for a person to read. Put it on the screen as it is |

**The state worth producing most:** `can_start: false` with a real `next_opens_at`. That is the
trap file 15 removed, and the page has to say when it opens rather than showing a dead button.

### 20. lms_open_lesson

**Where:** the player, and nowhere else.
**Call:** `certDb.rpc("lms_open_lesson", { p_lesson })`

Added in file 14. **The only call in the whole site that can return a video reference**, and it
asks `lms_lesson_is_open` before it answers.

```json
[{
  "lesson_id": "lesson-2", "title": "Cleaning survey data",
  "video_provider": "youtube", "video_ref": "dQw4w9WgXcQ",
  "content_md": null,
  "duration_seconds": 480, "bucket_seconds": 10, "coverage_percent": 90
}]
```

An empty reply means the lesson is not open to this person, which the player shows as "This
lesson is not open to you yet" rather than as an error.

### 21. lms_record_watch

**Where:** the player, once every ten seconds of real playing.
**Call:** `certDb.rpc("lms_record_watch", { p_lesson, p_bucket, p_position })`

```json
[{ "coverage": 52.50, "unlocked": false }]
```

**Changed in file 15, in two ways.** It now stores the **latest** position rather than the
furthest ever reached, so somebody who rewinds and stops is sent back to where they stopped. And
a slice that is genuinely new adds its ten seconds to `lms_watch_days`.

**THE ONE THING TO GET RIGHT IN A PREVIEW: a throttled call does not
fail.** `lms_record_watch` answers normally when it refuses a slice for
coming in too fast, with the coverage unchanged. A stub that returns an
error for a throttled slice is testing something the real database never
does, and it hides the bug that shape causes: a queue treating "answered"
as "stored" deletes slices the database ignored.

The real limit, since the Phase 4 review round, is
`ceil(60 / bucket_seconds * 1.5) + 3`, which is **12 a minute at ten
second slices**. It is 1.5x rather than 1x because 1.5x is the fastest
the player allows on a first watch, and the old limit of 9 was exactly
what an honest 1.5x watch produces, so ordinary timer jitter was
throwing real watching away.

**Four states to produce:**

| State | How | What must happen |
| --- | --- | --- |
| Normal | answer normally | the tape fills |
| No signal | make the call **fail** | "Offline, your progress will save when you reconnect", and the slices are kept, not lost |
| Reconnected | fail for two minutes, then answer again | "Catching up on N parts...", and the backlog arrives **slowly**, a dozen a minute, until every one is in |
| Throttled | answer normally but **do not** increase `coverage` | after three in a row, "Your progress has stopped moving even though the video is playing" |

**And the measurement that matters more than any of them:** play a whole
lesson, end to end, at 1.5x, and count the slices. It must be every one.
Phase 4 shipped a player that sent one slice per ten seconds of clock
rather than of video, so at 1.5x every third was missing and the lesson
could never be finished. Every other check passed.

### 22. lms_start_quiz

**Where:** the lesson check and the module quiz.
**Call:** `certDb.rpc("lms_start_quiz", { p_quiz })`

Returns **one row per question per option**, which is the shape a SQL function can return.
`src/lib/learn.ts` folds it into questions with their options.

```json
[
  {"attempt_id":"att-1","question_id":"q1","prompt":"Which command...","qtype":"single",
   "marks":1,"option_id":"o1","option_label":"tabulate id","option_position":1},
  {"attempt_id":"att-1","question_id":"q1","prompt":"Which command...","qtype":"single",
   "marks":1,"option_id":"o2","option_label":"duplicates report id","option_position":2}
]
```

**There is no `is_correct` in it and there never will be.** That single column is the one that
would make every quiz in the Academy pointless. A preview that invents one is testing something
the real site cannot do.

A short answer question comes back with `option_id: null` and no option rows.

**Replaced in file 15.** A lesson check now ignores the try limit completely, and a module quiz
reopens 24 hours after the last try with a fresh set of tries.

### 23. lms_submit_quiz

**Call:** `certDb.rpc("lms_submit_quiz", { p_attempt, p_answers })`

`p_answers` maps a question id to the chosen option id, or to an array for a multi.

```json
[{
  "kind": "check", "correct_count": 2, "question_count": 3,
  "score": 2, "max_score": 3, "percent": 66.67,
  "passed": false, "pass_mark": 100,
  "feedback": "2 of 3 correct. Have another look at the ones you missed."
}]
```

### 24. lms_attempt_marks

**Call:** `certDb.rpc("lms_attempt_marks", { p_attempt })`

```json
[{ "question_id": "q1", "prompt": "Which command...", "was_right": false,
   "explanation": "duplicates report counts how many observations share each value." }]
```

**The server decides what this is allowed to say, and it says different things for the two
kinds. The page does not get a vote.**

| Kind | What comes back |
| --- | --- |
| A lesson check | Every question, right or wrong, **with its explanation** |
| A module quiz, not yet passed | **Nothing at all.** An empty list is the correct answer |
| A module quiz, passed | The full review, explanations and all |

An empty list is therefore a normal reply, not a failure, and a preview must produce it: a
failed module quiz showing per question marks is the leak file 15 closed, because right or wrong
per question across three tries is solvable by elimination without watching a lesson.

### 25. lms_my_week

**Where:** `/lms/me` and the course page.
**Call:** `certDb.rpc("lms_my_week")`

Always seven rows, today last, with zero for a day nothing was watched.

```json
[{ "day": "2026-10-02", "seconds": 1680, "minutes": 28 },
 { "day": "2026-10-03", "seconds": 0,    "minutes": 0 }]
```

The minutes come from `lms_watch_days`, **not** from the watch slices. Counting the slices cannot
work: finishing a lesson deletes them, so the chart would empty itself as somebody worked.

An all-zero week is a real state: the tile is **absent**, not drawn as seven empty bars.

### 26. lms_my_courses

**Where:** `/lms/me`.
**Call:** `certDb.rpc("lms_my_courses")`

```json
[{
  "course_id": "c1", "slug": "stata-for-survey-data", "title": "STATA for survey data",
  "cover_code": "ST", "tool": "STATA", "level": "Beginner",
  "lesson_count": 12, "quiz_count": 2, "lessons_done": 3, "quizzes_passed": 0,
  "percent": 21, "has_access": true, "started": true,
  "last_activity": "2026-10-08T09:12:00Z",
  "resume_lesson_id": "lesson-4", "resume_lesson_title": "Recoding answers",
  "resume_second": 95,
  "certificate_number": null
}]
```

Most recently touched first, which is what makes the Continue tile right without the page
sorting anything. A course whose access has lapsed still appears with `has_access: false`, so
somebody does not open the page and find their work has vanished without explanation.

**An empty list is the state worth producing:** a brand new learner gets a designed welcome
card, not an empty list and an empty chart and an empty certificates box.

### 27. lms_my_certificates

**Call:** `certDb.rpc("lms_my_certificates")`

```json
[{ "certificate_number": "DLA-2026-0042",
   "course_title": "Survey forms with XLSForm",
   "course_slug": "survey-forms-with-xlsform",
   "issued_on": "2026-10-02", "revoked": false }]
```

A withdrawn certificate comes back with `revoked: true` and is filtered out by the page.

### A note on the name on a certificate

The certificate card reads `lms_profiles.full_name`, **not** the name `getSession` returns.
`getSession` falls back to the part of the email address before the at sign, which is right for
a greeting and wrong on a certificate, where it would read "This certifies that learner".
`lms_claim_course_certificate` reads the same field when it issues, so the card on screen and the
certificate in the register always carry the same name. When it is blank the card says "Add your
name" in grey italic rather than printing a guess.
