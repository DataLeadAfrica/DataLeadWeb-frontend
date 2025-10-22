import "../css/blog-post.css";

export default function BlogPost({
  title,
  date,
  imgSrc,
  content,
}: {
  title: string;
  date: string;
  imgSrc: string;
  content: string;
}) {
  return (
    <article className="blog-post">
      <div className="blog-post__head">
        <h1 className="blog-post__title">{title}</h1>
        {date != "" && <p className="blog-post__date">Date posted: {date}</p>}
      </div>
      <div className="blog-post__content">
        <img className="blog-post__image" src={imgSrc} alt={title + " image"} />
        <div className="blog-post__text">
          {content.split("\n\n").map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      </div>
    </article>
  );
}
