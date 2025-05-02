import { Link, To } from "react-router";
import Card from "../components/Card";
import "../css/researches.css";

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

export default function Researches() {
  return (
    <div className="researches">
      <div className="researches__hero">
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
      <div className="researches__posts">
        <div className="posts__title">
          <h3>Researches</h3>
          <div className="title-bar"></div>
        </div>
        <div className="posts__content">
          <ResearchesPost
            title="USAID/NIGERIA (Dec 2020 – Jan 2021)"
            imgSrc="/assets/researches/USAID.png"
            link={"/research/usaid-nigeria-dec-2020-jan-2021"}
          />
        </div>
      </div>
    </div>
  );
}
