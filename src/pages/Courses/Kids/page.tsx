import { Link } from "react-router";

import "./page.css";

import { CourseInfo } from "../router";
import Seo from "../../../components/Seo/component";

const SITE = "https://dataleadafrica.com";

const WHY = [
  {
    ic: "🎨",
    title: "Learning that feels like play",
    copy: "Every lesson ends with something that runs, moves or plays.",
  },
  {
    ic: "🌱",
    title: "Beginner friendly",
    copy: "No coding or experience needed. Everything starts from the beginning.",
  },
  {
    ic: "🛡️",
    title: "Safe and supervised",
    copy: "Small classes, kid-appropriate tools, and a conversation about using tech responsibly.",
  },
  {
    ic: "🏆",
    title: "Show-and-tell finish",
    copy: "They present a project they built themselves to the class on the final day.",
  },
];

export default function Kids({
  courseInfos,
}: {
  courseInfos: Array<CourseInfo>;
}) {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Summer Bootcamp for Kids",
      itemListElement: courseInfos.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Course",
          name: c.name,
          description: c.tagline || c.desc,
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
    <div className="kd">
      <Seo
        title="Summer Bootcamp for Kids | Coding, AI & Digital Skills | Data-Lead Africa"
        description="One month of hands-on tech for kids and teens in Abuja. Python coding, AI and machine learning, and digital content creation. No experience needed."
        jsonLd={jsonLd}
      />

      {/* HERO */}
      <section className="kd-hero">
        <div className="cwrap kd-hero__in">
          <p className="kd-hero__kicker">Data-Lead Africa · Summer Bootcamp</p>
          <h1 className="kd-hero__title">
            Give your child a summer they will build on.
          </h1>
          <p className="kd-hero__lead">
            One month of hands-on tech. They write real code, train a real AI, or
            produce real content, then present a project they made themselves.
          </p>
          <div className="kd-hero__facts">
            <span className="kd-fact">1 month</span>
            <span className="kd-fact">Ages 8 to 17</span>
            <span className="kd-fact">No experience needed</span>
            <span className="kd-fact">Abuja</span>
          </div>
        </div>
      </section>

      {/* WHY PARENTS LOVE IT */}
      <section className="kd-why">
        <div className="cwrap">
          <div className="kd-sec-head">
            <p className="kd-eyebrow">Why parents love it</p>
            <h2 className="kd-h2">Learning that feels like play</h2>
          </div>
          <div className="kd-why__grid">
            {WHY.map((w) => (
              <div className="kd-why__item" key={w.title}>
                <div className="kd-why__ic" aria-hidden="true">
                  {w.ic}
                </div>
                <h3>{w.title}</h3>
                <p>{w.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRACKS */}
      <section className="kd-tracks" id="tracks">
        <div className="cwrap">
          <div className="kd-sec-head">
            <p className="kd-eyebrow">Choose a track</p>
            <h2 className="kd-h2">Three one-month tracks</h2>
            <p className="kd-muted">
              Pick the one that fits your child. Each ends with a project they
              present to the class.
            </p>
          </div>

          <div className="kd-grid">
            {courseInfos.map((v) => (
              <Link className="kd-card" to={v.link} key={v.name}>
                <div className="kd-card__ico">
                  <img src={v.imgSrc} alt={v.name + " bootcamp"} />
                </div>
                <div className="kd-card__body">
                  <p className="kd-card__tag">Ages {v.ageRange}</p>
                  <h3 className="kd-card__name">{v.name}</h3>
                  <p className="kd-card__blurb">{v.tagline || v.desc}</p>
                  <ul className="kd-card__mods">
                    {Object.keys(v.modules)
                      .slice(0, 4)
                      .map((k) => (
                        <li key={k}>{k}</li>
                      ))}
                  </ul>
                </div>
                <div className="kd-card__foot">
                  <span className="kd-price">
                    ₦{v.price}
                    <small> one-time</small>
                  </span>
                  <span className="kd-card__go">View course →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="kd-cta">
        <div className="cwrap kd-cta__in">
          <div>
            <h2 className="kd-h2">Not sure which track?</h2>
            <p className="kd-muted">
              Tell us your child's age and what they enjoy, and we will point you to
              the right one.
            </p>
          </div>
          <Link className="kd-btn" to="/contact-us">
            Talk to us →
          </Link>
        </div>
      </section>
    </div>
  );
}
