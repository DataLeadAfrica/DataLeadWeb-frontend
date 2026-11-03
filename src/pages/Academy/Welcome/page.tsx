import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import "../academy.css";
import "./page.css";
import Seo from "../../../components/Seo/component";
import AcadCard from "../ui/AcadCard";
import AcadStage from "../ui/AcadStage";
import { Box, Chips } from "../ui/Ask";
import { ArrowIcon, LockIcon, TickIcon, WarnIcon } from "../ui/Icons";
import { routes } from "../../routes";
import { getSession, signOut, type Session } from "../../../lib/academy";
import {
  DEVICES,
  INTERNET,
  TOPIC_EXPERIENCE,
  getMyPhone,
  getMySetup,
  saveMyPhone,
  saveMySetup,
  type AlreadyToldUs,
} from "../../../lib/attendance";
import { AGE_BANDS, EDUCATION, OCCUPATIONS } from "../SignUp/answers.js";

// The screen a participant sees the first time they sign in, and the
// screen anybody can come back to afterwards to change their answers.
//
// FOUR QUESTIONS AND ONE OPTIONAL NOTE. Not thirteen. Six of the
// thirteen that were first proposed are already asked by the sign up
// page, in the About you section nobody can get past, and with stricter
// rules than the proposal had. A form that asks again for something it
// already holds teaches the person that it does not know them, and the
// second answer is the one that gets typed carelessly. So those six are
// shown back, read only, and the screen asks only what is new.
//
// WHY THE NAME IS READ ONLY, AND WHY THAT HOLDS. The name has to match
// the ID card, so only staff change it. The screen shows it with no box
// around it, but that is not what makes the rule true: lms_learner_setup
// has no name column, nothing in the browser may write that table at
// all, and lms_save_my_setup has no name parameter. There is nowhere for
// a name to go. A disabled text box is a box somebody can re-enable in
// their own browser; this is not.
//
// THE PHONE NUMBER IS THE ONE THING HERE THAT IS NOT PART OF FILE 28.
// It lives on lms_profiles, where file 18 left the browser exactly two
// writable columns, and it is saved by its own call. That is why it can
// fail on its own, and why this page says so rather than claiming the
// whole save failed when the five answers went in.

type Ready = "loading" | "ready" | "saved";

export default function AcademyWelcome() {
  const navigate = useNavigate();

  const [state, setState] = useState<Ready>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [fullName, setFullName] = useState("");
  const [already, setAlready] = useState<AlreadyToldUs | null>(null);
  /** True when this person has filled the screen in before, which turns
      it from a welcome into an edit screen. */
  const [returning, setReturning] = useState(false);

  // The five answers.
  const [preferredName, setPreferredName] = useState("");
  const [device, setDevice] = useState("");
  const [internet, setInternet] = useState("");
  const [experience, setExperience] = useState("");
  const [goal, setGoal] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneWas, setPhoneWas] = useState("");

  const [busy, setBusy] = useState(false);
  /** Something went wrong READING. Shown at the top, as a note, because
      it is not about anything the person has typed and a red alert
      beside the save button would say it was. */
  const [loadTrouble, setLoadTrouble] = useState("");
  /** Something went wrong SAVING. That one is an alert, beside the
      button that caused it. */
  const [trouble, setTrouble] = useState("");
  const [note, setNote] = useState("");
  /** Shown only once a save has actually failed. See below. */
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    let alive = true;

    getSession().then((s) => {
      if (alive) setSession(s);
    });

    // The phone is a separate read because it comes from a different
    // table. Neither waits for the other.
    getMyPhone().then((p) => {
      if (!alive) return;
      setPhone(p);
      setPhoneWas(p);
    });

    getMySetup().then((got) => {
      if (!alive) return;
      if (!got.ok) {
        // The screen still opens. Somebody whose answers cannot be read
        // should still be able to type them, and the save will say so
        // if it refuses as well.
        setLoadTrouble(got.message);
        setState("ready");
        return;
      }
      const s = got.data;
      setFullName((s.full_name ?? "").trim());
      setAlready(s.already_told_us);
      setReturning(Boolean(s.done));
      if (s.mine) {
        setPreferredName(s.mine.preferred_name ?? "");
        setDevice(s.mine.device ?? "");
        setInternet(s.mine.internet ?? "");
        setExperience(s.mine.topic_experience ?? "");
        setGoal(s.mine.goal_note ?? "");
      } else if (s.full_name) {
        // A sensible first guess at the preferred name rather than an
        // empty box: the first word of the name we already hold. It is
        // a draft, and anybody can change it before saving.
        setPreferredName(s.full_name.trim().split(/\s+/)[0] ?? "");
      }
      setState("ready");
    });

    return () => {
      alive = false;
    };
  }, []);

  // THE PROGRESS BAR COUNTS THE FOUR THAT ARE REQUIRED. The note is not
  // in it, because a bar that can never reach the end is a bar that
  // tells somebody they have not finished when they have.
  const answered = useMemo(
    () => [preferredName.trim(), device, internet, experience].filter(Boolean).length,
    [preferredName, device, internet, experience],
  );
  const share = Math.round((answered / 4) * 100);
  const complete = answered === 4;

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setTrouble("");
    setNote("");

    if (!complete) {
      setTrouble("Please answer the four questions. The last one is optional.");
      return;
    }

    setBusy(true);
    const saved = await saveMySetup({
      preferredName: preferredName.trim(),
      device,
      internet,
      topicExperience: experience,
      goalNote: goal,
    });

    if (!saved.ok) {
      setBusy(false);
      setTrouble(saved.message);
      // THE WAY OUT, AND IT APPEARS ONLY NOW. This screen stands
      // between a participant and their dashboard, so a save that
      // genuinely cannot work must not lock them out of the Academy.
      // It is not offered before a save has been tried, because a
      // skip button on the screen is a skip button everybody presses
      // and then the answers are never collected at all.
      setStuck(true);
      return;
    }

    // The phone is its own write, so it gets its own answer. Only sent
    // when it has actually changed.
    let phoneTrouble = "";
    if (phone.trim() !== phoneWas.trim()) {
      const p = await saveMyPhone(phone);
      if (p.ok) setPhoneWas(p.data);
      else phoneTrouble = p.message;
    }
    setBusy(false);

    if (phoneTrouble) {
      // Not an error about the save: the five answers ARE saved. It
      // says what did not happen, which is the phone number.
      setNote(`Saved. Your phone number could not be stored: ${phoneTrouble}`);
      setState("saved");
      return;
    }

    setState("saved");
  }

  async function onSignOut() {
    await signOut();
    navigate(routes.academySignIn, { replace: true });
  }

  const seo = (
    <Seo
      title="Complete your profile | Data-Lead Academy"
      description="A few quick questions before your dashboard opens."
      noindex
    />
  );

  // ------------------------------------------------------------- saved
  if (state === "saved") {
    return (
      <AcadStage width="wide" focus>
        {seo}
        <div className="acad-welcome">
          <AcadCard className="acad-welcome__card acad-welcome__card--done">
            <p className="acad-msg acad-msg--ok">
              <TickIcon />
              <span>
                {returning
                  ? "Your answers have been updated."
                  : "Thank you. That is everything we needed."}
              </span>
            </p>

            {note ? (
              <p className="acad-msg acad-msg--note acad-welcome__note">
                <WarnIcon />
                <span>{note}</span>
              </p>
            ) : null}

            <p className="acad-welcome__after">
              You can change any of it later from this page. Your name is the one
              thing only staff can change, because it has to match your ID card.
            </p>

            <Link className="acad-btn" to={routes.academyMe}>
              Go to my learning
              <ArrowIcon />
            </Link>
          </AcadCard>
        </div>
      </AcadStage>
    );
  }

  // ----------------------------------------------------------- loading
  if (state === "loading") {
    return (
      <AcadStage width="wide" focus>
        {seo}
        <div className="acad-welcome">
          <div className="acad-welcome__card acad-welcome__waiting" aria-busy="true" />
        </div>
      </AcadStage>
    );
  }

  // ------------------------------------------------------------ the form
  return (
    <AcadStage width="wide" focus>
      {seo}

      <div className="acad-welcome">
        <AcadCard as="form" className="acad-welcome__card" onSubmit={onSave}>
          {/* --------------------------------------------- the meter

              A bar and a count, not a spinner. Somebody who can see
              four has to be answered, and that they have done two of
              them, finishes the form. Somebody who cannot see the end
              of it stops. */}
          <div className="acad-prog" aria-hidden="true">
            <div className="acad-prog__track">
              <i className="acad-prog__fill" style={{ width: `${share}%` }} />
            </div>
            <b className="acad-mono acad-prog__count">
              {answered}/4
            </b>
          </div>
          <p className="acad-vis-hidden" role="status">
            {answered} of 4 questions answered
          </p>

          <p className="acad-eyebrow">
            <i />
            {returning ? "Your profile" : "One minute, then you are in"}
          </p>
          <h1 className="acad-h2 acad-welcome__title">
            {returning ? (
              <>
                Your <em>profile</em>
              </>
            ) : (
              <>
                Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""}.
                <br />
                Four quick <em>questions.</em>
              </>
            )}
          </h1>
          <p className="acad-sub acad-welcome__sub">
            {returning
              ? "Change anything here whenever you like."
              : "They tell your facilitator how to teach you, which is the whole reason we ask. About a minute."}
          </p>

          {loadTrouble ? (
            <p className="acad-msg acad-msg--note acad-welcome__load">
              <WarnIcon />
              <span>
                We could not load what you have told us before, so some of this
                may look empty. {loadTrouble} You can still answer and save.
              </span>
            </p>
          ) : null}

          {/* ------------------------------------ what we already have */}
          <section className="acad-known">
            <h3 className="acad-known__title">What we already have</h3>

            <div className="acad-known__grid">
              <div className="acad-known__cell">
                <span className="acad-known__k">
                  <LockIcon />
                  Your name
                </span>
                <b className="acad-known__v">{fullName || "Not set yet"}</b>
                <small className="acad-known__why">
                  On your ID card and your certificates. Ask a facilitator to
                  change it.
                </small>
              </div>

              <div className="acad-known__cell">
                <span className="acad-known__k">Email address</span>
                <b className="acad-known__v">{session?.email || ""}</b>
                <small className="acad-known__why">The address you sign in with.</small>
              </div>
            </div>

            <div className="acad-known__phone">
              <Box
                label="Phone number"
                value={phone}
                onChange={(v) => setPhone(v.replace(/[^\d+\s()-]/g, "").slice(0, 24))}
                maxLength={24}
                autoComplete="tel"
                inputMode="numeric"
                hint="How a facilitator reaches you about a class. You can change this."
                disabled={busy}
              />
            </div>

            {/* The six the sign up page already asked. Shown back so
                nobody is asked twice, and read only because changing
                them is a staff job: they are the ones the reports are
                built on. */}
            {already ? (
              <div className="acad-known__six">
                <p className="acad-known__sixhead">
                  You told us this when you signed up
                </p>
                <dl className="acad-known__dl">
                  <Pair k="Age" v={words(AGE_BANDS, already.age_band)} />
                  <Pair k="Gender" v={already.gender} />
                  <Pair
                    k="Where you live"
                    v={[already.state, already.country].filter(Boolean).join(", ")}
                  />
                  <Pair k="Education" v={words(EDUCATION, already.education_level)} />
                  <Pair k="Right now you are" v={words(OCCUPATIONS, already.occupation)} />
                  <Pair k="You heard about us from" v={already.heard_from} />
                </dl>
                <p className="acad-known__askstaff">
                  Ask a facilitator if any of this needs changing.
                </p>
              </div>
            ) : null}
          </section>

          {/* ------------------------------------------- the four, and the note */}
          <section className="acad-welcome__asks">
            <h3 className="acad-known__title">What we do not know yet</h3>

            <Box
              label="What should we call you?"
              value={preferredName}
              onChange={(v) => setPreferredName(v.slice(0, 40))}
              maxLength={40}
              hint="The name your facilitator will use in class."
              disabled={busy}
            />

            <Chips
              label="What will you be learning on?"
              value={device}
              onChange={(v: never) => setDevice(v)}
              options={DEVICES}
              hint="Some exercises need a laptop, and a facilitator who knows will set a different one."
              disabled={busy}
            />

            <Chips
              label="How is your internet?"
              value={internet}
              onChange={(v: never) => setInternet(v)}
              options={INTERNET}
              hint="So nobody is marked absent for a class they could not stay connected to."
              disabled={busy}
            />

            <Chips
              label="Have you worked with this topic before?"
              value={experience}
              onChange={(v: never) => setExperience(v)}
              options={TOPIC_EXPERIENCE}
              hint="There is no wrong answer. Most people say none at all."
              disabled={busy}
            />

            <Box
              label="What do you want to get out of this?"
              value={goal}
              onChange={(v) => setGoal(v.slice(0, 300))}
              maxLength={300}
              hint="Optional. One line is plenty, and your facilitator does read them."
              disabled={busy}
            />
          </section>

          {trouble ? (
            <p className="acad-msg acad-msg--bad" role="alert">
              <WarnIcon />
              <span>{trouble}</span>
            </p>
          ) : null}

          <div className="acad-welcome__end">
            <button type="submit" className="acad-btn" disabled={busy}>
              {busy ? "Saving" : returning ? "Save changes" : "Save and carry on"}
              {busy ? null : <ArrowIcon />}
            </button>

            {returning ? (
              <Link className="acad-btn acad-btn--ghost acad-btn--auto" to={routes.academyMe}>
                Back to my learning
              </Link>
            ) : null}
          </div>

          {/* Only after a save has failed, and only then. */}
          {stuck && !returning ? (
            <p className="acad-welcome__stuck">
              Still not saving?{" "}
              <Link to={routes.academyMe}>Carry on to my learning</Link> and tell a
              facilitator. We will ask you again next time.
            </p>
          ) : null}

          {!returning ? (
            <p className="acad-foot">
              Not you?{" "}
              <button type="button" className="acad-welcome__out" onClick={onSignOut}>
                Sign out
              </button>
            </p>
          ) : null}
        </AcadCard>
      </div>
    </AcadStage>
  );
}

/** One read only line in the "you told us this" list. */
function Pair({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null;
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}

/**
 * The person's own words for a stored code.
 *
 * The sign up page stores short codes: "u18", "tertiary", "seeking". A
 * screen showing somebody "seeking" back as their own answer is a screen
 * showing them our database rather than their answer. The same lists the
 * sign up page offered are used here, so the words match exactly what
 * they chose. Anything not in a list is shown as it is rather than
 * hidden, because a missing line looks like a missing answer.
 */
function words(
  list: readonly (readonly [string, string])[],
  code: string | null | undefined,
): string {
  if (!code) return "";
  const found = list.find(([v]) => v === code);
  return found ? found[1] : code;
}
