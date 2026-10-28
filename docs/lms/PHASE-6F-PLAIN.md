# Phase 6F, in plain words

One file, and it closes a hole that was measured rather than feared.

| File | What it is | State |
|---|---|---|
| **26** | A facilitator could edit courses that were not theirs. | This package |

## What was wrong

The rule about who may change a course lives in the functions. The table policies went around it.

```
lms_can_edit()        asks only "are you staff".
lms_may_edit_course() asks "are you an administrator, or the facilitator who made this course".
```

Six tables carried a write policy using the first. Eight more carried one using `lms_is_staff()`,
which is the same question by another name. So any facilitator could write any course's rows
directly, whatever the functions would have said.

**It was demonstrated, not theorised.** On a database built from files 01 to 24, as a facilitator who
owned no course at all, through row level security:

- the title of a lesson in somebody else's **live** course was changed;
- a bare delete across the chapters record removed **every chapter of every course**, live ones
  included;
- the answer key of another course's exam was readable, `is_correct` and all.

Some guards did hold. A live course's summary and a live exam's answers were refused. But a draft
course belonging to someone else had no such guard, and nor did the chapters.

**Learners were never the problem.** A learner reads 0 questions and 0 options, and so does a
visitor, before this file and after it. This was a staff to staff hole.

## Why taking the write away is safe

The lesson of file 21 is that a sweep built on a guess breaks the site twice over, so none of this
was assumed.

**Nothing in the browser writes these tables.** Every `.from("...")` in the source was read along
with the method chained onto it, rather than matched against one grep pattern. Nine direct writes
exist in the whole site and all nine are to `posts`, `post_events` and the blog's own `profiles`.
There is no `.from()` with a computed name anywhere, and no raw fetch at the REST surface, so there
is no path that a scan of literal names could have missed.

**Every function that writes them runs as its owner.** Thirty two functions write these fourteen
tables and all thirty two are security definer, so none of them notices this file. A security invoker
one would have broken. There are none.

**The six tables the site reads directly** are `lms_path_courses`, `lms_paths`, `lms_popups`,
`lms_profiles`, `lms_quizzes` and `lms_settings`. Their reads are untouched.

## The trap this file had to avoid

Two of the dropped policies were `ALL` policies, and an `ALL` policy is also a read. Neither
`lms_options` nor `lms_popups` had a SELECT policy of its own, so dropping the write without putting
a read back would have taken the questions screen and the popups screen down for everybody,
administrators included. Both are put back, and the answer key comes back narrower than it was.

Every other table in the list has a SELECT policy that names `lms_is_staff()` itself, so staff keep
their reads without anything being done.

## What was found when the allow list was questioned

The first version of this file fixed fourteen tables and listed eight more as "administrator only,
a separate question". Asked why, two of those eight turned out not to be a separate question at all.

**`lms_learner_profiles` was a data protection hole.** The rule is that only an administrator reads
`disability_detail`, **one learner at a time** through `lms_learner_record`, and that **every read is
logged** in `lms_admin_actions`. Measured: an administrator read every row at once, directly,
`disability_detail` included, with nothing logged. The first clause held and the other two did not.
Under the Nigeria Data Protection Act 2023 those two are the clauses that matter.

That record now has no policy at all and no grant to anybody signed in. `lms_learner_record` and
`lms_my_profile` are security definer and read it as the owner, so the logged route is not merely the
sensible way in, it is the only one. Nothing else reads it as the person asking: no policy references
it, no security invoker function reads it, and no view is built on it, all three checked rather than
assumed.

**`lms_entitlements` contradicted a rule we set.** Writes to entitlements are server side only, and
an administrator could grant a learner course access directly from the browser.

The other four, `lms_facilitators`, `lms_path_courses`, `lms_paths` and `lms_settings`, are the same
shape and lower stakes: writing them directly skips the function that records who did it. All six are
closed, and fifteen functions write them, all fifteen security definer.

## What is still deliberately left alone

`lms_profiles` keeps its self write, which is limited by column grants, and a learner still cannot
set `email_verified_at`. `lms_popup_seen` keeps its own row insert, which is harmless. Those two are
the whole allow list now, and the verify prints both with their reason every run.

## What each check in 26_verify_EDITOR.sql means

Rows 1 to 3 are the hole. Row 8 is the one that will still be working in a year.

| # | What it checks | What a NO means |
|---|---|---|
| 1 | A facilitator cannot write a course that is not theirs | **The hole.** The policies asked only whether you were staff, where the functions ask whether the course is yours. A NO means any facilitator can still write any course's rows directly. |
| 2 | And the privileges behind those policies are gone too | Both halves matter, as they did in file 23. A policy dropped while the privilege stands is one re-granted policy short of being back, and a privilege revoked while the policy stands is the same in reverse. `PUBLIC` is asked about as well as the two role names, because a grant to `PUBLIC` is held by every role at once. |
| 3 | A bare delete cannot empty a shared record | Asked on its own because it did the most damage in a single statement: every chapter of every course, live ones included, removed by somebody who owned none of them. |
| 4 | The answer key is readable only for courses a person may edit | A facilitator could read `is_correct` for every exam in the Academy. Both the questions and the answers are asked about, because narrowing one and not the other leaves the half that matters. |
| 5 | And the rule it asks is reachable by the people the policy applies to | **The file 21 lesson in a new shape.** A helper used inside a policy is run by whoever is querying, so taking execute off `authenticated` turns an ordinary staff read into "permission denied". A NO means either the control room cannot read its own questions, or a visitor can run the rule. |
| 6 | The two reads that rode on a write policy are back | The trap above. A NO means the questions screen or the popups screen is down for everybody, administrators included. |
| 7 | A learner and a visitor are exactly where they were | Learners were never the problem and this file must not make them one. A NO means a policy here has been widened to everybody, which would hand the answers to the people sitting the exam. |
| 8 | No lms record lets a signed in person write it directly | **The row that keeps working.** It asks the general question, so a record added later with the default grants **and** a policy permitting a write is caught without anybody adding a row here. It asks for both together, because a grant with no policy is refused by row level security anyway and a policy with no grant is refused by the privilege, and reporting either alone would cry wolf until nobody read the row. The allow list, with a reason for each entry, prints underneath every run. |
| 9 | The sensitive learner record has only the logged way in | **The row with legal weight.** It asks all three parts at once: no grant to anybody signed in, no policy of any kind, and `lms_learner_record` still writing the log. A NO means `disability_detail` can be read in bulk by a route that leaves no trace of who looked. |

## Two other things in this package

**A learner marking their own lessons done was already fixed.** That was file 23, which is already
live. The hand fix on live also revoked from `public` where file 23 revoked only from `anon` and
`authenticated`. On a database built the way ours is, `public` holds nothing on that record, so the
two are equivalent. Row 2 above now asks about all three anyway.

**A test that failed for the wrong reason.** `file_19_tests` check 9h asked whether the backfill mark
was less than an hour old, which is only the same question as "was it moved" on a database built in
the last hour. It failed on one built two and a half hours earlier, with and without any change. It
now captures the mark before the section and compares the two.
