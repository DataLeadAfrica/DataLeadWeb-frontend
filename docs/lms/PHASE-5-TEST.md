# The Phase 4 test, click by click

This is the test to run on the `lms-academy` Vercel preview with your own unlisted YouTube
video, before any of this is merged. It takes about 45 minutes the first time.

Nothing here touches the live site. Everything you create is prefixed `p4-` so you can find
it again and delete it, and the last section removes all of it in the right order.

**Have ready:**

- the Vercel preview address for the `lms-academy` branch
- one unlisted YouTube video, **and its length in seconds**, to the second
- a working email address you can read, that is NOT your administrator one
- the Supabase SQL editor open in another tab

---

## Before anything: run file 14, then file 15

**File 14 has never been run on the live database either.** It is the one that closes the two
security leaks, and file 15 is built on top of it. Doing them out of order, or skipping the
first, leaves the Academy with every paid video readable by anybody holding the public key.

In the Supabase SQL editor, in exactly this order, reading the verify output each time before
going on to the next:

| | Run | Then read | Every row should say |
| --- | --- | --- | --- |
| 1 | `database/lms/14_public_catalogue.sql` | `database/lms/14_verify.sql` | **20 rows, all yes** |
| 2 | `database/lms/15_learning_pages.sql` | `database/lms/15_verify.sql` | **23 rows, all yes** |

**If any row says `NO`, stop there.** The "what it means" column on that row says what to do,
and nothing after it will work properly until it says yes. In particular, file 15 refuses to
apply at all if file 14 has not been: its step 0 lists what is missing and changes nothing.

Row 1 and row 2 of `14_verify.sql` are the two leaks. If either says `NO` after running file
14, do not go any further: a stranger with the site's public key can still list every paid
video, and that matters more than any of the rest of this.

---

## 1. Build the test course

Paste this into the SQL editor, with **your own video id and length** in the two places marked.
It makes one course with two modules, three lessons and one module quiz.

```sql
-- =============================================== CHANGE THESE TWO LINES
-- Your unlisted video's id is the part after v= in its address, and the
-- length must be the REAL length in seconds. The whole lesson gate is
-- built on it: a wrong length means the bar fills at the wrong moment.
\set video_ref  'PUT_YOUR_VIDEO_ID_HERE'
\set video_secs 600
-- =======================================================================

-- A programme, which a course needs before it can be published.
insert into programmes (slug, title, code, template_key, active)
select 'p4-programme', 'Phase 4 test programme', 'P4T', 'default', true
 where not exists (select 1 from programmes where slug = 'p4-programme');

insert into lms_courses (slug, title, summary, tool, area, level, cover_code,
                         price_kobo, first_module_free, status, programme_id,
                         outcomes, audience, prerequisites)
values ('p4-test-course', 'Phase 4 test course',
        'A throwaway course for testing the learning pages. Delete it afterwards.',
        'STATA', 'Analysis', 'Beginner', 'P4', 0, false, 'draft',
        (select id from programmes where slug = 'p4-programme'),
        array['Watch a lesson all the way through',
              'Pass a lesson check',
              'Pass a module quiz'],
        array['Whoever is testing this'],
        array['Nothing']);

insert into lms_modules (course_id, title, position)
select c.id, m.title, m.position
  from lms_courses c,
       (values ('Module one', 1), ('Module two', 2)) as m(title, position)
 where c.slug = 'p4-test-course';

-- Three lessons, all the same video. coverage_percent is 90, so the
-- check opens at 90 percent watched.
insert into lms_lessons (module_id, title, position, type, video_provider,
                         video_ref, duration_seconds, bucket_seconds, coverage_percent)
select m.id, l.title, l.position, 'video', 'youtube',
       :'video_ref', :video_secs, 10, 90
  from lms_modules m
  join lms_courses c on c.id = m.course_id
  join (values ('Module one', 'Lesson one', 1),
               ('Module one', 'Lesson two', 2),
               ('Module two', 'Lesson three', 1)) as l(modtitle, title, position)
    on l.modtitle = m.title
 where c.slug = 'p4-test-course';
```

Then the questions, as an administrator, so they get the real defaults:

```sql
do $$
declare v_l1 uuid; v_m1 uuid; v_check uuid; v_quiz uuid; i integer;
begin
  select l.id into v_l1 from lms_lessons l
    join lms_modules m on m.id = l.module_id
    join lms_courses c on c.id = m.course_id
   where c.slug = 'p4-test-course' and l.title = 'Lesson one';
  select m.id into v_m1 from lms_modules m
    join lms_courses c on c.id = m.course_id
   where c.slug = 'p4-test-course' and m.title = 'Module one';

  v_check := lms_create_quiz(v_l1, null, 'Lesson one check');
  v_quiz  := lms_create_quiz(null, v_m1, 'Module one quiz');

  for i in 1..3 loop
    insert into lms_questions (quiz_id, prompt, type, position, marks, explanation)
    values (v_check, 'Check question ' || i || ': which answer is the right one?',
            'single', i, 1,
            'The right one is the one that says RIGHT. This sentence is the explanation, '
            || 'and you should see it under question ' || i || ' whether you got it right or wrong.');
    insert into lms_options (question_id, label, is_correct, position)
    select q.id, o.label, o.ok, o.position
      from lms_questions q,
           (values ('RIGHT', true, 1), ('wrong', false, 2), ('also wrong', false, 3))
             as o(label, ok, position)
     where q.quiz_id = v_check and q.position = i;

    insert into lms_questions (quiz_id, prompt, type, position, marks, explanation)
    values (v_quiz, 'Quiz question ' || i || ': which answer is the right one?',
            'single', i, 1, 'The explanation for quiz question ' || i || '.');
    insert into lms_options (question_id, label, is_correct, position)
    select q.id, o.label, o.ok, o.position
      from lms_questions q,
           (values ('RIGHT', true, 1), ('wrong', false, 2), ('also wrong', false, 3))
             as o(label, ok, position)
     where q.quiz_id = v_quiz and q.position = i;
  end loop;

  update lms_quizzes set status = 'published', shuffle = false
   where id in (v_check, v_quiz);
end $$;
```

**Check the course is ready to publish**, which prints the checklist rather than just failing:

```sql
select * from lms_course_blockers(
  (select id from lms_courses where slug = 'p4-test-course'));
```

Every row should say `ok = true`. Then publish it:

```sql
select * from lms_publish_course(
  (select id from lms_courses where slug = 'p4-test-course'));
```

---

## 2. Sign up as a learner

Use the preview address, not the live site.

| | What to do | What should happen |
| --- | --- | --- |
| 2.1 | Open `/lms/courses` | The test course is listed, marked **Free** |
| 2.2 | Open it | The course page, with the three lessons in the curriculum and no video reference anywhere. Right click, View Page Source, search for your video id: **it must not be there** |
| 2.3 | Press **Start free** | The sign up form |
| 2.4 | Sign up with your test email. Use your real full name | The code screen |
| 2.5 | Put in the code from the email | You land on `/lms/me` |
| 2.6 | Look at `/lms/me` | A welcome card saying "Pick your first course". **No** empty courses list, **no** empty week chart, **no** empty certificates list |

**If the email does not arrive,** that is the mailer, not Phase 4. `docs/lms/EMAIL-SETUP.md` is
the place to look, and the rest of this test can be done by confirming the account in the
Supabase Authentication tab instead.

---

## 3. The course page and the resume button

| | What to do | What should happen |
| --- | --- | --- |
| 3.1 | Go back to the course and press the button | You land on `/lms/learn/p4-test-course` |
| 3.2 | Look at the top | A ring at 0%, the title, "0 of 3 lessons done" and a button saying **Start the course** |
| 3.3 | Look at the modules | Lesson one has an orange ring mark. Lessons two and three have **padlocks** and are not links |
| 3.4 | Try to click lesson three | Nothing happens. It is not a link |
| 3.5 | Look at the right hand side | "Your certificate", with "Start the course" ticked and the other two not. The counts should read 0/3 and 0/1 |
| 3.6 | Press **Start the course** | The lesson player |

---

## 4. The player, which is where the real testing is

### 4.1 It plays

| | What to do | What should happen |
| --- | --- | --- |
| a | Look at the page | Your video, the watch tape under it, the outline on the right |
| b | Look at the tape | Grey cells, one per ten seconds, with a line marked **90%** |
| c | Press play and watch for a minute | Cells fill in from the left, about one every ten seconds, and the percentage goes up |
| d | Look at the gate line | "The lesson check opens at 90%. You are at 10%." or similar, and the button is **greyed out** |

### 4.2 No skipping ahead on a first watch

| | What to do | What should happen |
| --- | --- | --- |
| a | Drag the video's own scrubber to near the end | You are **sent back** to about where you had got to |
| b | Look under the tape | An orange note: "That part is still ahead of you..." |
| c | Drag backwards, to the start | Allowed. Going back is always allowed |

### 4.3 The speed cap, and a whole lesson at 1.5x

| | What to do | What should happen |
| --- | --- | --- |
| a | Look at the Speed box under the player | It offers 0.75x, 1x, 1.25x and **1.5x, and nothing faster** |
| b | Use **YouTube's own** speed menu, inside the video, and set 2x | Within a second or two it drops back to 1.5x on its own |

That second one matters: the cap is not a request. Above 1.5x the database refuses slices faster
than an honest watch could produce them, and the lesson would never open.

**Then the one that actually matters, and it takes as long as it takes.**

| | What to do | What should happen |
| --- | --- | --- |
| c | Set the speed to **1.5x** and watch **a whole lesson from beginning to end** without touching anything | The tape fills completely, the figure reaches **100%**, and the check button lights up |

**Do not skip this one, and do not do it at 1x only.** The first version of Phase 4 sent one
slice per ten seconds of clock time rather than per ten seconds of video, so at 1.5x every third
slice was never recorded and a lesson ended at about 65 percent, permanently short. At 1.25x it
was every fifth. At 1x it got there only if the phone was not busy. Every other test passed.

If the figure stops short of 100 and the button stays grey after watching the whole thing, that
is this bug coming back, and it is worth reporting immediately with the speed you used.

| | What to do | What should happen |
| --- | --- | --- |
| d | Do the same on lesson two at **1.25x** | Also reaches 100% |

### 4.4 Losing signal

| | What to do | What should happen |
| --- | --- | --- |
| a | With the video playing, turn off your wifi or mobile data | Within about twenty seconds, an orange note: "Offline, your progress will save when you reconnect." It says how many parts are waiting |
| b | Keep watching for a minute with it off | The note stays. The video keeps playing |
| c | Turn the connection back on | The note changes to "Catching up on N parts you watched while the connection was down", and the tape **fills in the cells from the offline minutes** |
| d | Keep watching, or just wait | The catching up note goes on its own once the backlog is through, and the figure includes every offline minute |

**Nothing should be lost.** If the tape does not catch up, that is a bug worth reporting.

The backlog comes in deliberately slowly, a few parts at a time. That is not a fault: the
database will not accept slices faster than somebody could honestly have watched them, and
sending them faster does not store them, it throws them away. Two minutes offline takes about
two minutes to catch up on.

### 4.5 Reaching the mark

| | What to do | What should happen |
| --- | --- | --- |
| a | Watch the whole lesson. It is the real length of your video, so put the kettle on | At 90% the button lights up and says **Take the lesson check** |
| b | Leave the page and come back | It resumes **where you stopped**, not at the start and not at the furthest point you ever reached |

To test the resume properly: watch to about halfway, then drag back to near the beginning, pause,
and reload the page. It should come back **near the beginning**, which is where you actually
stopped. That is the bug file 15 fixed.

---

## 5. The lesson check

| | What to do | What should happen |
| --- | --- | --- |
| 5.1 | Press **Take the lesson check** | A card with three questions, all on one screen, and "try as often as you like" at the top |
| 5.2 | Answer only two of them | **Check my answers** is greyed out, and a line says "1 still to answer" |
| 5.3 | Answer all three, getting at least one **wrong** on purpose | **Check my answers** goes live |
| 5.4 | Press it | Each question turns green or red, **and every one shows its explanation underneath, including the wrong ones** |
| 5.5 | Read the line at the bottom | "2 of 3 correct. Read why under each one, change your answers and check again." |
| 5.6 | Press **Try again**, fix the wrong one, press **Check my answers** | "All 3 correct. On you go." and the button becomes **Next lesson** |
| 5.7 | Press **Next lesson** | Lesson two opens |

Step 5.4 is the one to watch. Before file 15, a wrong answer showed nothing at all, which is the
one moment an explanation is any use.

**Then, if you have the patience, test the trap is gone:** on lesson two's check, get an answer
wrong **twenty one times in a row**. It must keep letting you try. Before file 15, the twenty
first attempt returned nothing, the lesson could never be completed, and the course was dead for
that account for ever.

---

## 6. The module quiz

Finish lessons one and two so the module quiz is reachable, then from
`/lms/learn/p4-test-course` press **Open** on the Module one quiz row.

| | What to do | What should happen |
| --- | --- | --- |
| 6.1 | Look at the intro | Four boxes: 3 questions, 70% pass mark, no time limit, 3 tries. Three grey pips on the right, and a sentence saying what happens after three tries |
| 6.2 | Press **Start the quiz** | **One** question, with numbered squares 1 2 3 above it |
| 6.3 | Answer question one | The word **Saved** appears, and square 1 changes colour |
| 6.4 | Press **Next**, skip question two without answering, press **Next** again, answer question three | Squares 1 and 3 are coloured, 2 is not |
| 6.5 | **Close the tab**, then reopen the quiz address | Your two answers are still there. The same try carries on |
| 6.6 | Press **Review my answers** | "1 question still blank", an orange warning, and a list where the blank one is highlighted |
| 6.7 | Press the blank one | It takes you back to question two |
| 6.8 | Answer it wrong on purpose, review again, press **Send my answers** | A red ring, the score, and **"You have 2 tries left"**, with one pip marked used |
| 6.9 | Scroll down | **Nothing** showing which questions were right or wrong. That is deliberate: it is solvable by elimination otherwise |
| 6.10 | Press **Try again**, fail it twice more | After the third failure: **"the quiz opens again at ..."** with a real time about 24 hours ahead, no Start button, and a **Revise the lessons** link |
| 6.10b | Go back to the quiz address while it is waiting | The four rule tiles are **dimmed and grey**, the fourth one reads "3/3 tries used", and on a phone the waiting card is **above** them. Nothing on the screen says "3 tries" at full strength next to a card saying they are gone |

Step 6.10 is the second trap. Before file 15 the quiz simply never opened again and the
certificate was unreachable for ever.

**To test the reopening without waiting a day,** run this in the SQL editor and reload:

```sql
update lms_quiz_attempts set submitted_at = submitted_at - interval '25 hours',
                             started_at   = started_at   - interval '25 hours'
 where user_id = (select id from auth.users where email = 'YOUR_TEST_EMAIL')
   and quiz_id = (select z.id from lms_quizzes z
                    join lms_modules m on m.id = z.module_id
                    join lms_courses c on c.id = m.course_id
                   where c.slug = 'p4-test-course');
```

The quiz should open again, with **three** fresh tries, not one.

| | What to do | What should happen |
| --- | --- | --- |
| 6.11 | Pass it this time | A green ring, the score, and **the full review appears**, every question with its explanation |

---

## 7. The certificate

Finish lesson three as well. The moment the last thing is done you should be sent to
`/lms/learn/p4-test-course/complete` on your own.

| | What to do | What should happen |
| --- | --- | --- |
| 7.1 | Look at the page | One short burst of confetti, then it stops. "You did it, <your first name>." |
| 7.2 | Look at the card | **Your real full name**, the course title, the real counts, a real date, and a real certificate number |
| 7.3 | Press **View and download** | The existing certificate page for that number, which already works |
| 7.4 | Open `/verify` and type the number in | It checks out |
| 7.5 | Press **Add to LinkedIn** | LinkedIn's add-a-certification form, already filled in with the course name, Data-Lead Africa, the month and year, and the number |
| 7.6 | Press **Share on WhatsApp** | A WhatsApp message with the certificate link in it |
| 7.7 | Reload the page | The same certificate, the same number. It does **not** issue a second one |
| 7.8 | Go to `/lms/me` | The course says **Certified**, and the certificate is listed |

If your card says "Add your name" in grey italic rather than your name, your account has no full
name on it. That is worth knowing: it means the certificate in the register has the part of your
email before the at sign on it instead.

---

## 8. On a phone

Do at least these four on a real phone, not a shrunken browser window.

| | What to check |
| --- | --- |
| 8.1 | `/lms/learn/p4-test-course` reads properly and nothing runs off the side |
| 8.2 | The player: the gate button is full width, the speed box is easy to tap |
| 8.3 | The quiz: the numbered squares are big enough for a thumb, the answers are easy to tap, Back and Next are stacked and full width |
| 8.4 | The certificate card is readable, and the three share buttons are stacked |

---

## 9. Two tabs

| | What to do | What should happen |
| --- | --- | --- |
| 9.1 | Open the same lesson in two tabs and play both | Neither breaks |
| 9.2 | Watch a minute in each, then check the tape | The percentage has gone up **once**, not twice. The same ten second slice sent from two tabs counts once |

---

## 10. Take it all down

In this order, because of the foreign keys:

```sql
-- the learner's own record first
delete from lms_quiz_attempts a using auth.users u
 where a.user_id = u.id and u.email = 'YOUR_TEST_EMAIL';
delete from lms_lesson_progress p using auth.users u
 where p.user_id = u.id and u.email = 'YOUR_TEST_EMAIL';
delete from lms_watch_buckets b using auth.users u
 where b.user_id = u.id and u.email = 'YOUR_TEST_EMAIL';
delete from lms_watch_days d using auth.users u
 where d.user_id = u.id and u.email = 'YOUR_TEST_EMAIL';

-- the certificate it issued, if you want it gone
delete from certificates c using participants p
 where c.participant_id = p.id and p.email_norm = lower('YOUR_TEST_EMAIL')
   and c.programme_id = (select id from programmes where slug = 'p4-programme');

-- then the course
delete from lms_options o using lms_questions q, lms_quizzes z
 where o.question_id = q.id and q.quiz_id = z.id
   and (z.lesson_id in (select l.id from lms_lessons l
                          join lms_modules m on m.id = l.module_id
                          join lms_courses c on c.id = m.course_id
                         where c.slug = 'p4-test-course')
     or z.module_id in (select m.id from lms_modules m
                          join lms_courses c on c.id = m.course_id
                         where c.slug = 'p4-test-course'));
delete from lms_questions q using lms_quizzes z
 where q.quiz_id = z.id
   and (z.lesson_id in (select l.id from lms_lessons l
                          join lms_modules m on m.id = l.module_id
                          join lms_courses c on c.id = m.course_id
                         where c.slug = 'p4-test-course')
     or z.module_id in (select m.id from lms_modules m
                          join lms_courses c on c.id = m.course_id
                         where c.slug = 'p4-test-course'));
delete from lms_quizzes z
 where z.lesson_id in (select l.id from lms_lessons l
                         join lms_modules m on m.id = l.module_id
                         join lms_courses c on c.id = m.course_id
                        where c.slug = 'p4-test-course')
    or z.module_id in (select m.id from lms_modules m
                         join lms_courses c on c.id = m.course_id
                        where c.slug = 'p4-test-course');
delete from lms_lessons l using lms_modules m, lms_courses c
 where l.module_id = m.id and m.course_id = c.id and c.slug = 'p4-test-course';
delete from lms_modules m using lms_courses c
 where m.course_id = c.id and c.slug = 'p4-test-course';
delete from lms_courses where slug = 'p4-test-course';
delete from programmes where slug = 'p4-programme';
```

**The test account is left alone on purpose.** Deleting an `auth.users` row is the one thing in
here that is hard to undo, and leaving a confirmed test account costs nothing. Delete it from the
Supabase Authentication tab if you want it gone.

---

## What to report back

For anything that does not match, the useful things to send are: which numbered step, what you
saw instead, and whether it was on a phone or a laptop. A screenshot of the whole page beats a
crop, because the thing that explains a bug is usually not the thing that looks wrong.
