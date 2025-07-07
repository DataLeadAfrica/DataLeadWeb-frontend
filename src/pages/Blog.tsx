import { Link } from "react-router";
import "../css/blog.css";
import Card from "../components/Card";

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
          link="/blog/why-should-i-register-for-a-course-when-i-can-self-learn"
        />
      </div>
    </div>
  );
}
