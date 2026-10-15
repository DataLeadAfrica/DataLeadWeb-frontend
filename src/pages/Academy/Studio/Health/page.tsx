import { useEffect, useState } from "react";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import { TickIcon, WarnIcon } from "../Icons";
import { Head, Problem, Waiting } from "../ui";
import {
  asWhen,
  getActivityLog,
  getBiggestTables,
  getHealth,
  type HealthRow,
  type LogRow,
  type TableSize,
} from "../../../../lib/studio";

// The meters, and the log.
//
// THE LOG CANNOT BE EDITED BY ANYBODY, including the person reading it.
// A trigger on lms_admin_actions refuses every UPDATE and DELETE, so the
// only thing anybody can do to that table is add to it. That is the
// property that makes it worth reading six months from now, and it is
// why this page has no delete button to explain the absence of.
//
// THE HEALTH ROWS ARE A SEPARATE FUNCTION FROM THE ALARM'S. File 12's
// system_health takes a token and refuses a signed in caller, because it
// is written for an outside script with no account. This is the same
// information for the person sitting here, and a separate function so
// the alarm's contract is untouched.

const WORDS: Record<string, string> = {
  course_created: "started",
  course_published: "published",
  course_unpublished: "took down",
  course_sent_for_review: "sent for review",
  course_sent_back: "sent back",
  course_archived: "archived",
  course_price_changed: "changed the price of",
  access_given: "gave access to",
  access_removed: "removed access from",
  exam_wait_lifted: "lifted the exam wait for",
  questions_pasted: "pasted questions into",
  popup_created: "made a popup",
  popup_started: "started the popup",
  popup_stopped: "stopped the popup",
  site_settings_changed: "changed the site settings",
  report_who_read: "read who our learners are",
  export_downloaded: "downloaded",
  facilitator_added: "added a facilitator",
  facilitator_removed: "removed a facilitator",
  role_changed: "changed a role for",
  area_tool_added: "added a tool to",
  path_created: "made the path",
  path_courses_set: "set the courses of",
};

function Inner() {
  const [tab, setTab] = useState<"health" | "log">("health");
  const [rows, setRows] = useState<HealthRow[] | null>(null);
  const [tables, setTables] = useState<TableSize[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    getHealth().then((a) => {
      if (a.ok) setRows(a.data);
      else setProblem(a.message);
    });
    getBiggestTables().then((a) => a.ok && setTables(a.data));
    getActivityLog(null, 100).then((a) => a.ok && setLog(a.data));
  }, []);

  if (problem && !rows) return <Problem>{problem}</Problem>;
  if (!rows) return <Waiting what="the health page" />;

  const warnings = rows.filter((r) => r.severity !== "ok").length;

  return (
    <>
      <Seo title="Health and activity | Control room" noindex />

      <Head
        eyebrow="Site"
        title="Health and activity"
        sub={
          warnings === 0
            ? "Everything is running. Nothing needs attention."
            : `${warnings} thing${warnings === 1 ? "" : "s"} to look at.`
        }
        actions={
          <div className="stu__chips">
            <button
              type="button"
              className="stu__chip"
              aria-pressed={tab === "health"}
              onClick={() => setTab("health")}
            >
              Health
            </button>
            <button
              type="button"
              className="stu__chip"
              aria-pressed={tab === "log"}
              onClick={() => setTab("log")}
            >
              Activity log
            </button>
          </div>
        }
      />

      {tab === "health" ? (
        <div className="stu__grid stu__g2">
          <section className="stu__panel">
            <header>
              <h2>The meters</h2>
            </header>
            <ul className="stu__checks">
              {rows.map((r) => (
                <li
                  className={`stu__check ${r.severity === "ok" ? "is-ok" : "is-no"}`}
                  key={r.item}
                >
                  {r.severity === "ok" ? <TickIcon /> : <WarnIcon />}
                  <div>
                    <b>
                      {r.item}: {r.value}
                    </b>
                    <small>{r.detail}</small>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="stu__panel">
            <header>
              <h2>Biggest tables</h2>
              <span className="stu__label">The free plan stops at 500 MB</span>
            </header>
            <div className="stu__bars">
              {tables.map((t) => (
                <div className="stu__bar" key={t.table_name}>
                  <span style={{ fontFamily: "var(--acad-f-mono)", fontSize: 12 }}>
                    {t.table_name}
                  </span>
                  <i
                    style={{
                      width: `${Math.max(2, Math.round((t.bytes / (tables[0]?.bytes || 1)) * 100))}%`,
                    }}
                  />
                  <b>{t.pretty}</b>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="stu__panel">
          <header>
            <h2>Everything that has happened</h2>
            <span className="stu__label">Nobody can edit this, including you</span>
          </header>

          {log.length === 0 ? (
            <div className="stu__empty">Nothing recorded yet.</div>
          ) : (
            <div className="stu__scroll">
              <table className="stu__table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>What</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((r, i) => (
                    <tr key={`${r.at}-${i}`}>
                      <td style={{ whiteSpace: "nowrap" }}>{asWhen(r.at)}</td>
                      <td>{r.actor}</td>
                      <td>
                        {WORDS[r.action] || r.action.replace(/_/g, " ")}
                        {r.subject ? <> <b>{r.subject}</b></> : null}
                      </td>
                      <td style={{ fontSize: 12.5, color: "var(--acad-muted)" }}>
                        {Object.entries(r.detail || {})
                          .filter(([k]) => k !== "was" && k !== "now")
                          .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
                          .join(" · ") || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="stu__hint" style={{ marginTop: 12 }}>
            A trigger refuses every change and every delete on this table, so the only thing
            anybody can do to it is add a line.
          </p>
        </div>
      )}
    </>
  );
}

export default function StudioHealthPage() {
  return <RequireStaff adminOnly>{() => <Inner />}</RequireStaff>;
}
