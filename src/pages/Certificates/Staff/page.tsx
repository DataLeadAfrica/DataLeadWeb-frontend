import { useCallback, useEffect, useState } from "react";

import "./page.css";
import Seo from "../../../components/Seo/component";
import { certDb, prettyDate } from "../../../lib/certificates";
import { isConfigured } from "../../../lib/certificateConfig";

const TOKEN_KEY = "dla_staff_token";

type Programme = {
  slug: string;
  title: string;
  code: string;
  template_key: string;
  module_count: number;
};
type Module = { slug: string; title: string; code: string; week_number: number | null };
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

export default function StaffCertificates() {
  const [token, setToken] = useState<string>("");
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [recent, setRecent] = useState<Issued[]>([]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [progSlug, setProgSlug] = useState("");
  const [modSlug, setModSlug] = useState("");
  const [completedOn, setCompletedOn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [issuedBy, setIssuedBy] = useState("");

  // Kept only for this browser tab, so closing the tab signs you out.
  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved) setToken(saved);
  }, []);

  const loadLists = useCallback(async (t: string) => {
    if (!certDb) return;
    const [p, r] = await Promise.all([
      certDb.rpc("staff_programmes", { p_token: t }),
      certDb.rpc("staff_recent_certificates", { p_token: t, p_limit: 25 }),
    ]);
    setProgrammes((p.data as Programme[]) || []);
    setRecent((r.data as Issued[]) || []);
  }, []);

  useEffect(() => {
    if (token) loadLists(token);
  }, [token, loadLists]);

  useEffect(() => {
    async function run() {
      if (!certDb || !token || !progSlug) {
        setModules([]);
        return;
      }
      const { data } = await certDb.rpc("staff_modules", {
        p_token: token,
        p_programme_slug: progSlug,
      });
      setModules((data as Module[]) || []);
      setModSlug("");
    }
    run();
  }, [token, progSlug]);

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
    setProgrammes([]);
    setRecent([]);
  }

  async function issue() {
    if (!certDb) return;
    setError("");
    setNotice("");
    if (!fullName.trim()) {
      setError("A full name is required.");
      return;
    }
    if (!progSlug) {
      setError("Choose a programme.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Enter an email address or a phone number.");
      return;
    }
    setBusy(true);
    const { data, error: err } = await certDb.rpc("staff_issue_certificate", {
      p_token: token,
      p_full_name: fullName,
      p_email: email,
      p_phone: phone,
      p_programme_slug: progSlug,
      p_module_slug: modSlug || null,
      p_completed_on: completedOn,
      p_issued_by: issuedBy || null,
    });
    setBusy(false);
    if (err) {
      setError("Something went wrong. Please try again.");
      return;
    }
    const row = (data as Array<{
      certificate_number: string | null;
      message: string;
      already_existed: boolean;
    }>)?.[0];
    if (!row || !row.certificate_number) {
      setError(row?.message || "Could not issue the certificate.");
      return;
    }
    setNotice(
      `${row.already_existed ? "Already issued" : "Issued"}: ${row.certificate_number} for ${fullName}`,
    );
    setFullName("");
    setEmail("");
    setPhone("");
    await loadLists(token);
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
    await loadLists(token);
  }

  async function restore(num: string) {
    if (!certDb) return;
    const { data } = await certDb.rpc("staff_restore_certificate", {
      p_token: token,
      p_number: num,
    });
    setNotice(String(data || ""));
    await loadLists(token);
  }

  if (!isConfigured) {
    return (
      <main className="sc">
        <Seo title="Staff certificates | Data-Lead Africa" noindex />
        <div className="sc__wrap">
          <h1 className="sc__h1">Not connected yet</h1>
          <p className="sc__sub">
            The certificate database has not been connected, so this console
            cannot be used yet.
          </p>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="sc">
        <Seo title="Staff certificates | Data-Lead Africa" noindex />
        <div className="sc__wrap sc__wrap--narrow">
          <h1 className="sc__h1">Staff sign in</h1>
          <p className="sc__sub">
            This page is for Data-Lead Africa staff. Enter the shared passcode
            to issue certificates.
          </p>
          <div className="sc__card">
            <label className="sc__label" htmlFor="pc">
              Shared passcode
            </label>
            <input
              id="pc"
              className="sc__input"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()}
              autoComplete="current-password"
            />
            {error && <p className="sc__error">{error}</p>}
            <button className="sc__btn" onClick={signIn} disabled={busy}>
              {busy ? "Checking..." : "Sign in"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const chosen = programmes.find((p) => p.slug === progSlug);

  return (
    <main className="sc">
      <Seo title="Staff certificates | Data-Lead Africa" noindex />
      <div className="sc__wrap">
        <div className="sc__top">
          <h1 className="sc__h1">Issue a certificate</h1>
          <button className="sc__btn sc__btn--ghost" onClick={signOut}>
            Sign out
          </button>
        </div>

        {notice && <p className="sc__notice">{notice}</p>}
        {error && <p className="sc__error">{error}</p>}

        <div className="sc__card">
          <div className="sc__grid">
            <div className="sc__field">
              <label className="sc__label" htmlFor="fn">
                Full name, exactly as it should print
              </label>
              <input
                id="fn"
                className="sc__input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="sc__field">
              <label className="sc__label" htmlFor="em">
                Email address
              </label>
              <input
                id="em"
                className="sc__input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="sc__hint">
                Needed for the participant to claim the certificate themselves.
              </p>
            </div>
            <div className="sc__field">
              <label className="sc__label" htmlFor="ph">
                Phone number
              </label>
              <input
                id="ph"
                className="sc__input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="sc__hint">Use this when there is no email on record.</p>
            </div>
            <div className="sc__field">
              <label className="sc__label" htmlFor="pr">
                Programme
              </label>
              <select
                id="pr"
                className="sc__input"
                value={progSlug}
                onChange={(e) => setProgSlug(e.target.value)}
              >
                <option value="">Choose a programme</option>
                {programmes.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            {chosen && chosen.module_count > 0 && (
              <div className="sc__field">
                <label className="sc__label" htmlFor="mo">
                  Weekly tool certificate
                </label>
                <select
                  id="mo"
                  className="sc__input"
                  value={modSlug}
                  onChange={(e) => setModSlug(e.target.value)}
                >
                  <option value="">
                    Whole programme (the full bootcamp certificate)
                  </option>
                  {modules.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.week_number ? `Week ${m.week_number}: ` : ""}
                      {m.title}
                    </option>
                  ))}
                </select>
                <p className="sc__hint">
                  Leave as whole programme unless this is a single tool.
                </p>
              </div>
            )}
            <div className="sc__field">
              <label className="sc__label" htmlFor="co">
                Completion date
              </label>
              <input
                id="co"
                className="sc__input"
                type="date"
                value={completedOn}
                onChange={(e) => setCompletedOn(e.target.value)}
              />
            </div>
            <div className="sc__field">
              <label className="sc__label" htmlFor="ib">
                Issued by
              </label>
              <input
                id="ib"
                className="sc__input"
                value={issuedBy}
                onChange={(e) => setIssuedBy(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>
          <button className="sc__btn" onClick={issue} disabled={busy}>
            {busy ? "Working..." : "Issue certificate"}
          </button>
        </div>

        <h2 className="sc__h2">Recently issued</h2>
        {recent.length === 0 ? (
          <p className="sc__sub">Nothing issued yet.</p>
        ) : (
          <div className="sc__tablewrap">
            <table className="sc__table">
              <thead>
                <tr>
                  <th>Certificate</th>
                  <th>Name</th>
                  <th>For</th>
                  <th>Completed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr
                    key={r.certificate_number}
                    className={r.revoked ? "sc__row--revoked" : ""}
                  >
                    <td className="sc__mono">{r.certificate_number}</td>
                    <td>{r.full_name}</td>
                    <td>
                      {r.module_title
                        ? `${r.week_number ? `Week ${r.week_number}: ` : ""}${r.module_title}`
                        : r.programme_title}
                    </td>
                    <td>{prettyDate(r.completed_on)}</td>
                    <td>
                      {r.revoked ? (
                        <button
                          className="sc__link"
                          onClick={() => restore(r.certificate_number)}
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          className="sc__link"
                          onClick={() => revoke(r.certificate_number)}
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
    </main>
  );
}
