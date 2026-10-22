import { useEffect, useRef, useState } from "react";

import { PlusIcon } from "../Icons";
import { Done, Problem } from "../ui";
import type { StudioCourseFull } from "./data";
import {
  asMoney,
  getAreas,
  setCourseAreas,
  setCourseDetails,
  setCoursePrice,
  type AreaOverview,
} from "../../../../lib/studio";

// The Details tab: everything about the course that is not a lesson.
//
// THE PRICE IS IN ITS OWN PANEL AND ITS OWN FUNCTION, because it is the
// one thing on this page a facilitator may not touch. Splitting it that
// way means the permission is a property of the call rather than a list
// of field names inside one, and a facilitator who gets to the panel
// anyway is refused by the database rather than having part of their
// save silently dropped.
//
// OUTCOMES ARE A LIST, NOT A PARAGRAPH. Three at least, each starting
// with a verb. They are what the course page promises and what the
// certificate is evidence of, so they are worth the extra fields.

const WAIT_MS = 800;

type Props = {
  course: StudioCourseFull;
  isAdmin: boolean;
  onSaved: () => void;
};

export default function Details({ course, isAdmin, onSaved }: Props) {
  const [title, setTitle] = useState(course.title);
  const [summary, setSummary] = useState(course.summary);
  const [level, setLevel] = useState(course.level);
  const [tool, setTool] = useState(course.tool);
  const [outcomes, setOutcomes] = useState<string[]>(
    course.outcomes.length ? course.outcomes : ["", "", ""],
  );
  const [audience, setAudience] = useState((course.audience || []).join("\n"));
  const [before, setBefore] = useState((course.prerequisites || []).join("\n"));
  const [faq, setFaq] = useState(course.faq || []);
  const [areas, setAreas] = useState<AreaOverview[]>([]);
  const [mine, setMine] = useState<string[]>(course.areas || []);
  const [price, setPrice] = useState(String(Math.round(course.price_kobo / 100)));
  const [freeFirst, setFreeFirst] = useState(course.first_module_free);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState("");
  const timer = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    getAreas().then((a) => {
      if (a.ok) setAreas(a.data);
    });
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setProblem("");
      const got = await setCourseDetails({
        p_course: course.id,
        p_title: title,
        p_summary: summary,
        p_level: level,
        p_tool: tool,
        p_outcomes: outcomes.map((o) => o.trim()).filter(Boolean),
        p_audience: audience.split("\n").map((s) => s.trim()).filter(Boolean),
        p_prerequisites: before.split("\n").map((s) => s.trim()).filter(Boolean),
        p_faq: faq.filter((f) => f.q.trim() && f.a.trim()),
      });
      if (!got.ok) {
        setProblem(got.message);
        return;
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
      onSaved();
    }, WAIT_MS);
    return () => window.clearTimeout(timer.current);
  }, [title, summary, level, tool, outcomes, audience, before, faq, course.id, onSaved]);

  const written = outcomes.filter((o) => o.trim()).length;

  return (
    <div className="stu__grid stu__g2">
      <div className="stu__grid">
        <section className="stu__panel">
          <header>
            <h3>The basics</h3>
            {saved ? (
              <span className="stu__label" style={{ color: "var(--acad-ok)" }}>
                Saved
              </span>
            ) : null}
          </header>
          <div className="stu__grid">
            <label className="stu__field">
              <span>Course title</span>
              <input className="stu__in" value={title} onChange={(e) => setTitle(e.target.value)} />
              {/* WHAT IS ALREADY PRINTED, SAID BEFORE IT MATTERS.
                  The certificate shows the programme title, which follows
                  this field until the first certificate is issued and then
                  stays where it is. Rewording certificates somebody already
                  holds is a decision for a person, so the page says what
                  will happen rather than letting it be found out later. */}
              {course.certificates_issued > 0 && course.certificate_title ? (
                <small>
                  Certificates already issued say{" "}
                  <strong>{course.certificate_title}</strong>. Changing the course title
                  here will not change them.
                </small>
              ) : (
                <small>
                  This is also the title printed on the certificate, until the first one
                  is issued.
                </small>
              )}
            </label>
            <label className="stu__field">
              <span>Short description</span>
              <textarea
                className="stu__in"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
              <small>One or two sentences, for the card and for Google.</small>
            </label>
            <label className="stu__field">
              <span>Tool or skill</span>
              <input className="stu__in" value={tool} onChange={(e) => setTool(e.target.value)} />
              <small>Exact names matter: MySQL, not SQL.</small>
            </label>
            <label className="stu__field">
              <span>Level</span>
              <select className="stu__in" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Mastery</option>
              </select>
            </label>
          </div>
        </section>

        <section className="stu__panel">
          <header>
            <h3>Areas</h3>
            <span className="stu__label">The first one decides the cover</span>
          </header>
          <div className="stu__chips">
            {areas.map((a) => {
              const on = mine.includes(a.name);
              return (
                <button
                  key={a.area_id}
                  type="button"
                  className="stu__chip"
                  aria-pressed={on}
                  onClick={async () => {
                    const next = on ? mine.filter((n) => n !== a.name) : [...mine, a.name];
                    if (next.length === 0) {
                      setProblem("A course needs at least one area.");
                      return;
                    }
                    setMine(next);
                    const got = await setCourseAreas(course.id, next);
                    if (!got.ok) setProblem(got.message);
                    else onSaved();
                  }}
                >
                  {a.name}
                  {on && mine[0] === a.name ? <small>main</small> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="stu__panel">
          <header>
            <h3>What learners will be able to do</h3>
            <span className="stu__label">{written} of at least 3</span>
          </header>
          <div className="stu__grid" style={{ gap: 8 }}>
            {outcomes.map((o, i) => (
              <input
                key={i}
                className="stu__in"
                value={o}
                placeholder="Clean a column of dates that arrived as text"
                aria-label={`Outcome ${i + 1}`}
                onChange={(e) => {
                  const next = [...outcomes];
                  next[i] = e.target.value;
                  setOutcomes(next);
                }}
              />
            ))}
            <button
              type="button"
              className="stu__chip"
              style={{ justifySelf: "start" }}
              onClick={() => setOutcomes([...outcomes, ""])}
            >
              <PlusIcon />
              Add one
            </button>
            <small className="stu__hint">
              Start each with a verb. At least three are needed to publish.
            </small>
          </div>
        </section>
      </div>

      <div className="stu__grid">
        <section className="stu__panel">
          <header>
            <h3>Who it is for</h3>
          </header>
          <div className="stu__grid">
            <label className="stu__field">
              <span>Who it is for</span>
              <textarea
                className="stu__in"
                rows={4}
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
              <small>One per line.</small>
            </label>
            <label className="stu__field">
              <span>Before you start</span>
              <textarea
                className="stu__in"
                rows={4}
                value={before}
                onChange={(e) => setBefore(e.target.value)}
              />
              <small>One per line.</small>
            </label>
          </div>
        </section>

        <section className="stu__panel">
          <header>
            <h3>Questions people ask</h3>
            <span className="stu__label">On the course page and in Google</span>
          </header>
          <div className="stu__grid" style={{ gap: 10 }}>
            {faq.map((f, i) => (
              <div className="stu__grid" style={{ gap: 6 }} key={i}>
                <input
                  className="stu__in"
                  value={f.q}
                  aria-label="Question"
                  placeholder="Do I need Excel installed?"
                  onChange={(e) => {
                    const next = [...faq];
                    next[i] = { ...next[i], q: e.target.value };
                    setFaq(next);
                  }}
                />
                <textarea
                  className="stu__in"
                  rows={2}
                  value={f.a}
                  aria-label="Answer"
                  onChange={(e) => {
                    const next = [...faq];
                    next[i] = { ...next[i], a: e.target.value };
                    setFaq(next);
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="stu__chip"
              style={{ justifySelf: "start" }}
              onClick={() => setFaq([...faq, { q: "", a: "" }])}
            >
              <PlusIcon />
              Add a question
            </button>
          </div>
        </section>

        {isAdmin ? (
          <section className="stu__panel">
            <header>
              <h3>Price</h3>
              <span className="stu__label">Administrators only</span>
            </header>
            <div className="stu__grid">
              <label className="stu__field">
                <span>Price in naira</span>
                <input
                  className="stu__in"
                  value={price}
                  inputMode="numeric"
                  style={{ maxWidth: 160 }}
                  onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
                />
                <small>
                  Zero makes it free, and publishing a free course opens it to everybody who already
                  has an account. Currently {asMoney(course.price_kobo)}.
                </small>
              </label>
              <label className="stu__field" style={{ flexDirection: "row", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={freeFirst}
                  onChange={(e) => setFreeFirst(e.target.checked)}
                />
                <span>Module 1 is free to try</span>
              </label>
              <button
                type="button"
                className="acad-btn acad-btn--auto"
                style={{ justifySelf: "start" }}
                onClick={async () => {
                  const got = await setCoursePrice(
                    course.id,
                    Math.max(0, Number(price || 0)) * 100,
                    freeFirst,
                  );
                  if (!got.ok) setProblem(got.message);
                  else {
                    setSaved(true);
                    onSaved();
                  }
                }}
              >
                Save the price
              </button>
              <p className="stu__hint">
                Every price change is recorded with the old number and the new one.
              </p>
            </div>
          </section>
        ) : (
          <section className="stu__panel">
            <header>
              <h3>Price</h3>
            </header>
            <p className="stu__hint">
              {asMoney(course.price_kobo)}. Only an administrator can change it.
            </p>
          </section>
        )}
      </div>

      <div style={{ gridColumn: "1 / -1" }}>
        <Problem>{problem}</Problem>
        {saved ? <Done>Saved.</Done> : null}
      </div>
    </div>
  );
}
