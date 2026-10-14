// The course exam page: what each state shows, and what a result is
// never allowed to contain.
//
//   npm test
//
// WHY THIS TEST EXISTS. The exam is the one place on the site where
// getting it wrong costs a learner something they cannot get back. Two
// tries, then a day shut. So the page has to be right about which state
// it is in, and the result has to be right about what it gives away.
//
// The second half is the important one. A result that leaked an option
// id would turn the second try into a corrected answer sheet, and it
// would do it silently: the page would look exactly the same, because
// the page does not show the ids it was sent.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { answerPayload, countdown, examView } from "../src/pages/Academy/Learn/Exam/state.js";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const base = {
  exam_id: "e1", tries_allowed: 2, tries_used: 0, tries_left: 2,
  lessons_done: 12, lessons_total: 12,
  pass_mark: 70, question_count: 20, minutes: 40,
};

// ---------------------------------------------------------------------
// The five states
// ---------------------------------------------------------------------

test("not open: the button says what opens it, and is disabled", () => {
  const v = examView({ ...base, state: "not_open", lessons_done: 9, lessons_total: 12 }, NOW);
  assert.equal(v.button.disabled, true);
  assert.match(v.button.label, /Opens after lesson 12/);
  assert.equal(v.canStart, false);
  assert.match(v.note, /3 lessons left/);
});

test("not open with one lesson left says lesson, not lessons", () => {
  const v = examView({ ...base, state: "not_open", lessons_done: 11, lessons_total: 12 }, NOW);
  assert.match(v.note, /One lesson left/);
});

test("open: try 1 of 2, with the numbers that matter", () => {
  const v = examView({ ...base, state: "open" }, NOW);
  assert.equal(v.button.label, "Start the exam");
  assert.equal(v.button.disabled, false);
  assert.equal(v.canStart, true);
  assert.match(v.note, /Try 1 of 2/);
  assert.match(v.note, /20 questions, 40 minutes, 70 percent to pass/);
});

test("the last try is named as the last try", () => {
  // Nobody should spend their second try thinking there is a third.
  const v = examView({ ...base, state: "open", tries_used: 1, tries_left: 1 }, NOW);
  assert.equal(v.button.label, "Start my last try");
  assert.match(v.note, /Try 2 of 2/);
});

test("in progress: carry on, with the time left", () => {
  const v = examView({
    ...base, state: "in_progress", attempt_id: "a1",
    deadline_at: "2026-10-12T12:25:00Z",
  }, NOW);
  assert.equal(v.button.label, "Carry on");
  assert.equal(v.button.disabled, false);
  assert.match(v.note, /25 minutes/);
});

test("waiting: a live countdown and NO try again button", () => {
  const v = examView({
    ...base, state: "waiting", tries_used: 2, tries_left: 0,
    reopens_at: "2026-10-13T09:30:00Z",
  }, NOW);
  assert.equal(v.canStart, false);
  assert.equal(v.showTryAgain, false, "a Try again button after the second fail");
  assert.equal(v.button.disabled, true);
  assert.match(v.note, /opens again in 21 hours 30 minutes/);
});

test("passed: no button at all", () => {
  const v = examView({ ...base, state: "passed", best_percent: 85 }, NOW);
  assert.equal(v.button, null);
  assert.equal(v.canStart, false);
  assert.match(v.note, /85 percent/);
});

test("a state this page does not know shows nothing rather than guessing", () => {
  const v = examView({ ...base, state: "something_new" }, NOW);
  assert.equal(v.button, null);
  assert.equal(v.canStart, false);
});

test("a missing answer from the server does not throw", () => {
  for (const s of [null, undefined, {}, { state: null }]) {
    const v = examView(s, NOW);
    assert.equal(v.canStart, false);
  }
});

// ---------------------------------------------------------------------
// The countdown
// ---------------------------------------------------------------------

test("the countdown reads like a person would say it", () => {
  const t = (iso) => countdown(iso, NOW);
  assert.equal(t("2026-10-12T13:00:00Z"), "1 hour");
  assert.equal(t("2026-10-12T12:01:00Z"), "1 minute");
  assert.equal(t("2026-10-12T12:04:00Z"), "4 minutes");
  assert.equal(t("2026-10-12T13:04:00Z"), "1 hour 4 minutes");
  assert.equal(t("2026-10-13T12:00:00Z"), "24 hours");
});

test("a deadline that has passed never reads as negative", () => {
  assert.equal(countdown("2026-10-12T11:00:00Z", NOW), "under a minute");
  assert.equal(countdown("nonsense", NOW), "under a minute");
});

// ---------------------------------------------------------------------
// Answers are saved as they are chosen
// ---------------------------------------------------------------------

test("only questions that have been answered are sent", () => {
  const { payload, answered } = answerPayload({ q1: ["o1"], q2: [], q3: null, q4: ["o7", "o8"] });
  assert.deepEqual(Object.keys(payload).sort(), ["q1", "q4"]);
  assert.equal(answered, 2);
});

test("nothing answered yet means nothing to save", () => {
  // "Saved" should appear only after the first answer, not on arrival.
  assert.equal(answerPayload({}).answered, 0);
  assert.equal(answerPayload(null).answered, 0);
});

test("a single chosen option is still sent as a list", () => {
  // lms_submit_exam compares sets, so one answer and three answers have
  // to arrive in the same shape.
  const { payload } = answerPayload({ q1: "o1" });
  assert.deepEqual(payload.q1, ["o1"]);
});

// ---------------------------------------------------------------------
// What a result is never allowed to contain
// ---------------------------------------------------------------------

test("an exam result never holds an option id", () => {
  const sql = readFileSync(new URL("../database/lms/16_restructure.sql", import.meta.url), "utf8");

  const returns = (fn) => {
    const i = sql.indexOf(`create or replace function ${fn}`);
    assert.ok(i > -1, `${fn} is not in file 16`);
    const j = sql.indexOf("language", i);
    return sql.slice(i, j);
  };

  // The two things a learner gets back after submitting.
  for (const fn of ["lms_submit_exam", "lms_exam_rewatch"]) {
    const block = returns(fn);
    assert.ok(!/option/i.test(block),
      `${fn} returns something with "option" in its name. A learner who failed must learn which parts to rewatch, not which answer was right.`);
    assert.ok(!/is_correct/i.test(block),
      `${fn} returns is_correct, which is the answer key.`);
  }

  // And nothing in the rewatch answer identifies the questions either,
  // so a second try cannot be reverse engineered from it.
  const rewatch = returns("lms_exam_rewatch");
  assert.ok(!/question_id/i.test(rewatch),
    "lms_exam_rewatch names the questions that were missed, which is halfway to an answer sheet");
  assert.ok(/lesson_title/.test(rewatch) && /chapter_start/.test(rewatch),
    "lms_exam_rewatch should return the lesson and the chapter to watch from");
});

test("passing and getting no certificate always comes with a reason", () => {
  // An earlier version swallowed the error if the claim function was
  // missing, so a learner could pass, see "passed", be handed nothing,
  // and have nothing anywhere say why.
  const sql = readFileSync(new URL("../database/lms/16_restructure.sql", import.meta.url), "utf8");
  assert.ok(sql.includes("certificate_message"),
    "lms_submit_exam does not say why there is no certificate");
  assert.ok(!/exception when undefined_function/.test(sql),
    "a missing claim function is being swallowed, which hides a learner never getting their certificate");
});

test("the exam is timed by the server, not the browser", () => {
  const sql = readFileSync(new URL("../database/lms/16_restructure.sql", import.meta.url), "utf8");
  assert.ok(sql.includes("deadline_at"), "there is no server side deadline");
  assert.ok(sql.includes("least(now(), coalesce(v_dead, now()))"),
    "a late submit is not marked at the deadline, so closing the laptop buys extra time");
});

test("two tries, then shut for a day", () => {
  const sql = readFileSync(new URL("../database/lms/16_restructure.sql", import.meta.url), "utf8");
  assert.ok(sql.includes("reopens_at"), "nothing works out when it opens again");
  assert.ok(/max_attempts,\s*serve_count,\s*\n?\s*retake_after_minutes/.test(sql)
            || sql.includes("retake_after_minutes"),
    "the wait is not stored on the exam, so staff cannot change it");
  // The numbers the brief asked for, as the defaults on a new exam.
  // Created as a draft, not published: an exam with an empty bank
  // cannot be sat, and file 07 refuses to publish an empty question set
  // anyway. lms_publish_exam is the gate, and it checks the bank.
  assert.ok(/values \(p_course, 'Course exam', 70, 2, 20, 1440, true, 'draft', 40, 1\.5\)/.test(sql),
    "a new course exam is not 20 questions, 40 minutes, 70 percent, 2 tries, 24 hours, bank of 1.5x, as a draft");
  assert.ok(/values \(p_path, 'Path exam', 70, 2, 40, 1440, true, 'draft', 90, 1\.5\)/.test(sql),
    "a new path exam is not 40 questions, 90 minutes, 70 percent, 2 tries, 24 hours, bank of 1.5x, as a draft");
  assert.ok(sql.includes("lms_publish_exam"),
    "there is no gate that checks the bank is big enough before an exam goes live");
  assert.ok(/needs a bank of at least/.test(sql),
    "publishing an exam does not check the bank size");
});
