// The course exam page, in one function: what the server said, turned
// into what the page shows.
//
// WHY THIS IS NOT WRITTEN INTO THE PAGE. There are five states, each
// with its own button, its own wording and its own reason for the
// button being disabled. Written inline that is five nested ternaries
// in the middle of some JSX, which is where a learner ends up seeing
// "Start my last try" on an exam they have already passed.
//
// THE SERVER DECIDES, ALWAYS. lms_exam_status works out the state; this
// only chooses words for it. Nothing here can open an exam that the
// database says is shut, because the Start button calls lms_start_exam
// and that refuses anything that is not the open state.
//
// tests/exam-state.test.mjs runs it in plain Node.

/**
 * @param {object} s a row from lms_exam_status
 * @param {number} now milliseconds, for the countdown. Passed in rather
 *   than read here so a test can stand still.
 */
export function examView(s, now = Date.now()) {
  const state = s && s.state;

  if (state === "passed") {
    return {
      state,
      heading: "You passed",
      button: null,
      note: s.best_percent != null ? `Your best score was ${pct(s.best_percent)}.` : "",
      canStart: false,
      showTryAgain: false,
    };
  }

  if (state === "not_open") {
    const left = Math.max((s.lessons_total || 0) - (s.lessons_done || 0), 0);
    return {
      state,
      heading: "Course exam",
      // The button says what will open it, so it is not a dead control
      // with no explanation. Disabled, because it genuinely cannot be
      // pressed yet.
      button: { label: `Opens after lesson ${s.lessons_total || ""}`.trim(), disabled: true },
      note: left === 1
        ? "One lesson left to finish."
        : `${left} lessons left to finish.`,
      canStart: false,
      showTryAgain: false,
    };
  }

  if (state === "in_progress") {
    return {
      state,
      heading: "Your try is running",
      button: { label: "Carry on", disabled: false },
      note: s.deadline_at ? `Time left: ${countdown(s.deadline_at, now)}.` : "",
      deadlineAt: s.deadline_at,
      canStart: true,
      showTryAgain: false,
    };
  }

  if (state === "waiting") {
    return {
      state,
      heading: "Both tries used",
      // No Try again button at all after the second fail. A disabled
      // button somebody keeps pressing is worse than no button.
      button: { label: "Opens again soon", disabled: true },
      note: s.reopens_at
        ? `The exam opens again in ${countdown(s.reopens_at, now)}, on ${longDate(s.reopens_at)}.`
        : "The exam opens again in a day.",
      reopensAt: s.reopens_at,
      canStart: false,
      showTryAgain: false,
    };
  }

  if (state === "open") {
    const allowed = s.tries_allowed || 0;
    const left = s.tries_left || 0;
    const used = allowed - left;
    return {
      state,
      heading: "Course exam",
      button: {
        // The last try is named as the last try, so nobody spends it
        // thinking there is another behind it.
        label: left === 1 && allowed > 1 ? "Start my last try" : "Start the exam",
        disabled: false,
      },
      note: `Try ${used + 1} of ${allowed}. `
        + `${s.question_count || 0} questions, ${s.minutes || 0} minutes, `
        + `${s.pass_mark || 0} percent to pass.`,
      canStart: true,
      // THE RESULT PAGE AFTER A FAIL asks this, and it is the only
      // thing that asks it. "open" with a try still on it means the
      // learner has just failed their first of two and has another, so
      // the result offers Try again. It sends them back to the rules,
      // where the button already reads "Start my last try" from the
      // branch above, rather than straight into the questions: a second
      // try begun by accident is a try spent.
      //
      // After the SECOND fail the state is "waiting", not "open", so
      // this is false and the result offers only the way back to the
      // course. That is deliberate. A Try again button that cannot be
      // pressed for 24 hours is a worse answer than no button.
      showTryAgain: used > 0,
    };
  }

  // An unknown state is the server telling us something this page does
  // not understand yet. Show nothing rather than guess.
  return {
    state: state || "unknown",
    heading: "Course exam",
    button: null,
    note: "",
    canStart: false,
    showTryAgain: false,
  };
}

/** "1 hour 4 minutes", "4 minutes", "under a minute". Never negative. */
export function countdown(when, now = Date.now()) {
  const ms = new Date(when).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return "under a minute";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "under a minute";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hp = h === 1 ? "1 hour" : `${h} hours`;
  const mp = m === 1 ? "1 minute" : `${m} minutes`;
  if (h === 0) return mp;
  if (m === 0) return hp;
  return `${hp} ${mp}`;
}

function longDate(when) {
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-NG", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

function pct(n) {
  const v = Number(n);
  return Number.isFinite(v) ? `${Math.round(v)} percent` : "";
}

/**
 * The answers a learner has chosen so far, ready for lms_submit_exam.
 *
 * Saved as they are chosen, so a phone that dies at minute 39 does not
 * take the whole try with it. "Saved" is shown only once there is
 * something to save, which is what this returns a count for.
 */
export function answerPayload(chosen) {
  const out = {};
  let answered = 0;
  for (const [questionId, ids] of Object.entries(chosen || {})) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (list.length === 0) continue;
    out[questionId] = list;
    answered += 1;
  }
  return { payload: out, answered };
}
