# What file 12 does, explained simply

Written to be understood without knowing any SQL.

---

## Part 0. The sign in deadlock

### What it is

The bootcamp portal does not use a password. You type your email address, it emails you a six
digit code, and you type the code in. A function called `request_certificate_code` makes the code.

That function asked one question before making anything: **does this person already hold a
certificate?** If yes, it made a code. If no, it made nothing.

Then, whichever happened, it answered **yes, done**. The page cannot tell the two apart, so it
shows the same cheerful "check your email" either way.

A certificate is what you get at the **end**. The portal is what you need in the **middle**. So
everybody on a course that is still running was told to check an email that was never sent. There
was nothing on the page suggesting a problem and nothing anywhere recording that a person had been
turned away. They would reasonably think they had mistyped their address, try again, and get the
same message.

### How to see it for yourself

1. Pick somebody with an active enrolment and no certificate.
2. At `/sign-in`, enter their email address. The page says a code has been sent.
3. In the SQL editor, look in `auth_codes` and in `mail_outbox` for that address. Both are empty.

Nothing was sent, and nothing recorded that nothing was sent.

### Why it was built that way, and why that is not an excuse

The caution was right. Without a gate, the page becomes a way of asking the database "is this
address one of yours", one guess at a time, and a free way of emailing strangers. The mistake was
choosing the wrong gate: the end of the journey instead of the middle.

### The fix

The gate now opens for either of two things: a certificate that has not been revoked, **or** an
active enrolment. One is the past, the other is the present.

Nothing else was loosened. A complete stranger still gets nothing. Somebody withdrawn from a
cohort still gets nothing. Somebody whose only certificate was revoked still gets nothing. The
tests check all three, because widening a gate is exactly the change that accidentally widens it
to everybody.

---

## Part 0b. One sentence for everybody, and why I changed my mind

Earlier today you asked for the page to tell people when they are not enrolled, and I built that.
Your reviewer was right to stop it, and so is the replacement.

### What was wrong with telling them

The moment the page says one thing to an enrolled address and another to an unenrolled one, it
becomes a machine for answering the question "is this person on your cohort?" Anybody can type
addresses into it all day.

On the certificate claim page it is worse. There the gate is **holding a certificate**, so a page
that answered honestly would be answering "has this person graduated?" That is somebody else's
business, not a stranger's.

### What it says now

Every outcome gets this, word for word:

> If you are enrolled, your code arrives within 5 minutes. Nothing yet? Check spam or contact us.

Enrolled, withdrawn, never heard of, already graduated, or asking too often: the same sentence.
This is better than my version in a way worth naming. It is **honest without being an oracle**. It
tells the person what to expect, how long to wait, and what to do if nothing comes, and it says
nothing whatever about them. The person who most needed telling, the one who is not enrolled, is
told what to do: contact us.

The only reply that differs is for something that is not an email address at all, because that is
about what was typed, not about who they are.

### The bit that is easy to get wrong

The page receives the whole answer from the database, and anybody can open their browser's tools
and read it. So it is not enough for the **sentence** to be identical: the hidden label beside it
has to be identical too. It is. Every outcome comes back labelled `accepted`. The real outcome goes
only to a log on the server that no browser can reach.

The rate limit needed the same care. If the limit counted **codes**, then hitting it could only
ever happen to somebody being sent codes, so hitting it would itself prove the address is enrolled.
The limit would become the very thing the wording exists to close. So it counts **attempts**
instead, which makes it fire the same way for everybody.

### What this costs

A learner who is genuinely rate limited, or caught by the ceiling below, is told their code is
coming when it is not. That is the same shape of fault as the original deadlock, which I do not
want to gloss over. Two things make it acceptable rather than a repeat: the sentence tells them to
contact you, which the original did not, and the health check now reports both counters so you can
see it happening rather than waiting for a complaint.

---

## Part 1. Email that reaches the public

### The problem

Supabase writes the Academy's sign up and password reset emails itself, and sends them through its
own service, which manages **two an hour and only to your own team**. A member of the public would
never get a confirmation, and nothing would look broken: the sign up would succeed and the email
would simply never exist.

### The obvious answer, and why it does not work

Supabase will call something of yours when it wants an email sent. The obvious something is a small
web page in Apps Script. Three things make that wrong, and any one of them alone would be enough:

1. **Apps Script cannot see the headers of a request.** The proof that a call really came from
   Supabase rides in a header. So an Apps Script page cannot check it, which means it cannot tell
   Supabase apart from a stranger, which means it is a way for a stranger to make your site email
   anybody in the world.
2. **The call has to be answered in five seconds.** Apps Script is not reliably that fast when it
   has been idle.
3. **Apps Script answers by redirecting**, and a caller expecting a plain yes may read a redirect
   as a no.

### What was built instead

Supabase will also call a function **inside your own database**, and that is what it now does. The
function is called `send_email_hook`. It takes the code Supabase made and drops it into the same
outbox your mailer has always emptied. Your mailer collects it on its next run.

There is no page on the internet, so there is nothing for a stranger to find. There is no network
in the middle, so there is nothing to be slow. And there is no header to check, because the call
never leaves the database.

Three good things fall out of it without extra work. One sender, so every email looks like the
same organisation. One place to change wording. And the alarm from Part 3 already watches the
outbox, so an Academy confirmation stuck in the queue raises the same alarm a bootcamp code would.

**How long a learner waits:** the mailer runs **every minute**, so under two minutes in practice.
That is why the agreed wording says five: it is a promise that is comfortably easy to keep.

### Who the email comes from

All of it goes out from **datalead.a.info@gmail.com**.

Apps Script always sends as whichever Google account owns the script. So if the script lives in that
account, there is nothing at all to set up. If it lives somewhere else, that account has to be given
permission to send as the gmail address, which is a few clicks in Gmail's settings and a
confirmation link. The script works out which situation it is in by itself, and `checkSenderReady()`
tells you what learners will actually see. That function exists because the failure here is a quiet
one: without the permission, every email goes out from the wrong address and nothing complains.

One happy side effect. There are three records people normally have to add to their domain name
before email is trusted, called SPF, DKIM and DMARC, and getting them wrong is the usual reason
confirmation emails land in spam. They say which servers are allowed to send email **as your
domain**. Mail from a gmail.com address is not sent as your domain, so none of that applies and
there is no DNS work and no waiting. The small cost is that a confirmation carrying links to
dataleadafrica.com, sent from a gmail.com address, is a slightly weaker signal to a spam filter than
one from the domain itself, because nothing ties the sender to the site. The test checklist is there
to confirm it arrives rather than assume it.

### One thing the outbox needed

Every row in the outbox used to be a certificate code, so the mailer could assume the wording.
Now that Academy sign ups go through the same outbox, the mailer has to be told which is which, or
somebody confirming a new account receives an email about a certificate. So the outbox gained a
column saying what each row is for, and the mailer picks from five wordings. A row written the old
way, with nothing in that column, is treated as a certificate code, so nothing already queued is
mis-sent.

### Why a failure here fails loudly

The hook runs inside the moment the account is being created. If it fails, the sign up fails and
the person sees an error. That is deliberate. A sign up that **appears** to work and sends no email
is the exact fault this whole file exists to remove, and we are not going to reintroduce it in a
new place. Better a visible failure the person can retry.

---

## Part 2. Who is "the caller", and the limit that cannot be faked

### What the database can see, and what it can believe

When the website calls the database, the database is handed the headers of the request, including
one called `x-forwarded-for`. That is a list of addresses, and it **grows from the left**: every
relay on the way adds the address it saw to the end.

So the first address in the list is whatever the caller **claimed**, which anybody is free to
invent. The last one is what the relay nearest to us **actually saw**.

**The version I sent you an hour ago read the first one.** That is backwards, and it made the limit
worthless: send a different invented address each time and the limit never bites once. It now reads
the last one. One of the tests fires twenty requests with a different faked address on each and
checks that the limit still catches them.

### Why that is still only a speed bump

Even corrected, a header is a claim and a claim is not a fact. We do not control the relays in
front of Supabase and cannot prove how many there are, and the header is missing altogether when
you run something in the SQL editor. So there are two more limits that depend on nothing anybody
can choose.

| Limit | What it counts | Fakeable? |
| --- | --- | --- |
| 5 tries per address per 15 minutes | tries, not codes | No. The address is the thing being guessed at |
| 15 tries per caller per 15 minutes | the last entry in that list | Partly. Treat as advisory |
| **25 codes an hour and 80 a day, for the whole site** | **what the database actually did** | **No** |

The last one is the backstop. It cannot be faked because it counts what the server wrote, not what
anybody told it.

**Its honest cost.** A flood could use that allowance up, and then real learners wait until the
hour rolls on. That is a denial of service and I am not pretending otherwise. It is the lesser of
two harms: the alternative is spending the day's Gmail allowance, and Google stops the account
sending for a full **24 hours** when that runs out. An hour of waiting beats a day of silence.

**Where 25 and 80 come from.** Google allows a free gmail.com account **100 emails a day** through
Apps Script, which we measured rather than guessed. So our ceiling sits under it on purpose: if
Google's limit is reached first it stops everything for a day with no warning, whereas ours shows up
in the health check. The 20 left over are for the daily alarm email, the odd manual test and a retry.

Those two numbers live in a small table called `mail_limits`, not in the code, because the right
number depends on which Google account owns the mailer script and that can change without the
database changing. Raising them is one statement. If the row is ever deleted by accident, the
functions fall back to 25 and 80 rather than to no limit at all, because "no limit" is the failure
that empties the day's quota.

**80 a day is tight, and worth saying plainly.** It covers every email the site sends: Academy sign
ups, password resets, bootcamp codes and certificate codes together. A cohort of 40 signing in once
is half of it in a morning.

The way out keeps the sender you asked for. The allowance follows the account that **owns** the
script, not the address it sends **as**. Own the script with your paid Workspace account, add
`datalead.a.info@gmail.com` to it under Send mail as, and you get 1,500 a day while learners still
see the gmail address. Then raise the table to match.

**How you would know.** The page tells nobody they were refused, on purpose, so the only place it
shows is the health check. It has two new rows: how many emails went out in the last day against
the ceiling, and how many sign in attempts sent nothing in the last hour, which warns at 50 and
alarms at 200. A handful is ordinary: people mistype their address. Two hundred is somebody working
through a list.

---

## Part 3. A health check and an alarm

### The problem

Several things here can stop working **silently**, which is the worst way for anything to fail. If
the mailer stops collecting, codes keep being made and are thrown away unsent after an hour. Nobody
can get in. Nothing says so. And a wrong password on the mailer looks exactly like a healthy mailer
with nothing to do.

### What was built

One function, `system_health`, answering seven questions at once:

| It reports | ALARM when | Warning when |
| --- | --- | --- |
| How old the oldest uncollected email is | over 20 minutes | over 7 minutes |
| When the mailer last collected | over 60 minutes, or never | over 30 minutes |
| Database size against the 500 MB allowed | over 90% | over 75% |
| Each night job, when it ran and whether it worked | it failed | the scheduler is off |
| People who signed up yesterday and never confirmed | | 5 or more |
| Emails sent in the last day, against the ceiling | at the ceiling | at 70 percent of it |
| Sign in attempts that sent nothing, last hour | 200 | 50 |

It also puts one line at the top, `OVERALL`, carrying the worst thing it found, so the alarm only
has to read one line.

It only reads. Running it can never make anything worse.

### How it is protected

It reports things an outsider should not know. But the thing calling it is a Google script, not a
person, so it cannot sign in. So it uses the trick the mailer already uses: a shared password. The
database stores only a **scrambled** version, so even somebody who could read that table could not
work out the real one.

Two extra rules, both tested. If the password is wrong it does not just refuse: it answers with one
line saying so, which the alarm treats as an alarm in its own right, because a blind alarm should
be noisy. And if somebody **is** signed in and is not the administrator, it refuses whatever
password they hold.

### The alarm

A small Google script runs once a day, calls the health check, and then decides whether to bother
you. Something wrong: it emails you. Nothing wrong: it says nothing, **except on Mondays**, when it
sends one short "all good" note.

That Monday note is the important decision. An alarm that only ever speaks when something is wrong
is indistinguishable from an alarm that has died, and you would find out which by having an outage
nobody told you about. One email a week is the price of knowing it is alive.

**It also stops the project pausing.** Supabase pauses a free project after about a week with no
traffic, and waking it is a manual step you would discover when a learner could not sign in. The
daily call arrives from Google's servers, from outside, so it counts as real traffic. One request a
day is enough. The alarm pays for itself twice: it tells you when something is broken, and it
removes one of the things that breaks.

**Where the password lives.** In Script Properties, a settings area attached to the script. Not in
the code, because code gets copied and pasted into chats. Not in a Sheet, because Sheets get shared
by link and links get forwarded. The mailer's token has moved there too, in this change.

---

## Part 4. Replacing the mailer's password

The steps are in `EMAIL-SETUP.md`. The one thing worth understanding here is the small gap.

The database holds one password. The moment you change it, the old one stops working, and the
Google script keeps using the old one until you edit it. For a minute or so they disagree.

Nothing is lost in that minute. A code is written into the outbox the instant somebody asks for it;
the mailer collecting it is a separate step afterwards. So during the gap the codes **queue up**
rather than vanish, and go out on the next collection.

There is one real deadline: an uncollected code is deleted after an hour. Finish inside the hour
and nobody loses anything at all.

---

## Part 5. You cannot delete a question somebody has answered

### What was wrong

When a learner starts a set of questions, the system writes down which questions they were given,
so nobody can change them underneath halfway through. That written-down list is just a list of
names. It did not stop anybody deleting the questions themselves.

So an administrator tidying up could delete a question that was on somebody's attempt. The list
then points at nothing. Before file 11, that learner was marked out of nothing and told **"All 0
correct. On you go."** File 11 stopped the false pass, which was the urgent half. But the record is
still damaged: nobody can ever see again what that learner was actually asked.

File 10 already stopped the question **import** from deleting. This closes the last way in: a plain
delete, by hand.

### What was done

The database refuses it, and explains itself:

> This question has already been given to a learner in 3 attempt(s), so deleting it would break
> their record. Retire it instead: update lms_questions set active = false where id = ...

Retiring already worked and is the right move anyway: an inactive question is never given to
anybody new, while everybody who already answered it keeps a complete record.

A question nobody has ever been given can still be deleted. Making one and realising it is wrong is
perfectly ordinary.

### This one applies to you too

Most guards in this system make an exception for the SQL editor, because without it nothing could
ever be fixed by hand. This one does not. It applies to everybody, including the administrator.

That is deliberate, and it is the second rule of its kind after the empty-quiz rule in file 11. The
damage is not to a setting that can be put back. It is to a person's record of what they were
asked, and no amount of authority can reconstruct that. The message names the alternative, and the
alternative achieves everything deleting would except the destruction.

---

## What this means for the website

Four files change, and they are complete in `front/`.

**`src/lib/learning.ts` and `src/lib/certificates.ts`** now call `request_sign_in_code` and show
the sentence the database returns, rather than inventing their own. One place to change the wording,
and the page can never drift out of step with what the database actually did.

**The two pages** show that sentence instead of their old ones. The claim page previously said "If
**you@example.com** is on our records, a code is on its way", which named the address back at the
person; the new wording does not need to.

**Nothing has to be deployed on the day the SQL runs.** `request_certificate_code` keeps its name,
its argument and its yes-or-no answer, and is now a thin wrapper around the new function. So the
site that is live today carries on working untouched, and you can deploy the pages whenever suits
you.

---

## If something goes wrong

`12_undo.sql` removes everything. **Read the top of it first:** two steps have to happen before a
single line of it runs, and neither can be done from the SQL editor.

1. Turn the Send Email hook **off** in the dashboard. The undo drops the function the hook calls,
   and dropping it while the hook is on makes every Academy sign up fail.
2. If the pages have already been deployed calling the new function, put the old pages back first.

It deliberately does **not** revert the Part 0 fix. Doing that would lock out every enrolled
participant with no certificate, which is the entire fault. The undo says so at the top and carries
a query that counts how many people on your database that would be.
