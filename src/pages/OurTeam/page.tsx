import { Link } from "react-router";

import "./page.css";
import Seo from "../../components/Seo/component";
import { StaffInfo } from "./router";

export default function OurTeam({ staffInfo }: { staffInfo: StaffInfo }) {
  const entries = Object.entries(staffInfo);
  const leadEntry = entries.find(([, v]) => v.lead);
  const lead = leadEntry ? leadEntry[1] : null;
  const rest = entries.filter(([, v]) => !v.lead).map(([, v]) => v);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Data-Lead Africa",
    url: "https://dataleadafrica.com",
    logo: "https://dataleadafrica.com/assets/dla-logo-email.png",
    employee: entries.map(([, v]) => ({
      "@type": "Person",
      name: v.name,
      jobTitle: v.title,
      image: "https://dataleadafrica.com" + v.imgSrc,
      url: "https://dataleadafrica.com" + v.bioRoute,
    })),
  };

  return (
    <div className="wwt">
      <Seo
        title="Leadership & Team | Data-Lead Africa"
        description="Meet the researchers, data scientists and development specialists leading Data-Lead Africa. Founded and led by Arowolo Ayoola, Ph.D, delivering rigorous data work across the African continent."
        jsonLd={jsonLd}
      />

      <div className="wwt__wrap">
        <header className="wwt-mast">
          <p className="wwt-eyebrow">Leadership</p>
          <h1 className="wwt-mast__title">The people behind the decisions.</h1>
          <p className="wwt-mast__lead">
            Data-Lead Africa is led by researchers, scientists and development
            specialists who have shaped national strategy and delivered rigorous
            work across the African continent.
          </p>
        </header>
      </div>

      {lead && (
        <section className="wwt-lead">
          <div className="wwt-lead__photo">
            <img src={lead.imgSrc} alt={lead.name} />
          </div>
          <div className="wwt-lead__body">
            <p className="wwt-lead__kicker">Founder &amp; Lead Partner</p>
            <h2 className="wwt-lead__name">{lead.name}</h2>
            <p className="wwt-lead__role">{lead.title}</p>
            <p className="wwt-lead__bio">
              A researcher, data analyst and monitoring &amp; evaluation
              consultant with nearly two decades of experience shaping
              high-impact policy and research, including working on the
              Nigeria's Economic Recovery &amp; Growth Plan. Founder of{" "}
              <a
                href="https://deafintech.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="wwt-inline-link"
              >
                Deaf-in-Tech
              </a>{" "}
              and World Economic Forum Social Intrapreneur of the Year 2023.
            </p>
            {lead.institutions && (
              <div className="wwt-lead__inst">
                {lead.institutions.map((inst) => (
                  <span key={inst}>{inst}</span>
                ))}
              </div>
            )}
            <Link to={lead.bioRoute} className="wwt-lead__link">
              Read full profile
            </Link>
          </div>
        </section>
      )}

      <div className="wwt__wrap">
        <div className="wwt-roster-head">
          <h2>The partners &amp; leadership team</h2>
        </div>
        <div className="wwt-roster">
          {rest.map((v) => (
            <Link key={v.bioRoute} to={v.bioRoute} className="wwt-ro">
              <div className="wwt-ro__photo">
                <img src={v.imgSrc} alt={v.name} />
              </div>
              <div className="wwt-ro__meta">
                <h3>{v.name}</h3>
                <p className="wwt-ro__role">{v.title}</p>
                {v.expertise && <p className="wwt-ro__exp">{v.expertise}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
