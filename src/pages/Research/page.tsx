import { Link } from "react-router";

import "./page.css";

import { ResearchInfo } from "./router";

export default function Research({
  researchInfos,
}: {
  researchInfos: Array<ResearchInfo>;
}) {
  return (
    <div className="research">
      <div className="research__hero">
        <h1>Research and Publications </h1>
        <p>
          Our research page showcases a collection of in-depth studies, reports,
          and analyses that investigate into a wide range of critical issues
        </p>
      </div>
      <div className="research__posts">
        {researchInfos.map((v) => {
          return (
            <Link className="research__post" to={v.link}>
              <div className="post__img">
                <img src={v.imgSrc} alt="" />
              </div>
              <p>{v.title}</p>
              <p className="post__timeline">{v.timeline}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
