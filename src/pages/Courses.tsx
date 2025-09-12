import { Link } from "react-router";
import Card from "../components/Card";
import "../css/courses.css";
import { routes } from "../routes";

function CourseCard({
  imgLink,
  name,
  desc,
  link,
}: {
  imgLink: string;
  name: string;
  desc: string;
  link: string;
}) {
  return (
    <Card extraClasses="course__card">
      <div className="course">
        <img src={imgLink} alt="" />
        <div className="course__content">
          <p className="course__name">{name}</p>
          <p className="course__desc">{desc}</p>
          <Link to={link} className="btn">
            Read
          </Link>
        </div>
      </div>
    </Card>
  );
}

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
        <div className="course__cards">
          <CourseCard
            imgLink="/assets/bootcamps/data-analytics/highlight.jpg"
            name="Data Analytics"
            desc="Learn to collect, clean, analyze, and visualize data to uncover meaningful insights..."
            link={routes.coursesDataAnalytics}
          />
          <CourseCard
            imgLink="/assets/course/data-science.png"
            name="Data Science"
            desc="Our Data Science Training is a comprehensive 3-month program designed to equip..."
            link={routes.coursesDataScience}
          />
          <CourseCard
            imgLink="/assets/course/bioinformatics.png"
            name="Bioinformatics"
            desc="Our Bioinformatics Training program is tailored for students, researchers..."
            link={routes.coursesBioInformatics}
          />
          <CourseCard
            imgLink="/assets/course/hr-analytics.png"
            name="HR Analytics"
            desc="The HR Analytics is designed to empower Human Resources professionals with..."
            link={routes.coursesHrAnalytcis}
          />
          <CourseCard
            imgLink="/assets/course/business-analytics.png"
            name="Business Analytics"
            desc="Our Business Analytics bootcamp is designed for professionals, entrepreneurs..."
            link={routes.coursesBusinessAnalytics}
          />
          <CourseCard
            imgLink="/assets/course/research.png"
            name="Research Methodology and Manuscript Writing"
            desc="This intensive program is designed to equip you with essential skills in research..."
            link={routes.coursesResearch}
          />
          <CourseCard
            imgLink="/assets/course/employability.png"
            name="Employability & Entrepreneurship"
            desc="The Employability and Entrepreneurship Training at Data-Lead Africa is designed to..."
            link={routes.coursesEmployability}
          />
          <CourseCard
            imgLink="/assets/course/digital-creation.png"
            name="Digital Creation"
            desc="Unleash your creativity in this hands-on bootcamp designed especially for teens! Whet..."
            link={routes.coursesDigitalCreation}
          />
        </div>
      </div>
    </div>
  );
}
