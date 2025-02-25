import "../css/research.css";

function ResearchesPost() {
  return <div className="researches__post"></div>;
}

export default function Research() {
  return (
    <div className="research">
      <div className="research__hero">
        <div className="hero__text">
          <h1>
            Data-Lead Africa is at the forefront of data-driven research across
            Africa.
          </h1>
          <p>
            Our research page showcases a collection of in-depth studies,
            reports, and analyses that delve into a wide range of critical
            issues, including agriculture, food security, humanitarian
            assistance, and economic development. Our goal is to provide
            evidence-based insights that inform policy decisions, drive
            innovation, and improve lives across the continent.
          </p>
        </div>
        <div className="hero__image"></div>
      </div>
      <div className="research__researches">
        <div className="researches__title">
          <h3>Researches</h3>
          <div className="title-bar"></div>
        </div>
        <div className="researches__content">
          <ResearchesPost />
          <ResearchesPost />
          <ResearchesPost />
        </div>
      </div>
    </div>
  );
}
