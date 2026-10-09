# The Supabase Auth settings, click by click

Seven settings. Each one has **where to click**, **what to set**, and **how to prove it took**, because
a setting you have not checked is a setting you are hoping about.

All of these are in the **certification project**, the one the Academy lives in. Make sure the
project name at the top left of the dashboard is the right one before you change anything.

Work through them in order. Number 3 is already done.

---

## 1. Email OTP expiration: 600 seconds

**Why.** The emails we send already say **"The code expires in 10 minutes."** For the bootcamp codes
that is true, because our own database sets it. For the Academy codes it is currently false:
Supabase makes those, and their documentation says an email code lasts **one hour** by default.

So right now we are telling people something untrue, and a code that lives for an hour is a code
somebody can find in a forwarded email and still use.

**Where.** Authentication, then **Sign In / Providers**, then **Email**, then **Email OTP
expiration**.

**Set it to.** `600`. The box is in seconds, so 600 is ten minutes.

**How to confirm it took.** The box shows 600 after you save, and the real proof is behavioural:

1. Request a sign up code to an outside Gmail address.
2. Wait **eleven minutes**. Make a cup of tea.
3. Type the code in. It must be refused.
4. Ask for a new one. It must work.

If the old code still works after eleven minutes, the setting did not save.

**One other thing on that page worth knowing.** Supabase only lets one person ask for a code **once
every 60 seconds**. The sign up page has to respect that or people will tap "send another" and get
an error. That is a note for whoever builds the page, not a setting to change.

---

## 2. Confirm email: ON

**Why.** This is the single most important setting in the whole system, and it is worth being
precise about what it protects.

Every right a person has in the Academy hangs on their **email address**. Bootcamp students get the
whole catalogue free because their address is on an active enrolment. Facilitators can build courses
because their address is on the facilitator list. If somebody could sign up claiming an address they
do not own, they would inherit whatever that address is entitled to.

Confirming the address is what makes the address mean something.

**Where.** Authentication, then **Sign In / Providers**, then **Email**, then **Confirm email**.

**Set it to.** On.

**How to confirm it took.**

1. Sign up with an outside Gmail address and **do not** open the confirmation email.
2. Try to sign in with the email and password you just set.
3. It must refuse, saying the email is not confirmed.
4. Now open the email, confirm, and sign in. It must work.

If step 2 signs you in, the setting is off and nothing else in this list matters.

---

## 3. The Send Email hook: already on

You switched this on earlier today. It is listed here so the page is complete and so somebody
checking the system in a year can see it was deliberate.

**Where.** Authentication, then **Hooks**, then **Send Email hook**.

**Set to.** Enabled, type **Postgres function**, pointing at `public.send_email_hook`.

**How to confirm it is still right.** Two ways, and do both.

The quick one, in the SQL editor:

```sql
select count(*) as hook_function_exists
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'send_email_hook';
```

`1` means the function the hook points at exists. `0` means the hook is pointing at nothing and
every Academy sign up will fail.

The real one, which proves the whole chain:

```sql
select to_email, purpose, created_at
  from mail_outbox order by created_at desc limit 5;
```

Sign somebody up, then run that within the minute. A row with `purpose = 'academy_signup'` means
Supabase called our function and our function wrote the email into the outbox, which is exactly what
the hook is for. If no row appears, the hook is not firing.

---

## 4. Email rate limit: 150 an hour

**Why.** Supabase's own limit of two an hour applies to their built-in email service. Once email goes
somewhere else, that limit becomes yours to set. 150 an hour is well above anything a real day will
need, and still low enough to stop a runaway loop emptying the day's allowance before anybody
notices.

**Where.** Authentication, then **Rate Limits**, then the limit on emails sent per hour.

**Set it to.** `150`.

**How to confirm it took.** The box shows 150. There is no behavioural test for this one that does
not involve sending 150 emails, which would use up most of a day's allowance, so the visual check is
the check.

**A word on the number, because it is not the number that will bite you.** This limit is Supabase
refusing to hand us the email. Underneath it sits Google's limit of **100 a day** on the account that
owns the mailer, and underneath that sits our own ceiling of 25 an hour and 80 a day in the
`mail_limits` table. The smallest number is the one that decides, and today that is 80. Setting this
to 150 does not give you 150; it gets Supabase out of the way so our own ceiling is the one doing
the work, where we can see it in the health check.

---

## 5. Site URL

**Why.** When Supabase builds a link and has nowhere else to send it, it uses this. If it still says
`localhost`, every confirmation link sent to the public tries to open a web server on the learner's
own computer, and they see nothing at all.

**Where.** Authentication, then **URL Configuration**, then **Site URL**.

**Set it to.**

```
https://www.dataleadafrica.com
```

No slash on the end.

**How to confirm it took.** Trigger a password reset to an outside address and look at where the
link in the email points. It must begin `https://www.dataleadafrica.com`. You can see this without
clicking, by hovering over the link, or by pressing and holding on a phone.

---

## 6. Redirect URLs

**Why.** Supabase refuses to send anybody to an address that is not on this list. That is a good
rule: without it, a link could be made that signs somebody in and then bounces them to a site that
is not ours.

**Where.** Authentication, then **URL Configuration**, then **Redirect URLs**.

**Add these, one per line.**

```
https://www.dataleadafrica.com/**
https://dataleadafrica.com/**
```

The second one matters. Somebody will eventually arrive without the `www`, and a redirect that is
not on this list is refused outright.

**If you want Vercel previews to work for testing**, add this as well, and keep it on its own line so
you can find it and remove it later:

```
https://*-dataleadafrica.vercel.app/**
```

**Take `http://localhost:3000` off the list** if it is there. It is useful to nobody on a live
project and it is one more address somebody could be sent to.

**How to confirm it took.** The list shows the lines after saving. The behavioural proof is that a
confirmation link opens the site and signs you in, rather than showing a page about a redirect not
being allowed.

---

## 7. Minimum password length: 8

**Why.** The sign up and reset pages already refuse anything shorter. But a rule enforced only in
the browser is not a rule: anybody calling Supabase directly, which takes about one line, is not
running our page. This setting is what makes it true for everybody.

**Where.** Authentication, then **Sign In / Providers**, then **Email**, then **Minimum password
length**.

**Set it to.** `8`.

**How to confirm it took.** The box shows 8. The behavioural test needs the browser's developer
tools, so it is optional, but it is the only one that proves the point:

1. On `/lms/sign-up`, open developer tools, then Console.
2. Type a seven character password into the form and submit. Our page refuses it, which is the
   browser check doing its job.
3. The real test is whether Supabase would refuse the same thing. If you would rather not go into
   the console, take the visual check: this setting is simple and does not drift.

---

## The whole list, to tick off

- [ ] 1. Email OTP expiration is 600, and a code really is refused after eleven minutes
- [ ] 2. Confirm email is on, and an unconfirmed account really cannot sign in
- [ ] 3. The hook is on, the function exists, and a sign up really does put a row in `mail_outbox`
- [ ] 4. The email rate limit is 150 an hour
- [ ] 5. Site URL is `https://www.dataleadafrica.com` and the link in a real email proves it
- [ ] 6. Both domains are in Redirect URLs, localhost is gone, and a real link opens the site
- [ ] 7. Minimum password length is 8

When all seven are ticked, public sign up works end to end and the emails say true things.

---

## One honest note about what you cannot check from SQL

Six of these seven live only in the dashboard. There is no query that reads them back, because
Supabase does not expose the auth configuration to the database side.

That is why every one of them has a behavioural test above. **A screenshot of a settings page proves
what the page said at the moment it was taken.** An email that arrives, with a link to the right
domain, carrying a code that expires when it should, proves the system actually behaves the way the
settings claim. Do the behavioural ones. They take longer and they are the only ones that mean
anything.
