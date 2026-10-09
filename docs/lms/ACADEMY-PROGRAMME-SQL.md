# Creating a programme for an Academy course

You chose one programme per Academy course, so each certificate names the course rather than a
bootcamp. The Phase 6 control room will do this from a page. Until then, here is the SQL, for the
Phase 5 test course.

## Why a course needs one

A certificate is issued **through a programme**. The programme supplies the title that appears on
the certificate, and its `code` is used in the certificate number. File 13 refuses to publish a
course that has no programme, because otherwise a learner finishes and finds there is nothing to
give them.

## The statement

Two steps. Make the programme, then point the course at it.

```sql
-- 1. The programme. One per Academy course.
insert into programmes (slug, title, code, active, template_key)
values (
  'academy-stata',            -- slug: must be unique, lowercase, with hyphens
  'STATA Essentials',         -- title: THIS IS WHAT THE CERTIFICATE SAYS
  'STA',                      -- code: goes into the certificate number
  true,
  'default'                   -- which certificate artwork to use
)
returning id, slug, title, code;
```

Copy the `id` it returns, then:

```sql
-- 2. Point the course at it.
update lms_courses
   set programme_id = 'PASTE-THE-ID-HERE'
 where slug = 'stata-essentials';   -- your course's slug
```

Check it took:

```sql
select c.slug as course, p.title as programme, p.code
  from lms_courses c join programmes p on p.id = c.programme_id
 where c.slug = 'stata-essentials';
```

And confirm the course can now be published:

```sql
select * from lms_course_blockers(
  (select id from lms_courses where slug = 'stata-essentials'));
```

Every row should say `ok`.

## Choosing the three values

**`title` is the one that matters most.** It is printed on the certificate and shown on the public
`/verify` page, so write it as you want somebody's employer to read it. "STATA Essentials" rather
than "stata course" or "Academy STATA v2".

**`code` goes into the certificate number**, so keep it short and obvious: two to four capital
letters. Your existing four programmes use codes of this shape. Pick something nobody will confuse
with another: `STA` for STATA, `SQL` for SQL, `PBI` for Power BI.

**`slug` is only ever used by us**, never shown. Keep it lowercase with hyphens, and starting them
all with `academy-` makes it obvious at a glance which programmes are Academy courses and which are
bootcamps.

## Two things to be careful of

**`slug` must be unique.** If you try to reuse one the statement fails, which is the right thing to
happen: two programmes with one slug would be impossible to tell apart later.

**Do not reuse one of the four bootcamp programmes.** They are `data-analytics`,
`digital-marketing-web-design`, `giz-employability` and `giz-remote-work`. Pointing an Academy
course at one of those would make a STATA learner's certificate say "Data Analytics Bootcamp", which
is not what they did.

## Undoing it

If you make a programme by mistake and nothing has been issued against it:

```sql
delete from programmes where slug = 'academy-stata';
```

That fails if any certificate or enrolment points at it, which is a protection rather than a
problem. A programme somebody holds a certificate from should never disappear, because the `/verify`
page reads the title from it.
