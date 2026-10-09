# Making the two administrators

Two people, done one at a time, with a check after each.

**Nothing on the website can make somebody an administrator.** That is deliberate, and it is worth
understanding before you start, because it looks like an oversight until you see the reason.

If a page could grant administrator, then that page would be the way in. Anybody who found a hole in
it would not get one person's data; they would get the ability to publish anything, change prices,
and read every answer key. So the only route is a statement typed into the Supabase SQL editor,
which only somebody with the project password can reach.

It has a second use. It is the **recovery route**. If everything else breaks, if nobody can sign in,
if the facilitator list is wrong, this is how you get back in. Breaking glass is the right picture:
it is behind glass on purpose, and you should be able to reach it in an emergency.

---

## Before you start: who are the two?

| | Who | Why |
| --- | --- | --- |
| First administrator | **You**, with whichever address you will actually sign in with | You are doing the work, so you need it first |
| Second administrator | **Dr Ayoola Arowolo** | So the Academy does not depend on one person being reachable |

**They must be two different people with two different email addresses.** If both administrators are
the same person under two addresses, you have two accounts and still one point of failure. The whole
value of the second one is that somebody else can publish a course, fix a wrong price, or recover
the system on a day when the first person is on a plane.

Everywhere below, replace `you@dataleadafrica.com` and `ayoola@dataleadafrica.com` with the real
addresses. **Use the exact address each person will sign in with**, including capitals if any,
because the match is on the address and a near miss simply does nothing.

---

## Step 1. Create the account properly

Do this in the Supabase dashboard, not on the website. The website sign up page does not exist yet,
and even once it does this way is cleaner.

1. Open the certification project in Supabase.
2. Go to **Authentication**, then **Users**.
3. Click **Add user**, then **Create new user**.
4. Enter the email address and a password.
5. **Tick "Auto Confirm User".** This matters more than it looks. The trigger that creates the
   profile row fires when the account is created, and every access rule in the Academy checks for a
   **confirmed** address. An unconfirmed administrator is an administrator with no rights, and the
   symptom is confusing: the role says admin and nothing works.
6. Click **Create user**.

**Check it worked**, in the SQL editor:

```sql
select email,
       case when email_confirmed_at is null then 'NOT CONFIRMED, go back and tick Auto Confirm'
            else 'confirmed' end as state
  from auth.users
 where email = 'you@dataleadafrica.com';
```

One row saying `confirmed`. No row means the address is different from what you typed.

---

## Step 2. Check the profile row appeared

The Academy keeps its own small row per person, in `lms_profiles`, created automatically when the
account is made.

```sql
select p.id, u.email, p.role
  from lms_profiles p join auth.users u on u.id = p.id
 where u.email = 'you@dataleadafrica.com';
```

You should see one row with `role` saying **learner**. That is correct at this stage: everybody
starts as a learner.

**If there is no row**, the trigger did not fire. Do not carry on and do not create the row by hand
until you know why. Send me what you see.

---

## Step 3. Break the glass

This is the statement. One person at a time.

```sql
update lms_profiles set role = 'admin'
 where id = (select id from auth.users where email = 'you@dataleadafrica.com');
```

**Check it took:**

```sql
select u.email, p.role
  from lms_profiles p join auth.users u on u.id = p.id
 where p.role = 'admin';
```

You should see exactly one row, with the right address, saying `admin`.

**The proper check** is to sign in on the site as that person and run:

```sql
select lms_my_role();
```

This is better than the previous one, because it answers the question the way the system actually
asks it: as the signed in person, through the function every page uses. If that says `admin`, you
are an administrator. If the table says admin and this says learner, the account you are signed in
as is not the account you changed.

---

## Step 4. Now the second administrator

Repeat steps 1, 2 and 3 with `ayoola@dataleadafrica.com`.

Then check you have **two**:

```sql
select u.email, p.role, u.created_at
  from lms_profiles p join auth.users u on u.id = p.id
 where p.role = 'admin'
 order by u.created_at;
```

Two rows. If you see one, the second statement did not match an address. If you see three or more,
somebody has an administrator account you did not mean to give, and that should be looked at before
anything else.

---

## Step 5. Add the facilitators

Facilitators build courses. They cannot publish, cannot change a price, cannot delete, and cannot
edit a course that is already live. Those are enforced by seven guard triggers in the database, not
by hiding buttons, so a facilitator cannot route around them.

As an administrator, in the SQL editor:

```sql
select * from lms_add_facilitator('tutor@dataleadafrica.com', 'Their Full Name', 'why they need it');
```

It returns `ok` and a message. The third argument is a note for whoever reads this list in a year
wondering why that person is on it. Write something useful: "STATA course author, Oct 2026" beats
"tutor".

**The person must sign up on the site first**, or there is no account to attach the role to. The
facilitator list works in both directions and is re-checked at every sign in, so adding them before
they sign up also works: they get the role the first time they arrive.

**To see the list:**

```sql
select email_norm, full_name, note, added_at from lms_facilitators order by added_at;
```

**To take somebody off:**

```sql
select * from lms_remove_facilitator('tutor@dataleadafrica.com');
```

Removing them from the list is the whole job. The nightly sweep and the check at every sign in will
take the role away even if they never sign in again.

---

## What to write down, and where

This is the part people skip, and it is the part that matters in a year.

Put in your password manager, shared with the second administrator:

- which two addresses are administrators
- the Supabase project password
- the health check token
- the mailer token

**Do not put them in a Google Sheet, a document, or a chat message.** The mailer token reached a chat
message once already in this project, which is why it is being rotated.

And put one line in `docs/lms/STATUS.md` saying who the two administrators are and when they were
made. Not the addresses if you would rather not, but the fact and the date. The repository is what
survives everybody's memory.

---

## If you ever lose access to both

This is the scenario the second administrator exists to prevent, and if it happens anyway:

1. Sign in to Supabase itself, which is a separate account from the Academy.
2. Open the SQL editor.
3. Run the break glass statement in step 3 against whichever address you can still receive email on.

The SQL editor is outside the Academy's own rules entirely. As long as somebody can sign in to
Supabase, the Academy can be recovered. **That means the Supabase account password is the real
master key**, and it should be treated as the most important secret in the project, above any token.
