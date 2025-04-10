import { Link } from "react-router";
import "../css/blog.css";
import Card from "../components/Card";

function Post() {
  return (
    <Card extraClasses="post__card">
      <div className="post">
        <img src="/assets/blog/temp.svg" alt="" />
        <div className="post__content">
          <p className="post__title">Lorem ipsum dolor</p>
          <p className="post__summary">
            Lorem ipsum dolor, sit amet consectetur adipisicing elit. Quas
            dolorum magnam velit consequuntur, recusandae, impedit architecto
            porro quod doloremque mollitia ut praesentium vel nulla pariatur.
            Tempore numquam explicabo facere aliquid?
            <p className="post__date">Jun 2025</p>
          </p>
          <Link className="btn" to="">
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
      <div className="posts__wrapper">
        <Card extraClasses="search__card">
          <input type="text" className="search" placeholder="Search..." />
        </Card>
        <div className="posts">
          <Post />
          <Post />
          <Post />
          <Post />
          <Post />
          <Post />
          <Post />
        </div>
      </div>
    </div>
  );
}
