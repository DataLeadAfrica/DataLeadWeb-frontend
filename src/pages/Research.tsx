import { Link, To } from "react-router";
import Card from "../components/Card";
import "../css/research.css";

function ResearchesPost({
  link,
  title,
  imgSrc,
}: {
  link: To;
  title: string;
  imgSrc: string;
}) {
  return (
    <Card extraClasses="post__card">
      <div className="researches__post">
        <img src={imgSrc} alt="" />
        <div className="post__text">
          <p>{title}</p>
          <Link className="btn" to={link}>
            Read
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function Research() {
  return (
    <div className="research">
      <div className="research__hero">
        <h1>
          Data-Lead Africa is at the forefront of data-driven research across
          Africa.
        </h1>
        <p>
          Our research page showcases a collection of in-depth studies, reports,
          and analyses that delve into a wide range of critical issues,
          including agriculture, food security, humanitarian assistance, and
          economic development.
        </p>
      </div>
      <div className="research__researches">
        <div className="researches__title">
          <h3>Researches</h3>
          <div className="title-bar"></div>
        </div>
        <div className="researches__content">
          <ResearchesPost
            title="USAID/NIGERIA (Dec 2020 – Jan 2021)"
            imgSrc="/assets/research/USAID.png"
            link={""}
          />
          <ResearchesPost
            title="USAID/NIGERIA (Dec 2020 – Jan 2021)"
            imgSrc="/assets/research/USAID.png"
            link={""}
          />
          <ResearchesPost
            title="USAID/NIGERIA (Dec 2020 – Jan 2021)"
            imgSrc="/assets/research/USAID.png"
            link={""}
          />
          <ResearchesPost
            title="USAID/NIGERIA (Dec 2020 – Jan 2021)"
            imgSrc="/assets/research/USAID.png"
            link={""}
          />
        </div>
      </div>
    </div>
  );
}
