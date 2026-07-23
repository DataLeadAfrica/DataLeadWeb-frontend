import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import "./page.css";
import Seo from "../../../components/Seo/component";
import { routes } from "../../routes";
import {
  requestCode,
  verifyCode,
  certificateTitle,
  prettyDate,
  addToLinkedInUrl,
  type Certificate,
} from "../../../lib/certificates";
import {
  renderCertificate,
  downloadCanvasPng,
  printCanvas,
} from "../../../lib/certificateRenderer";
import {
  isConfigured,
  SITE,
  HASHTAG,
  HANDLES,
  LINKEDIN_ORGANIZATION_ID,
} from "../../../lib/certificateConfig";

type Step = "email" | "code" | "done";

export default function ClaimCertificate() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);

  const current = certs[active];

  useEffect(() => {
    if (step !== "done" || !current || !canvasRef.current) return;
    renderCertificate(canvasRef.current, current).catch(() =>
      setError("The certificate image could not be drawn. Please refresh."),
    );
  }, [step, active, current]);

  async function onSendCode() {
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await requestCode(clean);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setStep("code");
    window.setTimeout(() => boxRefs.current[0]?.focus(), 50);
  }

  async function onVerify() {
    const code = digits.join("");
    if (code.length !== 6) {
      setError("Enter all six digits.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await verifyCode(email, code);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setCerts(res.certificates);
    setActive(0);
    setStep("done");
  }

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "").slice(0, 1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) boxRefs.current[i + 1]?.focus();
  }

  const verifyUrl = current ? `${SITE}/verify/${current.certificate_number}` : "";

  function caption(handle: string) {
    if (!current) return "";
    return (
      `I have completed the ${certificateTitle(current)} with ${handle}. ` +
      `You can verify my certificate here: ${verifyUrl} ${HASHTAG}`
    );
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption(HANDLES.linkedin));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Please select the text and copy it manually.");
    }
  }

  const enc = encodeURIComponent;

  if (!isConfigured) {
    return (
      <main className="claim">
        <Seo
          title="Get your certificate | Data-Lead Africa"
          description="Data-Lead Africa participants can download and verify their training certificates."
        />
        <div className="claim__wrap">
          <h1 className="claim__h1">Certificates are coming soon</h1>
          <p className="claim__sub">
            We are putting the finishing touches to our digital certificate
            portal. If you have completed a programme with us and need your
            certificate today, please{" "}
            <Link to={routes.contactUs}>contact us</Link> and we will send it to
            you.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="claim">
      <Seo
        title="Get your certificate | Data-Lead Africa"
        description="Data-Lead Africa participants can sign in to download, print and share their verified training certificates."
      />
      <div className="claim__wrap">
        {step === "email" && (
          <>
            <h1 className="claim__h1">Get your certificate</h1>
            <p className="claim__sub">
              Enter the email address you registered with. We will send you a
              6-digit code to confirm it is you.
            </p>
            <div className="claim__card">
              <label className="claim__label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                className="claim__input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSendCode()}
                placeholder="you@example.com"
              />
              <p className="claim__hint">
                We send a code so that nobody else can pull up your certificate.
              </p>
              {error && <p className="claim__error">{error}</p>}
              <button className="claim__btn" onClick={onSendCode} disabled={busy}>
                {busy ? "Sending..." : "Send my code"}
              </button>
            </div>
          </>
        )}

        {step === "code" && (
          <>
            <h1 className="claim__h1">Enter your code</h1>
            <p className="claim__sub">
              If <b>{email}</b> is on our records, a 6-digit code is on its way.
              It expires in 10 minutes.
            </p>
            <div className="claim__card">
              <label className="claim__label">6-digit code</label>
              <div className="claim__otp">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      boxRefs.current[i] = el;
                    }}
                    className="claim__otpbox"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !digits[i] && i > 0)
                        boxRefs.current[i - 1]?.focus();
                      if (e.key === "Enter") onVerify();
                    }}
                  />
                ))}
              </div>
              {error && <p className="claim__error">{error}</p>}
              <div className="claim__row">
                <button className="claim__btn" onClick={onVerify} disabled={busy}>
                  {busy ? "Checking..." : "Verify"}
                </button>
                <button
                  className="claim__btn claim__btn--ghost"
                  onClick={() => {
                    setStep("email");
                    setError("");
                    setDigits(["", "", "", "", "", ""]);
                  }}
                >
                  Use a different email
                </button>
              </div>
            </div>
          </>
        )}

        {step === "done" && current && (
          <>
            <h1 className="claim__h1">
              Congratulations, {current.full_name.split(" ")[0]}
            </h1>
            <p className="claim__sub">
              {certs.length > 1
                ? `You have ${certs.length} certificates. Choose one to download or share.`
                : "Your certificate is ready. Download it, or share it."}
            </p>

            {certs.length > 1 && (
              <div className="claim__tabs">
                {certs.map((c, i) => (
                  <button
                    key={c.certificate_number}
                    className={
                      "claim__tab" + (i === active ? " claim__tab--on" : "")
                    }
                    onClick={() => setActive(i)}
                  >
                    {c.is_module && c.week_number ? `Week ${c.week_number}: ` : ""}
                    {certificateTitle(c)}
                  </button>
                ))}
              </div>
            )}

            <div className="claim__certshell">
              <canvas ref={canvasRef} className="claim__canvas" />
            </div>

            <div className="claim__meta">
              <span>
                Certificate number <b>{current.certificate_number}</b>
              </span>
              <span>
                Completed <b>{prettyDate(current.completed_on)}</b>
              </span>
              <span>
                Status <b className="claim__valid">Valid</b>
              </span>
            </div>

            <p className="claim__verify">
              Anyone can check this certificate at <b>{verifyUrl}</b>
            </p>

            <div className="claim__row">
              <button
                className="claim__btn"
                onClick={() =>
                  canvasRef.current &&
                  downloadCanvasPng(canvasRef.current, current.certificate_number)
                }
              >
                Download PNG
              </button>
              <button
                className="claim__btn claim__btn--ghost"
                onClick={() =>
                  canvasRef.current &&
                  printCanvas(canvasRef.current, current.certificate_number)
                }
              >
                Download PDF
              </button>
            </div>

            <section className="claim__share">
              <h2 className="claim__h2">Share your achievement</h2>
              <div className="claim__sbtns">
                <a
                  className="claim__s"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://twitter.com/intent/tweet?text=${enc(caption(HANDLES.x))}`}
                >
                  X
                </a>
                <a
                  className="claim__s"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://wa.me/?text=${enc(caption(HANDLES.x))}`}
                >
                  WhatsApp
                </a>
                <a
                  className="claim__s"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(verifyUrl)}`}
                >
                  LinkedIn
                </a>
                <a
                  className="claim__s"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://www.facebook.com/sharer/sharer.php?u=${enc(verifyUrl)}`}
                >
                  Facebook
                </a>
                <button className="claim__s" onClick={copyCaption}>
                  {copied ? "Caption copied" : "Copy caption"}
                </button>
              </div>

              <div className="claim__addli">
                <a
                  className="claim__btn claim__addli__btn"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={addToLinkedInUrl(
                    current,
                    LINKEDIN_ORGANIZATION_ID,
                    verifyUrl,
                  )}
                >
                  Add to my LinkedIn profile
                </a>
                <p className="claim__addli__note">
                  This adds the certificate to the Licenses and Certifications
                  section of your profile, where it stays permanently.
                </p>
              </div>
              <div className="claim__captionbox">
                <span className="claim__caplabel">Your caption</span>
                <textarea
                  className="claim__caption"
                  readOnly
                  value={caption(HANDLES.linkedin)}
                />
              </div>
            </section>

            {current.course_url && (
              <p className="claim__more">
                Want to go further?{" "}
                <Link to={current.course_url}>
                  See the full {current.programme_title}
                </Link>
                , or <Link to={routes.courses}>browse all our programmes</Link>.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
