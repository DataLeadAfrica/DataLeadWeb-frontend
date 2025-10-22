import { Link } from "react-router";
import "../css/blog.css";
import Card from "../components/Card";
import { routes } from "../routes";

function Post({
  imgSrc,
  title,
  summary,
  date,
  link,
}: {
  imgSrc: string;
  title: string;
  summary: string;
  date: string;
  link: string;
}) {
  return (
    <Card extraClasses="post__card">
      <div className="post">
        <img src={imgSrc} alt="" />
        <div className="post__content">
          <p className="post__title">{title}</p>
          <p className="post__summary">
            {summary}
            <span className="post__date">{date}</span>
          </p>
          <Link className="btn" to={link}>
            Read
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function Blog() {
  return (
    <div className="blog-page">
      <div className="hero">
        <h1>Stay Ahead in Tech, Data & Research</h1>
        <p>
          Discover expert perspectives, practical guides, and the latest
          findings shaping the future of technology, data analysis, and
          research.
        </p>
      </div>
      <div className="posts">
        <Post
          imgSrc="/assets/blog/temp.svg"
          title="WHY SHOULD I REGISTER FOR A COURSE WHEN I CAN SELF LEARN?"
          summary="“Get into tech, that is one of the ways to make money” I am sure you’ve heard this a..."
          date="May 2022"
          link={routes.blogWhyRegisterCourse}
        />
        <Post
          imgSrc="/assets/blog/temp.svg"
          title="TOP 7 DATA ANALYTICS SKILLS EMPLOYERS WANT IN NIGERIA (2025)"
          summary="The demand for data analysts in Nigeria has never been higher. From banks and tech startups..."
          date="September 2025"
          link={routes.blogTop7DataAnalytics}
        />
        <Post
          imgSrc="/assets/blog/temp.svg"
          title="HOW NYSC MEMBERS CAN LAUNCH A CAREER IN DATA ANALYTICS DURING SERVICE YEAR"
          summary="Every year, thousands of Nigerian graduates begin the National Youth Service Corps (NYSC)..."
          date="September 2025"
          link={routes.blogHowNYSCMembersCan}
        />
        <Post
          imgSrc="/assets/blog/temp.svg"
          title="FROM BEGINNER TO ANALYST: 12 WEEKS TO A DATA CAREER IN ABUJA"
          summary="Do you dream of working in tech but worry you don’t have the right background? The..."
          date="September 2025"
          link={routes.blogFromBeginnerToAnalyst}
        />
        <Post
          imgSrc="/assets/blog/temp.svg"
          title="EXCEL VS POWER BI VS PYTHON: WHICH TOOL SHOULD YOU LEARN FIRST?"
          summary="If you are thinking about starting a career in data analytics, you’ve probably heard..."
          date="September 2025"
          link={routes.blogExcelVsPowerBI}
        />
        <Post
          imgSrc="/assets/blog/temp.svg"
          title="SQL FOR BEGINNERS: WHY EVERY NIGERIAN GRADUATE SHOULD LEARN IT"
          summary="In today’s digital economy, data is everywhere, from your bank transactions to the..."
          date="September 2025"
          link={routes.blogSQLForBeginners}
        />
        <Post
          imgSrc="/assets/blog/temp.svg"
          title="DRIVING INCLUSION WITH DATA: WHEN QUALITY STATISTICS MEET ACCESSIBILITY"
          summary="Driving Inclusion with Data: When Quality Statistics Meet Accessibility..."
          date="September 2025"
          link={routes.blogDrivingInclusionWithData}
        />
      </div>
    </div>
  );
}
