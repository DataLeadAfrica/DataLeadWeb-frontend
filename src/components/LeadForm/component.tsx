import { useEffect, useMemo, useRef, useState } from "react";

import "./component.css";

import { BROCHURES, Brochure } from "./brochures";
import {
  COUNTRIES,
  NIGERIA_STATES,
  startOptionsFor,
  HEARD_OPTIONS,
} from "./data";

// ── Backend config (same account as the World Cup form) ──────────────
const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbw5Cfj1iNr_KfYciNl5Bdxr6cfeY_BK9-mtabjb3ueC21RAws3E76ZzdJxVxDksZW16Zg/exec";
const EMAILJS_SERVICE = "service_ortl1vg";
const EMAILJS_TEMPLATE = "template_2nrbioa";
const EMAILJS_PUBLIC = "6svlOkrevGHII2V8s";

type Msg = { type: "" | "ok" | "err"; text: string };

type LeadFormProps = {
  /** Programme name to pre-select in the dropdown (from the clicked card). */
  defaultProgramme?: string;
  /** Close the modal. */
  onClose: () => void;
};

function brochureFor(name: string): Brochure | null {
  return BROCHURES.find((x) => x.name === name) || null;
}

export default function LeadForm({ defaultProgramme, onClose }: LeadFormProps) {
  const [programme, setProgramme] = useState(defaultProgramme || "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [stateRes, setStateRes] = useState("");
  const [start, setStart] = useState("");
  const [heard, setHeard] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<Msg>({ type: "", text: "" });

  const comboRef = useRef<HTMLDivElement | null>(null);

  const dial = useMemo(() => {
    const c = COUNTRIES.find((x) => x.name === country);
    return c ? c.dial : "";
  }, [country]);

  // Initialise EmailJS + lock body scroll while the modal is open.
  useEffect(() => {
    try {
      const ej = (window as unknown as { emailjs?: any }).emailjs;
      if (ej) ej.init({ publicKey: EMAILJS_PUBLIC });
    } catch (e) {
      /* ignore */
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Close the country menu when clicking outside it.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    const list = q
      ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q))
      : COUNTRIES;
    return list.slice(0, 60);
  }, [countryQuery]);

  function pickCountry(name: string) {
    setCountry(name);
    setCountryQuery(name);
    setCountryOpen(false);
    if (name !== "Nigeria") setStateRes("");
  }

  function submit() {
    if (submitting) return;
    const em = email.trim();
    if (!programme) return setMsg({ type: "err", text: "Please choose a programme." });
    if (!firstName.trim() || !lastName.trim())
      return setMsg({ type: "err", text: "Please enter your first and last name." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))
      return setMsg({ type: "err", text: "Please enter a valid email address." });
    if (!phone.trim())
      return setMsg({ type: "err", text: "Please enter your phone number." });
    if (!country) return setMsg({ type: "err", text: "Please select your country." });
    if (country === "Nigeria" && !stateRes)
      return setMsg({ type: "err", text: "Please select your state of residence." });

    const b = brochureFor(programme);
    if (!b)
      return setMsg({
        type: "err",
        text: "Sorry, that brochure isn't available yet. Please pick another programme.",
      });
    const brochureLink = window.location.origin + "/brochures/" + b.file;
    const fullPhone = (dial ? dial + " " : "") + phone.trim();

    setSubmitting(true);
    setMsg({ type: "", text: "Sending your brochure…" });

    // 1) Save the lead to the Google Sheet (fire-and-forget).
    try {
      fetch(SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          programme,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: em,
          phone: fullPhone,
          country,
          state: stateRes,
          start,
          heardAboutUs: heard,
        }),
      }).catch(() => {});
    } catch (e) {
      /* ignore */
    }

    // 2) Email the brochure via EmailJS.
    const ej = (window as unknown as { emailjs?: any }).emailjs;
    if (!ej) {
      setMsg({
        type: "err",
        text: "Email service didn't load — please refresh and try again.",
      });
      setSubmitting(false);
      return;
    }
    ej.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
      to_email: em,
      to_name: firstName.trim(),
      programme,
      duration: b.duration,
      brochure_link: brochureLink,
    })
      .then(() => {
        setDone(true);
        setMsg({
          type: "ok",
          text: "Done! Your brochure is on its way to your inbox.",
        });
      })
      .catch(() => {
        setMsg({
          type: "err",
          text: "We saved your details but the email didn't send — please check your address and try again.",
        });
        setSubmitting(false);
      });
  }

  const brochureLinkNow = (() => {
    const b = brochureFor(programme);
    return b ? window.location.origin + "/brochures/" + b.file : "#";
  })();

  return (
    <div className="lf-overlay" onClick={onClose}>
      <div
        className="lf-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lf-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="lf-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {done ? (
          <div className="lf-success">
            <div className="lf-success__tick">✓</div>
            <h3 id="lf-title" className="lf-title">
              Check your inbox
            </h3>
            <p className="lf-sub">
              We've emailed your <b>{programme}</b> brochure to {email}. You can
              also open it right now:
            </p>
            <a
              className="lf-btn"
              href={brochureLinkNow}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open your brochure ↓
            </a>
            <button className="lf-textbtn" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <h3 id="lf-title" className="lf-title">
              Download your brochure
            </h3>
            <p className="lf-sub">
              Tell us where to send it and we'll email your brochure right away.
            </p>

            <div className="lf-field">
              <label className="lf-label" htmlFor="lf-programme">
                Programme of interest
              </label>
              <select
                id="lf-programme"
                className="lf-input"
                value={programme}
                onChange={(e) => {
                  setProgramme(e.target.value);
                  setStart("");
                }}
              >
                <option value="">— Select a programme —</option>
                {BROCHURES.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="lf-row">
              <div className="lf-field">
                <label className="lf-label" htmlFor="lf-first">
                  First name
                </label>
                <input
                  id="lf-first"
                  className="lf-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="lf-field">
                <label className="lf-label" htmlFor="lf-last">
                  Last name
                </label>
                <input
                  id="lf-last"
                  className="lf-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="lf-field">
              <label className="lf-label" htmlFor="lf-email">
                Email
              </label>
              <input
                id="lf-email"
                type="email"
                className="lf-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="lf-field" ref={comboRef}>
              <label className="lf-label" htmlFor="lf-country">
                Country
              </label>
              <div className="lf-combo">
                <input
                  id="lf-country"
                  className="lf-input"
                  value={countryQuery}
                  placeholder="Start typing…"
                  onChange={(e) => {
                    setCountryQuery(e.target.value);
                    setCountryOpen(true);
                    setCountry("");
                  }}
                  onFocus={() => setCountryOpen(true)}
                  autoComplete="off"
                />
                {countryOpen && (
                  <div className="lf-menu">
                    {filteredCountries.length === 0 ? (
                      <div className="lf-menu__empty">No match</div>
                    ) : (
                      filteredCountries.map((c) => (
                        <div
                          key={c.name}
                          className="lf-menu__item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickCountry(c.name);
                          }}
                        >
                          <span>{c.name}</span>
                          <span className="lf-menu__dial">{c.dial}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="lf-field">
              <label className="lf-label" htmlFor="lf-phone">
                Phone
              </label>
              <div className="lf-phone">
                <span className="lf-phone__dial">{dial || "—"}</span>
                <input
                  id="lf-phone"
                  type="tel"
                  className="lf-input lf-phone__num"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="phone number"
                  autoComplete="tel-national"
                />
              </div>
            </div>

            {country === "Nigeria" && (
              <div className="lf-field">
                <label className="lf-label" htmlFor="lf-state">
                  State of residence
                </label>
                <select
                  id="lf-state"
                  className="lf-input"
                  value={stateRes}
                  onChange={(e) => setStateRes(e.target.value)}
                >
                  <option value="">— Select a state —</option>
                  {NIGERIA_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="lf-field">
              <label className="lf-label" htmlFor="lf-start">
                How early do you want to start?
              </label>
              <select
                id="lf-start"
                className="lf-input"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              >
                <option value="">— Select one —</option>
                {startOptionsFor(programme).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="lf-field">
              <label className="lf-label" htmlFor="lf-heard">
                How did you hear about us? <span className="lf-opt">(optional)</span>
              </label>
              <select
                id="lf-heard"
                className="lf-input"
                value={heard}
                onChange={(e) => setHeard(e.target.value)}
              >
                <option value="">— Select one —</option>
                {HEARD_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {msg.text && <p className={"lf-msg lf-msg--" + (msg.type || "info")}>{msg.text}</p>}

            <button className="lf-btn lf-btn--block" onClick={submit} disabled={submitting}>
              {submitting ? "Sending…" : "Email me the brochure ↓"}
            </button>
            <p className="lf-fine">
              We'll only use your details to send your brochure and occasional
              programme updates.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
