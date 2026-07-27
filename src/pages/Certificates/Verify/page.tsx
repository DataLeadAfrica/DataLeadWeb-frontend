import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import "./page.css";
import Seo from "../../../components/Seo/component";
import { routes } from "../../routes";
import { verifyNumber, prettyDate, type VerifyResult } from "../../../lib/certificates";
import { isConfigured } from "../../../lib/certificateConfig";

type State = "loading" | "valid" | "revoked" | "notfound" | "offline";

export default function VerifyCertificate() {
  const { number } = useParams();
  const [state, setState] = useState<State>("loading");
  const [row, setRow] = useState<VerifyResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isConfigured) {
        setState("offline");
        return;
      }
      const res = await verifyNumber(number || "");
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
  }, [number]);

  const title =
    row && row.is_module && row.module_title
      ? row.module_title
      : row?.programme_title || "";

  // Structured data helps search engines and AI assistants understand that
  // this is a real credential issued by Data-Lead Africa.
  const jsonLd =
    state === "valid" && row
      ? {
          "@context": "https://schema.org",
          "@type": "EducationalOccupationalCredential",
          name: title,
          credentialCategory: row.is_module
            ? "Module certificate"
            : "Certificate of completion",
          identifier: number,
          dateCreated: row.completed_on,
          recognizedBy: {
            "@type": "Organization",
            name: "Data-Lead Africa",
            url: "https://www.dataleadafrica.com",
          },
        }
      : undefined;

  return (
    <main className="vfy">
      <Seo
        title={
          state === "valid"
            ? `Verified certificate ${number} | Data-Lead Africa`
            : `Certificate check | Data-Lead Africa`
        }
        description="Check whether a Data-Lead Africa training certificate is genuine."
        jsonLd={jsonLd}
        noindex
      />
      <div className="vfy__wrap">
        {state === "loading" && (
          <p className="vfy__loading">Checking this certificate...</p>
        )}

        {state === "offline" && (
          <div className="vfy__card">
            <h1 className="vfy__h1">Certificate checking is coming soon</h1>
            <p className="vfy__text">
              Our online verification service is not live yet. To confirm a
              certificate today, please{" "}
              <Link to={routes.contactUs}>contact us</Link> with the certificate
              number.
            </p>
          </div>
        )}

        {state === "notfound" && (
          <div className="vfy__card vfy__card--bad">
            <span className="vfy__pill vfy__pill--bad">Not found</span>
            <h1 className="vfy__h1">We have no record of this certificate</h1>
            <p className="vfy__text">
              No certificate matches the number <b>{number}</b>. Please check
              for typing mistakes. Certificate numbers look like
              DLA-2026-DAB-EXC-7K3Q9F.
            </p>
            <p className="vfy__text">
              If you believe this certificate should be genuine, please{" "}
              <Link to={routes.contactUs}>contact us</Link>.
            </p>
          </div>
        )}

        {state === "revoked" && row && (
          <div className="vfy__card vfy__card--bad">
            <span className="vfy__pill vfy__pill--bad">Withdrawn</span>
            <h1 className="vfy__h1">This certificate has been withdrawn</h1>
            <p className="vfy__text">
              Certificate <b>{number}</b> is no longer valid and should not be
              relied upon. Please <Link to={routes.contactUs}>contact us</Link>{" "}
              if you need more information.
            </p>
          </div>
        )}

        {state === "valid" && row && (
          <div className="vfy__card vfy__card--good">
            <span className="vfy__pill vfy__pill--good">Verified</span>
            <h1 className="vfy__h1">This certificate is genuine</h1>

            <dl className="vfy__facts">
              <div className="vfy__fact">
                <dt>Awarded to</dt>
                <dd>{row.full_name}</dd>
              </div>
              <div className="vfy__fact">
                <dt>{row.is_module ? "Tool certified" : "Programme"}</dt>
                <dd>{title}</dd>
              </div>
              {row.is_module && (
                <div className="vfy__fact">
                  <dt>Part of</dt>
                  <dd>
                    {row.programme_title}
                    {row.week_number ? ` (week ${row.week_number})` : ""}
                  </dd>
                </div>
              )}
              <div className="vfy__fact">
                <dt>Completed</dt>
                <dd>{row.completed_on ? prettyDate(row.completed_on) : ""}</dd>
              </div>
              {row.duration_text && !row.is_module && (
                <div className="vfy__fact">
                  <dt>Duration</dt>
                  <dd>{row.duration_text}</dd>
                </div>
              )}
              <div className="vfy__fact">
                <dt>Certificate number</dt>
                <dd>{number}</dd>
              </div>
              <div className="vfy__fact">
                <dt>Issued by</dt>
                <dd>Data-Lead Africa, Abuja, Nigeria</dd>
              </div>
            </dl>

            {row.course_url && (
              <p className="vfy__text vfy__cta">
                <Link to={row.course_url}>
                  Learn more about the {row.programme_title}
                </Link>{" "}
                or <Link to={routes.courses}>browse all our programmes</Link>.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
