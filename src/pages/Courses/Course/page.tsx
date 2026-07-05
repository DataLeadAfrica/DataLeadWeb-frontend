import { useState, ReactNode } from "react";

import "./page.css";

import { Modules, ModulesWithTracks } from "../router";
import EnrolForm from "../../../components/EnrolForm/component";
import LeadForm from "../../../components/LeadForm/component";
import Seo from "../../../components/Seo/component";
import TrainingGallery, {
  TrainingShot,
} from "../../../components/TrainingGallery/component";
import { PAYMENTS, naira } from "../../../components/EnrolForm/payments";

const HOW = [
  { ic: "🎥", t: "Hands-on training", d: "Project-based work on industry-standard tools." },
  { ic: "🤝", t: "Mentorship", d: "Guidance from seasoned practitioners throughout." },
  { ic: "🏢", t: "In-agency internship", d: "Work on live projects with the Data-Lead team." },
  { ic: "📚", t: "Guided self-study", d: "Structured skill-building between sessions." },
  { ic: "🎓", t: "Capstone project", d: "An end-to-end project you present to graduate." },
];

export type CoursePageProps = {
  name: string;
  desc: string;
  modules: Modules | ModulesWithTracks;
  price: string;
  videoEmbed?: ReactNode;
  programmes: string[];
  tagline?: string;
  duration?: string;
  cohortNote?: string;
  outcomes?: string[];
  tools?: string[];
  whoFor?: string[];
  faqs?: { q: string; a: string }[];
  scholarship?: boolean;
  gallery?: TrainingShot[];
  formLink?: string;
};

export default function Course({
  name,
  desc,
  modules,
  price,
  videoEmbed,
  programmes,
  tagline,
  duration = "3 months",
  cohortNote = "Next cohort now enrolling · limited seats",
  outcomes,
  tools,
  whoFor,
  faqs,
  scholarship,
  gallery,
}: CoursePageProps) {
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [brochureOpen, setBrochureOpen] = useState(false);
  const [openMod, setOpenMod] = useState<number | null>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const pay = PAYMENTS[name];
  const modEntries = Object.entries(modules);
  const seoDesc = (tagline || desc || "").replace(/\s+/g, " ").trim().slice(0, 155);

  const jsonLd: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: name + " Bootcamp",
      description: seoDesc,
      provider: { "@type": "Organization", name: "Data-Lead Africa", sameAs: "https://dataleadafrica.com" },
      offers: { "@type": "Offer", price: (price || "").replace(/[^0-9]/g, ""), priceCurrency: "NGN" },
    },
  ];
  if (faqs && faqs.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return (
    <div className="cx">
      <Seo
        title={name + " Bootcamp in Abuja, Nigeria | Data-Lead Africa"}
        description={seoDesc}
        jsonLd={jsonLd}
      />

      <section className="cx-hero">
        <div className="cx-wrap cx-hero__grid">
          <div>
            {scholarship && (
              <a className="cx-schol-pill" href="#cx-scholarship">
                <span className="tag">NEW</span> Win a full scholarship · Predict &amp; Win →
              </a>
            )}
            <p className="cx-ey">Data-Lead Africa · Bootcamp</p>
            <h1 className="cx-hero__title">{name} Bootcamp</h1>
            <p className="cx-hero__lead">{tagline || desc}</p>
            <div className="cx-facts">
              <span className="cx-fact">{duration}</span>
              <span className="cx-fact">Online &amp; onsite</span>
              <span className="cx-fact">Abuja HQ</span>
              <span className="cx-fact">From <b>₦{price}</b></span>
            </div>
            <div className="cx-hero__cta">
              <button className="cx-btn" onClick={() => setEnrolOpen(true)}>Enrol now →</button>
              <button className="cx-btn cx-btn--ghost" onClick={() => setBrochureOpen(true)}>Download brochure ↓</button>
            </div>
            <div className="cx-cohort"><span className="cx-pulse" /> {cohortNote}</div>
          </div>
          <div className="cx-viz">
            <div className="cx-viz__top">
              <span className="cx-viz__lbl">{name.toLowerCase().replace(/[^a-z]+/g, "_")}.live</span>
              <span className="cx-viz__lbl cx-live">● registration open</span>
            </div>
            <div className="cx-bars">
              {[42, 66, 38, 84, 58, 100, 72].map((h, i) => (
                <span key={i} className="cx-bar" style={{ height: h + "%", animationDelay: i * 0.07 + "s" }} />
              ))}
            </div>
            <div className="cx-viz__foot">
              <div><div className="cx-viz__n">3mo</div><div className="cx-viz__l">to job-ready</div></div>
              <div><div className="cx-viz__n">100%</div><div className="cx-viz__l">hands-on</div></div>
            </div>
          </div>
        </div>
      </section>

      {outcomes && outcomes.length > 0 && (
        <section className="cx-sec">
          <div className="cx-wrap">
            <div className="cx-sec-head">
              <p className="cx-ey">What you'll be able to do</p>
              <h2>Graduate ready to work, not just certified</h2>
            </div>
            <div className="cx-cards">
              {outcomes.map((o, i) => (
                <div className="cx-card" key={i}>
                  <div className="cx-card__n">{String(i + 1).padStart(2, "0")}</div>
                  <p>{o}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="cx-stats">
        <div className="cx-wrap cx-stats__row">
          <div className="cx-stat"><div className="cx-stat__n">21</div><div className="cx-stat__l">cohorts delivered</div></div>
          <div className="cx-stat"><div className="cx-stat__n">5</div><div className="cx-stat__l">countries of operation</div></div>
          <div className="cx-stat"><div className="cx-stat__n">100%</div><div className="cx-stat__l">hands-on &amp; project-based</div></div>
          <div className="cx-stat"><div className="cx-stat__n">Global</div><div className="cx-stat__l">learners, online &amp; onsite</div></div>
        </div>
      </div>

      <section className="cx-sec cx-mist" id="cx-curriculum">
        <div className="cx-wrap">
          <div className="cx-sec-head">
            <p className="cx-ey">Curriculum</p>
            <h2>What you'll master</h2>
            <p className="cx-muted">A complete breakdown of the skills you'll build. Tap a module to see what it covers.</p>
          </div>
          <div className="cx-curric">
            {modEntries.map(([title, body], i) => {
              const open = openMod === i;
              const hasBody = typeof body === "string" && body.length > 0;
              return (
                <div className={"cx-mod" + (open ? " open" : "")} key={title}>
                  <button className="cx-mod__head" onClick={() => setOpenMod(open ? null : i)}>
                    <span className="cx-mod__n">{String(i + 1).padStart(2, "0")}</span>
                    <span className="cx-mod__t">{title}</span>
                    {hasBody && <span className="cx-mod__pl">+</span>}
                  </button>
                  {hasBody && (
                    <div className="cx-mod__body" style={{ maxHeight: open ? "320px" : "0" }}>
                      <p>{body}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {tools && tools.length > 0 && (
        <section className="cx-sec">
          <div className="cx-wrap cx-split">
            <div>
              <p className="cx-ey">The toolkit</p>
              <h2 className="cx-h2">Tools you'll use on the job</h2>
              <p className="cx-muted">You'll graduate fluent in the software real analysts use every day.</p>
            </div>
            <div className="cx-tools">
              {tools.map((t) => (<span className="cx-tool" key={t}>{t}</span>))}
            </div>
          </div>
        </section>
      )}

      <section className="cx-sec cx-mist">
        <div className="cx-wrap">
          <div className="cx-sec-head">
            <p className="cx-ey">How it works</p>
            <h2>A programme that builds real experience</h2>
          </div>
          <div className="cx-how">
            {HOW.map((s) => (
              <div className="cx-step" key={s.t}>
                <div className="cx-step__ic">{s.ic}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
          {videoEmbed && <div className="cx-video">{videoEmbed}</div>}
        </div>
      </section>

      <section className="cx-sec">
        <div className="cx-wrap cx-split">
          <div>
            <p className="cx-ey">Who it's for</p>
            <h2 className="cx-h2">Built for people ready to work with data</h2>
            {whoFor && whoFor.length > 0 ? (
              <ul className="cx-who">
                {whoFor.map((w) => (<li key={w}><span className="cx-arrow">→</span> {w}</li>))}
              </ul>
            ) : (
              <p className="cx-muted">Aspiring professionals, recent graduates and career-changers who want practical, job-ready skills.</p>
            )}
          </div>
          <div className="cx-cert">
            <p className="cx-ey">Certificate &amp; portfolio</p>
            <h3>Finish with proof, not just knowledge</h3>
            <p className="cx-muted">Graduate with a Data-Lead Africa certificate and a portfolio-ready capstone, the two things employers actually ask to see.</p>
            <div className="cx-cert__card">
              <div className="cx-cert__lbl">Certificate of Completion</div>
              <div className="cx-cert__name">{name} Bootcamp</div>
              <div className="cx-cert__org">Data-Lead Africa</div>
            </div>
          </div>
        </div>
      </section>

      {gallery && gallery.length > 0 && (
        <div className="cx-mist"><TrainingGallery images={gallery} /></div>
      )}

      {scholarship && (
        <section className="cx-sec" id="cx-scholarship">
          <div className="cx-wrap">
            <div className="cx-schol">
              <div className="cx-schol__l">
                <p className="cx-ey cx-orange">Full scholarship</p>
                <h3>You could join for free.</h3>
                <p>Play our World Cup 2026 Predict &amp; Win challenge for a shot at a fully funded seat. Register, make your predictions, and the top forecaster wins a full scholarship.</p>
              </div>
              <div className="cx-schol__r">
                <div className="cx-trophy">🏆</div>
                <a className="cx-btn cx-btn--light" href="/world-cup-2026/">Play Predict &amp; Win →</a>
              </div>
            </div>
          </div>
        </section>
      )}

      {pay && (
        <section className="cx-sec cx-mist" id="cx-pricing">
          <div className="cx-wrap">
            <div className="cx-sec-head cx-center">
              <p className="cx-ey">Enrolment</p>
              <h2>Choose how you join</h2>
              <p className="cx-muted">Register in minutes. Pay online or by transfer, your seat is confirmed once payment clears.</p>
            </div>
            <div className="cx-plans">
              {pay.nysc && (
                <div className="cx-plan">
                  <div className="cx-plan__pl">NYSC discount</div>
                  <div className="cx-plan__amt">{naira(pay.nysc.amount)}</div>
                  <div className="cx-plan__sub">For serving corps members in Nigeria</div>
                  <button className="cx-btn cx-btn--ghost cx-btn--block" onClick={() => setEnrolOpen(true)}>Enrol (NYSC) →</button>
                </div>
              )}
              {pay.full && (
                <div className="cx-plan cx-plan--pop">
                  <div className="cx-plan__badge">Most popular</div>
                  <div className="cx-plan__pl">Full payment</div>
                  <div className="cx-plan__amt">{naira(pay.full.amount)}</div>
                  <div className="cx-plan__sub">One-time · best value</div>
                  <button className="cx-btn cx-btn--block" onClick={() => setEnrolOpen(true)}>Enrol now →</button>
                </div>
              )}
              {pay.installments && (
                <div className="cx-plan">
                  <div className="cx-plan__pl">Installments</div>
                  <div className="cx-plan__amt">{naira(pay.installments.per)}<span className="cx-plan__x"> ×{pay.installments.count}</span></div>
                  <div className="cx-plan__sub">{naira(pay.installments.total)} total, spread over the term</div>
                  <button className="cx-btn cx-btn--ghost cx-btn--block" onClick={() => setEnrolOpen(true)}>Enrol (installments) →</button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {faqs && faqs.length > 0 && (
        <section className="cx-sec" id="cx-faq">
          <div className="cx-wrap cx-narrow">
            <div className="cx-sec-head">
              <p className="cx-ey">FAQ</p>
              <h2>Questions, answered</h2>
            </div>
            <div className="cx-faqs">
              {faqs.map((f, i) => {
                const open = openFaq === i;
                return (
                  <div className={"cx-q" + (open ? " open" : "")} key={i}>
                    <button onClick={() => setOpenFaq(open ? null : i)}>{f.q} <span className="cx-q__pl">+</span></button>
                    <div className="cx-q__a" style={{ maxHeight: open ? "300px" : "0" }}><p>{f.a}</p></div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="cx-final">
        <div className="cx-wrap">
          <h2>Ready to turn data into your career?</h2>
          <p>Join the next {name} cohort and graduate job-ready.</p>
          <div className="cx-final__cta">
            <button className="cx-btn cx-btn--light" onClick={() => setEnrolOpen(true)}>Enrol now →</button>
            <button className="cx-btn cx-btn--outline" onClick={() => setBrochureOpen(true)}>Download brochure ↓</button>
          </div>
        </div>
      </section>

      {enrolOpen && (
        <EnrolForm defaultProgramme={name} programmes={programmes} onClose={() => setEnrolOpen(false)} />
      )}
      {brochureOpen && (
        <LeadForm defaultProgramme={name} onClose={() => setBrochureOpen(false)} />
      )}
    </div>
  );
}
