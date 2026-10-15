import { useEffect, useState } from "react";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import { OutIcon, SearchIcon } from "../Icons";
import { Head, Problem, Stat, Waiting } from "../ui";
import {
  getCertificateCounts,
  getCertificates,
  type StudioCertificate,
} from "../../../../lib/studio";
import { routes } from "../../../routes";

// Every Academy certificate, searchable by number or name.
//
// REVOKING IS NOT HERE, and that is the brief's instruction rather than
// an omission. The Certificate console already does it, already logs it,
// and two places that can revoke a certificate is one too many for an
// action nobody can take back. The link below goes there.

function Inner() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<StudioCertificate[] | null>(null);
  const [counts, setCounts] = useState({ all_time: 0, this_week: 0, revoked: 0 });
  const [problem, setProblem] = useState("");

  useEffect(() => {
    getCertificateCounts().then((a) => {
      if (a.ok) setCounts(a.data);
    });
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      getCertificates(q).then((a) => {
        if (a.ok) setRows(a.data);
        else setProblem(a.message);
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  if (problem && !rows) return <Problem>{problem}</Problem>;
  if (!rows) return <Waiting what="the certificates" />;

  return (
    <>
      <Seo title="Certificates | Control room" noindex />

      <Head
        eyebrow="Results"
        title="Certificates"
        sub="Every certificate the Academy has issued. Each one has a number anybody can check at dataleadafrica.com/verify."
        actions={
          <a className="stu__chip" href={routes.staffCertificates}>
            Certificate console
            <OutIcon />
          </a>
        }
      />

      <div className="stu__grid stu__g4" style={{ marginBottom: 20 }}>
        <Stat label="All time" value={counts.all_time} />
        <Stat label="This week" value={counts.this_week} />
        <Stat label="Revoked" value={counts.revoked} note="Revoking happens in the console" />
        <Stat label="Shown" value={rows.length} />
      </div>

      <div className="stu__panel">
        <header>
          <label className="stu__find" style={{ maxWidth: 320 }}>
            <SearchIcon />
            <input
              className="stu__cmdin"
              style={{ padding: 0, border: 0, fontSize: 13.5 }}
              value={q}
              placeholder="Certificate number or name"
              aria-label="Find a certificate"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </header>

        {rows.length === 0 ? (
          <div className="stu__empty">Nothing matches that.</div>
        ) : (
          <div className="stu__scroll">
            <table className="stu__table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Who</th>
                  <th>For</th>
                  <th>Issued</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.certificate_number}>
                    <td style={{ fontFamily: "var(--acad-f-mono)", fontSize: 12.5 }}>
                      {r.certificate_number}
                    </td>
                    <td>{r.full_name}</td>
                    <td>{r.programme}</td>
                    <td>{r.issued_on || "-"}</td>
                    <td>
                      {r.revoked ? (
                        <span className="stu__tag is-bad">Revoked</span>
                      ) : (
                        <span className="stu__tag is-live">Valid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function StudioCertificatesPage() {
  return <RequireStaff adminOnly>{() => <Inner />}</RequireStaff>;
}
