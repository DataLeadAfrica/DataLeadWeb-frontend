import { useEffect, useMemo, useRef, useState } from "react";

import "../LeadForm/component.css"; // reuse the shared modal + field styles (lf-*)
import "./component.css"; // enrol-specific additions (ef-*)

import {
  COUNTRIES,
  NIGERIA_STATES,
  HEARD_OPTIONS,
  TIMEFRAME_OPTIONS,
} from "../LeadForm/data";
import { PAYMENTS, PAYSTACK_BASE, naira } from "./payments";

// ── Backend config ───────────────────────────────────────────────────
// TODO: paste the "Enrolments" Apps Script Web App URL here once created.
const SHEET_URL = "https://script.google.com/macros/s/AKfycbw8Pi0xqYpOBrIQc0VjADk1vU0hE2Tor1FikOw6CV3SS365WgLM55hfSJLrfPUeTJ3afQ/exec";

// Registration confirmation email (same EmailJS account as the brochure form).
const EMAILJS_SERVICE = "service_ortl1vg";
const EMAILJS_TEMPLATE = "enrollment_dla";
const EMAILJS_PUBLIC = "6svlOkrevGHII2V8s";

// Company bank-transfer details (shown on the payment step).
const BANK = {
  name: "Polaris Bank",
  account: "4091115879",
  holder: "DataLead Pace Africa",
};

type Plan = "full" | "installments" | "nysc";
type Msg = { type: "" | "ok" | "err"; text: string };

type EnrolFormProps = {
  /** Programme name to pre-select (from the clicked course card). */
  defaultProgramme?: string;
  /** The enrollable course names to list in the dropdown. */
  programmes: string[];
  onClose: () => void;
};

const GENDERS = ["Female", "Male", "Prefer not to say"];
const EDUCATION = [
  "Secondary school",
  "OND / NCE",
  "HND / Bachelor's",
  "Master's",
  "PhD",
  "Other",
];
const STATUSES = [
  "Student",
  "Employed",
  "Self-employed",
  "Job-seeking",
  "NYSC (serving)",
  "Other",
];
const FORMATS = ["Online", "Onsite", "Hybrid"];

export default function EnrolForm({
  defaultProgramme,
  programmes,
  onClose,
}: EnrolFormProps) {
  const [programme, setProgramme] = useState(defaultProgramme || "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [stateRes, setStateRes] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [education, setEducation] = useState("");
  const [status, setStatus] = useState("");
  const [format, setFormat] = useState("");
  const [cohort, setCohort] = useState("");
  const [plan, setPlan] = useState<Plan | "">("");
  const [why, setWhy] = useState("");
  const [heard, setHeard] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "registered" | "payment">("form");
  const [msg, setMsg] = useState<Msg>({ type: "", text: "" });

  const comboRef = useRef<HTMLDivElement | null>(null);

  const dial = useMemo(() => {
    const c = COUNTRIES.find((x) => x.name === country);
    return c ? c.dial : "";
  }, [country]);

  const pay = PAYMENTS[programme];

  // Which plans to offer for this programme (NYSC only when country is Nigeria).
  const planOptions = useMemo(() => {
    const out: { key: Plan; label: string }[] = [];
    if (!pay) return out;
    if (pay.full) out.push({ key: "full", label: `Full payment — ${naira(pay.full.amount)}` });
    if (pay.installments)
      out.push({
        key: "installments",
        label: `Installments — ${naira(pay.installments.total)} (${pay.installments.count} × ${naira(pay.installments.per)})`,
      });
    if (pay.nysc && country === "Nigeria")
      out.push({ key: "nysc", label: `NYSC discount — ${naira(pay.nysc.amount)}` });
    return out;
  }, [pay, country]);

  // If NYSC was chosen then the country changed away from Nigeria, clear it.
  useEffect(() => {
    if (plan === "nysc" && country !== "Nigeria") setPlan("");
  }, [country, plan]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    if (!country) return setMsg({ type: "err", text: "Please select your country." });
    if (!phone.trim())
      return setMsg({ type: "err", text: "Please enter your phone number." });
    if (country === "Nigeria" && !stateRes)
      return setMsg({ type: "err", text: "Please select your state of residence." });
    if (!cohort) return setMsg({ type: "err", text: "Please choose your preferred cohort." });
    if (!plan) return setMsg({ type: "err", text: "Please choose a payment plan." });

    const fullPhone = (dial ? dial + " " : "") + phone.trim();
    const amount =
      plan === "installments"
        ? pay?.installments?.total
        : plan === "nysc"
          ? pay?.nysc?.amount
          : pay?.full?.amount;

    setSubmitting(true);
    setMsg({ type: "", text: "Registering you…" });

    // Save the enrolment to the Google Sheet (fire-and-forget).
    try {
      fetch(SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          programme,
          plan,
          amount: amount || "",
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: em,
          phone: fullPhone,
          country,
          state: stateRes,
          gender,
          dob,
          education,
          status,
          format,
          cohort,
          why: why.trim(),
          heardAboutUs: heard,
        }),
      }).catch(() => {});
    } catch (e) {
      /* ignore */
    }

    // Email the prospective student a registration confirmation + how to pay.
    const slug =
      plan === "installments"
        ? pay?.installments?.paystack
        : plan === "nysc"
          ? pay?.nysc?.paystack
          : pay?.full?.paystack;
    const planText =
      plan === "installments"
        ? "Installments"
        : plan === "nysc"
          ? "NYSC discount"
          : "Full payment";
    try {
      const ej = (window as unknown as { emailjs?: any }).emailjs;
      if (ej) {
        ej.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
          to_email: em,
          to_name: firstName.trim(),
          programme,
          plan: planText,
          amount: amount ? naira(amount) : "",
          paystack_link: slug ? PAYSTACK_BASE + slug : "",
        }).catch(() => {});
      }
    } catch (e) {
      /* ignore */
    }

    // Show the "registration received" screen (payment is an optional next step).
    setStep("registered");
    setSubmitting(false);
  }

  // ── Derived values for the payment step ──
  const chosenAmount =
    plan === "installments"
      ? pay?.installments?.total
      : plan === "nysc"
        ? pay?.nysc?.amount
        : pay?.full?.amount;
  const chosenSlug =
    plan === "installments"
      ? pay?.installments?.paystack
      : plan === "nysc"
        ? pay?.nysc?.paystack
        : pay?.full?.paystack;
  const planLabel =
    plan === "installments"
      ? "Installments"
      : plan === "nysc"
        ? "NYSC discount"
        : "Full payment";

  return (
    <div className="lf-overlay" onClick={onClose}>
      <div
        className="lf-panel ef-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ef-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="lf-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {step === "payment" ? (
          /* ── PAYMENT STEP ── */
          <div className="ef-pay">
            <h3 id="ef-title" className="lf-title">
              Secure your seat
            </h3>
            <p className="lf-sub">
              We've received your details for <b>{programme}</b>. Complete your
              payment to secure your seat.
            </p>

            <div className="ef-summary">
              <div>
                <span>Programme</span>
                <b>{programme}</b>
              </div>
              <div>
                <span>Plan</span>
                <b>{planLabel}</b>
              </div>
              <div>
                <span>Amount</span>
                <b>{chosenAmount ? naira(chosenAmount) : "—"}</b>
              </div>
              {plan === "installments" && pay?.installments && (
                <div>
                  <span>Instalments</span>
                  <b>
                    {pay.installments.count} × {naira(pay.installments.per)}
                  </b>
                </div>
              )}
            </div>

            {plan === "nysc" && (
              <p className="ef-note">
                Please have your NYSC call-up letter or ID ready — it's checked at
                onboarding.
              </p>
            )}

            <div className="ef-paylabel">Pay online</div>
            {chosenSlug ? (
              <a
                className="lf-btn lf-btn--block"
                href={PAYSTACK_BASE + chosenSlug}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pay {chosenAmount ? naira(chosenAmount) : ""} with Paystack →
              </a>
            ) : (
              <p className="ef-soon">
                An online payment link for this option is coming soon. Please use
                bank transfer below — our team will also reach out to help.
              </p>
            )}

            <div className="ef-or">or</div>

            <div className="ef-paylabel">Pay by bank transfer</div>
            <div className="ef-bank">
              <div>
                <span>Bank</span>
                <b>{BANK.name}</b>
              </div>
              <div>
                <span>Account number</span>
                <b>{BANK.account}</b>
              </div>
              <div>
                <span>Account name</span>
                <b>{BANK.holder}</b>
              </div>
            </div>
            <p className="ef-note">
              After transferring, send your proof of payment to{" "}
              <a href="mailto:info@dataleadafrica.com">info@dataleadafrica.com</a>{" "}
              or WhatsApp us, and we'll confirm your seat.
            </p>

            <button className="lf-textbtn" onClick={onClose}>
              Done
            </button>
          </div>
        ) : step === "registered" ? (
          /* ── REGISTRATION RECEIVED ── */
          <div className="ef-pay">
            <div className="lf-success__tick">✓</div>
            <h3 id="ef-title" className="lf-title">
              Registration received
            </h3>
            <p className="lf-sub">
              Thanks {firstName || "there"} — we've received your registration for{" "}
              <b>{programme}</b>. Someone from Data-Lead Africa will reach out to you
              shortly to guide you through the next steps. We've also emailed the
              details to {email}.
            </p>
            <button
              className="lf-btn lf-btn--block"
              onClick={() => setStep("payment")}
            >
              Secure your seat — make payment →
            </button>
            <button className="lf-textbtn" onClick={onClose}>
              I'll pay later
            </button>
          </div>
        ) : (
          /* ── ENROL FORM ── */
          <>
            <h3 id="ef-title" className="lf-title">
              Enrol now
            </h3>
            <p className="lf-sub">
              Tell us about you and pick a payment plan. It only takes a minute.
            </p>

            <div className="lf-field">
              <label className="lf-label" htmlFor="ef-programme">
                Programme
              </label>
              <select
                id="ef-programme"
                className="lf-input"
                value={programme}
                onChange={(e) => {
                  setProgramme(e.target.value);
                  setPlan("");
                }}
              >
                <option value="">— Select a programme —</option>
                {programmes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="lf-row">
              <div className="lf-field">
                <label className="lf-label" htmlFor="ef-first">
                  First name
                </label>
                <input
                  id="ef-first"
                  className="lf-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="lf-field">
                <label className="lf-label" htmlFor="ef-last">
                  Last name
                </label>
                <input
                  id="ef-last"
                  className="lf-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="lf-field">
              <label className="lf-label" htmlFor="ef-email">
                Email
              </label>
              <input
                id="ef-email"
                type="email"
                className="lf-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="lf-field" ref={comboRef}>
              <label className="lf-label" htmlFor="ef-country">
                Country
              </label>
              <div className="lf-combo">
                <input
                  id="ef-country"
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
              <label className="lf-label" htmlFor="ef-phone">
                Phone
              </label>
              <div className="lf-phone">
                <span className="lf-phone__dial">{dial || "—"}</span>
                <input
                  id="ef-phone"
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
                <label className="lf-label" htmlFor="ef-state">
                  State of residence
                </label>
                <select
                  id="ef-state"
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

            <div className="lf-row">
              <div className="lf-field">
                <label className="lf-label" htmlFor="ef-gender">
                  Gender
                </label>
                <select
                  id="ef-gender"
                  className="lf-input"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lf-field">
                <label className="lf-label" htmlFor="ef-dob">
                  Date of birth
                </label>
                <input
                  id="ef-dob"
                  type="date"
                  className="lf-input"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>
            </div>

            <div className="lf-row">
              <div className="lf-field">
                <label className="lf-label" htmlFor="ef-education">
                  Highest education
                </label>
                <select
                  id="ef-education"
                  className="lf-input"
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {EDUCATION.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lf-field">
                <label className="lf-label" htmlFor="ef-status">
                  Current status
                </label>
                <select
                  id="ef-status"
                  className="lf-input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {STATUSES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="lf-row">
              <div className="lf-field">
                <label className="lf-label" htmlFor="ef-format">
                  Preferred format
                </label>
                <select
                  id="ef-format"
                  className="lf-input"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {FORMATS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lf-field">
                <label className="lf-label" htmlFor="ef-cohort">
                  When are you hoping to start?
                </label>
                <select
                  id="ef-cohort"
                  className="lf-input"
                  value={cohort}
                  onChange={(e) => setCohort(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {TIMEFRAME_OPTIONS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="lf-field">
              <label className="lf-label" htmlFor="ef-plan">
                Payment plan
              </label>
              <select
                id="ef-plan"
                className="lf-input"
                value={plan}
                onChange={(e) => setPlan(e.target.value as Plan)}
                disabled={!programme}
              >
                <option value="">
                  {programme ? "— Select a plan —" : "Pick a programme first"}
                </option>
                {planOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              {pay?.nysc && country && country !== "Nigeria" && (
                <p className="ef-hint">
                  The NYSC discount is available to learners in Nigeria.
                </p>
              )}
            </div>

            <div className="lf-field">
              <label className="lf-label" htmlFor="ef-why">
                Why are you interested in this programme?{" "}
                <span className="lf-opt">(optional)</span>
              </label>
              <textarea
                id="ef-why"
                className="lf-input ef-textarea"
                rows={3}
                value={why}
                onChange={(e) => setWhy(e.target.value)}
              />
            </div>

            <div className="lf-field">
              <label className="lf-label" htmlFor="ef-heard">
                How did you hear about us?{" "}
                <span className="lf-opt">(optional)</span>
              </label>
              <select
                id="ef-heard"
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

            {msg.text && (
              <p className={"lf-msg lf-msg--" + (msg.type || "info")}>{msg.text}</p>
            )}

            <button
              className="lf-btn lf-btn--block"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? "Registering…" : "Register →"}
            </button>
            <p className="lf-fine">
              We'll use your details to process your enrolment and keep you updated
              about your cohort.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
