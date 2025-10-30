import "./page.css";

export default function Bio({
  imgSrc,
  name,
  title,
  text,
}: {
  imgSrc: string;
  name: string;
  title: string;
  text: string;
}) {
  return (
    <div className="bio">
      <div className="bio__top">
        <div className="bio__image">
          <img src={imgSrc} alt={name + " image"} />
        </div>
        <div className="bio__details">
          <p className="bio__name">{name}</p>
          <p className="bio__title">{title}</p>
        </div>
      </div>
      <div className="bio__body">
        {text.split("\n\n").map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
    </div>
  );
}
