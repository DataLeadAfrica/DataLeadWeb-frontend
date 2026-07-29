import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import qrcode from "qrcode-generator";

import "./page.css";
import Seo from "../../../components/Seo/component";
import { routes } from "../../routes";
import {
  verifyNumber,
  prettyDate,
  type Certificate,
  type VerifyResult,
} from "../../../lib/certificates";
import {
  renderCertificate,
  downloadCanvasPng,
  printCanvas,
} from "../../../lib/certificateRenderer";
import { isConfigured, SITE, TEMPLATES } from "../../../lib/certificateConfig";

type State = "loading" | "valid" | "revoked" | "notfound" | "offline";

// The public verification lookup does not return the programme's template_key,
// so fall back to the programme slug when a template of that name exists. That
// is how "giz-remote-work" finds its own artwork. Anything with no matching
// template falls through to the standard Data-Lead Africa design, which is what
// the renderer would have chosen anyway.
function templateFor(row: VerifyResult): string | undefined {
  if (row.template_key) return row.template_key;
  const slug = row.programme_slug || "";
  return TEMPLATES[slug] ? slug : undefined;
}

export default function ShowcaseCertificate() {
  const { number } = useParams();
  const [state, setState] = useState<State>("loading");
  const [row, setRow] = useState<VerifyResult | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const certNumber = number || "";
  const verifyPath = routes.verifyCertificate.replace(":number", certNumber);
  const verifyUrl = `${SITE}${verifyPath}`;

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isConfigured) {
        setState("offline");
        return;
      }
      const res = await verifyNumber(certNumber);
      if (cancelled) return;
      if (!res || !res.found) {
        setState("notfound");
        return;
      }
      setRow(res);
      setState(res.revoked ? "revoked" : "valid");
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [certNumber]);

  // Rebuild the same shape the renderer already knows how to draw.
  const cert: Certificate | null = useMemo(() => {
    if (!row || !row.found) return null;
    return {
      certificate_number: certNumber,
      full_name: row.full_name || "",
      programme_title: row.programme_title || "",
      programme_slug: row.programme_slug || "",
      module_title: row.module_title,
      module_slug: null,
      week_number: row.week_number,
      is_module: !!row.is_module,
      course_url: row.course_url,
      duration_text: row.duration_text,
      completed_on: row.completed_on || "",
      template_key: templateFor(row),
    };
  }, [row, certNumber]);

  useEffect(() => {
    if (state !== "valid" || !cert || !canvasRef.current) return;
    renderCertificate(canvasRef.current, cert).catch(() => {
      // A drawing failure must not blank the page. The details and the
      // verify button below are still useful on their own.
    });
  }, [state, cert]);

  // One <path> is far lighter than a thousand <rect> elements.
  const qr = useMemo(() => {
    if (!certNumber) return null;
    const q = qrcode(0, "M");
    q.addData(verifyUrl);
    q.make();
    const n = q.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      }
    }
    return { n, d };
  }, [certNumber, verifyUrl]);

  const title =
    row && row.is_module && row.module_title
      ? row.module_title
      : row?.programme_title || "";

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(`${SITE}/certificate/${certNumber}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="shc">
      <Seo
        title={
          state === "valid" && row
            ? `${row.full_name} | ${title} | Data-Lead Africa`
            : "Certificate | Data-Lead Africa"
        }
        description={
          state === "valid" && row
            ? `${row.full_name} completed the ${title} programme with Data-Lead Africa.`
            : "A Data-Lead Africa training certificate."
        }
      />

      <div className="shc__wrap">
        {state === "loading" && (
          <p className="shc__loading">Loading this certificate...</p>
        )}

        {state === "offline" && (
          <div className="shc__panel">
            <h1 className="shc__h1">Certificates are coming soon</h1>
            <p className="shc__text">
              Our certificate service is not live yet. Please{" "}
              <Link to={routes.contactUs}>contact us</Link> with the certificate
              number and we will confirm it by hand.
            </p>
          </div>
        )}

        {state === "notfound" && (
          <div className="shc__panel">
            <h1 className="shc__h1">We have no record of this certificate</h1>
            <p className="shc__text">
              No certificate matches the number <b>{certNumber}</b>. Please
              check for typing mistakes, or{" "}
              <Link to={routes.contactUs}>contact us</Link> if you believe it
              should be genuine.
            </p>
          </div>
        )}

        {state === "revoked" && (
          <div className="shc__panel">
            <h1 className="shc__h1">This certificate has been withdrawn</h1>
            <p className="shc__text">
              Certificate <b>{certNumber}</b> is no longer valid and should not
              be relied upon. Please{" "}
              <Link to={routes.contactUs}>contact us</Link> if you need more
              information.
            </p>
          </div>
        )}

        {state === "valid" && row && (
          <>
            <header className="shc__head">
              <p className="shc__eyebrow">Certificate of completion</p>
              <h1 className="shc__h1">{row.full_name}</h1>
              <p className="shc__sub">
                {title}
                {row.completed_on
                  ? ` \u00b7 completed ${prettyDate(row.completed_on)}`
                  : ""}
              </p>
            </header>

            <figure className="shc__figure">
              <canvas ref={canvasRef} className="shc__canvas" />
            </figure>

            <section className="shc__verify">
              <div className="shc__verifyText">
                <h2 className="shc__h2">Check that this is genuine</h2>
                <p className="shc__text">
                  Anyone can confirm this certificate against our records. Use
                  the button, or scan the code with a phone camera.
                </p>
                <Link className="shc__btn shc__btn--primary" to={verifyPath}>
                  Verify this certificate
                </Link>
                <p className="shc__number">
                  Certificate number <b>{certNumber}</b>
                </p>
              </div>

              {qr && (
                <div className="shc__qrBox">
                  <svg
                    className="shc__qr"
                    viewBox={`0 0 ${qr.n} ${qr.n}`}
                    role="img"
                    aria-label="QR code linking to the verification page"
                  >
                    <rect width={qr.n} height={qr.n} fill="#ffffff" />
                    <path d={qr.d} fill="#111111" />
                  </svg>
                  <span className="shc__qrCaption">Scan to verify</span>
                </div>
              )}
            </section>

            <section className="shc__actions">
              <button
                type="button"
                className="shc__btn"
                onClick={() =>
                  canvasRef.current &&
                  downloadCanvasPng(canvasRef.current, certNumber)
                }
              >
                Download image
              </button>
              <button
                type="button"
                className="shc__btn"
                onClick={() =>
                  canvasRef.current &&
                  printCanvas(canvasRef.current, certNumber)
                }
              >
                Print or save as PDF
              </button>
              <button type="button" className="shc__btn" onClick={onCopy}>
                {copied ? "Link copied" : "Copy link to this page"}
              </button>
            </section>

            <p className="shc__issuer">
              Issued by Data-Lead Africa, Abuja, Nigeria.{" "}
              <Link to={routes.courses}>Browse our programmes</Link>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
