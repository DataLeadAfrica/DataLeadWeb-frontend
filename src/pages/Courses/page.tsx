import { Link } from "react-router";
import { useEffect, useState } from "react";

import "./page.css";

import { CourseInfo } from "./router";

// Existing Data Analytics brochure (Google Drive). Phase 2: replace with a gated form.
const BROCHURE =
  "https://drive.google.com/file/d/1jHZvPz1fvEXb9sh_KsJ94y-_1oZUpTpt/view?usp=sharing";

type Meta = {
  category: string;
  duration: string;
  tagline: string;
  featured?: boolean;
};

// Enrichment for the cards, keyed by course name (names come from router.tsx).
const META: { [name: string]: Meta } = {
  "Data Analytics": {
    category: "Analytics · Flagship",
    duration: "3 months",
    tagline:
      "Manage data end-to-end and apply analytics to real-world problems across sectors and policy.",
    featured: true,
  },
  "AI & Machine Learning": {
    category: "Artificial Intelligence",
    duration: "3 months",
    tagline:
      "From Python fundamentals to building predictive models with real datasets.",
  },
  "Business Analytics": {
    category: "Business",
    duration: "6 weeks",
    tagline: "Turn business data into smarter decisions with Excel, SQL and Power BI.",
  },
  Bioinformatics: {
    category: "Research",
    duration: "3 months",
    tagline:
      "Analyse biological data with computational biology, genomics and health research.",
  },
  "HR Analytics": {
    category: "Business",
    duration: "1 month",
    tagline:
      "Make evidence-based workforce decisions with people data and dashboards.",
  },
  "Research Methodology and Manuscript Writing": {
    category: "Research",
    duration: "Intensive",
    tagline:
      "Design rigorous research and get published, from question to journal submission.",
  },
  "Employability & Entrepreneurship": {
    category: "Career",
    duration: "2 weeks",
    tagline: "Land the job or launch the business with practical, real-world skills.",
  },
  "Digital Creators": {
    category: "Teens · Ages 12-17",
    duration: "Summer",
    tagline: "A fun summer of content creation, design and video editing for teens.",
  },
};

const ROTATOR = [
  "Powering high-level impact research, evaluations and training across Africa",
  "Headquartered in Abuja, operating across five countries",
  "Learn online or onsite, from anywhere in the world",
  "Practitioner-led. Project-based. Career-focused.",
];

const TOOLS = ["Python", "R", "SQL", "Power BI", "Excel", "SPSS", "STATA", "Nvivo"];

const COUNTRIES: Array<{ flag: string; name: string; hq?: boolean }> = [
  { flag: "🇳🇬", name: "Nigeria", hq: true },
  { flag: "🇧🇯", name: "Benin Republic" },
  { flag: "🇬🇼", name: "Guinea-Bissau" },
  { flag: "🇹🇬", name: "Togo" },
  { flag: "🇹🇩", name: "Chad" },
];

export default function Courses({
  courseInfos,
}: {
  courseInfos: Array<CourseInfo>;
}) {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((i) => (i + 1) % ROTATOR.length), 2800);
    return () => clearInterval(t);
  }, []);

  const featured = courseInfos.find((c) => META[c.name]?.featured);
  const rest = courseInfos.filter((c) => !META[c.name]?.featured);

  return (
    <div className="lc">
      {/* HERO */}
      <section className="lc-hero">
        <div className="cwrap lc-hero__grid">
          <div>
            <p className="lc-eyebrow">Data-Lead Africa · Learn</p>
            <h1 className="lc-hero__title">
              Master the data skills the <span>world</span> is hiring for.
            </h1>
            <p className="lc-hero__lead">
              Expert-led bootcamps in analytics, AI and research. Learn online or
              onsite, from anywhere.
            </p>
            <p className="lc-rotor">
              <span className="lc-rotor__dot" />
              <span className="lc-rotor__txt">{ROTATOR[line]}</span>
            </p>
            <div className="lc-hero__cta">
              <a className="lc-btn" href="#courses">
                Explore courses →
              </a>
              <a
                className="lc-btn lc-btn--ghost"
                href={BROCHURE}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download brochure ↓
              </a>
            </div>
          </div>
          <div className="lc-hero__art" aria-hidden="true">
            <span className="lc-ring lc-ring--1" />
            <span className="lc-ring lc-ring--2" />
            <span className="lc-ring lc-ring--3" />
            <span className="lc-chip lc-chip--1">🇳🇬 Abuja · HQ</span>
            <span className="lc-chip lc-chip--2">🌍 5 countries</span>
          </div>
        </div>
      </section>

      {/* FOOTPRINT TICKER */}
      <div className="lc-ticker" aria-hidden="true">
        <div className="lc-ticker__track">
          {[0, 1].map((k) => (
            <div className="lc-ticker__group" key={k}>
              {COUNTRIES.map((c) => (
                <span key={c.name}>
                  {c.flag} <b>{c.name}</b>
                  {c.hq ? <i> · Abuja HQ</i> : null}
                </span>
              ))}
              <span className="lc-ticker__o">
                High-level impact research, evaluations &amp; training across Africa
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* TOOLS */}
      <div className="lc-tools">
        <div className="cwrap lc-tools__row">
          <span className="lc-tools__lbl">Tools you'll master</span>
          {TOOLS.map((t) => (
            <span className="lc-tools__chip" key={t}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* WHO WE ARE / IMPACT */}
      <section className="lc-impact">
        <div className="cwrap lc-impact__grid">
          <div>
            <p className="lc-eyebrow">Who we are</p>
            <h2 className="lc-h2">Built in Africa. Trusted across borders.</h2>
            <p className="lc-muted">
              Headquartered in Abuja and operating across Benin Republic,
              Guinea-Bissau, Togo and Chad, Data-Lead Africa powers high-level impact
              research, evaluations and training across the continent.
            </p>
            <div className="lc-countries">
              {COUNTRIES.map((c) => (
                <span className="lc-cty" key={c.name}>
                  {c.flag} {c.name}
                  {c.hq ? <b> · HQ</b> : null}
                </span>
              ))}
            </div>
          </div>
          <div className="lc-stats">
            <div className="lc-stat">
              <div className="lc-stat__n">5</div>
              <div className="lc-stat__l">countries of operation</div>
            </div>
            <div className="lc-stat">
              <div className="lc-stat__n">8</div>
              <div className="lc-stat__l">career-focused bootcamps</div>
            </div>
            <div className="lc-stat">
              <div className="lc-stat__n">100%</div>
              <div className="lc-stat__l">hands-on &amp; project-based</div>
            </div>
            <div className="lc-stat">
              <div className="lc-stat__n">Global</div>
              <div className="lc-stat__l">learners, online &amp; onsite</div>
            </div>
          </div>
        </div>
      </section>

      {/* COURSES */}
      <section className="lc-courses" id="courses">
        <div className="cwrap">
          <div className="lc-sec-head">
            <p className="lc-eyebrow">Our bootcamps</p>
            <h2 className="lc-h2">Pick your path into data</h2>
            <p className="lc-muted">
              Every course is hands-on and taught by practitioners. Online or onsite,
              beginner-friendly to advanced.
            </p>
          </div>

          {featured && (
            <div className="lc-card lc-feature">
              <span className="lc-badge">🏆 Scholarship eligible</span>
              <div className="lc-feature__text">
                <div className="lc-card__ico">
                  <img src={featured.imgSrc} alt="" />
                </div>
                <p className="lc-card__tag">{META[featured.name].category}</p>
                <h3 className="lc-card__name">{featured.name} Bootcamp</h3>
                <p className="lc-card__blurb">
                  {META[featured.name].tagline} {META[featured.name].duration}, online
                  and onsite, beginner-friendly.
                </p>
              </div>
              <div className="lc-feature__side">
                <div className="lc-price">₦{featured.price}</div>
                <div className="lc-price__sub">one-time · next cohort soon</div>
                <Link className="lc-btn lc-btn--block" to={featured.link}>
                  Enrol now →
                </Link>
                <a
                  className="lc-btn lc-btn--ghost lc-btn--block"
                  href={BROCHURE}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download brochure ↓
                </a>
              </div>
            </div>
          )}

          <div className="lc-grid">
            {rest.map((v) => {
              const m = META[v.name];
              return (
                <Link to={v.link} className="lc-card lc-card--link" key={v.name}>
                  <div className="lc-card__ico">
                    <img src={v.imgSrc} alt="" />
                  </div>
                  <p className="lc-card__tag">{m?.category}</p>
                  <h3 className="lc-card__name">{v.name}</h3>
                  <p className="lc-card__blurb">{m?.tagline}</p>
                  <div className="lc-card__meta">🗓️ {m?.duration}</div>
                  <div className="lc-card__foot">
                    <span className="lc-price lc-price--sm">
                      ₦{v.price}
                      <small> one-time</small>
                    </span>
                    <span className="lc-go">Explore →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="lc-why">
        <div className="cwrap">
          <div className="lc-sec-head">
            <p className="lc-eyebrow">Why Data-Lead Africa</p>
            <h2 className="lc-h2">Learning built for the real world</h2>
          </div>
          <div className="lc-why__grid">
            <div className="lc-why__item">
              <div className="lc-why__ic">🎥</div>
              <h3>Video + live sessions</h3>
              <p>Recorded lessons plus live, expert-led classes.</p>
            </div>
            <div className="lc-why__item">
              <div className="lc-why__ic">🌍</div>
              <h3>Online &amp; onsite</h3>
              <p>Collaborate with learners online and in person.</p>
            </div>
            <div className="lc-why__item">
              <div className="lc-why__ic">🤝</div>
              <h3>Peer review</h3>
              <p>Gain new perspectives with your cohort.</p>
            </div>
            <div className="lc-why__item">
              <div className="lc-why__ic">📊</div>
              <h3>Real case studies</h3>
              <p>Solve real business and research problems.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="lc-ctaband-wrap">
        <div className="cwrap">
          <div className="lc-ctaband">
            <div>
              <h2 className="lc-h2 lc-ctaband__title">
                Ready to accelerate your career?
              </h2>
              <p className="lc-ctaband__sub">
                Join the next cohort and build the skills the world is hiring for.
              </p>
            </div>
            <div className="lc-ctaband__btns">
              <a className="lc-btn" href="#courses">
                Explore courses →
              </a>
              <a
                className="lc-btn lc-btn--ghost-dark"
                href={BROCHURE}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download brochure ↓
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
