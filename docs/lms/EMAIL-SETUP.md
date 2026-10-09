# Email for the Academy and the bootcamp portal

Everything here was checked against the current Supabase and Google documentation on
7 October 2026, not from memory.

**The short version.** All email now leaves through one place: the Apps Script mailer you
already run, sending as `datalead.a.info@gmail.com`. Supabase Auth hands its emails to a
function inside the database, which drops them into the same outbox the mailer empties every
minute. There is no SMTP to configure, no DNS work needed for this to function, one sender, one
script, and the alarm from file 12 watches all of it because it watches the outbox.

| | |
| --- | --- |
| How long a learner waits | under 2 minutes. The mailer runs **every minute** |
| Daily allowance | **100 emails a day**, measured. That is Google's limit for a free gmail.com account through Apps Script, and it is the ceiling on how many people can sign in in one day |
| Our own ceiling | 25 an hour and 80 a day, held in the `mail_limits` table, deliberately under Google's 100 so ours fires first and visibly |
| Where the secret lives | Script Properties, never in the code |
| What watches it | `system_health()` and the daily alarm, already built |

---

## Part 1. How this works, and why not the obvious way

### The problem

Supabase Auth writes the Academy's sign up confirmation and password reset emails itself. They
never pass through your database, so your outbox never sees them and your mailer cannot send
them. Supabase's own email service sends **2 an hour, and only to members of the project team**.
Left alone, no member of the public could ever confirm an account, and nothing would look broken:
the sign up would succeed and the email would simply never exist.

### The route we are not taking, and why

Supabase will call either an HTTP endpoint or a Postgres function when it wants an email sent. An
Apps Script web app looks like the obvious endpoint. It is the wrong answer for three separate
reasons, each on its own fatal:

1. **Apps Script cannot read request headers.** `doPost` gives you the body and nothing else. The
   proof that a call really came from Supabase travels in a header, so an Apps Script endpoint
   cannot check it. An endpoint that cannot tell Supabase from anybody else is a way for a
   stranger to make your site email any address in the world.
2. **An HTTP hook must answer within 5 seconds.** Apps Script is not reliably that quick on a
   cold start.
3. **An Apps Script web app answers with a redirect**, not with the plain 200 a webhook caller
   expects. Some callers read that as a failure.

### The route we are taking

A Postgres function, `send_email_hook`, which is the other option Supabase offers and the better
one here. Supabase calls it **inside the database**: no network to cross, no signature to check,
nothing exposed to the internet. It writes the email into `mail_outbox` with a note saying what
kind it is, and your existing mailer collects it on its next minute.

```
Academy sign up                    bootcamp sign in
      |                                   |
Supabase Auth                      request_sign_in_code
      |                                   |
send_email_hook  (Postgres function)      |
      |                                   |
      +---------->  mail_outbox  <--------+
                        |
                 Apps Script mailer, every minute
                        |
                 Gmail, as datalead.a.info@gmail.com
```

Three things fall out of this for free. One sender, so everything looks like the same
organisation. One place to change wording. And the alarm built in file 12 already watches the
outbox, so an Academy confirmation stuck in the queue raises the same alarm a bootcamp code would.

### What to do, click by click

**Before you start:** run `12_email_and_health.sql`. The hook function comes from it.

1. **Make sure `datalead.a.info@gmail.com` can actually be the sender.** Apps Script always sends
   as whichever account owns the script, so there are only two situations:

   - **If the script is owned by `datalead.a.info@gmail.com`, there is nothing to do.** It already
     sends from there. This is the simplest arrangement and the one I would pick.
   - **If it is owned by another account**, that account has to be allowed to send as the gmail
     address: in Gmail as the owning account, the gear, **See all settings**, **Accounts**, then
     under **Send mail as** click **Add another email address**, enter
     `datalead.a.info@gmail.com`, and follow it through. Google emails a confirmation to the gmail
     account; open it and click the link.

   **Either way, run `checkSenderReady()` once** (it is in the script). It tells you which account
   owns the script, which of the two situations applies, what learners will actually see, and how
   many emails a day Google allows. Do not skip it: in the second situation, without the
   verification every email silently goes out from the owning account and you would find that out
   from a learner.

2. **Update the mailer script.** Open the existing Apps Script project and replace its contents
   with `scripts/lms/mailer.gs`. Then:
   - Click the gear, **Project Settings**, then **Script properties**, and add three:
     `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MAILER_TOKEN`. The values are the ones currently
     written at the top of the old file. **The token moves out of the code here**, which is the
     point: the code can then be shared without the secret.
   - Run **`testConnection`**. It should say the connection is good.
   - Run **`sendSamplesToMyself`** to see all five emails.
   - Run **`createTrigger`** if the every-minute trigger is not already there.

3. **Switch the hook on.** In the Supabase dashboard for the certification project, go to
   **Authentication**, then **Hooks**. Find **Send Email hook**, enable it, choose **Postgres
   function**, and select `public.send_email_hook`. Save.

4. **Turn off Supabase's own confirmation link emails if you are using codes.** In
   **Authentication**, then **Providers**, then **Email**, the confirmation setting stays **on**:
   you still want addresses proven. The hook is what changes who posts the letter, not whether one
   is sent.

5. **Check the rate limit.** **Authentication**, then **Rate Limits**. Supabase's 2 an hour
   applies to their built-in provider; their documentation says the limit becomes configurable
   once you use custom SMTP or the Send Email hook. Set it to **150 an hour**. That is well inside
   the 1,500 a day Workspace allows even in the worst hour, while still capping a runaway loop
   before it empties the day's quota.

6. **Set the URL settings** so links in any email that does carry one open on the right site.
   **Authentication**, then **URL Configuration**:
   - **Site URL**: `https://www.dataleadafrica.com`
   - **Redirect URLs**, one per line:
     ```
     https://www.dataleadafrica.com/**
     https://dataleadafrica.com/**
     ```
   - Do not leave `http://localhost:3000` in the list on a live project.

### SPF, DKIM and DMARC: not needed for this, and here is why

This is the one part that got **simpler** by sending from a gmail.com address, so it is worth being
clear about rather than leaving the section looking like outstanding work.

These three records tell the world which servers may send email as **your own domain**. Mail sent
from `datalead.a.info@gmail.com` is not sent as your domain: it is sent as a Gmail address, and
Google already publishes and signs the records for gmail.com. So **none of the work below is needed
for the sign in and sign up emails to arrive.**

Two things that follow, one good and one worth knowing.

The good one: there is no DNS work, no admin console, and no waiting for records to spread before
public sign up can go live. That removes the slowest step from the whole plan.

The one worth knowing: a confirmation email from a gmail.com address carrying links to
dataleadafrica.com is a slightly weaker signal to a spam filter than one from the domain itself,
because nothing ties the sender to the site. In practice Gmail's own reputation carries it and it
will arrive; the test checklist below is how you confirm that rather than assume it. If you ever
want the stronger version later, switch `FROM_ADDRESS` in the script to an address on your domain
and then do the table below. Nothing else changes.

**If you do that later**, or for any other mail you send as the domain, this is the table:

Check all three at once with a web checker: search for "MX toolbox SPF" or "dmarcian domain
checker" and enter `dataleadafrica.com`. Or from a terminal:

```
dig +short TXT dataleadafrica.com
dig +short TXT google._domainkey.dataleadafrica.com
dig +short TXT _dmarc.dataleadafrica.com
```

| Record | A good answer | If it is missing |
| --- | --- | --- |
| SPF | one line on the domain containing `v=spf1` and `include:_spf.google.com`, ending `~all` | Add a TXT record at the root: `v=spf1 include:_spf.google.com ~all`. If you already have an SPF line, do NOT add a second: two SPF records is itself a failure. Merge the include into the existing line |
| DKIM | a long line starting `v=DKIM1; k=rsa; p=...` at `google._domainkey` | **admin.google.com**, then **Apps**, **Google Workspace**, **Gmail**, **Authenticate email**. Google gives you a host name and a value. Add that TXT record at your DNS host, wait, then click **Start authentication** |
| DMARC | a line at `_dmarc` starting `v=DMARC1` | Add a TXT record at `_dmarc.dataleadafrica.com`: `v=DMARC1; p=none; rua=mailto:dmarc@dataleadafrica.com`. `p=none` changes nothing about delivery but starts the reports arriving. After a few weeks of clean reports, move to `p=quarantine` |

Do DKIM **before** raising DMARC past `p=none`. Tightening DMARC while DKIM is missing is the one
order that can stop your own mail arriving.

Again: none of that is needed for the emails in this document. It is here for the day you move the
sender onto your own domain.

### The five emails

The wording now lives in `mailer.gs`, not in the Supabase dashboard, because the hook means
Supabase no longer composes them. All five share one frame so they look like one organisation.

| Purpose | Subject |
| --- | --- |
| `certificate_code` | Your Data-Lead Africa certificate code |
| `academy_signup` | Confirm your Data-Lead Academy account |
| `academy_recovery` | Reset your Data-Lead Academy password |
| `academy_signin` | Your Data-Lead Academy sign in code |
| `academy_email_change` | Confirm your new email address |

A purpose the script has not met falls back to the certificate wording, which is what every row
was before the Academy existed, so an older row is never mis-sent.

### The test checklist, with an outside Gmail address

Use a Gmail address that has nothing to do with Data-Lead Africa. A colleague's address on your
own domain proves nothing, because mail between accounts on one domain often never leaves Google.

**The bootcamp portal, which works today:**

- [ ] At `/sign-in`, request a code for an enrolled participant's address. It arrives within two
      minutes.
- [ ] The sender reads **Data-Lead Africa**, from `datalead.a.info@gmail.com`.
- [ ] Request a code for an address that is **not** enrolled. The page says exactly the same
      thing, and no email arrives. This is the test that proves the page is not telling people
      who is on your list.
- [ ] Sign in with the code.

**The Academy, once the hook is on and a sign up page exists:**

- [ ] Sign up with the outside Gmail address. The confirmation arrives within two minutes.
- [ ] **Check the spam folder before deciding it failed.** First emails from a new sender often
      land there. If it is in spam, press **Not spam** and then finish the SPF, DKIM and DMARC
      section above.
- [ ] The email is worded as a sign up confirmation, not as a certificate code. If it says
      certificate, the hook is writing rows without a purpose.
- [ ] Confirm, then sign in.
- [ ] Use **Forgot password**. The reset email arrives and is worded as a reset.
- [ ] The new password works and the old one is refused.
- [ ] Open one on a phone. The code should be readable without pinching.

**Then check the plumbing:**

- [ ] In the SQL editor, `select * from system_health('your-health-token');`. The row **mailer
      last fetched** should be under a minute, and **oldest unsent email** should be ok.

---

## Part 2. How "the caller" is worked out, and the backstop

This answers the question directly, including the part where my first version of it was wrong.

### What the function can see

PostgREST hands a database function the HTTP headers it received, so the function can read
`x-forwarded-for`. That header is a list of addresses, and **the list grows from the left**: each
proxy appends the address it saw. So:

- the **first** entry is whatever the caller claimed, which they are free to invent
- the **last** entry is what the proxy nearest to us actually saw

**The version I sent you an hour ago read the first entry.** That is backwards, and it made the
limit worthless: a different invented header on each request and the limit never bites once. It
now reads the last entry, and test R2 proves it by firing twenty requests with a different faked
first entry each time and checking that the limit still catches them.

### Why that is still not the protection

Even corrected, treat it as a speed bump. We do not control the proxy chain in front of Supabase
and cannot prove how many hops there are, and the header is absent altogether in the SQL editor.
A header is a claim, and a claim is not a fact.

### The three limits, and which one you can actually rely on

| Limit | Counted on | Can it be faked? |
| --- | --- | --- |
| 5 attempts per address per 15 minutes | attempts, not codes | No. The address is the thing being probed, so an attacker must change it, which does not help them |
| 15 attempts per caller per 15 minutes | the last `x-forwarded-for` entry | Partly. Advisory |
| **25 codes an hour and 80 a day, site wide, from `mail_limits`** | **what the server actually did** | **No** |

The site wide ceiling is the backstop, and it cannot be faked because it counts rows the server
wrote rather than anything a caller said.

**One honest cost.** A flood could use the ceiling up, and real learners would then wait until the
hour rolls on. That is a denial of service, and it is the lesser of two harms: the alternative is
spending the day's Gmail allowance, and Google locks sending for a full 24 hours when that runs
out. An hour of waiting beats a day of silence.

**The ceiling is set to your measured allowance.** `checkSenderReady()` reported **100 a day**, so
the ceiling is 25 an hour and 80 a day, held in the `mail_limits` table rather than written into the
code. Ours sits under Google's deliberately: if Google's limit is reached first, it stops all
sending for up to 24 hours with no warning, whereas ours shows up in the health check.

The 20 left over are for the daily alarm email, the odd manual test, and a retry.

**That is a tight budget, and worth facing squarely.** 80 a day covers every email the site sends:
Academy sign ups, password resets, bootcamp sign in codes and certificate codes together. A cohort
of 40 people each signing in once is half of it in a morning. A launch day would hit the wall.

**The fix is one move, and it keeps the sender you asked for.** The daily allowance follows the
account that **owns** the script, not the address it sends **as**. So if the mailer project is owned
by your paid Workspace account, with `datalead.a.info@gmail.com` added to it under Send mail as,
you get **1,500 a day** and learners still see the gmail address. The script already handles that
case; `checkSenderReady()` will say "GOOD" and report the larger number.

Then raise ours to match, one statement:

```sql
update mail_limits set per_hour = 200, per_day = 1200 where id = 1;
```

`12_verify.sql` row 02e prints whatever it is currently set to, so there is no guessing later.

**Note what the per-address limit does NOT do.** It counts attempts rather than codes. That
matters for a reason that is easy to miss: if it counted codes, hitting the limit would only ever
happen to an address that was being sent codes, so hitting it would itself prove the address is
enrolled. The limit would become the very oracle the identical wording exists to close. Counting
attempts makes it fire the same way for everybody. Test Q7 checks exactly that.

**How a flood becomes visible.** The page tells nobody they were refused, on purpose. So the only
place it shows is the health check, which now has two more rows: **emails sent, last 24 hours**
against the 1000 ceiling, and **sign in attempts that sent nothing, last hour**, which warns at 50
and alarms at 200. The daily alarm emails you when either fires.

---

## Part 3. The alarm

Unchanged from what I sent earlier: `scripts/lms/alarm.gs`, a daily trigger, emails only when
something is wrong plus one "all good" note every Monday so silence cannot hide a dead alarm. Its
own comments carry the setup. Two things worth repeating:

**Who should own it.** A Workspace account that will outlive any one person's involvement, with
edit access shared to a second person. A monitoring script owned by one individual dies quietly
with that individual's login.

**It also stops the project pausing.** Supabase pauses a free project after about a week with no
traffic, and waking it is a manual step you would discover when a learner could not sign in. The
daily call arrives from Google's servers, from outside, so it counts as real traffic. One request a
day is enough.

Set its token in the SQL editor:

```sql
select lms_set_health_token('a long random string of your own, at least 24 characters');
```

---

## Part 4. Rotating the mailer token

The token guards `mail_fetch_pending`, which hands out plaintext codes for other people's
accounts. It has been exposed and should be replaced.

### Why there is a short gap, and why nothing is lost in it

The database holds one token. The moment you change it the old one stops working, and the script
keeps using the old one until you edit it. For a minute or so they disagree.

Nothing is lost. A code is written into the outbox by the database the instant somebody asks for
it; the mailer collecting it is a separate step afterwards. So during the gap codes **queue** rather
than vanish, and go out on the next collection.

One real deadline: an uncollected row is deleted after **one hour**. Finish inside the hour and
nobody loses anything. Early morning Lagos time makes even the delay unlikely to be noticed.

### The steps, in an order that never leaves sign in broken

1. **Generate the new token**, at least 32 characters, from a password manager. Save it there
   before going further.

2. **Prove you can test, with the OLD token.** In the SQL editor:
   ```sql
   select mail_ping('THE-OLD-TOKEN');
   ```
   Expect `OK`. If it says `BAD TOKEN`, stop: what you are holding is not the live token, and you
   need to find the real one in the Apps Script before continuing.

3. **Open the mailer script ready to edit.** If you are also doing the Part 1 rewrite, do it now:
   paste in the new `mailer.gs` and add the three script properties, putting the **new** token in
   `MAILER_TOKEN`. Do not save yet if you want the gap as short as possible; have it ready.

4. **Change the token in the database:**
   ```sql
   update mailer_token
      set token_hash = encode(digest('THE-NEW-TOKEN', 'sha256'), 'hex'),
          updated_at = now()
    where id = 1;
   ```
   Then immediately check both:
   ```sql
   select mail_ping('THE-NEW-TOKEN');   -- expect OK
   select mail_ping('THE-OLD-TOKEN');   -- expect BAD TOKEN
   ```

5. **Save the script.** The gap closes here.

6. **Run `sendPendingCodes` once by hand** rather than waiting for the timer.

7. **Check the queue drained:** `select mail_ping('THE-NEW-TOKEN');` The waiting count should be
   0 or falling.

8. **Prove it end to end.** At `/sign-in`, request a code to an outside Gmail address belonging to
   an enrolled participant. It should arrive. This is the only step that proves the whole chain
   rather than just the token.

9. **Delete the old token** from your password manager, your notes, and any chat it was pasted
   into. It is dead the moment step 4 runs, but a dead secret lying around still teaches somebody
   how you store them.

### Do these three together

Set the health token, rotate the mailer token, and paste in the new `mailer.gs`. One sitting, two
secrets, and the alarm starts watching the mailer you have just fixed.
