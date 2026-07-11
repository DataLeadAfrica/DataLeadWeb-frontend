import "./page.css";

// Turn a plain paragraph into React nodes, linkifying the first mention of
// "Deaf-in-Tech" (and the "Deaf in Tech" spelling) to the Deaf-in-Tech site.
function renderParagraph(text: string, key: number) {
  const re = /Deaf[-\s]in[-\s]Tech/;
  const match = text.match(re);
  if (!match) return <p key={key}>{text}</p>;
  const idx = match.index ?? 0;
  const before = text.slice(0, idx);
  const label = match[0];
  const after = text.slice(idx + label.length);
  return (
    <p key={key}>
      {before}
      <a
        href="https://deafintech.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="bio__link"
      >
        {label}
      </a>
      {after}
    </p>
  );
}

export default function Bio({
  imgSrc,
  name,
  title,
  text,
}: {
  imgSrc: string;
  name: string;
  title: string;
  text: string;
}) {
  return (
    <div className="bio">
      <div className="bio__top">
        <div className="bio__image">
          <img src={imgSrc} alt={name + " image"} />
        </div>
        <div className="bio__details">
          <p className="bio__name">{name}</p>
          <p className="bio__title">{title}</p>
        </div>
      </div>
      <div className="bio__body">
        {text.split("\n\n").map((line, index) => renderParagraph(line, index))}
      </div>
    </div>
  );
}
