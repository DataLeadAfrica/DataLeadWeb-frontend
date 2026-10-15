import { useCallback, useEffect, useState } from "react";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import { PlusIcon, WarnIcon } from "../Icons";
import { Done, Head, Problem, Waiting } from "../ui";
import {
  addFacilitator,
  asWhen,
  getStaff,
  removeFacilitator,
  type StaffRow,
} from "../../../../lib/studio";

// The facilitator list.
//
// AN EMAIL ADDRESS, NOT AN ACCOUNT. Somebody can be appointed before
// they have ever signed up, and the appointment waits for them. That is
// file 10's arrangement and this page is its face: the chips below show
// whether each person has signed up yet, because "added but has not
// appeared" is the state somebody will ask about.
//
// NOTHING HERE CAN MAKE AN ADMINISTRATOR. The form adds a facilitator
// and nothing else, and lms_set_staff_role refuses the value 'admin'
// outright. The two administrators are made in Supabase by somebody who
// already holds the project keys. The page that can make an
// administrator is the page worth attacking, so there is no such page,
// and saying so here is better than leaving somebody to wonder where the
// button is.
//
// THE CHIPS WRAP AND NOTHING IS CLIPPED. An address is long, and a row
// of them cut off at the edge of a 1360 screen is the thing nobody
// notices until the name they want is the one that was cut.

function Inner() {
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    getStaff().then((a) => {
      if (a.ok) setRows(a.data);
      else setProblem(a.message);
    });
  }, []);

  useEffect(load, [load]);

  if (problem && !rows) return <Problem>{problem}</Problem>;
  if (!rows) return <Waiting what="the staff list" />;

  return (
    <>
      <Seo title="Staff | Control room" noindex />

      <Head
        eyebrow="People"
        title="Staff"
        sub="Facilitators build courses. They see only what they built, and never a learner name or email address."
        actions={
          <button type="button" className="acad-btn" onClick={() => setAdding(true)}>
            <PlusIcon />
            Add a facilitator
          </button>
        }
      />

      <Problem>{problem}</Problem>
      <Done>{done}</Done>

      <p className="stu__msg is-warn" style={{ marginBottom: 18 }}>
        <WarnIcon />
        <span>
          <b>An administrator is made in Supabase, never from here.</b> This page adds facilitators
          and nothing more. There are two administrators, and raising somebody to that needs the
          project keys, on purpose.
        </span>
      </p>

      {adding ? (
        <div className="stu__panel" style={{ marginBottom: 18 }}>
          <header>
            <h2>Add a facilitator</h2>
            <button type="button" className="stu__chip" onClick={() => setAdding(false)}>
              Close
            </button>
          </header>
          <div className="stu__grid stu__g2">
            <label className="stu__field">
              <span>Email address</span>
              <input
                className="stu__in"
                value={email}
                autoFocus
                onChange={(e) => setEmail(e.target.value)}
                placeholder="amaka@dataleadafrica.com"
              />
              <small>
                They do not need an account yet. The appointment waits for them, and takes effect
                the first time they sign in.
              </small>
            </label>
            <label className="stu__field">
              <span>Their name</span>
              <input className="stu__in" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="stu__field" style={{ gridColumn: "1 / -1" }}>
              <span>A note, for whoever reads this next</span>
              <input className="stu__in" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          <button
            type="button"
            className="acad-btn"
            style={{ marginTop: 14 }}
            onClick={async () => {
              const got = await addFacilitator(email, name, note);
              if (got.ok) {
                setDone(got.data);
                setEmail("");
                setName("");
                setNote("");
                setAdding(false);
                load();
              } else setProblem(got.message);
            }}
          >
            Add them
          </button>
        </div>
      ) : null}

      <div className="stu__panel">
        <header>
          <h2>
            {rows.length} facilitator{rows.length === 1 ? "" : "s"}
          </h2>
        </header>

        {rows.length === 0 ? (
          <div className="stu__empty">Nobody on the list yet.</div>
        ) : (
          <div className="stu__scroll">
            <table className="stu__table">
              <thead>
                <tr>
                  <th>Who</th>
                  <th>State</th>
                  <th>Courses built</th>
                  <th>Added</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.email}>
                    <td>
                      <span className="stu__who">
                        <span className="stu__course__code">
                          {(r.full_name || r.email)
                            .split(/[\s@.]+/)
                            .slice(0, 2)
                            .map((w) => w[0]?.toUpperCase())
                            .join("")}
                        </span>
                        <span>
                          <b>{r.full_name || "Name not given"}</b>
                          <small>{r.email}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      {r.has_account ? (
                        <span className="stu__tag is-live">{r.role}</span>
                      ) : (
                        <span className="stu__tag is-review">Waiting for them to sign up</span>
                      )}
                    </td>
                    <td>{r.course_count}</td>
                    <td>{asWhen(r.added_at)}</td>
                    <td>{r.note || "-"}</td>
                    <td>
                      <button
                        type="button"
                        className="stu__link"
                        onClick={async () => {
                          const got = await removeFacilitator(r.email);
                          if (got.ok) {
                            setDone(got.data);
                            load();
                          } else setProblem(got.message);
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="stu__hint" style={{ marginTop: 12 }}>
          Removing somebody puts them back to learner. Everything they built stays exactly where it
          is, and their name stays on it.
        </p>
      </div>
    </>
  );
}

export default function StudioStaffPage() {
  return <RequireStaff adminOnly>{() => <Inner />}</RequireStaff>;
}
