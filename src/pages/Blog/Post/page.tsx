import { ReactElement } from "react";
import "./page.css";

export default function BlogPost({
  title,
  author,
  authorImgSrc,
  date,
  children,
}: {
  title: string;
  author: string;
  authorImgSrc: string;
  date: string;
  children: ReactElement;
}) {
  return (
    <article className="blog-post">
      <div className="blog-post__head">
        <h1 className="blog-post__title">{title}</h1>
        <div className="blog-post__details">
          <p className="blog-post__author">{author}</p>
          <p className="blog-post__date">{date}</p>
        </div>
      </div>
      <div className="blog-post__content">{children}</div>
      <div className="blog-post__author-banner">
        <div className="author-banner__img">
          <img src={authorImgSrc} alt="" />
        </div>
        <div>
          <p className="author-banner__name">{author}</p>
          <p>Author</p>
        </div>
        {/*<a href="#" target="_blank">*/}
        <a href="#">
          <i className="nf nf-dev-linkedin"></i>
        </a>
      </div>
    </article>
  );
}
