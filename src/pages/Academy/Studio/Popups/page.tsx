import { useCallback, useEffect, useState } from "react";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import { PlusIcon, WarnIcon } from "../Icons";
import { Done, Head, Problem, Waiting } from "../ui";
import { certDb } from "../../../../lib/certificates";
import {
  asWhen,
  savePopup,
  startPopup,
  stopPopup,
  type StudioPopup,
} from "../../../../lib/studio";

// The one popup.
//
// A NEW ONE IS ALWAYS A DRAFT, and there is no way to make a live one in
// a single action. A box that appears over the whole site is the one
// thing in here where a slip of the hand is seen by everybody, so going
// live is a second, deliberate press.
//
// ONE LIVE AT A TIME, and starting one stands the others down in the
// same statement, so there is never a moment when two are live. The page
// says so rather than letting somebody find out.
//
// WHERE IT MAY APPEAR: the landing page, the catalogue, a course page
// and My learning. NEVER a lesson, a check or an exam. That rule is in
// the table's constraint, in lms_save_popup and in the learner side's
// Popup component, three times on purpose: somebody who wants to put one
// over a lesson has to mean it in three places, and will not.

const PLACES = [
  { key: "landing", label: "The landing page" },
  { key: "courses", label: "The catalogue" },
  { key: "course", label: "A course page" },
  { key: "me", label: "My learning" },
];

const OFTEN = [
  { key: "once", label: "Once per person" },
  { key: "daily", label: "Once a day" },
  { key: "always", label: "Every visit" },
];

function Inner() {
  const [rows, setRows] = useState<StudioPopup[] | null>(null);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const [making, setMaking] = useState(false);
  const [draft, setDraft] = useState({
    heading: "",
    message: "",
    button_text: "Have a look",
    url: "",
    place: "landing",
    how_often: "once",
  });

  const load = useCallback(async () => {
    if (!certDb) return;
    const { data, error } = await certDb
      .from("lms_popups")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setProblem(error.message);
    else setRows((data || []) as StudioPopup[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (problem && !rows) return <Problem>{problem}</Problem>;
  if (!rows) return <Waiting what="the popups" />;

  const live = rows.filter((r) => r.status === "live");

  return (
    <>
      <Seo title="Popups | Control room" noindex />

      <Head
        eyebrow="Site"
        title="Popups"
        sub="One card in the corner of the Academy. It never covers the page, and never appears over a lesson, a check or an exam."
        actions={
          <button type="button" className="acad-btn" onClick={() => setMaking(true)}>
            <PlusIcon />
            New popup
          </button>
        }
      />

      <Problem>{problem}</Problem>
      <Done>{done}</Done>

      {live.length > 1 ? (
        <p className="stu__msg is-bad">
          <WarnIcon />
          <span>
            More than one is live, which should not be possible. Tell somebody.
          </span>
        </p>
      ) : null}

      {making ? (
        <div className="stu__panel" style={{ marginBottom: 18 }}>
          <header>
            <h2>A new popup</h2>
            <button type="button" className="stu__chip" onClick={() => setMaking(false)}>
              Close
            </button>
          </header>
          <div className="stu__grid stu__g2">
            <label className="stu__field">
              <span>Heading</span>
              <input
                className="stu__in"
                value={draft.heading}
                onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
              />
            </label>
            <label className="stu__field">
              <span>Button words</span>
              <input
                className="stu__in"
                value={draft.button_text}
                onChange={(e) => setDraft({ ...draft, button_text: e.target.value })}
              />
            </label>
            <label className="stu__field" style={{ gridColumn: "1 / -1" }}>
              <span>What it says</span>
              <textarea
                className="stu__in"
                rows={2}
                value={draft.message}
                onChange={(e) => setDraft({ ...draft, message: e.target.value })}
              />
            </label>
            <label className="stu__field">
              <span>Where the button goes</span>
              <input
                className="stu__in"
                value={draft.url}
                placeholder="/lms/courses/power-bi"
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              />
              <small>A popup points at one thing: a course, a path or an address.</small>
            </label>
            <label className="stu__field">
              <span>Where it shows</span>
              <select
                className="stu__in"
                value={draft.place}
                onChange={(e) => setDraft({ ...draft, place: e.target.value })}
              >
                {PLACES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              <small>Never over a lesson, a check or an exam.</small>
            </label>
            <label className="stu__field">
              <span>How often</span>
              <select
                className="stu__in"
                value={draft.how_often}
                onChange={(e) => setDraft({ ...draft, how_often: e.target.value })}
              >
                {OFTEN.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              <small>
                This is why there is no "do not show again" link on the popup itself: a promise the
                next campaign breaks is what teaches people to close a box without reading it.
              </small>
            </label>
          </div>
          <button
            type="button"
            className="acad-btn"
            style={{ marginTop: 14 }}
            onClick={async () => {
              const got = await savePopup(draft);
              if (got.ok) {
                setDone("Made as a draft. Start it when you are ready.");
                setMaking(false);
                load();
              } else setProblem(got.message);
            }}
          >
            Make it, as a draft
          </button>
        </div>
      ) : null}

      <div className="stu__grid stu__g2">
        {rows.length === 0 ? (
          <div className="stu__empty">No popups yet.</div>
        ) : (
          rows.map((p) => (
            <section className="stu__panel" key={p.id}>
              <header>
                <h3>{p.heading || "No heading"}</h3>
                <span
                  className={`stu__tag ${p.status === "live" ? "is-live" : p.status === "draft" ? "is-draft" : ""}`}
                >
                  {p.status}
                </span>
              </header>
              <p className="stu__hint" style={{ marginBottom: 10 }}>
                {p.message}
              </p>
              <div className="stu__chips" style={{ marginBottom: 12 }}>
                <span className="stu__tag">
                  {PLACES.find((x) => x.key === p.place)?.label || p.place}
                </span>
                <span className="stu__tag">
                  {OFTEN.find((x) => x.key === p.how_often)?.label || p.how_often}
                </span>
                {p.starts_at ? <span className="stu__tag">from {asWhen(p.starts_at)}</span> : null}
              </div>
              <div className="stu__chips">
                {p.status === "live" ? (
                  <button
                    type="button"
                    className="stu__chip"
                    onClick={async () => {
                      const got = await stopPopup(p.id);
                      if (got.ok) {
                        setDone("Stopped.");
                        load();
                      } else setProblem(got.message);
                    }}
                  >
                    Stop it
                  </button>
                ) : (
                  <button
                    type="button"
                    className="acad-btn acad-btn--auto"
                    onClick={async () => {
                      const got = await startPopup(p.id);
                      if (got.ok) {
                        setDone("Live. Any other live popup has been stood down.");
                        load();
                      } else setProblem(got.message);
                    }}
                  >
                    Start it
                  </button>
                )}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}

export default function StudioPopupsPage() {
  return <RequireStaff adminOnly>{() => <Inner />}</RequireStaff>;
}
