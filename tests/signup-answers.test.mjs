// The sign up form's questions, and the rules about which ones are
// asked.
//
//   npm test
//
// WHY THIS TEST EXISTS. The About you form asks about twenty things,
// and most of them are only asked sometimes. A corps member is asked
// for a sector; somebody not working is not. Only a tertiary education
// asks for a qualification. Only Nigeria has a postal code. That is a
// lot of branches, each of which is invisible unless you happen to pick
// the combination that reaches it.
//
// It is checked in two places on purpose, and this file checks both:
//
//   THE PAGE, so the form is pleasant. A question that does not apply
//   is never shown, never sent, and never complained about.
//
//   THE DATABASE, so the data is true. The constraints on
//   lms_learner_profiles say the same things again, because a browser
//   with JavaScript off, a replayed request or a staff screen written
//   in a hurry can all reach the table without going near the page.
//
// The last test reads database/lms/16_restructure.sql and fails if the
// two halves ever stop saying the same thing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  clearHidden,
  AGE_BANDS,
  COUNTRIES,
  GOALS,
  NG_STATES,
  NYSC_BLOCKED_AGES,
  NYSC_QUALIFICATIONS,
  firstProblem,
  nyscOffered,
  sectorLabel,
  shows,
  toMetadata,
} from "../src/pages/Academy/SignUp/answers.js";

/** A complete, valid set of answers to start from. */
const ok = (over = {}) => ({
  full_name: "Ada Nwosu",
  email: "ada@example.com",
  password: "a-good-password",
  country: "Nigeria",
  state: "FCT Abuja",
  city: "Garki",
  postal_code: "900103",
  age_band: "25",
  gender: "Female",
  education_level: "secondary",
  occupation: "none",
  disability: "no",
  heard_from: "WhatsApp",
  goals: ["job"],
  consent: true,
  ...over,
});

// ---------------------------------------------------------------------
// The lists the form offers
// ---------------------------------------------------------------------

test("the country list is every country, with Nigeria first", () => {
  assert.equal(COUNTRIES[0], "Nigeria", "Nigeria is not first");
  assert.ok(COUNTRIES.length >= 190, `only ${COUNTRIES.length} countries`);
  assert.equal(new Set(COUNTRIES).size, COUNTRIES.length, "a country is listed twice");
  // Nigeria first, then the rest in order. Somebody in Abuja should not
  // have to scroll past 150 countries to find their own.
  const rest = COUNTRIES.slice(1);
  assert.deepEqual(rest, [...rest].sort((a, b) => a.localeCompare(b, "en")),
    "the countries after Nigeria are not in order");
  assert.ok(!rest.includes("Nigeria"), "Nigeria is in the list twice");
});

test("the states are the 36 and the Federal Capital Territory", () => {
  assert.equal(NG_STATES.length, 37, `${NG_STATES.length} states, not 37`);
  assert.ok(NG_STATES.includes("FCT Abuja"), "the FCT is missing");
  assert.ok(NG_STATES.includes("Lagos") && NG_STATES.includes("Kano"));
  assert.equal(new Set(NG_STATES).size, 37, "a state is listed twice");
});

test("there is no age restriction: every band can sign up", () => {
  for (const [band] of AGE_BANDS) {
    const bad = firstProblem(ok({ age_band: band }));
    assert.equal(bad, null, `age band "${band}" was refused: ${bad && bad.message}`);
  }
  // Including under 18, which is Big Sam's decision and the one most
  // likely to be "tidied up" by somebody later.
  assert.equal(firstProblem(ok({ age_band: "u18" })), null, "under 18 was refused");
});

// ---------------------------------------------------------------------
// Which questions are asked
// ---------------------------------------------------------------------

test("a state for Nigeria, a typed region for anywhere else", () => {
  assert.equal(shows("state", { country: "Nigeria" }), true);
  assert.equal(shows("region", { country: "Nigeria" }), false);
  assert.equal(shows("state", { country: "Ghana" }), false);
  assert.equal(shows("region", { country: "Ghana" }), true);
  // Before a country is chosen, neither is asked.
  assert.equal(shows("region", {}), false);
});

test("a postal code is asked for Nigeria and nowhere else", () => {
  assert.equal(shows("postal_code", { country: "Nigeria" }), true);
  for (const c of ["Ghana", "Kenya", "United Kingdom", "Benin"]) {
    assert.equal(shows("postal_code", { country: c }), false, `${c} was asked for a postal code`);
  }
});

test("only a tertiary education is asked what, and in what", () => {
  for (const level of ["none", "primary", "secondary", "vocational"]) {
    assert.equal(shows("qualification", { education_level: level }), false, level);
    assert.equal(shows("course_of_study", { education_level: level }), false, level);
  }
  assert.equal(shows("qualification", { education_level: "tertiary" }), true);
  assert.equal(shows("course_of_study", { education_level: "tertiary" }), true);
});

test("only vocational training is asked what they trained in", () => {
  assert.equal(shows("trade", { education_level: "vocational" }), true);
  for (const level of ["none", "primary", "secondary", "tertiary"]) {
    assert.equal(shows("trade", { education_level: level }), false, level);
  }
});

test("each work answer asks for its own things and no others", () => {
  const asks = (occupation) =>
    ["job_title", "business", "study_level", "school", "sector"]
      .filter((f) => shows(f, { occupation }));

  assert.deepEqual(asks("employed"), ["job_title", "sector"]);
  assert.deepEqual(asks("self"), ["business", "sector"]);
  assert.deepEqual(asks("student"), ["study_level", "school"]);
  assert.deepEqual(asks("nysc"), ["sector"]);
  assert.deepEqual(asks("seeking"), ["sector"]);
  // Not working right now is asked nothing more at all.
  assert.deepEqual(asks("none"), []);
});

test("the sector question is worded for the answer above it", () => {
  assert.equal(sectorLabel("employed"), "Sector you work in");
  assert.equal(sectorLabel("self"), "Sector your business is in");
  assert.equal(sectorLabel("nysc"), "Sector of your place of primary assignment");
  assert.equal(sectorLabel("seeking"), "Sector you want to work in");
});

test("the disability detail is asked only when the answer was yes", () => {
  assert.equal(shows("disability_detail", { disability: "yes" }), true);
  assert.equal(shows("disability_detail", { disability: "no" }), false);
  assert.equal(shows("disability_detail", { disability: "pn" }), false);
});

// ---------------------------------------------------------------------
// NYSC, which depends on three answers at once
// ---------------------------------------------------------------------

test("NYSC is offered only in Nigeria, and only under 35", () => {
  assert.equal(nyscOffered({ country: "Nigeria", age_band: "18" }), true);
  assert.equal(nyscOffered({ country: "Nigeria", age_band: "25" }), true);
  assert.equal(nyscOffered({ country: "Ghana", age_band: "25" }), false);
  for (const band of NYSC_BLOCKED_AGES) {
    assert.equal(nyscOffered({ country: "Nigeria", age_band: band }), false,
      `NYSC was offered to the "${band}" band`);
  }
});

test("NYSC needs an HND or a degree, and says so in those words", () => {
  const base = { country: "Nigeria", age_band: "18", occupation: "nysc",
                 education_level: "tertiary", course_of_study: "Statistics", sector: "Health" };
  for (const q of NYSC_QUALIFICATIONS) {
    assert.equal(firstProblem(ok({ ...base, qualification: q })), null,
      `NYSC was refused with "${q}"`);
  }
  for (const q of ["ond", "nce"]) {
    const bad = firstProblem(ok({ ...base, qualification: q }));
    assert.ok(bad, `NYSC was allowed with only "${q}"`);
    assert.equal(bad.message, "NYSC is for HND and degree holders. Check your education answers.");
  }
});

test("NYSC outside Nigeria is refused", () => {
  const bad = firstProblem(ok({
    country: "Ghana", state: undefined, postal_code: undefined, region: "Greater Accra",
    age_band: "18", occupation: "nysc", education_level: "tertiary",
    qualification: "bsc", course_of_study: "Statistics", sector: "Health",
  }));
  assert.ok(bad, "NYSC was allowed for Ghana");
  assert.equal(bad.field, "occupation");
});

// ---------------------------------------------------------------------
// What the form complains about, one thing at a time
// ---------------------------------------------------------------------

test("a complete set of answers has nothing wrong with it", () => {
  assert.equal(firstProblem(ok()), null);
});

test("a postal code has to be six digits, and only Nigeria has one", () => {
  assert.equal(firstProblem(ok({ postal_code: "90010" }))?.field, "postal_code");
  assert.equal(firstProblem(ok({ postal_code: "9001034" }))?.field, "postal_code");
  assert.equal(firstProblem(ok({ postal_code: "abcdef" }))?.field, "postal_code");
  // Ghana is never asked, so a missing one is not a problem.
  assert.equal(firstProblem(ok({
    country: "Ghana", state: undefined, postal_code: undefined, region: "Greater Accra",
  })), null);
});

test("only one thing is reported at a time", () => {
  // Three things wrong. The person should hear about the first of them
  // and not be shown a wall of red.
  const bad = firstProblem(ok({ password: "short", city: "", goals: [] }));
  assert.ok(bad);
  assert.equal(bad.field, "password", "the first problem in the form's own order is not the one reported");
});

test("goals: one or two, never none and never three", () => {
  assert.equal(firstProblem(ok({ goals: [] }))?.field, "goals");
  assert.equal(firstProblem(ok({ goals: ["job", "work", "biz"] }))?.field, "goals");
  assert.equal(firstProblem(ok({ goals: ["job"] })), null);
  assert.equal(firstProblem(ok({ goals: ["job", "biz"] })), null);
});

test("a question that is not asked is never complained about", () => {
  // Not working right now, so no job title, no business, no sector.
  // None of those should hold the form up.
  assert.equal(firstProblem(ok({ occupation: "none" })), null);
  // No formal education, so no qualification and no trade.
  assert.equal(firstProblem(ok({ education_level: "none" })), null);
});

test("the terms have to be agreed", () => {
  assert.equal(firstProblem(ok({ consent: false }))?.field, "consent");
});

// ---------------------------------------------------------------------
// What is sent
// ---------------------------------------------------------------------

test("a question that was not asked is not sent at all", () => {
  const m = toMetadata(ok({ country: "Ghana", state: "Lagos", postal_code: "900103", region: "Greater Accra" }));
  // state and postal_code were not asked for Ghana, so even though they
  // are sitting in the answers they must not travel. The database
  // stores null for those, and "" would fail a check constraint that is
  // doing exactly its job.
  assert.ok(!("state" in m), "a state was sent for a country that has none");
  assert.ok(!("postal_code" in m), "a postal code was sent for Ghana");
  assert.equal(m.region, "Greater Accra");
});

test("nothing empty is ever sent", () => {
  const m = toMetadata(ok({ heard_from: "" }));
  for (const [k, v] of Object.entries(m)) {
    assert.ok(v !== "" && v !== null, `${k} was sent as empty`);
  }
});

test("the consent time is recorded", () => {
  const m = toMetadata(ok());
  assert.ok(m.consented_at, "no consent time");
  assert.ok(!Number.isNaN(Date.parse(m.consented_at)), "the consent time is not a date");
});

test("a password is never sent as one of the answers", () => {
  const m = toMetadata(ok());
  for (const k of ["password", "email", "full_name", "consent"]) {
    assert.ok(!(k in m), `${k} was put in with the About you answers`);
  }
});

// ---------------------------------------------------------------------
// The database says the same thing
// ---------------------------------------------------------------------

test("every rule here has a matching constraint in file 16", () => {
  // The page and the database are two separate statements of the same
  // rules, and the one way they go wrong is quietly, one at a time, as
  // somebody edits one of them. This reads the SQL and checks each rule
  // is still said there too.
  const sql = readFileSync(new URL("../database/lms/16_restructure.sql", import.meta.url), "utf8");

  const needed = [
    ["lp_state_ck", "a state only for Nigeria, a region only for elsewhere"],
    ["lp_post_ck", "a six digit postal code, Nigeria only"],
    ["lp_tert_ck", "a qualification and a course of study only for tertiary"],
    ["lp_voc_ck", "a trade only for vocational"],
    ["lp_job_ck", "a job title only when employed"],
    ["lp_biz_ck", "a business only when self employed"],
    ["lp_stud_ck", "a study level and school only for a student"],
    ["lp_sector_ck", "a sector for the four answers that have one"],
    ["lp_nysc_ck", "NYSC: Nigeria, under 35, HND or a degree"],
    ["lp_disd_ck", "the disability detail only when the answer was yes"],
    ["lp_goals_ck", "one or two goals"],
  ];
  for (const [name, what] of needed) {
    assert.ok(sql.includes(name),
      `database/lms/16_restructure.sql has no constraint "${name}", which is the database's half of: ${what}`);
  }

  // The two lists of allowed values have to match, or the form offers
  // something the table will refuse.
  for (const [band] of AGE_BANDS) {
    assert.ok(sql.includes(`'${band}'`), `the database does not allow the age band "${band}"`);
  }
  for (const [goal] of GOALS) {
    assert.ok(sql.includes(`'${goal}'`), `the database does not allow the goal "${goal}"`);
  }
  for (const q of NYSC_QUALIFICATIONS) {
    assert.ok(sql.includes(`'${q}'`), `the database does not allow the qualification "${q}"`);
  }

  // The empty array trap. array_length of an empty array is null, and a
  // check constraint passes on null, so without the coalesce an answer
  // of no goals at all was accepted by the database while the form
  // refused it.
  assert.ok(sql.includes("coalesce(array_length(goals, 1), 0)"),
    "the goals constraint is back to bare array_length, which lets an empty list through");
});

// ---------------------------------------------------------------------
// The lists live in two places, so one test compares them
//
// Dr Ayoola's review item 6: country and state were free text, and he
// stored a country called "<script>alert(1)</script>". They now point
// at two seeded tables. A list that is typed out twice always drifts,
// and the drift is only ever noticed by a report with two spellings of
// Nigeria in it, so this test reads the seed straight out of file 16
// and compares it, name by name and in order, with the list this form
// offers.
// ---------------------------------------------------------------------

const file16 = () =>
  readFileSync(new URL("../database/lms/16_restructure.sql", import.meta.url), "utf8");

/** Pull the values out of one "insert into X ... values (...) ..." block. */
function seeded(sql, table) {
  const start = sql.indexOf(`insert into ${table} (`);
  assert.ok(start > -1, `file 16 does not seed ${table}`);
  const from = sql.indexOf("values\n", start) + "values\n".length;
  const to = sql.indexOf("\non conflict", from);
  assert.ok(to > from, `the ${table} seed has no "on conflict" line to end it`);
  // ('Nigeria',1), ('Côte d''Ivoire',46)  ->  Nigeria, Côte d'Ivoire
  return [...sql.slice(from, to).matchAll(/\('((?:[^']|'')*)'/g)]
    .map((m) => m[1].replace(/''/g, "'"));
}

test("the country table is the form's list, in the form's order", () => {
  const names = seeded(file16(), "lms_countries");
  assert.deepEqual(names, COUNTRIES,
    "database/lms/16_restructure.sql and src/pages/Academy/SignUp/answers.js no longer offer the same countries. Whichever one was edited, edit the other.");
  // Nigeria first is the whole reason position is stored rather than
  // worked out by sorting.
  assert.equal(names[0], "Nigeria");
});

test("the state table is the 37 the form offers", () => {
  assert.deepEqual(seeded(file16(), "lms_ng_states"), NG_STATES,
    "the 37 states in file 16 and in answers.js have drifted apart");
});

test("an apostrophe survives the trip into the seed", () => {
  // Côte d'Ivoire is the one name on the list with an apostrophe in it,
  // and an apostrophe is how a seeded list turns into a syntax error.
  const sql = file16();
  assert.ok(sql.includes("Côte d''Ivoire"),
    "Côte d'Ivoire is not escaped in the country seed, so file 16 will not parse");
  assert.ok(seeded(sql, "lms_countries").includes("Côte d'Ivoire"));
});

// ---------------------------------------------------------------------
// Refused means store nothing, and nothing includes the token
// ---------------------------------------------------------------------

test("a refused sign up is stripped from the token on both paths", () => {
  const sql = file16();
  const i = sql.indexOf("create or replace function lms_apply_signup_answers");
  const fn = sql.slice(i, sql.indexOf("\nend $$;", i));

  // Review item 2. The first version returned before the strip when the
  // insert was refused, so the answers that broke a rule, including
  // disability_detail, stayed in user_metadata and rode inside every
  // access token for the life of the account.
  const strips = [...fn.matchAll(/perform lms_strip_signup_metadata\(p_user\);/g)];
  assert.ok(strips.length >= 2,
    `lms_apply_signup_answers strips the token in ${strips.length} place(s). It needs to do it when the answers are stored AND when they are refused.`);
  const refused = fn.indexOf("if not v_ok then");
  assert.ok(refused > -1, "there is no refusal branch at all");
  assert.ok(fn.indexOf("perform lms_strip_signup_metadata(p_user);", refused) > -1,
    "the refusal branch does not strip the token");

  // Review item 3. detail is jsonb, so text failed on the way in, and a
  // blanket catch threw that failure away. The refusal then existed
  // nowhere at all.
  assert.ok(/jsonb_build_object\('reason'/.test(fn),
    "the refusal is still being written to a jsonb column as text");
  assert.ok(!/exception when others then null/.test(fn),
    "a blanket catch is hiding the failure to record a refusal");
});

test("an account that is born confirmed is processed too", () => {
  const sql = file16();
  // Review item 4. The old trigger was "after update of
  // email_confirmed_at" only, so an account created with it already set
  // kept its answers for ever and never got a profile row.
  assert.ok(sql.includes("create trigger lms_users_created_confirmed"),
    "nothing fires when an account is created already confirmed");
  assert.ok(/after insert on auth\.users/.test(sql),
    "the new trigger is not on insert");
  assert.ok(sql.includes("if tg_op = 'INSERT' then"),
    "lms_on_email_confirmed does not tell an insert from an update");
  assert.ok(sql.includes("swept % already confirmed account(s)"),
    "there is no one off sweep for accounts confirmed before file 16 ran");
});

test("abandoned sign ups go, and the free courses do not save them", () => {
  const sql = file16();
  // Review item 5, which is brief item 11.
  assert.ok(sql.includes("create or replace function lms_prune_unconfirmed_signups"),
    "unconfirmed sign ups are never deleted");

  // THE TRAP. lms_handle_new_user grants the free courses to every
  // single sign up, so a plain "has no entitlement" test matches
  // nobody, and this would have run every night for ever and deleted
  // nothing, with no error anywhere to say so.
  assert.ok(sql.includes("e.source <> 'free'"),
    "the prune refuses to delete any account that holds a free course, which is every account there has ever been");

  const i = sql.indexOf("create or replace function lms_prune_unconfirmed_signups");
  const fn = sql.slice(i, sql.indexOf("\nend $$;", i));
  for (const [what, needle] of [
    ["an entitlement somebody gave it", "lms_entitlements"],
    ["a quiz or exam attempt", "lms_quiz_attempts"],
    ["lesson progress", "lms_lesson_progress"],
    ["a watch slice", "lms_watch_buckets"],
    ["About you answers", "lms_learner_profiles"],
    ["a certificate", "certificates"],
    ["a profile row somebody has edited", "pr.full_name <> ''"],
  ]) {
    assert.ok(fn.includes(needle),
      `the prune does not check for ${what}, so an account with one could be deleted`);
  }
  assert.ok(fn.includes("email_confirmed_at is null"), "it does not check the email was never confirmed");
  assert.ok(fn.includes("make_interval(hours => p_hours)"), "it does not check the age");
  assert.ok(fn.includes("lms_admin_actions"), "the count is not written down");
});

test("nothing is callable that only the database should call", () => {
  const sql = file16();
  // Review item 7.
  for (const fn of [
    "lms_on_email_confirmed()",
    "lms_sync_course_area()",
    "lms_strip_signup_metadata(uuid)",
    "lms_prune_unconfirmed_signups(integer)",
  ]) {
    assert.ok(sql.includes(`revoke all on function ${fn} from public, anon, authenticated`),
      `execute on ${fn} is not revoked, and nothing a browser cannot use should be callable from one`);
  }
});

test("only staff read the question bank, and the check page still works", () => {
  const sql = file16();
  // Review item 1, the serious one: p_q_public let any signed in
  // learner read all 30 exam questions AND their explanations, for a
  // course they did not hold.
  assert.ok(sql.includes("drop policy if exists p_q_public on lms_questions"),
    "the file 06 policy that opens the whole question bank is still in place");
  assert.ok(sql.includes("create policy p_q_staff_only on lms_questions"),
    "there is no staff only policy to replace it");

  // And the other half: the live check page reads lms_quizzes directly
  // by lesson_id, so shutting the table completely would have broken
  // every lesson check on the site.
  const i = sql.indexOf("create policy p_quiz_learner_checks on lms_quizzes");
  assert.ok(i > -1, "the check page has no policy to find its quiz row through");
  const policy = sql.slice(i, sql.indexOf(";", i));
  assert.ok(policy.includes("lesson_id is not null"), "the policy lets a learner see exam rows");
  assert.ok(policy.includes("lms_lesson_is_open(lesson_id)"),
    "the policy does not check the learner can actually open that lesson");
});

// ---------------------------------------------------------------------
// An answer that stops applying stops existing
//
// This is the half of the skip logic that is invisible on the page.
// shows() decides which questions are DRAWN; clearHidden decides what
// happens to an answer that was already given to a question that has
// just gone away. Without it, a question nobody can see any more is
// still being sent, and the database refuses the whole row for it.
// ---------------------------------------------------------------------

test("changing country takes the postal code and the state with it", () => {
  const ng = {
    full_name: "Ada Nwosu", email: "ada@example.com", password: "a-good-password",
    country: "Nigeria", state: "Lagos", postal_code: "100001", city: "Ikeja",
    age_band: "25", gender: "Female", education_level: "secondary",
    occupation: "none", disability: "no", heard_from: "A friend", goals: ["job"],
  };
  const gh = clearHidden({ ...ng, country: "Ghana" });

  assert.equal(gh.postal_code, undefined, "a Nigerian postal code travelled to Ghana");
  assert.equal(gh.state, undefined, "a Nigerian state travelled to Ghana");
  assert.equal(gh.city, "Ikeja", "the city was thrown away, and every country has one");
  assert.equal(firstProblem(gh)?.field, "region", "Ghana should now be asked for a region");
});

test("changing education takes the qualification and the course of study", () => {
  const uni = {
    full_name: "Ada Nwosu", email: "ada@example.com", password: "a-good-password",
    country: "Nigeria", state: "Lagos", postal_code: "100001", city: "Ikeja",
    age_band: "25", gender: "Female",
    education_level: "tertiary", qualification: "bsc", course_of_study: "Statistics",
    occupation: "none", disability: "no", heard_from: "A friend", goals: ["job"],
  };
  const school = clearHidden({ ...uni, education_level: "secondary" });
  assert.equal(school.qualification, undefined);
  assert.equal(school.course_of_study, undefined);
  assert.equal(firstProblem({ ...school, consent: true }), null,
    "a secondary education is a complete answer");

  // And the other branch: vocational asks what they trained in, and
  // changing to it must not keep the degree.
  const trade = clearHidden({ ...uni, education_level: "vocational", trade: "Welding" });
  assert.equal(trade.qualification, undefined);
  assert.equal(trade.course_of_study, undefined);
  assert.equal(trade.trade, "Welding");
});

test("answering No to the disability question takes the detail away", () => {
  // THE ONE THAT MATTERS. Somebody writes something in the box, thinks
  // better of it, and changes the answer to No. What they wrote must
  // not be sent, must not reach the table, and must not sit in a token.
  const yes = {
    full_name: "Ada Nwosu", email: "ada@example.com", password: "a-good-password",
    country: "Nigeria", state: "Lagos", postal_code: "100001", city: "Ikeja",
    age_band: "25", gender: "Female", education_level: "secondary",
    occupation: "none", disability: "yes", disability_detail: "Deaf",
    heard_from: "A friend", goals: ["job"],
  };
  for (const answer of ["no", "pn"]) {
    const after = clearHidden({ ...yes, disability: answer });
    assert.equal(after.disability_detail, undefined,
      `a disability detail survived an answer of "${answer}"`);
    assert.ok(
      !JSON.stringify(toMetadata(after)).includes("Deaf"),
      `"Deaf" was still in what would be sent after answering "${answer}"`,
    );
  }
});

test("changing job takes the answers that job was asked for", () => {
  const base = {
    full_name: "Ada Nwosu", email: "ada@example.com", password: "a-good-password",
    country: "Nigeria", state: "Lagos", postal_code: "100001", city: "Ikeja",
    age_band: "25", gender: "Female", education_level: "secondary",
    disability: "no", heard_from: "A friend", goals: ["job"],
  };
  const employed = clearHidden({ ...base, occupation: "employed", job_title: "Analyst", sector: "Health" });
  assert.equal(employed.job_title, "Analyst");

  const none = clearHidden({ ...employed, occupation: "none" });
  assert.equal(none.job_title, undefined, "a job title survived not working");
  assert.equal(none.sector, undefined, "a sector survived not working");

  const student = clearHidden({ ...employed, occupation: "student", study_level: "A degree", school: "UNILAG" });
  assert.equal(student.job_title, undefined);
  assert.equal(student.sector, undefined, "a student is not asked for a sector");
  assert.equal(student.school, "UNILAG");
});

test("NYSC goes away when the country or the age makes it impossible", () => {
  // The option is not offered to somebody outside Nigeria or in a
  // blocked age band. If it was already chosen and then one of those
  // changes, the answer has to go too: the page would not show it and
  // the database would refuse it.
  const corps = {
    full_name: "Ada Nwosu", email: "ada@example.com", password: "a-good-password",
    country: "Nigeria", state: "Lagos", postal_code: "100001", city: "Ikeja",
    age_band: "25", gender: "Female", education_level: "tertiary",
    qualification: "bsc", course_of_study: "Statistics",
    occupation: "nysc", sector: "Health",
    disability: "no", heard_from: "A friend", goals: ["job"],
  };
  assert.equal(nyscOffered(corps), true, "the test case is not actually a corps member");

  const abroad = clearHidden({ ...corps, country: "Ghana" });
  assert.equal(abroad.occupation, undefined, "a corps member moved to Ghana and stayed a corps member");
  assert.equal(abroad.sector, undefined);

  const older = clearHidden({ ...corps, age_band: "45" });
  assert.equal(older.occupation, undefined, "NYSC survived an age band it is not offered to");
});

test("clearing is safe to run when nothing has changed", () => {
  // The page runs it on every keystroke, so it has to be idempotent and
  // it has to leave a complete answer alone.
  const full = {
    full_name: "Ada Nwosu", email: "ada@example.com", password: "a long enough one",
    country: "Nigeria", state: "FCT Abuja", postal_code: "900103", city: "Garki",
    age_band: "25", gender: "Female", education_level: "tertiary",
    qualification: "bsc", course_of_study: "Statistics",
    occupation: "nysc", sector: "Health",
    disability: "no", heard_from: "WhatsApp", goals: ["job", "research"], consent: true,
  };
  assert.equal(firstProblem(full), null, "the complete answer is not actually complete");
  assert.deepEqual(clearHidden(full), full);
  assert.deepEqual(clearHidden(clearHidden(full)), full);
});

// ---------------------------------------------------------------------
// What leaves the browser
// ---------------------------------------------------------------------

test("the answers travel in the sign up call and nowhere else", () => {
  const lib = readFileSync(new URL("../src/lib/academy.ts", import.meta.url), "utf8");

  // options.data is the one route: Supabase puts it in user_metadata,
  // where it waits for the email to be confirmed and is then taken out
  // again by the trigger in file 16.
  assert.ok(
    /options:\s*\{\s*data:\s*\{\s*full_name:\s*name,\s*\.\.\.\(about \|\| \{\}\)\s*\}\s*\}/.test(lib),
    "signUp no longer passes the About you answers through options.data",
  );

  // AND NOWHERE ELSE. A half filled form in a browser's storage on a
  // shared machine, with the disability answer in it, is exactly what
  // the Nigeria Data Protection Act is about.
  const page = readFileSync(new URL("../src/pages/Academy/SignUp/page.tsx", import.meta.url), "utf8");
  const about = readFileSync(new URL("../src/pages/Academy/SignUp/AboutYou.tsx", import.meta.url), "utf8");
  // Comments stripped first: the note in the page explains WHY the
  // answers are not put in localStorage, and names it to do so.
  const code = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const [name, src] of [["the page", page], ["AboutYou", about]]) {
    assert.ok(!/localStorage|sessionStorage|indexedDB/.test(code(src)),
      `${name} puts the sign up answers into browser storage`);
  }
});

test("a fresh token is asked for the moment the code is verified", () => {
  // Verifying signs the person in, and the token GoTrue hands back was
  // built from the user record it loaded BEFORE the confirm trigger
  // ran. So it still carries every About you answer, including the
  // disability one, for up to an hour, in storage and in the header of
  // every request.
  const lib = readFileSync(new URL("../src/lib/academy.ts", import.meta.url), "utf8");
  const i = lib.indexOf("export async function confirmSignUp");
  const fn = lib.slice(i, lib.indexOf("export async function resendSignUpCode"));

  assert.ok(/auth\.refreshSession\(\)/.test(fn),
    "confirmSignUp does not ask for a new token, so the first one keeps the answers for up to an hour");
  // After the code is accepted, not before: refreshing a session that
  // does not exist yet does nothing.
  assert.ok(
    fn.indexOf("CODE_REFUSED") < fn.indexOf("refreshSession"),
    "the refresh happens before the code is known to be good",
  );
  // And it cannot fail the confirm.
  assert.ok(/try \{[\s\S]*refreshSession[\s\S]*\} catch/.test(fn),
    "a failed refresh would tell somebody their email did not confirm when it did");
});
