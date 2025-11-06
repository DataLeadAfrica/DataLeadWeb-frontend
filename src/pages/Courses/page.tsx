import { Link } from "react-router";

import "./page.css";

import { CourseInfo } from "./router";

export default function Courses({
  courseInfos,
}: {
  courseInfos: Array<CourseInfo>;
}) {
  return (
    <div className="courses">
      <div className="courses__head">
        <h1>Elevate Your Career with Upcoming Courses</h1>
        <p>
          Discover a wide range of engaging courses designed to enhance your
          skills and advance your career goals.
        </p>
      </div>
      <div className="courses__cards">
        {courseInfos.map((v) => {
          return (
            <Link to={v.link} className="courses__card">
              <div className="card__img">
                <img src={v.imgSrc} alt="" />
              </div>
              <p className="card__name">{v.name}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
