import { Link } from "react-router";

import AfricaMap from "./AfricaMap";
import { useEffect, useState } from "react";

import "./page.css";

import { CourseInfo } from "./router";
import { routes } from "../routes";
import LeadForm from "../../components/LeadForm/component";
import EnrolForm from "../../components/EnrolForm/component";
import Seo from "../../components/Seo/component";
import GizStrip from "../../components/GizStrip/component";

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
    duration: "3 months",
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
    category: "Teens · Ages 12 to 17",
    duration: "1 month",
    tagline: "A fun summer of content creation, design and video editing for teens.",
  },
  "AI & ML for Kids": {
    category: "Kids & Teens · Ages 8 to 17",
    duration: "1 month",
    tagline:
      "Discover how machines learn, train a real model and build a smart project.",
  },
  "Python Coding for Kids": {
    category: "Kids & Teens · Ages 8 to 17",
    duration: "1 month",
    tagline:
      "From their very first line of code to their very first game, in one month.",
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

const SITE = "https://dataleadafrica.com";

export default function Courses({
  courseInfos,
}: {
  courseInfos: Array<CourseInfo>;
}) {
  const [line, setLine] = useState(0);
  // When non-null, the brochure modal is open, pre-selected to this programme
  // name ("" = no pre-selection).
  const [brochureFor, setBrochureFor] = useState<string | null>(null);
  // When non-null, the enrol modal is open, pre-selected to this programme.
  const [enrolFor, setEnrolFor] = useState<string | null>(null);

  const programmes = courseInfos.map((c) => c.name);

  useEffect(() => {
    const t = setInterval(() => setLine((i) => (i + 1) % ROTATOR.length), 2800);
    return () => clearInterval(t);
  }, []);

  const featured = courseInfos.find((c) => META[c.name]?.featured);
  // Adult bootcamps keep the main grid. Kids tracks get their own band below,
  // so a 3-month professional course is never confused with a summer club.
  const rest = courseInfos.filter((c) => !META[c.name]?.featured && !c.kids);
  const kidsCourses = courseInfos.filter((c) => c.kids);

  // ── SEO: structured data for the organisation + the course list ──
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Data-Lead Africa",
      url: SITE,
      description:
        "Research and training consultancy providing data analytics, data science and AI bootcamps across Africa.",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Plot 759, Bassan Plaza, Central Business District",
        addressLocality: "Abuja",
        addressCountry: "NG",
      },
      email: "info@dataleadafrica.com",
      telephone: "+234-703-050-0741",
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: courseInfos.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Course",
          name: c.name,
          description: META[c.name]?.tagline || c.desc,
          url: SITE + c.link,
          provider: {
            "@type": "Organization",
            name: "Data-Lead Africa",
            sameAs: SITE,
          },
          offers: {
            "@type": "Offer",
            price: (c.price || "").replace(/[^0-9]/g, ""),
            priceCurrency: "NGN",
          },
        },
      })),
    },
  ];

  return (
    <div className="lc">
      <Seo
        title="Data & AI Bootcamps in Nigeria & Africa | Data-Lead Africa"
        description="Practitioner-led bootcamps in data analytics, AI & machine learning, business analytics, bioinformatics, HR analytics and research methods - online or onsite in Abuja. Explore courses and download a brochure."
        jsonLd={jsonLd}
      />

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
              <button
                type="button"
                className="lc-btn lc-btn--ghost"
                onClick={() => setBrochureFor("")}
              >
                Download brochure ↓
              </button>
              {featured && (
                <button
                  type="button"
                  className="lc-btn"
                  onClick={() => setEnrolFor(featured.name)}
                >
                  Enrol now →
                </button>
              )}
            </div>

          </div>
          <div className="lc-hero__art">
            <AfricaMap />
            <span className="lc-chip lc-chip--1">🇳🇬 Abuja · HQ</span>
            <span className="lc-chip lc-chip--2">🌍 Footprint &amp; reach</span>
          </div>
        </div>
      </section>

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
              <Link to={featured.link} className="lc-feature__text">
                <div className="lc-card__ico">
                  <img src={featured.imgSrc} alt={featured.name + " bootcamp"} />
                </div>
                <p className="lc-card__tag">{META[featured.name].category}</p>
                <h3 className="lc-card__name">{featured.name} Bootcamp</h3>
                <p className="lc-card__blurb">
                  {META[featured.name].tagline} {META[featured.name].duration}, online
                  and onsite, beginner-friendly.
                </p>
              </Link>
              <div className="lc-feature__side">
                <div className="lc-price">₦{featured.price}</div>
                <div className="lc-price__sub">one-time · next cohort soon</div>
                <button
                  type="button"
                  className="lc-btn lc-btn--block"
                  onClick={() => setEnrolFor(featured.name)}
                >
                  Enrol now →
                </button>
                <button
                  type="button"
                  className="lc-btn lc-btn--ghost lc-btn--block"
                  onClick={() => setBrochureFor(featured.name)}
                >
                  Download brochure ↓
                </button>
              </div>
            </div>
          )}

          <div className="lc-grid">
            {rest.map((v) => {
              const m = META[v.name];
              return (
                <div className="lc-card lc-card--link" key={v.name}>
                  <Link to={v.link} className="lc-card__body">
                    <div className="lc-card__ico">
                      <img src={v.imgSrc} alt={v.name + " bootcamp"} />
                    </div>
                    <p className="lc-card__tag">{m?.category}</p>
                    <h3 className="lc-card__name">{v.name}</h3>
                    <p className="lc-card__blurb">{m?.tagline}</p>
                    <div className="lc-card__meta">🗓️ {m?.duration}</div>
                  </Link>
                  <div className="lc-card__foot">
                    <span className="lc-price lc-price--sm">
                      ₦{v.price}
                      <small> one-time</small>
                    </span>
                    <span className="lc-card__acts">
                      <button
                        type="button"
                        className="lc-card__enrol"
                        onClick={() => setEnrolFor(v.name)}
                      >
                        Enrol
                      </button>
                      <button
                        type="button"
                        className="lc-card__brochure"
                        onClick={() => setBrochureFor(v.name)}
                      >
                        Brochure ↓
                      </button>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* GIZ-ZME promo band - TEMPORARY. Remove this whole block and the
          import when applications close. Sits between courses and kids so it
          does not crowd the hero. */}
      <section className="lc-giz-band">
        <div className="cwrap">
          <GizStrip />
        </div>
      </section>

      {/* SUMMER BOOTCAMP FOR KIDS */}
      {kidsCourses.length > 0 && (
        <section className="lc-kids" id="kids">
          <div className="cwrap">
            <div className="lc-sec-head">
              <span className="lc-kids__badge">☀ Summer Bootcamp</span>
              <p className="lc-eyebrow lc-eyebrow--kids">For kids and teens</p>
              <h2 className="lc-h2">Summer Bootcamp for Kids</h2>
              <p className="lc-muted">
                One month, hands-on, no experience needed. Your child builds something
                real and presents it to the class.
              </p>
            </div>

            <div className="lc-grid">
              {kidsCourses.map((v) => {
                const m = META[v.name];
                return (
                  <div className="lc-card lc-card--link lc-card--kid" key={v.name}>
                    <Link to={v.link} className="lc-card__body">
                      <div className="lc-card__ico">
                        <img src={v.imgSrc} alt={v.name + " bootcamp"} />
                      </div>
                      <p className="lc-card__tag">{m?.category}</p>
                      <h3 className="lc-card__name">{v.name}</h3>
                      <p className="lc-card__blurb">{m?.tagline}</p>
                      <div className="lc-card__meta">🗓️ {m?.duration}</div>
                    </Link>
                    <div className="lc-card__foot">
                      <span className="lc-price lc-price--sm">
                        ₦{v.price}
                        <small> one-time</small>
                      </span>
                      <span className="lc-card__acts">
                        <button
                          type="button"
                          className="lc-card__enrol"
                          onClick={() => setEnrolFor(v.name)}
                        >
                          Enrol
                        </button>
                        <button
                          type="button"
                          className="lc-card__brochure"
                          onClick={() => setBrochureFor(v.name)}
                        >
                          Brochure ↓
                        </button>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lc-kids__more">
              <Link className="lc-btn lc-btn--kid" to={routes.coursesKids}>
                See the kids programme →
              </Link>
            </div>
          </div>
        </section>
      )}

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
              <button
                type="button"
                className="lc-btn lc-btn--ghost-dark"
                onClick={() => setBrochureFor("")}
              >
                Download brochure ↓
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTPRINT TICKER (bottom) */}
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

      {brochureFor !== null && (
        <LeadForm
          defaultProgramme={brochureFor}
          onClose={() => setBrochureFor(null)}
        />
      )}

      {enrolFor !== null && (
        <EnrolForm
          defaultProgramme={enrolFor}
          programmes={programmes}
          onClose={() => setEnrolFor(null)}
        />
      )}
    </div>
  );
}
