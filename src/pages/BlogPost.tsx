import "../css/blog-post.css";

export default function BlogPost({
  title,
  author,
  date,
  content,
}: {
  title: string;
  author: string;
  date: string;
  content: string;
  imgSrc: string;
}) {
  return (
    <>
      <article className="blog-post">
        <div className="blog-post__head">
          <h1 className="blog-post__title">{title}</h1>
          {date != "" && (
            <p className="blog-post__subtitle">
              <span>{author}</span> <span>{date}</span>
            </p>
          )}
        </div>
        <div className="blog-post__content">
          <div className="blog-post__text">
            {content.split("\n\n").map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        </div>
      </article>
      <div className="blog-post__author-banner">
        <div className="blog-post__author-img">
          <img src="/assets/blog/arowolo-ayoola.png" alt="" />
        </div>
        <div className="">
          <p>Arowolo Ayoola PhD.</p>
          <p>Author</p>
        </div>
        {/*<a href="#" target="_blank">*/}
        <a href="#">
          <img src="/assets/icons/linkedin.svg" alt="" />
        </a>
      </div>
    </>
  );
}
