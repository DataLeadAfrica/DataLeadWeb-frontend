import { Link, To } from "react-router";
import "../css/blog.css";
import Card from "../components/Card";

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
  img_src,
  title,
  body,
  date,
  link,
}: {
  img_src: string;
  title: string;
  body: string;
  date: string;
  link: To;
}) {
  return (
    <Card>
      <div className="blog-post">
        <div className="blog-post__image">
          <img src={img_src} alt="" />
        </div>
        <div className="blog-post__content">
          <div className="blog-post__body">
            <h4 className="blog-post__title">{title}</h4>
            <p>{body}</p>
            <p>{date}</p>
          </div>
          <Link to={link} className="btn">
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
      <div className="look-up">
        <Card>
          <input className="search" type="text" placeholder="Search" />
        </Card>
        <Card>
          <div className="top-posts">
            <h2>Top Posts</h2>
            <ol>
              <TopPost />
              <TopPost />
              <TopPost />
            </ol>
          </div>
        </Card>
      </div>
      <div className="blog-posts">
        <BlogPost
          img_src="assets/blog/temp.svg"
          title="Lorem ipsum dolor"
          body="Lörem ipsum digital-tv bepresk, planådade, läling. Readelig ikise om eukask äsm trädmord. Makrogyv kangen. Åsygt pase. Bessade hemigybel. Tide tresamma. "
          date=""
          link={""}
        />
        <BlogPost img_src="" title="" body="" date="" link={""} />
        <BlogPost img_src="" title="" body="" date="" link={""} />
        <BlogPost img_src="" title="" body="" date="" link={""} />
        <BlogPost img_src="" title="" body="" date="" link={""} />
      </div>
    </div>
  );
}
