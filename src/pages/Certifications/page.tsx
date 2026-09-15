import { Link } from "react-router";

import Seo from "../../components/Seo/component";
import { routes } from "../routes";
import "./page.css";

// The only public page in this feature. Everything in the portal itself is
// noindex, because it holds participant scores and the question bank. This
// page is what Google should see: what the certifications are, how they
// work, and where to verify one.

const SECTIONS = [
  {
    area: "Data Collection",
    name: "Kobo Toolbox and XLSForms",
    meta: "20 questions",
    blurb:
      "Designing digital forms, skip logic and validation, and gathering clean data from the field.",
  },
  {
    area: "Data Management",
    name: "SQL",
    meta: "20 questions",
    blurb:
      "Storing and structuring data, writing queries, joining tables and keeping records consistent.",
  },
  {
    area: "Quantitative Analysis",
    name: "Microsoft Excel",
    meta: "30 drawn from 53",
    blurb:
      "Cleaning and summarising data, lookups and absolute references, plus charts and dashboards.",
  },
  {
    area: "Quantitative Analysis",
    name: "Stata",
    meta: "25 questions",
    blurb:
      "Managing datasets, descriptive and inferential statistics, and reproducible do-files.",
  },
  {
    area: "Programming",
    name: "Python",
    meta: "25 questions",
    blurb:
      "pandas for cleaning, grouping and merging survey data, plus the core Python an analyst uses.",
  },
  {
    area: "Data Visualisation",
    name: "Power BI",
    meta: "25 drawn from 50",
    blurb:
      "Modelling data, building measures, and turning results into dashboards people act on.",
  },
  {
    area: "Qualitative Analysis",
    name: "NVivo and Dedoose",
    meta: "20 questions",
    blurb:
      "Coding transcripts, retrieving excerpts, code co-occurrence and comparing coders.",
  },
];

const STEPS = [
  {
    title: "Learn the section",
    text: "Your trainer covers the section across the bootcamp, with practical work throughout.",
  },
  {
    title: "Sit the assessment",
    text: "Open it from your portal whenever you are ready. No booking and no fixed date.",
  },
  {
    title: "Pass at 70%",
    text: "Marked instantly. Retake as many times as you need, at no extra cost.",
  },
  {
    title: "Get certified",
    text: "Your certificate is issued within a second, carrying a number anyone can verify.",
  },
];

export default function Certifications() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: "Data Analytics Bootcamp",
      description:
        "A seven section data analytics bootcamp covering data collection, data management, quantitative and qualitative analysis, programming and data visualisation. Each section is separately assessed and certified.",
      url: "https://dataleadafrica.com/certifications",
      provider: {
        "@type": "Organization",
        name: "Data-Lead Africa",
        url: "https://dataleadafrica.com",
      },
      hasCourseInstance: {
        "@type": "CourseInstance",
        courseMode: "blended",
        location: { "@type": "Place", name: "Abuja, Nigeria" },
      },
      educationalCredentialAwarded: SECTIONS.map((s) => ({
        "@type": "EducationalOccupationalCredential",
        name: `${s.name} certificate`,
        credentialCategory: "certificate",
        competencyRequired: s.area,
        recognizedBy: { "@type": "Organization", name: "Data-Lead Africa" },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How many times can I take an assessment?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "As many times as you need. An assessment stays open until you pass it, and only your best attempt is recorded. Once you pass, that section closes because the certificate has already been issued.",
          },
        },
        {
          "@type": "Question",
          name: "What score do I need to pass?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Seventy per cent. Papers are marked automatically the moment you submit, and the certificate is issued within a second of passing.",
          },
        },
        {
          "@type": "Question",
          name: "How does an employer check a certificate?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Every certificate carries a number such as DLA-2026-EXC-4M8P2R. Entering it on the Data-Lead Africa verification page shows the holder's name, the section, and the date, straight from our records. A revoked certificate is clearly marked as revoked.",
          },
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://dataleadafrica.com/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Certifications",
          item: "https://dataleadafrica.com/certifications",
        },
      ],
    },
  ];

  return (
    <>
      <Seo
        title="Tool certifications | Data Analytics Bootcamp | Data-Lead Africa"
        description="Seven separately certified sections on the Data-Lead Africa Data Analytics Bootcamp, covering Excel, SQL, Python, Stata, Power BI, Kobo Toolbox and qualitative analysis. Assessed online, marked instantly, and verifiable by any employer."
        jsonLd={jsonLd}
      />

      <main className="cert">
        <div className="cert__wrap">
          <div className="cert__hero">
            <p className="cert__eyebrow">Data Analytics Bootcamp</p>
            <h1 className="cert__h1">
              Seven sections. <span>Seven certificates.</span>
            </h1>
            <p className="cert__lede">
              The Data Analytics Bootcamp is split into seven sections, and each
              one is certified on its own. Some sections cover a single tool,
              such as SQL. Others cover more than one, such as qualitative
              analysis with NVivo and Dedoose. Pass a section and you hold that
              certificate, whatever happens with the rest. Each one carries a
              number that any employer can verify on this site.
            </p>
            <div className="cert__acts">
              <Link
                className="cert__btn cert__btn--go"
                to={routes.learnerLogin}
              >
                Sign in to the portal
              </Link>
              <a className="cert__btn" href="/my-certificate">
                Claim your certificate
              </a>
            </div>
          </div>

          <section>
            <h2 className="cert__h2">The seven sections</h2>
            <p className="cert__sub">
              Each section stands alone. There is no fixed order and no
              deadline, and the pass mark is 70 per cent throughout.
            </p>
            <div className="cert__grid">
              {SECTIONS.map((s) => (
                <article className="cert__card" key={s.name}>
                  <span className="cert__area">{s.area}</span>
                  <h3 className="cert__name">{s.name}</h3>
                  <p className="cert__blurb">{s.blurb}</p>
                  <p className="cert__meta">{s.meta} &middot; 70% to pass</p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2 className="cert__h2">How it works</h2>
            <p className="cert__sub">
              Four steps, no paperwork, and no waiting for anybody to mark it.
            </p>
            <ol className="cert__steps">
              {STEPS.map((s, i) => (
                <li className="cert__step" key={s.title}>
                  <span className="cert__stepNo">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="cert__band">
            <div>
              <h2>Checking someone&rsquo;s certificate?</h2>
              <p>
                Every certificate we issue carries a number in the form
                DLA-2026-EXC-4M8P2R. Enter it on our verification page and you
                will see the holder&rsquo;s name, the section, and the date,
                straight from our records. A certificate we have withdrawn says
                so plainly.
              </p>
            </div>
            <a className="cert__btn cert__btn--go" href="/verify/">
              Verify a number
            </a>
          </section>

          <section className="cert__faq">
            <h2 className="cert__h2">Common questions</h2>
            <details className="cert__q">
              <summary>How many times can I take an assessment?</summary>
              <p>
                As many times as you need. An assessment stays open until you
                pass it, and only your best attempt is recorded, so a weaker
                score later never replaces a stronger one. Once you pass, that
                section closes, because the certificate has already been issued.
              </p>
            </details>
            <details className="cert__q">
              <summary>Is the paper the same every time?</summary>
              <p>
                Not for every section. Excel draws 30 questions from a bank of
                53, and Power BI draws 25 from 50, so a retake is a different
                paper. The order of the questions and of the answer options
                changes on every attempt.
              </p>
            </details>
            <details className="cert__q">
              <summary>Who marks it?</summary>
              <p>
                Nobody. Marking happens automatically the moment you submit, and
                a certificate is issued within a second of passing. There is no
                queue and nothing to wait for.
              </p>
            </details>
            <details className="cert__q">
              <summary>What if my name is spelled wrongly?</summary>
              <p>
                Tell us before you share the certificate. The training team can
                correct it, and every certificate you hold updates at once.
              </p>
            </details>
          </section>
        </div>
      </main>
    </>
  );
}
