import { Link } from "react-router";

import { BlogInfo } from "./router";

import "./page.css";

import image_1 from "./assets/image-1.svg";
import image_2 from "./assets/image-2.svg";
import image_3 from "./assets/image-3.svg";
import image_4 from "./assets/image-4.svg";
import image_5 from "./assets/image-5.svg";
import image_6 from "./assets/image-6.svg";
import image_7 from "./assets/image-7.svg";

const images = [image_1, image_2, image_3, image_4, image_5, image_6, image_7];

export default function Blog({ blogInfos }: { blogInfos: Array<BlogInfo> }) {
  return (
    <div className="blog">
      <div className="blog__hero">
        <h1>Data-Lead Africa Blog</h1>
        <p>
          Discover expert perspectives, practical guides, and the latest
          findings shaping the future of technology, data analysis, and
          research.
        </p>
      </div>
      <div className="blog__posts">
        {blogInfos.map((v, i) => {
          return (
            <Link className="blog__post" to={v.route}>
              <div className="post__image">
                <img
                  src={images[i < images.length ? i : i % images.length]}
                  alt=""
                />
              </div>
              <div className="post__content">
                <p className="post__title">{v.title}</p>
                <p className="post__date">{v.date}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
