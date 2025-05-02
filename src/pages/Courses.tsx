import { Link } from "react-router";
import Card from "../components/Card";
import "../css/courses.css";

export default function Courses() {
  return (
    <div className="courses-page">
      <div className="courses__head">
        <h1>Elevate Your Career with Upcoming Courses</h1>
        <p>
          Discover a wide range of engaging courses designed to enhance your
          skills and advance your career goals.
        </p>
      </div>
      <div className="courses">
        <div className="courses__title">
          <h3>Available Courses</h3>
          <div className="title-bar"></div>
        </div>
        <div className="courses__content">
          <Card extraClasses="course__card">
            <div className="course">
              <img src="/assets/courses/data-analytics.png" alt="" />
              <div className="course__content">
                <h3>Data Analytics</h3>
                <p>
                  Master essential tools and techniques through real-world
                  projects. Start your data journey with our immersive bootcamp.
                </p>
                <Link to="/courses/data-analytics-bootcamp" className="btn">
                  Read
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
