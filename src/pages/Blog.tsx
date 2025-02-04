import { Link, To } from "react-router";
import ".././css/blog.css";

function TopPost() {
  return (
    <li>
      <Link to={""}>
        <h3>Lorem ipsum dolor</h3>
      </Link>
      <p>
        Lorem, ipsum dolor sit amet consectetur adipisicing elit. Enim quos
        atque ratione vel nisi nesciunt dicta! Cumque dolore labore possimus
        asperiores natus consequatur corporis et, suscipit, iure fugit ex
        dolores.
      </p>
      <p>Nov. 2024</p>
    </li>
  );
}

function BlogPost({
  image_src,
  title,
  body,
  link,
}: {
  image_src: string;
  title: string;
  body: string;
  link: To;
}) {
  return (
    <div className="blog-post">
      <div className="blog-post__image">
        <img src={image_src} alt="" />
      </div>
      <div className="blog-post__content">
        <div className="blog-post__body">
          <h3 className="blog-post__title">{title}</h3>
          <p>{body}</p>
        </div>
        <Link to={link} className="btn">
          Read
        </Link>
      </div>
    </div>
  );
}
export default function Blog() {
  return (
    <div className="blog-page">
      <div className="look-up">
        <input type="text" placeholder="Search" />
        <div className="top-posts">
          <h2>Top Posts</h2>
          <ol>
            <TopPost />
            <TopPost />
            <TopPost />
          </ol>
        </div>
      </div>
      <div className="blog-posts">
        <BlogPost image_src="" title="" body="" link={""} />
        <BlogPost image_src="" title="" body="" link={""} />
        <BlogPost image_src="" title="" body="" link={""} />
        <BlogPost image_src="" title="" body="" link={""} />
        <BlogPost image_src="" title="" body="" link={""} />
      </div>
    </div>
  );
}
