import { ReactElement } from "react";
import "./page.css";

export default function ResearchPost({
  imgSrc,
  title,
  timeline,
  content,
}: {
  imgSrc: string;
  title: string;
  timeline: string;
  content: () => ReactElement;
}) {
  return (
    <div className="research-post">
      <h1>{title}</h1>
      <p className="research-post__timeline">{timeline}</p>
      <div className="research-post__img">
        <img src={imgSrc} alt="" />
      </div>
      <div className="research-post__content">{content()}</div>
    </div>
  );
}
