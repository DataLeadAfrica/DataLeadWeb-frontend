import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import { ClockIcon, TickIcon } from "../Icons";
import { Done, Head, Problem, Stat, Waiting } from "../ui";
import {
  MODES,
  closeDay,
  correctRecord,
  getLive,
  getRoster,
  getToday,
  listCohorts,
  methodWord,
  openDay,
  revealCode,
  say,
  type AttendanceDay,
  type LiveRow,
  type RevealedCode,
  type RosterRow,
} from "../../../../lib/attendance";
import type { Role } from "../../../../lib/studio";

// The facilitator's panel: open today, read the code out, watch people
// arrive.
//
// THE CODE CANNOT BE SHOWN TWICE, and the screen says so rather than
// hiding it. What the database keeps is a salted fingerprint, so the
// plain code exists on this screen, in this tab, for as long as the
// window lasts and nowhere else. Refresh the page while a code is live
// and the panel knows a code IS live and cannot tell you what it is.
// The honest thing is to say that and offer a fresh one, which kills
// the old one anyway. Stashing it in the browser so it survived a
// refresh would be writing the secret down in the one place we were
// careful not to put it.
//
// IT POLLS, AND ONLY WHILE SOMEBODY IS LOOKING. Who has arrived changes
// while the facilitator watches, so the list refreshes itself every ten
// seconds. In a hidden tab it stops: a class runs for two hours and a
// panel left open in a background tab would ask seven hundred times for
// an answer nobody is reading, on a phone, on mobile data.

const WINDOWS = [10, 20, 30, 60];

function Inner({ role }: { role: Role }) {
  const isAdmin = role === "admin";

  const [cohorts, setCohorts] = useState<string[] | null>(null);
  const [cohort, setCohort] = useState("");
  const [day, setDay] = useState<AttendanceDay | null>(null);
  const [live, setLive] = useState<LiveRow[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [looking, setLooking] = useState(true);

  // Opening a day.
  const [mode, setMode] = useState("in_person");
  const [title, setTitle] = useState("");
  const [formHours, setFormHours] = useState(12);

  // The revealed code. Held here and nowhere else.
  const [code, setCode] = useState<RevealedCode | null>(null);
  const [windowMinutes, setWindowMinutes] = useState(20);
  const [now, setNow] = useState(() => Date.now());

  const [busy, setBusy] = useState("");
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");

  // Marking somebody present by hand, which is what a broken card or a
  // forgotten one comes to in the end.
  const [addWho, setAddWho] = useState("");
  const [addWhy, setAddWhy] = useState("");

  // ------------------------------------------------------------ load
  useEffect(() => {
    let alive = true;
    listCohorts().then((a) => {
      if (!alive) return;
      if (!a.ok) {
        setProblem(a.message);
        setCohorts([]);
        return;
      }
      const names = a.data.map((c) => c.cohort);
      setCohorts(names);
      setCohort((c) => c || names[0] || "");
    });
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!cohort) return;
    const today = await getToday(cohort);
    if (!today.ok) {
      setProblem(today.message);
      return;
    }
    setProblem("");
    setDay(today.data);
    if (today.data) {
      const who = await getLive(today.data.id);
      if (who.ok) setLive(who.data);
    } else {
      setLive([]);
    }
  }, [cohort]);

  // The cohort changed: everything about the old one goes, including
  // any code that was on screen. A code belongs to one day.
  useEffect(() => {
    setDay(null);
    setLive([]);
    setCode(null);
    setDone("");
    refresh();
    if (cohort) {
      getRoster(cohort).then((a) => {
        if (a.ok) setRoster(a.data);
      });
    }
  }, [cohort, refresh]);

  // Stop asking when nobody is looking.
  useEffect(() => {
    const onSee = () => setLooking(document.visibilityState !== "hidden");
    onSee();
    document.addEventListener("visibilitychange", onSee);
    return () => document.removeEventListener("visibilitychange", onSee);
  }, []);

  const tick = useRef(0);
  useEffect(() => {
    if (!looking || !day || day.closed_at) return;
    tick.current = window.setInterval(refresh, 10000);
    return () => window.clearInterval(tick.current);
  }, [looking, day, refresh]);

  // One second clock, for the countdown only, and only while there is
  // something counting down.
  useEffect(() => {
    if (!code && !day?.code_live) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [code, day?.code_live]);

  // ---------------------------------------------------------- actions
  async function onOpen() {
    setBusy("open");
    setProblem("");
    const a = await openDay({ cohort, mode, title, formHours });
    setBusy("");
    if (!a.ok) {
      setProblem(a.message);
      return;
    }
    setDay(a.data);
    setDone("Today is open. Scan people in, or reveal the code for anybody online.");
    refresh();
  }

  async function onReveal() {
    if (!day) return;
    setBusy("code");
    setProblem("");
    const a = await revealCode(day.id, windowMinutes);
    setBusy("");
    if (!a.ok) {
      setProblem(a.message);
      return;
    }
    setCode(a.data);
    setNow(Date.now());
    setDone("");
    refresh();
  }

  async function onClose() {
    if (!day) return;
    setBusy("close");
    const a = await closeDay(day.id);
    setBusy("");
    if (!a.ok) {
      setProblem(a.message);
      return;
    }
    setCode(null);
    setDay(null);
    setDone("Today is closed. Everything recorded is kept.");
    refresh();
  }

  async function onAdd() {
    if (!day || !addWho) return;
    setBusy("add");
    setProblem("");
    const a = await correctRecord(day.id, addWho, addWhy);
    setBusy("");
    if (!a.ok) {
      setProblem(a.message);
      return;
    }
    setAddWho("");
    setAddWhy("");
    setDone("Marked present, with your name and your reason on the record.");
    refresh();
  }

  // ------------------------------------------------------------ words
  const secondsLeft = useMemo(() => {
    const closes = code?.closes_at || day?.code_closes_at;
    if (!closes) return 0;
    // THE SERVER'S DEADLINE, not a timer started here. A countdown
    // counted from the moment the button was pressed would drift away
    // from the window the database is actually enforcing, and the two
    // would disagree about whether a code still works.
    return Math.max(0, Math.round((new Date(closes).getTime() - now) / 1000));
  }, [code, day?.code_closes_at, now]);

  const codeLive = secondsLeft > 0 && Boolean(code || day?.code_live);

  /** Who is in the cohort but not yet marked present today. */
  const missing = useMemo(() => {
    const inAlready = new Set(live.map((l) => l.user_id));
    return roster.filter((r) => r.user_id && !inAlready.has(r.user_id));
  }, [roster, live]);

  if (cohorts === null) return <Waiting what="the cohorts" />;

  if (cohorts.length === 0) {
    return (
      <>
        <Seo title="Attendance | Control room" noindex />
        <Head eyebrow="People" title="Attendance" />
        <Problem>{problem}</Problem>
        <div className="stu__empty">
          <p>
            <b>No cohort has anybody active in it.</b>
          </p>
          <p>
            Attendance is taken per cohort, so there is nothing to open until
            somebody is enrolled in one.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Seo title="Attendance | Control room" noindex />

      <Head
        eyebrow="People"
        title="Attendance"
        sub="Open the class, mark people in, and read the code out to anybody online. One record per person per day, on Nigerian time."
      />

      {/* ------------------------------------------------- the cohort */}
      <div className="stu__chips stu-att__cohorts">
        {cohorts.map((c) => (
          <button
            key={c}
            type="button"
            className="stu__chip"
            aria-pressed={c === cohort}
            onClick={() => setCohort(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <Problem>{problem}</Problem>
      <Done>{done}</Done>

      {!day ? (
        /* ----------------------------------------- nothing open yet */
        <div className="stu__panel stu-att__open">
          <header>
            <h2>Today is not open yet</h2>
          </header>
          <div className="stu-att__openbody">
            <p className="stu__hint">
              Nothing can be recorded for {cohort} until a day is open. Opening
              one twice does nothing: the second press hands back the same day.
            </p>

            <div className="stu__field">
              <span>Where is this class?</span>
              <div className="stu__chips">
                {MODES.map(([v, text]) => (
                  <button
                    key={v}
                    type="button"
                    className="stu__chip"
                    aria-pressed={mode === v}
                    onClick={() => setMode(v)}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>

            <label className="stu__field">
              <span>What is today about? Optional</span>
              <input
                className="stu__in"
                value={title}
                maxLength={120}
                placeholder="Day 4, joins and filters"
                onChange={(e) => setTitle(e.target.value)}
              />
              <small>It shows on the learner's screen and in the register.</small>
            </label>

            <div className="stu__field">
              <span>How long should today's form stay open?</span>
              <div className="stu__chips">
                {[4, 12, 24, 48].map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="stu__chip"
                    aria-pressed={formHours === h}
                    onClick={() => setFormHours(h)}
                  >
                    {h} hours
                  </button>
                ))}
              </div>
              <small className="stu__hint">
                Only people marked present can open it, whenever they open it.
              </small>
            </div>

            <button
              type="button"
              className="stu__chip stu-att__big"
              disabled={busy === "open"}
              onClick={onOpen}
            >
              {busy === "open" ? "Opening" : "Open today"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ------------------------------------------- it is open */}
          <div className="stu__grid stu__g4 stu-att__stats">
            <Stat label="Marked present" value={day.checked_in} />
            <Stat label="Enrolled" value={day.expected} />
            <Stat
              label="Still to come"
              value={Math.max(0, day.expected - day.checked_in)}
            />
            <Stat label="Where" value={say(MODES, day.mode)} note={day.title || undefined} />
          </div>

          {/* ------------------------------------------- the code */}
          <div className="stu__panel stu-att__code">
            <header>
              <h2>The code for anybody online</h2>
              {codeLive ? (
                <span className="stu__tag is-live">
                  <ClockIcon />
                  {clock(secondsLeft)} left
                </span>
              ) : null}
            </header>

            <div className="stu-att__codebody">
              {code && secondsLeft > 0 ? (
                <>
                  <b className="stu-att__codenow" aria-live="polite">
                    {code.code}
                  </b>
                  <p className="stu__hint">
                    Read it out now. It works for {code.window_minutes} minutes,
                    once per person, and only for {cohort}.
                  </p>
                </>
              ) : day.code_live && secondsLeft > 0 ? (
                /* A code is running that this screen cannot show. */
                <p className="stu__msg is-warn stu-att__cantshow">
                  <ClockIcon />
                  <span>
                    A code is live for another {clock(secondsLeft)}, but it cannot
                    be shown again. The database keeps a fingerprint of it rather
                    than the code, which is what stops a copy of the database
                    handing out every code ever used. Reveal a new one if you need
                    to read it out, which stops the old one straight away.
                  </span>
                </p>
              ) : (
                <p className="stu__hint">
                  Nothing is live. Reveal one during the class rather than
                  before it: the clock starts the moment you press it.
                </p>
              )}

              <div className="stu__field">
                <span>How long should it work for?</span>
                <div className="stu__chips">
                  {WINDOWS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="stu__chip"
                      aria-pressed={windowMinutes === m}
                      onClick={() => setWindowMinutes(m)}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="stu__chip stu-att__big"
                disabled={busy === "code"}
                onClick={onReveal}
              >
                {busy === "code"
                  ? "Revealing"
                  : codeLive
                    ? "Reveal a new one"
                    : "Reveal the code"}
              </button>
            </div>
          </div>

          {/* ------------------------------------------- who is here */}
          <div className="stu__panel">
            <header>
              <h2>Who is here</h2>
              <span className="stu__hint">
                {looking ? "Updating every ten seconds" : "Paused while this tab is hidden"}
              </span>
            </header>

            {live.length === 0 ? (
              <div className="stu__empty">
                Nobody yet. Scan a card, or read the code out.
              </div>
            ) : (
              <div className="stu__scroll">
                <table className="stu__table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>How</th>
                      <th>When</th>
                      <th>Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {live.map((r) => (
                      <tr key={r.user_id}>
                        <td>{r.full_name || "Name not set"}</td>
                        <td>{methodWord(r.method)}</td>
                        <td style={{ fontFamily: "var(--acad-f-mono)", fontSize: 12.5 }}>
                          {at(r.checked_in_at)}
                        </td>
                        <td>
                          {r.answered ? (
                            <span className="stu__tag is-live">
                              <TickIcon />
                              Sent
                            </span>
                          ) : (
                            <span className="stu__tag is-draft">Not yet</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* --------------------------- marking somebody in by hand

              Administrators only, because the database refuses anybody
              else, and with a reason because the database insists on
              one. A record added this way says who added it and why,
              which is the difference between a correction and a
              register somebody edited. */}
          {isAdmin ? (
            <div className="stu__panel stu-att__add">
              <header>
                <h2>Card not working?</h2>
              </header>
              <div className="stu-att__openbody">
                <p className="stu__hint">
                  Mark somebody present by hand. Your name and your reason go on
                  the record, and nothing is ever removed from it.
                </p>

                <label className="stu__field">
                  <span>Who</span>
                  <select
                    className="stu__in"
                    value={addWho}
                    onChange={(e) => setAddWho(e.target.value)}
                  >
                    <option value="">Choose a person</option>
                    {missing.map((r) => (
                      <option key={r.participant_id} value={r.user_id as string}>
                        {r.full_name}
                        {r.participant_no ? ` (${r.participant_no})` : ""}
                      </option>
                    ))}
                  </select>
                  <small>
                    {missing.length} of {roster.length} in {cohort} are not marked
                    present yet. Anybody with no Academy account is not in this
                    list, because attendance belongs to an account.
                  </small>
                </label>

                <label className="stu__field">
                  <span>Why</span>
                  <input
                    className="stu__in"
                    value={addWhy}
                    maxLength={200}
                    placeholder="Card would not scan, checked her ID"
                    onChange={(e) => setAddWhy(e.target.value)}
                  />
                </label>

                <button
                  type="button"
                  className="stu__chip"
                  disabled={busy === "add" || !addWho || addWhy.trim().length < 3}
                  onClick={onAdd}
                >
                  {busy === "add" ? "Recording" : "Mark present"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="stu-att__end">
            <button
              type="button"
              className="stu__chip"
              disabled={busy === "close"}
              onClick={onClose}
            >
              {busy === "close" ? "Closing" : "Close today"}
            </button>
            <span className="stu__hint">
              Closing stops the code and the scanner. Everything recorded is
              kept, and the form stays open for the time you set.
            </span>
          </div>
        </>
      )}
    </>
  );
}

/** 9:41 am, in Lagos, whatever the clock on this machine is set to. */
function at(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

/** 4:05 from 245 seconds. */
function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function StudioAttendancePage() {
  return <RequireStaff>{(role) => <Inner role={role} />}</RequireStaff>;
}
