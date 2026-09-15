import { useCallback, useEffect, useState } from "react";

import Seo from "../../../components/Seo/component";
import { certDb, prettyDate } from "../../../lib/certificates";
import { isConfigured } from "../../../lib/certificateConfig";
import LiveBackground from "../LiveBackground";
import "../portal.css";

// Staff console for the assessment portal. No marking and no queue. It
// exists for the things that cannot be done by a participant or by the
// system itself: enrolling people, reopening a section, fixing a name, and
// withdrawing or restoring a certificate.
//
// Enrolling never issues a certificate. It calls staff_enrol_participant,
// which creates the participant if the email is new and opens every active
// section of the chosen programme to them. Certificates are only issued
// when a participant passes an assessment.
//
// It shares the passcode and the session key with /staff/certificates, so
// signing in to one signs you in to the other.

const TOKEN_KEY = "dla_staff_token";

type Programme = {
  slug: string;
  title: string;
  module_count: number;
};

type Enrolled = {
  enrolmentId: string;
  fullName: string;
  email: string;
  programmeTitle: string;
  wasNew: boolean;
  withdrawn: boolean;
};

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

  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [enName, setEnName] = useState("");
  const [enEmail, setEnEmail] = useState("");
  const [enPhone, setEnPhone] = useState("");
  const [enProg, setEnProg] = useState("");
  const [enError, setEnError] = useState("");
  const [enDone, setEnDone] = useState("");
  const [enrolled, setEnrolled] = useState<Enrolled[]>([]);

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

  const loadProgrammes = useCallback(async (t: string) => {
    if (!certDb) return;
    const { data } = await certDb.rpc("staff_programmes", { p_token: t });
    const list = (data as Programme[]) || [];
    setProgrammes(list);
    // With only one programme there is nothing to choose, so pick it.
    if (list.length === 1) setEnProg(list[0].slug);
  }, []);

  useEffect(() => {
    if (token) {
      loadRecent(token);
      loadProgrammes(token);
    }
  }, [token, loadRecent, loadProgrammes]);

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
    setProgrammes([]);
    setEnrolled([]);
  }

  async function enrol() {
    if (!certDb) return;
    setEnError("");
    setEnDone("");
    const name = enName.trim().replace(/\s+/g, " ");
    const mail = enEmail.trim().toLowerCase();
    if (!name) {
      setEnError("Enter the participant's full name.");
      return;
    }
    if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setEnError(
        "Enter a valid email address. It is how the participant signs in.",
      );
      return;
    }
    if (!enProg) {
      setEnError("Choose a programme.");
      return;
    }
    setBusy(true);
    const { data, error: err } = await certDb.rpc("staff_enrol_participant", {
      p_token: token,
      p_full_name: name,
      p_email: mail,
      p_phone: enPhone.trim() || null,
      p_programme_slug: enProg,
      p_cohort: "default",
      p_starts_on: null,
    });
    setBusy(false);
    if (err) {
      setEnError("Could not reach the database. Please try again.");
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { enrolment_id: string; was_new: boolean }
      | undefined;
    if (!row || !row.enrolment_id) {
      // The database is quiet about why. These are the only causes.
      setEnError(
        "Not enrolled. Your staff session may have expired (sign out and sign in again), or the programme is no longer active.",
      );
      return;
    }
    const prog = programmes.find((p) => p.slug === enProg);
    setEnrolled((list) => [
      {
        enrolmentId: row.enrolment_id,
        fullName: name,
        email: mail,
        programmeTitle: prog ? prog.title : enProg,
        wasNew: Boolean(row.was_new),
        withdrawn: false,
      },
      ...list.filter((e) => e.enrolmentId !== row.enrolment_id),
    ]);
    setEnDone(
      row.was_new
        ? `Enrolled ${name}. They can now sign in at dataleadafrica.com/my-learning with ${mail}.`
        : `${mail} was already registered. Their enrolment on this programme is now active. The name on record was updated to ${name}.`,
    );
    setEnName("");
    setEnEmail("");
    setEnPhone("");
  }

  async function setEnrolmentStatus(
    id: string,
    status: "withdrawn" | "active",
  ) {
    if (!certDb) return;
    if (
      status === "withdrawn" &&
      !window.confirm(
        "Withdraw this enrolment? The participant will no longer see these sections. You can undo this.",
      )
    ) {
      return;
    }
    const { data } = await certDb.rpc("staff_set_enrolment_status", {
      p_token: token,
      p_enrolment: id,
      p_status: status,
    });
    if (!data) {
      setEnError(
        "That change was not saved. Sign out and sign in again, then retry.",
      );
      return;
    }
    setEnrolled((list) =>
      list.map((e) =>
        e.enrolmentId === id ? { ...e, withdrawn: status === "withdrawn" } : e,
      ),
    );
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
                  Enrol participants here. The other tools are for the rare bad
                  day. There is no marking and no queue.
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
                <h3>Enrol a participant</h3>
                <p>
                  Opens every section of the programme to this person. No
                  certificate is issued: that only happens when they pass. Type
                  the name exactly as it should appear on their certificates.
                </p>
                <label className="lbl" htmlFor="en-name">
                  Full name
                </label>
                <input
                  id="en-name"
                  className="inp"
                  value={enName}
                  disabled={busy}
                  onChange={(e) => setEnName(e.target.value)}
                />
                <label className="lbl" htmlFor="en-email">
                  Email (used to sign in)
                </label>
                <input
                  id="en-email"
                  className="inp"
                  type="email"
                  value={enEmail}
                  disabled={busy}
                  onChange={(e) => setEnEmail(e.target.value)}
                />
                <label className="lbl" htmlFor="en-phone">
                  Phone (optional)
                </label>
                <input
                  id="en-phone"
                  className="inp"
                  type="tel"
                  value={enPhone}
                  disabled={busy}
                  onChange={(e) => setEnPhone(e.target.value)}
                />
                <label className="lbl" htmlFor="en-prog">
                  Programme
                </label>
                <select
                  id="en-prog"
                  className="inp"
                  value={enProg}
                  disabled={busy}
                  onChange={(e) => setEnProg(e.target.value)}
                >
                  <option value="">
                    {programmes.length
                      ? "Choose a programme"
                      : "Loading programmes"}
                  </option>
                  {programmes.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.title}
                      {p.module_count ? ` (${p.module_count} sections)` : ""}
                    </option>
                  ))}
                </select>
                {enError ? (
                  <p className="err">
                    <span>&#9888;</span>
                    <span>{enError}</span>
                  </p>
                ) : null}
                {enDone ? <p className="asm__warn">{enDone}</p> : null}
                <button
                  type="button"
                  className="btn btn--go"
                  disabled={busy}
                  onClick={enrol}
                >
                  {busy ? "Working" : "Enrol"}{" "}
                  <span className="arw">&#8594;</span>
                </button>
              </div>

              <div className="adm__card glass">
                <h3>Enrolled in this session</h3>
                <p>
                  People you enrolled since signing in. If you made a mistake,
                  withdraw the enrolment, then enrol again with the right
                  details. To correct only a name, use Fix a name below. This
                  list clears when you close the tab.
                </p>
                {enrolled.length === 0 ? (
                  <p className="modMeta">Nobody yet.</p>
                ) : (
                  <div className="adm__scroll">
                    <table className="adm__table">
                      <thead>
                        <tr>
                          <th>Participant</th>
                          <th>Programme</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {enrolled.map((e) => (
                          <tr key={e.enrolmentId}>
                            <td>
                              {e.fullName}
                              <br />
                              <span className="modMeta">
                                {e.email}
                                {e.wasNew ? "" : " (existing)"}
                              </span>
                            </td>
                            <td>
                              {e.programmeTitle}
                              {e.withdrawn ? " (withdrawn)" : ""}
                            </td>
                            <td>
                              {e.withdrawn ? (
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() =>
                                    setEnrolmentStatus(e.enrolmentId, "active")
                                  }
                                >
                                  Undo
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn adm__danger"
                                  onClick={() =>
                                    setEnrolmentStatus(
                                      e.enrolmentId,
                                      "withdrawn",
                                    )
                                  }
                                >
                                  Withdraw
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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

              <div className="adm__card glass brk">
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
                  way to spot it.
                </p>
                {recent.length === 0 ? (
                  <p className="modMeta">Nothing issued yet.</p>
                ) : (
                  <div className="adm__scroll">
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
                  </div>
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
