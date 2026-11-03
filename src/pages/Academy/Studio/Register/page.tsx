import { useEffect, useMemo, useState } from "react";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import { DownIcon } from "../Icons";
import { Head, Problem, Stat, Waiting } from "../ui";
import {
  getDaysList,
  getRegister,
  getRoster,
  listCohorts,
  methodWord,
  type DayRow,
  type RegisterRow,
  type RosterRow,
} from "../../../../lib/attendance";
import { logExport } from "../../../../lib/studio";

// The register: everybody in a cohort down the side, every day across
// the top, and a mark where the two meet.
//
// IT IS BUILT FROM THREE ANSWERS, not one, and that is the whole
// design. The register function returns one row per person per day they
// were PRESENT, so on its own it can only draw the people who came and
// the days somebody came to. A grid drawn from it alone would quietly
// leave out the learner who has never once turned up, who is the person
// the grid exists to find, and a day nobody came to at all, which is
// the day worth asking about. So the rows come from the roster, the
// columns from the day list, and the register fills in the squares.
//
// ABSENT IS NOT A RECORD. Nothing in the database says somebody was
// absent. A blank square means no check-in was written for that person
// on that day, which is what absence is: the lack of a record rather
// than a record of its own. The export says the same thing in words.

function Inner() {
  const [cohorts, setCohorts] = useState<string[] | null>(null);
  const [cohort, setCohort] = useState("");
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState("");

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

  useEffect(() => {
    if (!cohort) return;
    let alive = true;
    setLoading(true);
    Promise.all([getRoster(cohort), getDaysList(cohort), getRegister(cohort)]).then(
      ([r, d, g]) => {
        if (!alive) return;
        if (!r.ok || !d.ok || !g.ok) {
          setProblem([r, d, g].find((x) => !x.ok)?.message || "");
          setLoading(false);
          return;
        }
        setProblem("");
        setRoster(r.data);
        // Oldest first across the page, because that is the order the
        // classes happened in and the order anybody reads a register.
        setDays([...d.data].reverse());
        setRows(g.data);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [cohort]);

  /** participant id and date, to the check-in. The square's contents. */
  const cells = useMemo(() => {
    const m = new Map<string, RegisterRow>();
    for (const r of rows) {
      if (r.participant_id) m.set(`${r.participant_id}|${r.meets_on}`, r);
    }
    return m;
  }, [rows]);

  const present = (p: string, on: string) => cells.get(`${p}|${on}`);

  /** How many of this cohort's days each person was present for. */
  const tally = useMemo(() => {
    const t = new Map<string, number>();
    for (const r of rows) {
      if (!r.participant_id) continue;
      t.set(r.participant_id, (t.get(r.participant_id) || 0) + 1);
    }
    return t;
  }, [rows]);

  const totalSquares = roster.length * days.length;
  const filled = rows.length;
  const rate = totalSquares > 0 ? Math.round((filled / totalSquares) * 100) : 0;

  async function download() {
    // ONE ROW PER PERSON PER DAY, including the days they missed, with
    // a column saying which it was. A grid exported as a grid is a
    // shape a spreadsheet cannot filter or total; a long list is.
    const head =
      "cohort,date,name,id number,present,how,time,followed,confidence\n";
    const lines: string[] = [];
    for (const p of roster) {
      for (const d of days) {
        const c = present(p.participant_id, d.meets_on);
        lines.push(
          [
            cohort,
            d.meets_on,
            p.full_name,
            p.participant_no || "",
            c ? "present" : "no record",
            c ? methodWord(c.method) : "",
            c ? c.checked_in_at : "",
            c?.followed || "",
            c?.confidence ?? "",
          ]
            .map((x) => `"${String(x).replace(/"/g, '""')}"`)
            .join(","),
        );
      }
    }

    // Recorded before the file is handed over, so a download that
    // happened is in the log even if the browser then fails to save it.
    await logExport(`attendance-${cohort}.csv`, lines.length);

    const url = URL.createObjectURL(
      new Blob([head + lines.join("\n")], { type: "text/csv" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${cohort}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (cohorts === null) return <Waiting what="the cohorts" />;

  return (
    <>
      <Seo title="Attendance register | Control room" noindex />

      <Head
        eyebrow="Results"
        title="Attendance register"
        sub="Everybody in the cohort, every day it met, and where the two meet. A blank square means no record, which is what being absent is."
        actions={
          roster.length > 0 && days.length > 0 ? (
            <button type="button" className="stu__chip" onClick={download}>
              <DownIcon />
              Download CSV
            </button>
          ) : null
        }
      />

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

      {loading ? (
        <Waiting what="the register" />
      ) : days.length === 0 ? (
        <div className="stu__empty">
          <p>
            <b>{cohort} has not met yet.</b>
          </p>
          <p>Open a day under Attendance and the register starts filling in.</p>
        </div>
      ) : (
        <>
          <div className="stu__grid stu__g4" style={{ marginBottom: 20 }}>
            <Stat label="People" value={roster.length} />
            <Stat label="Days" value={days.length} />
            <Stat label="Marks" value={filled} note={`of ${totalSquares} squares`} />
            <Stat label="Turnout" value={`${rate}%`} note="across every day" />
          </div>

          <div className="stu__panel">
            <div className="stu__scroll">
              <table className="stu__table stu-reg__grid">
                <thead>
                  <tr>
                    <th className="stu-reg__name">Name</th>
                    {days.map((d) => (
                      <th key={d.id} className="stu-reg__day" title={d.title || ""}>
                        {shortDate(d.meets_on)}
                      </th>
                    ))}
                    <th className="stu-reg__sum">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((p) => {
                    const mine = tally.get(p.participant_id) || 0;
                    return (
                      <tr key={p.participant_id}>
                        <td className="stu-reg__name">
                          <b>{p.full_name}</b>
                          {p.participant_no ? (
                            <small className="stu-reg__no">{p.participant_no}</small>
                          ) : (
                            <small className="stu-reg__no is-none">No ID card</small>
                          )}
                        </td>
                        {days.map((d) => {
                          const c = present(p.participant_id, d.meets_on);
                          return (
                            <td key={d.id} className="stu-reg__cell">
                              <i
                                className={"stu-reg__mark" + (c ? ` is-${c.method}` : "")}
                                title={
                                  c
                                    ? `${p.full_name}, ${shortDate(d.meets_on)}: ${methodWord(c.method)}`
                                    : `${p.full_name}, ${shortDate(d.meets_on)}: no record`
                                }
                              />
                            </td>
                          );
                        })}
                        <td className="stu-reg__sum">
                          {mine} / {days.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="stu__hint stu-reg__key">
              <i className="stu-reg__mark is-scan" /> card scanned
              <i className="stu-reg__mark is-code" /> code typed in
              <i className="stu-reg__mark is-staff" /> added by staff
              <i className="stu-reg__mark" /> no record
            </p>
          </div>
        </>
      )}
    </>
  );
}

/** 4 Nov, which is all a column heading has room for. */
function shortDate(on: string): string {
  const d = new Date(`${on}T12:00:00`);
  if (Number.isNaN(d.getTime())) return on;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export default function StudioRegisterPage() {
  return <RequireStaff>{() => <Inner />}</RequireStaff>;
}
