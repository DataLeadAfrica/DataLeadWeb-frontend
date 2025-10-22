import { Link, To } from "react-router";
import Card from "../components/Card";
import "../css/researches.css";
import { routes } from "../routes";

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
            title="ACCOUNTABILITY PILOT SURVEY IN BORNO STATE"
            imgSrc="/assets/researches/NJR.png"
            link={routes.researchNigeriaJointResponse}
          />
          <ResearchesPost
            title="NORTHERN EDUCATION INITIATIVE PLUS (NEI+)"
            imgSrc="/assets/researches/USAID.png"
            link={routes.researchUsaidNigeria}
          />
          <ResearchesPost
            title="HUMANITARIAN ASSISTANCE, LIVELIHOOD, FOOD SECURITY"
            imgSrc="/assets/researches/Mercy-corps.png"
            link={routes.researchMercyCorps}
          />
          <ResearchesPost
            title="PROMOTION OF MARKET-ORIENTED AGRICULTURAL EXTENSION SYSTEM FOR LIVELIHOOD IMPROVEMENT IN NIGERIA (SHEP NIGERIA)"
            imgSrc="/assets/researches/JICA.jpg"
            link={routes.researchJapanInternational}
          />
          <ResearchesPost
            title="USAID Agribusiness Investment Midterm Performance Evaluation"
            imgSrc="/assets/researches/social-impact-usaid.jpg"
            link={routes.researchSocialImpactUsaid}
          />
          <ResearchesPost
            title="FINAL ASSESSMENT REPORT USAID/NIGERIA VIOLENCE AND CONFLICT ASSESSMENT (VCA)"
            imgSrc="/assets/researches/nigeria-violence-usaid.png"
            link={routes.researchNigeriaViolenceUsaid}
          />
          <ResearchesPost
            title="DEVELOPMENT OF BUSINESS CASE FOR REUSABLE MENSTRUAL PRODUCTS"
            imgSrc="/assets/researches/water-aid.png"
            link={routes.researchDevelopmentOfBusiness}
          />
        </div>
      </div>
    </div>
  );
}
