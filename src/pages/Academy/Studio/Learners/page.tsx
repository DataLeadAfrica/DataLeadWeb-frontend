import { useCallback, useEffect, useState } from "react";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import Drawer from "./Drawer";
import { DownIcon, SearchIcon } from "../Icons";
import { Head, Problem, Stat, Waiting } from "../ui";
import {
  asWhen,
  getLearners,
  logExport,
  type StudioLearner,
} from "../../../../lib/studio";

// Everybody with an Academy account. ADMINISTRATORS ONLY.
//
// A facilitator never reaches this page: the rail does not show it, the
// guard refuses it, and lms_staff_learners refuses underneath both. The
// third one is the one that matters.
//
// THE FILTERS ARE WORKED OUT IN THE DATABASE. "Waiting on the exam"
// means both tries used and the 24 hours not yet up, which is a join
// across attempts and a time comparison. Done in the browser it would
// need every learner's attempts sent here first, which is slow and is
// exactly the data that should not travel.
//
// A DOWNLOAD IS RECORDED. Not its contents, the fact: who asked for
// which file and when. An export is the moment data leaves the place
// that protects it, and six months later the only question anybody asks
// is who had it.

const FILTERS = [
  { key: "all", label: "Everyone" },
  { key: "active", label: "Active this week" },
  { key: "waiting", label: "Waiting on the exam" },
  { key: "finished", label: "Finished" },
  { key: "quiet", label: "Gone quiet" },
];

const SOURCES = [
  { key: "", label: "Any access" },
  { key: "free", label: "Free course" },
  { key: "purchase", label: "Paid" },
  { key: "roster", label: "Bootcamp" },
  { key: "manual", label: "Given by staff" },
  { key: "scholarship", label: "Scholarship" },
];

const SOURCE_WORDS: Record<string, string> = {
  free: "Free course",
  purchase: "Paid",
  roster: "Bootcamp",
  manual: "Given by staff",
  scholarship: "Scholarship",
};

function Inner() {
  const [rows, setRows] = useState<StudioLearner[] | null>(null);
  const [problem, setProblem] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [access, setAccess] = useState("");
  const [open, setOpen] = useState<StudioLearner | null>(null);

  const load = useCallback(() => {
    getLearners({ search: q, filter, access: access || null }).then((a) => {
      if (a.ok) {
        setRows(a.data);
        setProblem("");
      } else setProblem(a.message);
    });
  }, [q, filter, access]);

  // A pause before asking, so typing a name is one request rather than
  // one per letter.
  useEffect(() => {
    const t = window.setTimeout(load, 300);
    return () => window.clearTimeout(t);
  }, [load]);

  if (problem) return <Problem>{problem}</Problem>;
  if (!rows) return <Waiting what="the learners" />;

  const waiting = rows.filter((r) => r.state === "waiting").length;
  const active = rows.filter((r) => r.state === "active").length;
  const certified = rows.filter((r) => r.certificates > 0).length;

  async function download() {
    // rows is non-null here: the component returns early above while it
    // is still null, and this is only reachable from a button on the
    // rendered table. Named rather than asserted, so the next person
    // does not have to work that out.
    const list = rows || [];
    const head = "name,email,joined,courses,furthest,last active,access,certificates\n";
    const body = list
      .map((r) =>
        [
          r.full_name,
          r.email,
          r.joined?.slice(0, 10) || "",
          r.course_count,
          r.furthest_course || "",
          r.last_active?.slice(0, 10) || "",
          r.access_source || "",
          r.certificates,
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    // Recorded BEFORE the file is handed over, so a download that
    // happened is in the log even if the browser then fails to save it.
    await logExport("learners.csv", list.length);

    const url = URL.createObjectURL(new Blob([head + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "learners.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Seo title="Learners | Control room" noindex />

      <Head
        eyebrow="People"
        title="Learners"
        sub="Everyone with an Academy account. Find a person, see where they are, and sort out what is stopping them."
        actions={
          <button type="button" className="stu__chip" onClick={download}>
            <DownIcon />
            Download CSV
          </button>
        }
      />

      <div className="stu__grid stu__g4" style={{ marginBottom: 20 }}>
        <Stat label="Shown" value={rows.length} />
        <Stat label="Active in 7 days" value={active} />
        <Stat
          label="Waiting on the exam"
          value={waiting}
          note={waiting ? "Opens again by itself after 24 hours" : undefined}
        />
        <Stat label="Certified" value={certified} note="At least one certificate" />
      </div>

      <div className="stu__panel">
        <header>
          <div className="stu__chips">
            <label className="stu__find" style={{ maxWidth: 260 }}>
              <SearchIcon />
              <input
                className="stu__cmdin"
                style={{ padding: 0, border: 0, fontSize: 13.5 }}
                value={q}
                placeholder="Name or email address"
                aria-label="Find a learner"
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className="stu__chip"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
            <select
              className="stu__in"
              style={{ width: "auto" }}
              value={access}
              aria-label="Access"
              onChange={(e) => setAccess(e.target.value)}
            >
              {SOURCES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="stu__empty">Nobody matches that.</div>
        ) : (
          <>
            <div className="stu__scroll">
              <table className="stu__table">
                <thead>
                  <tr>
                    <th>Learner</th>
                    <th>Joined</th>
                    <th>Courses</th>
                    <th>Furthest course</th>
                    <th>Last active</th>
                    <th>Access</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.user_id}>
                      <td>
                        <button
                          type="button"
                          className="stu__who"
                          style={{ border: 0, background: "none", cursor: "pointer", padding: 0 }}
                          onClick={() => setOpen(r)}
                        >
                          <span className="stu__course__code">
                            {(r.full_name || "?")
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((w) => w[0]?.toUpperCase())
                              .join("")}
                          </span>
                          <span>
                            <b>{r.full_name || "No name"}</b>
                            <small>{r.email}</small>
                          </span>
                        </button>
                      </td>
                      <td>{asWhen(r.joined)}</td>
                      <td>{r.course_count}</td>
                      <td>
                        {r.furthest_course ? (
                          <>
                            {r.furthest_course}
                            <div className="stu__meter" style={{ marginTop: 5, width: 120 }}>
                              <i style={{ width: `${r.furthest_percent || 0}%` }} />
                            </div>
                          </>
                        ) : (
                          "No course yet"
                        )}
                      </td>
                      <td>{asWhen(r.last_active) || "Not yet"}</td>
                      <td>
                        <span className="stu__tag">
                          {SOURCE_WORDS[r.access_source || ""] || "None"}
                        </span>
                        {r.state === "waiting" ? (
                          <span className="stu__tag is-review" style={{ marginLeft: 6 }}>
                            Exam wait
                          </span>
                        ) : null}
                        {r.certificates > 0 ? (
                          <span className="stu__tag is-live" style={{ marginLeft: 6 }}>
                            Certified {r.certificates}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <button type="button" className="stu__chip" onClick={() => setOpen(r)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="stu__hint">
              Only administrators see email addresses. Opening a learner, and every change you
              make, is recorded in the activity log.
            </p>
          </>
        )}
      </div>

      {open ? (
        <Drawer
          learner={open}
          onClose={() => setOpen(null)}
          onChanged={() => {
            load();
          }}
        />
      ) : null}
    </>
  );
}

export default function StudioLearnersPage() {
  return <RequireStaff adminOnly>{() => <Inner />}</RequireStaff>;
}
