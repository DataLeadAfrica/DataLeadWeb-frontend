import { Link } from "react-router";

import "./page.css";
import Seo from "../../../components/Seo/component";

type BioProps = {
  imgSrc: string;
  name: string;
  title: string;
  text: string;
  bioRoute?: string;
  quote?: string;
  focus?: string;
  education?: string;
  recognition?: string;
  languages?: string;
  boards?: string;
  linkedin?: string;
  x?: string;
  instagram?: string;
  facebook?: string;
  knowsAbout?: string[];
  areaServed?: string;
  noindex?: boolean;
};

// Linkify known links inside the bio prose: Deaf-in-Tech and mothers2mothers.
function renderParagraph(text: string, key: number) {
  const patterns: { re: RegExp; href: string }[] = [
    { re: /Deaf[-\s]in[-\s]Tech/, href: "https://deafintech.org/" },
    { re: /mothers2mothers(?:\s*\(M2M\))?/, href: "https://m2m.org/" },
  ];
  // find the earliest match among patterns
  let best: { idx: number; label: string; href: string } | null = null;
  for (const p of patterns) {
    const m = text.match(p.re);
    if (m && m.index !== undefined) {
      if (!best || m.index < best.idx)
        best = { idx: m.index, label: m[0], href: p.href };
    }
  }
  if (!best) return <p key={key}>{text}</p>;
  const before = text.slice(0, best.idx);
  const after = text.slice(best.idx + best.label.length);
  return (
    <p key={key}>
      {before}
      <a
        href={best.href}
        target="_blank"
        rel="noopener noreferrer"
        className="bio__link"
      >
        {best.label}
      </a>
      {after}
    </p>
  );
}

export default function Bio(props: BioProps) {
  const {
    imgSrc,
    name,
    title,
    text,
    quote,
    focus,
    education,
    recognition,
    languages,
    boards,
    linkedin,
    x,
    instagram,
    facebook,
    knowsAbout,
    areaServed,
    noindex,
  } = props;

  const facts: { label: string; value?: string }[] = [
    { label: "Focus", value: focus },
    { label: "Education", value: education },
    { label: "Recognition", value: recognition },
    { label: "Boards", value: boards },
    { label: "Languages", value: languages },
  ].filter((f) => f.value && f.value.trim().length > 0);

  // Build a rich Person profile for search engines and AI assistants.
  const person: Record<string, unknown> = {
    "@type": "Person",
    name: name,
    jobTitle: title,
    worksFor: {
      "@type": "Organization",
      name: "Data-Lead Africa",
      url: "https://dataleadafrica.com",
    },
    image: "https://dataleadafrica.com" + imgSrc,
    url: "https://dataleadafrica.com" + (props.bioRoute || ""),
  };
  if (quote) person.description = quote;
  if (languages) {
    // Include the primary languages and any "working" languages listed after ";"
    person.knowsLanguage = languages
      .replace(/;/g, ",")
      .replace(/working /gi, "")
      .replace(/ & /g, ", ")
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
  }
  if (knowsAbout && knowsAbout.length) person.knowsAbout = knowsAbout;
  if (areaServed) person.areaServed = areaServed;
  if (education) person.alumniOf = education;
  if (recognition) person.award = recognition;
  if (boards) {
    person.memberOf = boards.split(",").map((b) => ({
      "@type": "Organization",
      name: b.trim(),
    }));
  }
  const sameAs: string[] = [];
  if (linkedin) sameAs.push(linkedin);
  if (x) sameAs.push(x);
  if (instagram) sameAs.push(instagram);
  if (facebook) sameAs.push(facebook);
  if (sameAs.length) person.sameAs = sameAs;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: person,
  };

  return (
    <div className="bio">
      <Seo
        title={name + " | Data-Lead Africa"}
        description={
          name +
          ", " +
          title +
          " at Data-Lead Africa. " +
          (quote || "")
        }
        jsonLd={jsonLd}
        noindex={noindex}
      />

      <div className="bio__crumb">
        <Link to="/our-team">&larr; Back to team</Link>
      </div>

      <div className="bio__grid">
        <aside className="bio__side">
          <div className="bio__photo">
            <img src={imgSrc} alt={name} />
          </div>
          <h1 className="bio__name">{name}</h1>
          <p className="bio__role">{title}</p>

          {facts.length > 0 && (
            <div className="bio__facts">
              {facts.map((f) => (
                <div className="bio__fact" key={f.label}>
                  <b>{f.label}</b>
                  {f.value}
                </div>
              ))}
            </div>
          )}

          {(linkedin || x || instagram || facebook) && (
            <div className="bio__socials">
              {linkedin && (
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                >
                  in
                </a>
              )}
              {x && (
                <a
                  href={x}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X"
                >
                  X
                </a>
              )}
              {instagram && (
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                >
                  IG
                </a>
              )}
              {facebook && (
                <a
                  href={facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                >
                  f
                </a>
              )}
            </div>
          )}
        </aside>

        <div className="bio__main">
          <p className="bio__kicker">Profile</p>
          {quote && <p className="bio__lead">{quote}</p>}
          <div className="bio__body">
            {text
              .split("\n\n")
              .map((line, index) => renderParagraph(line, index))}
          </div>
        </div>
      </div>
    </div>
  );
}
