import { useCallback, useEffect, useState } from "react";

import Seo from "../../../components/Seo/component";
import { certDb, prettyDate } from "../../../lib/certificates";
import { isConfigured } from "../../../lib/certificateConfig";
import LiveBackground from "../LiveBackground";
import "../portal.css";

// Staff console for the assessment portal. Deliberately small: no marking,
// no queue, nothing to do on a normal day. It exists for the four things
// that cannot be done by a participant or by the system itself.
//
// It shares the passcode and the session key with /staff/certificates, so
// signing in to one signs you in to the other.

const TOKEN_KEY = "dla_staff_token";

type Issued = {
  certificate_number: string;
  full_name: string;
  email: string | null;
  programme_title: string;
  module_title: string | null;
  week_number: number | null;
  completed_on: string;
  revoked: boolean;
};

type Issued2 = { full_name: string; email: string; password: string };

// Build a spreadsheet file in the browser. Nothing is sent anywhere: the
// passwords only ever exist on this screen and in the file you download.
function downloadCsv(rows: Issued2[]) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ["Full name", "Email", "Password"].map(esc).join(","),
    ...rows.map((r) => [r.full_name, r.email, r.password].map(esc).join(",")),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `portal-passwords-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function StaffPortal() {
  const [token, setToken] = useState("");
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recent, setRecent] = useState<Issued[]>([]);

  const [reopenEmail, setReopenEmail] = useState("");
  const [reopenSection, setReopenSection] = useState("");
  const [renameEmail, setRenameEmail] = useState("");
  const [renameName, setRenameName] = useState("");

  const [summary, setSummary] = useState<{
    enrolled: number;
    with_password: number;
    without_email: number;
  } | null>(null);
  const [issued, setIssued] = useState<Issued2[]>([]);
  const [resetEmail, setResetEmail] = useState("");
  const [resetResult, setResetResult] = useState<{
    name: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved) setToken(saved);
  }, []);

  const loadRecent = useCallback(async (t: string) => {
    if (!certDb) return;
    const { data } = await certDb.rpc("staff_recent_certificates", {
      p_token: t,
      p_limit: 25,
    });
    setRecent((data as Issued[]) || []);
  }, []);

  useEffect(() => {
    if (token) loadRecent(token);
  }, [token, loadRecent]);

  const loadSummary = useCallback(async (t: string) => {
    if (!certDb) return;
    const { data } = await certDb.rpc("staff_password_summary", { p_token: t });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) setSummary(row);
  }, []);

  useEffect(() => {
    if (token) loadSummary(token);
  }, [token, loadSummary]);

  async function issueAll(onlyMissing: boolean) {
    if (!certDb) return;
    if (
      !onlyMissing &&
      !window.confirm(
        "Replace EVERY participant's password?\n\nEveryone's current password stops working immediately, including any they chose themselves. Only do this if the list has leaked.",
      )
    ) {
      return;
    }
    setNotice("");
    setBusy(true);
    const { data, error: err } = await certDb.rpc("staff_issue_passwords", {
      p_token: token,
      p_only_missing: onlyMissing,
    });
    setBusy(false);
    if (err) {
      setNotice("Could not generate passwords. Please try again.");
      return;
    }
    const rows = (data as Issued2[]) || [];
    setIssued(rows);
    setNotice(
      rows.length === 0
        ? "Everyone enrolled already has a password. Nothing new to issue."
        : `${rows.length} ${rows.length === 1 ? "password" : "passwords"} issued. Download the list now: they cannot be shown again.`,
    );
    await loadSummary(token);
  }

  async function resetOne() {
    if (!certDb) return;
    setNotice("");
    setResetResult(null);
    setBusy(true);
    const { data } = await certDb.rpc("staff_reset_password", {
      p_token: token,
      p_email: resetEmail.trim(),
    });
    setBusy(false);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.ok) {
      setNotice(row?.message || "No reply from the database.");
      return;
    }
    setResetResult({ name: row.full_name, password: row.password });
    await loadSummary(token);
  }

  async function signIn() {
    if (!certDb) return;
    setError("");
    setBusy(true);
    const { data, error: err } = await certDb.rpc("staff_login", {
      p_passcode: passcode,
    });
    setBusy(false);
    if (err) {
      setError("Could not reach the database. Please try again.");
      return;
    }
    if (!data) {
      setError(
        "That passcode was not accepted. After ten wrong attempts, sign in locks for 15 minutes.",
      );
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, data as string);
    setToken(data as string);
    setPasscode("");
  }

  async function signOut() {
    if (certDb && token) await certDb.rpc("staff_logout", { p_token: token });
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setRecent([]);
  }

  async function revoke(num: string) {
    if (!certDb) return;
    const reason = window.prompt(
      `Withdraw certificate ${num}?\n\nGive a short reason (optional):`,
    );
    if (reason === null) return;
    const { data } = await certDb.rpc("staff_revoke_certificate", {
      p_token: token,
      p_number: num,
      p_reason: reason,
    });
    setNotice(String(data || ""));
    await loadRecent(token);
  }

  async function restore(num: string) {
    if (!certDb) return;
    const { data } = await certDb.rpc("staff_restore_certificate", {
      p_token: token,
      p_number: num,
    });
    setNotice(String(data || ""));
    await loadRecent(token);
  }

  async function reopen() {
    if (!certDb) return;
    setNotice("");
    setBusy(true);
    const { data } = await certDb.rpc("staff_reopen_module", {
      p_token: token,
      p_email: reopenEmail.trim(),
      p_module: reopenSection.trim(),
    });
    setBusy(false);
    const row = Array.isArray(data) ? data[0] : data;
    setNotice(row?.message || "No reply from the database.");
  }

  async function rename() {
    if (!certDb) return;
    setNotice("");
    setBusy(true);
    const { data } = await certDb.rpc("staff_rename_participant", {
      p_token: token,
      p_email: renameEmail.trim(),
      p_full_name: renameName.trim(),
    });
    setBusy(false);
    const row = Array.isArray(data) ? data[0] : data;
    setNotice(row?.message || "No reply from the database.");
    await loadRecent(token);
  }

  if (!isConfigured) {
    return (
      <div className="lp">
        <LiveBackground />
        <main className="adm">
          <div className="adm__wrap">
            <div className="lp__msg glass">
              <h1>Not configured</h1>
              <p>The certificate database is not connected in this build.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!token) {
    return (
      <>
        <Seo title="Staff portal | Data-Lead Africa" noindex />
        <div className="lp">
          <LiveBackground />
          <main className="lgn">
            <div className="lgn__card glass brk">
              <p className="eyebrow">
                <i />
                Staff
              </p>
              <h1 className="lgn__h1">Assessment portal</h1>
              <p className="lgn__txt">
                Same passcode as the certificates console. Signing in here signs
                you in there too, and closing the tab signs you out of both.
              </p>
              <label className="lbl" htmlFor="sp-pass">
                Passcode
              </label>
              <input
                id="sp-pass"
                className="inp"
                type="password"
                value={passcode}
                disabled={busy}
                onChange={(e) => setPasscode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy) signIn();
                }}
              />
              {error ? (
                <p className="err">
                  <span>&#9888;</span>
                  <span>{error}</span>
                </p>
              ) : null}
              <button
                type="button"
                className="btn btn--go btn--wide w100"
                disabled={busy}
                onClick={signIn}
              >
                {busy ? "Checking" : "Sign in"}{" "}
                <span className="arw">&#8594;</span>
              </button>
            </div>
          </main>
        </div>
      </>
    );
  }

  const live = recent.filter((r) => !r.revoked).length;

  return (
    <>
      <Seo title="Staff portal | Data-Lead Africa" noindex />
      <div className="lp">
        <LiveBackground />
        <main className="adm">
          <div className="adm__wrap">
            <header className="top">
              <div>
                <p className="eyebrow">
                  <i />
                  Staff &middot; assessment portal
                </p>
                <h1 className="h1">
                  Portal <span>admin</span>
                </h1>
                <p className="sub">
                  Only for the rare bad day. No marking, no queue, no daily use.
                </p>
              </div>
              <div className="tally">
                <div className="tile glass">
                  <b>{live}</b>
                  <small>Live recently</small>
                </div>
                <div className="tile glass">
                  <b>7</b>
                  <small>Sections</small>
                </div>
                <div className="tile glass tile--hi">
                  <b>213</b>
                  <small>Questions</small>
                </div>
              </div>
            </header>

            {notice ? <p className="asm__warn">{notice}</p> : null}

            <div className="adm__grid">
              <div className="adm__card glass brk adm__span">
                <h3>Participant passwords</h3>
                <p>
                  Participants sign in with their email and a password, so they
                  do not depend on an email code arriving. Generate passwords
                  here and share them in class or on WhatsApp. Each one is shown
                  once, when it is created, and cannot be looked up afterwards.
                </p>
                {summary ? (
                  <div className="pwd__stats">
                    <span>
                      <b>{summary.enrolled}</b> enrolled
                    </span>
                    <span>
                      <b>{summary.with_password}</b> have a password
                    </span>
                    <span>
                      <b>
                        {Math.max(
                          0,
                          summary.enrolled -
                            summary.with_password -
                            summary.without_email,
                        )}
                      </b>{" "}
                      still to issue
                    </span>
                    {summary.without_email > 0 ? (
                      <span>
                        <b>{summary.without_email}</b> have no email, so cannot
                        use a password
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="adm__row">
                  <button
                    type="button"
                    className="btn btn--go"
                    disabled={busy}
                    onClick={() => issueAll(true)}
                  >
                    Generate for everyone without one{" "}
                    <span className="arw">&#8594;</span>
                  </button>
                  <button
                    type="button"
                    className="btn adm__danger"
                    disabled={busy}
                    onClick={() => issueAll(false)}
                  >
                    Replace everyone&rsquo;s
                  </button>
                </div>

                {issued.length > 0 ? (
                  <>
                    <p className="pwd__warn" style={{ marginTop: "1.2rem" }}>
                      These {issued.length} passwords will not be shown again.
                      Download the list before you leave this page.
                    </p>
                    <div className="adm__row" style={{ marginBottom: "1rem" }}>
                      <button
                        type="button"
                        className="btn btn--go"
                        onClick={() => downloadCsv(issued)}
                      >
                        Download as spreadsheet
                      </button>
                    </div>
                    <table className="adm__table">
                      <thead>
                        <tr>
                          <th>Participant</th>
                          <th>Email</th>
                          <th>Password</th>
                        </tr>
                      </thead>
                      <tbody>
                        {issued.map((r) => (
                          <tr key={r.email}>
                            <td data-label="Participant">{r.full_name}</td>
                            <td data-label="Email">{r.email}</td>
                            <td data-label="Password" className="pwd__pass">
                              {r.password}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : null}
              </div>

              <div className="adm__card glass">
                <h3>Reset one password</h3>
                <p>
                  For someone who has forgotten theirs, or is locked out after
                  five wrong attempts. Issues a new password and unlocks the
                  account. Their old password stops working.
                </p>
                <label className="lbl">Participant email</label>
                <input
                  className="inp"
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    setResetResult(null);
                  }}
                />
                <button
                  type="button"
                  className="btn btn--go"
                  disabled={busy}
                  onClick={resetOne}
                >
                  Issue new password <span className="arw">&#8594;</span>
                </button>
                {resetResult ? (
                  <div className="pwd__one">
                    <p className="pwd__oneLbl">
                      New password for {resetResult.name}
                    </p>
                    <p className="pwd__oneVal">{resetResult.password}</p>
                  </div>
                ) : null}
              </div>

              <div className="adm__card glass">
                <h3>Reopen a section</h3>
                <p>
                  Revoking a certificate leaves the participant locked out of
                  that section, because the system thinks they have already
                  passed it. This lets them sit it again. It refuses to run
                  while the certificate is still live, so revoke first.
                </p>
                <label className="lbl">Participant email</label>
                <input
                  className="inp"
                  value={reopenEmail}
                  onChange={(e) => setReopenEmail(e.target.value)}
                />
                <label className="lbl">Section</label>
                <input
                  className="inp"
                  placeholder="excel, sql, stata, python, power-bi, qualitative-analysis, kobo-toolbox"
                  value={reopenSection}
                  onChange={(e) => setReopenSection(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn--go"
                  disabled={busy}
                  onClick={reopen}
                >
                  Reopen <span className="arw">&#8594;</span>
                </button>
              </div>

              <div className="adm__card glass">
                <h3>Fix a name</h3>
                <p>
                  A participant cannot edit their own name, or a certificate
                  would be worth nothing. Correcting it here updates every
                  certificate they hold at once.
                </p>
                <label className="lbl">Participant email</label>
                <input
                  className="inp"
                  value={renameEmail}
                  onChange={(e) => setRenameEmail(e.target.value)}
                />
                <label className="lbl">Correct full name</label>
                <input
                  className="inp"
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn--go"
                  disabled={busy}
                  onClick={rename}
                >
                  Save name <span className="arw">&#8594;</span>
                </button>
              </div>

              <div className="adm__card glass adm__span">
                <h3>Recent certificates</h3>
                <p>
                  Anything issued lately, including automatically when a
                  participant passed. A wrong answer key shows up here as a
                  sudden cluster of passes on one section, which is the quickest
                  way to spot it. Enrolling someone is still done on the
                  certificates console.
                </p>
                {recent.length === 0 ? (
                  <p className="modMeta">Nothing issued yet.</p>
                ) : (
                  <table className="adm__table">
                    <thead>
                      <tr>
                        <th>Number</th>
                        <th>Participant</th>
                        <th>Section</th>
                        <th>Completed</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((r) => (
                        <tr key={r.certificate_number}>
                          <td data-label="Number" className="adm__no">
                            {r.certificate_number}
                          </td>
                          <td data-label="Participant">{r.full_name}</td>
                          <td data-label="Section">
                            {r.module_title || r.programme_title}
                          </td>
                          <td data-label="Completed">
                            {prettyDate(r.completed_on)}
                          </td>
                          <td>
                            {r.revoked ? (
                              <button
                                type="button"
                                className="btn"
                                onClick={() => restore(r.certificate_number)}
                              >
                                Restore
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn adm__danger"
                                onClick={() => revoke(r.certificate_number)}
                              >
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="strips">
              <div className="strip glass">
                <h3>Signed in on a shared computer?</h3>
                <p>
                  Your session ends when you close this tab, but sign out if you
                  are stepping away.
                </p>
                <button type="button" className="btn" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
