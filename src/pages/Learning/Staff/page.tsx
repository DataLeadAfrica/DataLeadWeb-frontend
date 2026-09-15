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
              <div className="adm__card glass brk">
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
                          <td className="adm__no">{r.certificate_number}</td>
                          <td>{r.full_name}</td>
                          <td>{r.module_title || r.programme_title}</td>
                          <td>{prettyDate(r.completed_on)}</td>
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
